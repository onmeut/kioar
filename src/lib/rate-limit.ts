import "server-only";

import { sql } from "drizzle-orm";

import { getDb } from "@/db";
import { rateLimitBuckets } from "@/db/schema";
import { log } from "@/lib/log";
import { getRedis } from "@/lib/redis";

/**
 * Rate limiter for server actions, route handlers, and middleware-level
 * server functions. Public API is intentionally a single function so call
 * sites stay backend-agnostic.
 *
 * Drivers:
 *   1. **Redis** (production): single round-trip atomic INCR + PEXPIRE. No
 *      Postgres write per request. Required when `NODE_ENV=production` —
 *      see `src/lib/redis.ts`.
 *   2. **Postgres** (dev/test fallback): single-roundtrip UPSERT into
 *      `rate_limit_buckets`. Used only when `REDIS_URL` is unset outside
 *      of production, or as a transient fallback if Redis is momentarily
 *      unreachable.
 *
 * In-process deny cache:
 *   Once a key has been denied within a window, additional checks for that
 *   same (key, window) short-circuit in memory until the window rolls over.
 *   This collapses flood traffic to ~zero backend writes per node without
 *   ever under-counting (the cache is only populated *after* the backend
 *   has already returned `count > limit`).
 *
 * Why fixed-window: single-roundtrip INCR/UPSERT, tiny storage, simple
 * semantics. The known burst-at-boundary edge case is acceptable for
 * OTP/SMS endpoints because the dominant cost (SMS) is already capped
 * per-phone.
 */
export type RateLimitResult = {
  allowed: boolean;
  count: number;
  limit: number;
  remaining: number;
  resetAt: Date;
};

// ---------- in-process deny cache --------------------------------------------

type DenyEntry = { resetAt: number; count: number; limit: number };
const denyCache = new Map<string, DenyEntry>();
const DENY_CACHE_MAX = 10_000;

function denyCacheKey(key: string, windowStartMs: number): string {
  return `${key}@${windowStartMs}`;
}

function checkDenyCache(
  key: string,
  windowStartMs: number,
): RateLimitResult | null {
  const entry = denyCache.get(denyCacheKey(key, windowStartMs));
  if (!entry) return null;
  if (Date.now() >= entry.resetAt) {
    denyCache.delete(denyCacheKey(key, windowStartMs));
    return null;
  }
  return {
    allowed: false,
    count: entry.count,
    limit: entry.limit,
    remaining: 0,
    resetAt: new Date(entry.resetAt),
  };
}

function rememberDeny(
  key: string,
  windowStartMs: number,
  result: RateLimitResult,
) {
  if (denyCache.size >= DENY_CACHE_MAX) {
    // Coarse eviction: drop the oldest 10% by iteration order (Map is FIFO).
    const dropCount = Math.ceil(DENY_CACHE_MAX / 10);
    let dropped = 0;
    for (const k of denyCache.keys()) {
      denyCache.delete(k);
      if (++dropped >= dropCount) break;
    }
  }
  denyCache.set(denyCacheKey(key, windowStartMs), {
    resetAt: result.resetAt.getTime(),
    count: result.count,
    limit: result.limit,
  });
}

// ---------- Redis driver -----------------------------------------------------

async function redisIncrement(
  key: string,
  windowStartMs: number,
  windowMs: number,
): Promise<number | null> {
  const client = getRedis();
  if (!client) return null;
  const redisKey = `rl:${key}:${windowStartMs}`;
  try {
    // Pipelined INCR + PEXPIRE: one round-trip, atomic enough for our needs.
    // PEXPIRE is set on every increment, which is harmless (it only refreshes
    // the TTL within the same window) and saves a SETNX/EXISTS check.
    const results = await client
      .multi()
      .incr(redisKey)
      .pexpire(redisKey, windowMs + 5_000)
      .exec();
    const first = results?.[0];
    if (!first) throw new Error("redis: empty exec");
    const [err, value] = first;
    if (err) throw err;
    return Number(value);
  } catch (err) {
    log.warn("rate-limit.redis.incr_failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

// ---------- Postgres driver (fallback) ---------------------------------------

async function postgresIncrement(
  key: string,
  windowStart: Date,
): Promise<number> {
  const db = getDb();
  const rows = await db
    .insert(rateLimitBuckets)
    .values({ key, windowStart, count: 1 })
    .onConflictDoUpdate({
      target: [rateLimitBuckets.key, rateLimitBuckets.windowStart],
      set: { count: sql`${rateLimitBuckets.count} + 1` },
    })
    .returning({ count: rateLimitBuckets.count });
  return rows[0]?.count ?? 1;
}

// ---------- public API -------------------------------------------------------

export async function checkRateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  if (limit <= 0 || windowSeconds <= 0) {
    throw new Error("rate-limit: limit and windowSeconds must be positive");
  }

  const now = Date.now();
  const windowMs = windowSeconds * 1000;
  const windowStartMs = Math.floor(now / windowMs) * windowMs;
  const windowStart = new Date(windowStartMs);
  const resetAt = new Date(windowStartMs + windowMs);

  const cached = checkDenyCache(key, windowStartMs);
  if (cached) return cached;

  let count = await redisIncrement(key, windowStartMs, windowMs);
  if (count === null) {
    count = await postgresIncrement(key, windowStart);
  }

  const allowed = count <= limit;
  const remaining = Math.max(0, limit - count);
  const result: RateLimitResult = { allowed, count, limit, remaining, resetAt };

  if (!allowed) rememberDeny(key, windowStartMs, result);
  return result;
}
