import { and, isNotNull, lt, or, sql } from "drizzle-orm";
import { NextResponse } from "next/server";

import { getDb } from "@/db";
import { otpCodes, rateLimitBuckets, sessions } from "@/db/schema";
import { log } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Housekeeping endpoint. Intended to be called every ~15 minutes by an
 * external cron (systemd timer / PM2 cron / container orchestrator) with:
 *
 *   Authorization: Bearer <CRON_SECRET>
 *
 * We avoid a shared database cleanup job running on boot because multiple
 * app instances would race; a single cron ping is simpler and deterministic.
 */
export async function POST(request: Request) {
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

  const db = getDb();
  const deletedOtps = await db
    .delete(otpCodes)
    .where(
      or(
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

  log.info("cron.cleanup", summary);
  return NextResponse.json({ ok: true, ...summary });
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}
