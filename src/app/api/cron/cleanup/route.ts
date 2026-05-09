import { and, isNotNull, lt, or, sql } from "drizzle-orm";
import { NextResponse } from "next/server";

import { getDb } from "@/db";
import { otpCodes, rateLimitBuckets, sessions } from "@/db/schema";
import { log } from "@/lib/log";
import { withRequestContext } from "@/lib/log-context";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Housekeeping endpoint. Intended to be called every ~15 minutes by an
 * external cron (systemd timer, PM2 cron, container orchestrator, GitHub
 * Actions, cron-job.org, etc.) with:
 *
 *   Authorization: Bearer <CRON_SECRET>
 *
 * Both POST and GET are accepted because some cron providers only emit GET.
 *
 * Concurrency:
 *   A `pg_try_advisory_lock` guards the body so overlapping invocations
 *   (cron retries, multi-region pings) exit cleanly with `skipped: true`
 *   instead of doing duplicate DELETEs and burning IO.
 */

// Stable, arbitrary 64-bit identifier for the advisory lock namespace.
// Hard-coded — never recomputed at runtime. Sent as a bigint to Postgres
// because `pg_advisory_lock` expects an int8.
const CLEANUP_LOCK_KEY = BigInt("7427301519462395");

async function handle(request: Request) {
  return withRequestContext(
    {
      requestId: request.headers.get("x-request-id") ?? undefined,
      route: "cron.cleanup",
    },
    () => runCleanup(request),
  );
}

async function runCleanup(request: Request) {
  const startedAt = Date.now();
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    // Fail closed when the secret is missing so a misconfigured deployment
    // doesn't leave this route callable by anyone.
    return NextResponse.json({ error: "cron_disabled" }, { status: 503 });
  }

  const header = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  if (!timingSafeEqual(header, expected)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  log.info("cron.cleanup.start");
  const db = getDb();

  const lockRows = await db.execute<{ locked: boolean }>(
    sql`select pg_try_advisory_lock(${CLEANUP_LOCK_KEY}) as locked`,
  );
  const locked = Boolean(
    (lockRows as unknown as Array<{ locked: boolean }>)[0]?.locked,
  );
  if (!locked) {
    log.info("cron.cleanup.skipped", {
      reason: "lock_held",
      durationMs: Date.now() - startedAt,
    });
    return NextResponse.json({ ok: true, skipped: true });
  }

  try {
    const deletedOtps = await db
      .delete(otpCodes)
      .where(
        or(
          // 1-day grace beyond the 3-minute OTP TTL: lets any in-flight
          // verification complete before the row is garbage-collected.
          lt(otpCodes.expiresAt, sql`now() - interval '1 day'`),
          and(
            isNotNull(otpCodes.consumedAt),
            lt(otpCodes.consumedAt, sql`now() - interval '1 day'`),
          ),
        ),
      )
      .returning({ id: otpCodes.id });

    const deletedSessions = await db
      .delete(sessions)
      .where(
        or(
          lt(sessions.expiresAt, new Date()),
          and(
            isNotNull(sessions.revokedAt),
            lt(sessions.revokedAt, sql`now() - interval '7 days'`),
          ),
        ),
      )
      .returning({ id: sessions.id });

    const deletedBuckets = await db
      .delete(rateLimitBuckets)
      .where(lt(rateLimitBuckets.windowStart, sql`now() - interval '2 days'`))
      .returning({ key: rateLimitBuckets.key });

    const summary = {
      otps: deletedOtps.length,
      sessions: deletedSessions.length,
      rateLimitBuckets: deletedBuckets.length,
    };

    log.info("cron.cleanup.ok", {
      ...summary,
      durationMs: Date.now() - startedAt,
    });
    return NextResponse.json({ ok: true, ...summary });
  } finally {
    await db.execute(sql`select pg_advisory_unlock(${CLEANUP_LOCK_KEY})`);
  }
}

export async function POST(request: Request) {
  return handle(request);
}

export async function GET(request: Request) {
  return handle(request);
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}
