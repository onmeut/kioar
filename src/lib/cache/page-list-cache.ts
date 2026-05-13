import "server-only";

import { log } from "@/lib/log";
import { getRedis } from "@/lib/redis";

/**
 * Redis read-through caches for the two high-traffic public listing pages:
 *
 *   /events  — `withEventsCache` / `invalidateEventsCache`
 *   /discover — `withDiscoverCache` / `invalidateDiscoverCache`
 *
 * Design mirrors the profile cache in ./profile-cache.ts:
 *   - Fail-open: any Redis error falls through to the loader.
 *   - Date revival: ISO 8601 UTC strings are revived to Date objects so
 *     callers see the same shape as a fresh DB query.
 *   - No stampede protection (traffic volumes don't warrant it).
 *
 * Discover uses a **version-stamped key** rather than direct invalidation:
 *   `kioar:discover:v1:version` is an integer INCR'd on any write that
 *   affects the directory (profile mutations, new pages, category changes).
 *   Cache data keys embed this version so a bump instantly orphans all
 *   prior entries — they expire quietly on their own TTL.
 *   Free-text search results (q != "") are never cached — unbounded
 *   key cardinality.
 */

// ─── Shared helpers ──────────────────────────────────────────────────────────

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;

function dateReviver(_key: string, value: unknown): unknown {
  if (typeof value === "string" && ISO_DATE_RE.test(value)) {
    return new Date(value);
  }
  return value;
}

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

// ─── Events ──────────────────────────────────────────────────────────────────

const EVENTS_KEY = "kioar:events:v1:published";
const EVENTS_TTL_SECONDS = 60;

/**
 * Read-through cache wrapper for `getPublishedEvents()`.
 * TTL: 60 s. Invalidated explicitly by any admin event mutation that
 * changes published status, creates, or deletes an event.
 */
export async function withEventsCache<T>(loader: () => Promise<T>): Promise<T> {
  const redis = getRedis();

  if (redis) {
    try {
      const cached = await redis.get(EVENTS_KEY);
      if (cached !== null) {
        log.debug("events_cache.hit");
        return JSON.parse(cached, dateReviver) as T;
      }
    } catch (err) {
      log.warn("events_cache.read_error", { error: errMsg(err) });
    }
  }

  log.debug("events_cache.miss");
  const fresh = await loader();

  if (redis) {
    try {
      await redis.set(
        EVENTS_KEY,
        JSON.stringify(fresh),
        "EX",
        EVENTS_TTL_SECONDS,
      );
    } catch (err) {
      log.warn("events_cache.write_error", { error: errMsg(err) });
    }
  }

  return fresh;
}

/**
 * Drop the events cache entry. Call after any write that changes the
 * set of published events (create, delete, status change).
 */
export async function invalidateEventsCache(): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  try {
    await redis.del(EVENTS_KEY);
  } catch (err) {
    log.warn("events_cache.invalidate_error", { error: errMsg(err) });
  }
}

// ─── Discover ────────────────────────────────────────────────────────────────

const DISCOVER_VERSION_KEY = "kioar:discover:v1:version";
const DISCOVER_DATA_PREFIX = "kioar:discover:v1:data:";
/**
 * TTL on data keys.  When the version is bumped the old keys become
 * unreachable — they expire on their own within DISCOVER_TTL_SECONDS.
 */
const DISCOVER_TTL_SECONDS = 120;

export interface DiscoverCacheParams {
  /** "all" | "personal" | "business" */
  type: string;
  /** Raw URL param value for category, or null if absent. */
  categoryRaw: string | null;
  /** "newest" | "popular" */
  sort: string;
  /** 1-based page number. */
  page: number;
  /**
   * Free-text search query. When non-empty, caching is skipped entirely
   * to avoid unbounded key cardinality.
   */
  q: string;
}

function discoverDataKey(version: string, p: DiscoverCacheParams): string {
  const cat = p.categoryRaw ?? "_";
  return `${DISCOVER_DATA_PREFIX}${version}:${p.type}:${cat}:${p.sort}:${p.page}`;
}

/**
 * Read-through cache wrapper for the discover page data loader.
 *
 * Skips caching when `params.q` is non-empty (free-text search).
 * On any Redis error the loader runs directly — fail-open.
 *
 * Invalidation is via `invalidateDiscoverCache()` which INCRs the version
 * key, orphaning all current data entries without needing to SCAN/DEL.
 */
export async function withDiscoverCache<T>(
  params: DiscoverCacheParams,
  loader: () => Promise<T>,
): Promise<T> {
  // Never cache search results.
  if (params.q.length > 0) return loader();

  const redis = getRedis();
  if (!redis) return loader();

  try {
    const version = (await redis.get(DISCOVER_VERSION_KEY)) ?? "0";
    const key = discoverDataKey(version, params);

    const cached = await redis.get(key);
    if (cached !== null) {
      log.debug("discover_cache.hit", { key });
      return JSON.parse(cached, dateReviver) as T;
    }

    log.debug("discover_cache.miss", { key });
    const fresh = await loader();
    await redis.set(key, JSON.stringify(fresh), "EX", DISCOVER_TTL_SECONDS);
    return fresh;
  } catch (err) {
    log.warn("discover_cache.error", { error: errMsg(err) });
    return loader();
  }
}

/**
 * Bump the discover version counter, orphaning all cached entries.
 * O(1) — no SCAN or DEL of data keys.
 *
 * Call after any write that changes the discover directory:
 *   - Profile name / avatar updates (`saveProfileDetailsForUser`)
 *   - Page settings mutations that touch discoverEnabled / discoverCategory
 *     (`savePageSettingsForUser`)
 *   - New page creation (`createPageForOwner`)
 */
export async function invalidateDiscoverCache(): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  try {
    await redis.incr(DISCOVER_VERSION_KEY);
  } catch (err) {
    log.warn("discover_cache.invalidate_error", { error: errMsg(err) });
  }
}
