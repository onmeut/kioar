import "server-only";

import { sql } from "drizzle-orm";

import { getDb } from "@/db";
import { rateLimitBuckets } from "@/db/schema";

/**
 * Fixed-window rate limiter backed by Postgres. Safe to call from server
 * actions, route handlers, or middleware-level server functions.
 *
 * Why fixed-window and not sliding / leaky-bucket: we want a single
 * round-trip UPSERT and low storage. Fixed-window has a known edge-case
 * (bursting at window boundaries) which is acceptable for anti-abuse on
 * OTP/SMS endpoints because the dominant cost is SMS, which is already
 * per-phone capped.
 *
 * Cleanup: old rows are removed by the cron cleanup route.
 */
export type RateLimitResult = {
  allowed: boolean;
  count: number;
  limit: number;
  remaining: number;
  resetAt: Date;
};

export async function checkRateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  if (limit <= 0 || windowSeconds <= 0) {
    throw new Error("rate-limit: limit and windowSeconds must be positive");
  }

  const db = getDb();
  const now = Date.now();
  const windowMs = windowSeconds * 1000;
  const windowStart = new Date(Math.floor(now / windowMs) * windowMs);
  const resetAt = new Date(windowStart.getTime() + windowMs);

  // Atomic increment: insert the row at count=1, or bump existing by 1.
  // Returning the post-increment count lets us decide allow/deny in a single
  // round-trip.
  const rows = await db
    .insert(rateLimitBuckets)
    .values({ key, windowStart, count: 1 })
    .onConflictDoUpdate({
      target: [rateLimitBuckets.key, rateLimitBuckets.windowStart],
      set: { count: sql`${rateLimitBuckets.count} + 1` },
    })
    .returning({ count: rateLimitBuckets.count });

  const count = rows[0]?.count ?? 1;
  const allowed = count <= limit;
  const remaining = Math.max(0, limit - count);

  return { allowed, count, limit, remaining, resetAt };
}
