import "server-only";

import { eq } from "drizzle-orm";

import { getDb } from "@/db";
import { profiles } from "@/db/schema";
import { log } from "@/lib/log";
import { getRedis } from "@/lib/redis";

/**
 * Phase 2 — Public profile read-through cache.
 *
 * The public profile page (`/[slug]`) is read-heavy and not personalized.
 * Its expensive part — the multi-table fetch in `getPublicProfileBySlug`
 * — is wrapped here behind a Redis read-through cache. Mutation paths
 * MUST call one of the `invalidate*` helpers AFTER the DB transaction
 * commits so the next read repopulates the cache.
 *
 * Design rules (see CLAUDE.md):
 *   - Cache key includes a version segment (`v1`) so a future schema
 *     change can bust every entry by bumping it without a manual flush.
 *   - Hit TTL: 300s. Miss TTL (null sentinel): 60s. Misses are kept
 *     short because new pages are common; hits are kept long because
 *     mutations explicitly invalidate.
 *   - **Fail-open**. Any Redis error (down, timeout, parse) drops to the
 *     loader. The page must keep rendering even if Redis is unreachable.
 *   - **No stampede protection**. A 5-min TTL on a cold key means that a
 *     burst on a never-cached slug can hit the DB N times in parallel.
 *     This is acceptable; pages aren't hot enough to warrant a lock.
 *   - Metrics are fire-and-forget INCRs on `kioar:metrics:profile_cache:*`
 *     so an operator can scrape the keys and graph hit-ratio over time.
 *
 * Serialization:
 *   - Postgres `timestamptz` values come through Drizzle as `Date`. We
 *     `JSON.stringify` (which calls `Date.toJSON` → ISO 8601 with `Z`)
 *     and revive ISO strings back into `Date` on read so callers see
 *     the same shape they would have got from a fresh DB query. The
 *     ISO regex is tight enough that other string fields (slugs, urls)
 *     never accidentally hydrate as Dates.
 */

const KEY_PREFIX = "kioar:page:v1:";
const METRICS_PREFIX = "kioar:metrics:profile_cache:";

const TTL_HIT_SECONDS = 300;
const TTL_MISS_SECONDS = 60;

const NOT_FOUND_SENTINEL = '{"__kioarNotFound":true}';

function cacheKeyFor(slug: string): string {
  return KEY_PREFIX + slug;
}

function bumpMetric(name: "hit" | "miss" | "not_found_hit" | "error"): void {
  const redis = getRedis();
  if (!redis) return;
  // Fire-and-forget; never block the request path on metrics.
  redis.incr(METRICS_PREFIX + name).catch(() => undefined);
}

const ISO_DATE_RE =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;

function dateReviver(_key: string, value: unknown): unknown {
  if (typeof value === "string" && ISO_DATE_RE.test(value)) {
    return new Date(value);
  }
  return value;
}

function isNotFoundEnvelope(parsed: unknown): boolean {
  return (
    parsed !== null &&
    typeof parsed === "object" &&
    "__kioarNotFound" in (parsed as Record<string, unknown>)
  );
}

/**
 * Read-through cache wrapper around an arbitrary loader keyed by slug.
 * Returns whatever the loader returns; the loader's `null` is itself
 * cached as a short-TTL sentinel so 404 floods don't hammer the DB.
 *
 * If Redis is unavailable (dev without REDIS_URL, or a transient
 * production outage), this transparently falls through to the loader
 * without caching either side — the route still works, just slower.
 */
export async function withProfileCache<T>(
  slug: string,
  loader: () => Promise<T | null>,
): Promise<T | null> {
  const redis = getRedis();
  const key = cacheKeyFor(slug);

  if (redis) {
    try {
      const cached = await redis.get(key);
      if (cached !== null) {
        const parsed = JSON.parse(cached, dateReviver) as unknown;
        if (isNotFoundEnvelope(parsed)) {
          bumpMetric("not_found_hit");
          log.debug("profile_cache.not_found_hit", { slug });
          return null;
        }
        bumpMetric("hit");
        log.debug("profile_cache.hit", { slug });
        return parsed as T;
      }
    } catch (err) {
      // Cache read failed — log once and fall through to the loader.
      log.warn("profile_cache.read_error", {
        slug,
        error: err instanceof Error ? err.message : String(err),
      });
      bumpMetric("error");
    }
  }

  bumpMetric("miss");
  log.debug("profile_cache.miss", { slug });
  const fresh = await loader();

  if (redis) {
    try {
      if (fresh === null) {
        await redis.set(key, NOT_FOUND_SENTINEL, "EX", TTL_MISS_SECONDS);
      } else {
        await redis.set(key, JSON.stringify(fresh), "EX", TTL_HIT_SECONDS);
      }
    } catch (err) {
      // Cache write failed — log and continue. The fresh value is still
      // returned to the caller, only the next request loses the cache.
      log.warn("profile_cache.write_error", {
        slug,
        error: err instanceof Error ? err.message : String(err),
      });
      bumpMetric("error");
    }
  }

  return fresh;
}

/**
 * Drop the cache entry for `slug`. Safe to call even when Redis is
 * unavailable. Failures are logged and swallowed because invalidation
 * is best-effort: a stale entry expires in at most `TTL_HIT_SECONDS`.
 */
export async function invalidateProfileCacheBySlug(
  slug: string,
): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  try {
    await redis.del(cacheKeyFor(slug));
  } catch (err) {
    log.warn("profile_cache.invalidate_error", {
      slug,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Drop the cache entry for the page identified by `pageId`. Looks up
 * the slug first because the cache is keyed by slug (which is what the
 * public route receives). Use this from contexts where only the page
 * id is in scope — billing, admin actions, cron transitions, referrals.
 *
 * No-op when the page doesn't exist (already deleted).
 */
export async function invalidateProfileCacheById(
  pageId: string,
): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  try {
    const db = getDb();
    const row = await db.query.profiles.findFirst({
      where: eq(profiles.id, pageId),
      columns: { slug: true },
    });
    if (!row) return;
    await redis.del(cacheKeyFor(row.slug));
  } catch (err) {
    log.warn("profile_cache.invalidate_by_id_error", {
      pageId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Invalidate both the old and the new slug after a slug rename. Both
 * keys are dropped in parallel so a poorly-timed visit to either url
 * is guaranteed fresh. The caller is responsible for passing the slugs
 * BEFORE and AFTER the DB write so neither stale entry survives.
 */
export async function invalidateProfileCacheOnSlugChange(
  oldSlug: string,
  newSlug: string,
): Promise<void> {
  if (oldSlug === newSlug) {
    await invalidateProfileCacheBySlug(oldSlug);
    return;
  }
  await Promise.all([
    invalidateProfileCacheBySlug(oldSlug),
    invalidateProfileCacheBySlug(newSlug),
  ]);
}
