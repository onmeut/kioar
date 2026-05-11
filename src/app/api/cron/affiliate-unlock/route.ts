import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";

import { getDb } from "@/db";
import { unlockMaturedCommissions } from "@/lib/affiliate";
import { safeCompareStrings } from "@/lib/cron-auth";
import { log } from "@/lib/log";
import { withRequestContext } from "@/lib/log-context";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Affiliate holding-period unlock.
 *
 * Runs hourly. Promotes `pending` referral commission rows whose
 * `commission_unlock_at <= now()` to `available`, so the affiliate can
 * request a payout. Concurrency-safe via `pg_try_advisory_lock`.
 *
 * Auth: `Authorization: Bearer ${CRON_SECRET}`. Both POST and GET work.
 */
const AFFILIATE_UNLOCK_LOCK_KEY = BigInt("4427301519462399");

async function handle(request: Request) {
  return withRequestContext(
    {
      requestId: request.headers.get("x-request-id") ?? undefined,
      route: "cron.affiliate_unlock",
    },
    () => runAffiliateUnlock(request),
  );
}

async function runAffiliateUnlock(request: Request) {
  const startedAt = Date.now();
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "cron_disabled" }, { status: 503 });
  }
  const header = request.headers.get("authorization") ?? "";
  if (!safeCompareStrings(header, `Bearer ${secret}`)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  log.info("cron.affiliate_unlock.start");
  const db = getDb();
  const lockRows = await db.execute<{ locked: boolean }>(
    sql`select pg_try_advisory_lock(${AFFILIATE_UNLOCK_LOCK_KEY}) as locked`,
  );
  const locked = Boolean(
    (lockRows as unknown as Array<{ locked: boolean }>)[0]?.locked,
  );
  if (!locked) {
    log.info("cron.affiliate_unlock.skipped", {
      reason: "lock_held",
      durationMs: Date.now() - startedAt,
    });
    return NextResponse.json({ ok: true, skipped: true });
  }

  try {
    const result = await unlockMaturedCommissions(new Date());
    log.info("cron.affiliate_unlock.ok", {
      unlocked: result.unlocked,
      durationMs: Date.now() - startedAt,
    });
    return NextResponse.json({ ok: true, unlocked: result.unlocked });
  } catch (error) {
    log.error("cron.affiliate_unlock.failed", {
      error,
      durationMs: Date.now() - startedAt,
    });
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  } finally {
    await db.execute(
      sql`select pg_advisory_unlock(${AFFILIATE_UNLOCK_LOCK_KEY})`,
    );
  }
}

export async function POST(request: Request) {
  return handle(request);
}

export async function GET(request: Request) {
  return handle(request);
}
