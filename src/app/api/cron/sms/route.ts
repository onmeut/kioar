/**
 * Phase 10 — SMS queue worker cron.
 *
 *   POST/GET /api/cron/sms
 *   Authorization: Bearer <CRON_SECRET>
 *
 * Designed to be called every ~60 seconds by the same systemd timer
 * pattern that drives `/api/cron/cleanup` and `/api/cron/billing` (see
 * `docs/cron.md`). Each tick drains up to 50 due `queued` rows from
 * `sms_queue`. The route is the transport layer; queue mechanics live
 * in `lib/sms-queue.ts#processSmsQueue`.
 *
 * Concurrency
 *   `pg_try_advisory_lock` keeps two overlapping route invocations from
 *   doing the same scan. `processSmsQueue` *also* uses
 *   `FOR UPDATE SKIP LOCKED` row-level claims, so two workers across
 *   different hosts (or a missed-and-retried tick) are still safe even
 *   if they slip past the advisory lock.
 *
 * Auth
 *   `Bearer CRON_SECRET` matched in constant time. Missing secret = 503
 *   (fail closed).
 */
import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";

import { getDb } from "@/db";
import { log } from "@/lib/log";
import { processSmsQueue } from "@/lib/sms-queue";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Stable, arbitrary 64-bit identifier — distinct from cleanup/billing.
const SMS_LOCK_KEY = BigInt("7427301519462397");

async function handle(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "cron_disabled" }, { status: 503 });
  }

  const header = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  if (!timingSafeEqual(header, expected)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const db = getDb();

  const lockRows = await db.execute<{ locked: boolean }>(
    sql`select pg_try_advisory_lock(${SMS_LOCK_KEY}) as locked`,
  );
  const locked = Boolean(
    (lockRows as unknown as Array<{ locked: boolean }>)[0]?.locked,
  );
  if (!locked) {
    log.info("cron.sms.skipped", { reason: "lock_held" });
    return NextResponse.json({ ok: true, skipped: true });
  }

  try {
    const result = await processSmsQueue({ now: new Date() });

    log.info("cron.sms", {
      scanned: result.scanned,
      sent: result.sent,
      retried: result.retried,
      failed: result.failed,
    });

    return NextResponse.json({
      ok: true,
      scanned: result.scanned,
      sent: result.sent,
      retried: result.retried,
      failed: result.failed,
      errorDetails: result.errorDetails,
    });
  } finally {
    await db.execute(sql`select pg_advisory_unlock(${SMS_LOCK_KEY})`);
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
