import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";

import { getDb } from "@/db";
import { safeCompareStrings } from "@/lib/cron-auth";
import { log } from "@/lib/log";
import { withRequestContext } from "@/lib/log-context";
import { expireStaleTransfers } from "@/lib/transfer-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Page-transfer expiry.
 *
 * Runs hourly. Flips `page_transfers` rows that are still `pending` past
 * their `expires_at` (7 days after creation) to `expired`, so stale offers
 * leave the recipient's prompt + notifications and the sender's outgoing
 * list. Concurrency-safe via `pg_try_advisory_lock`.
 *
 * Auth: `Authorization: Bearer ${CRON_SECRET}`. Both POST and GET work.
 */
const EXPIRE_TRANSFERS_LOCK_KEY = BigInt("4427301519462411");

async function handle(request: Request) {
  return withRequestContext(
    {
      requestId: request.headers.get("x-request-id") ?? undefined,
      route: "cron.expire_transfers",
    },
    () => runExpireTransfers(request),
  );
}

async function runExpireTransfers(request: Request) {
  const startedAt = Date.now();
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "cron_disabled" }, { status: 503 });
  }
  const header = request.headers.get("authorization") ?? "";
  if (!safeCompareStrings(header, `Bearer ${secret}`)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  log.info("cron.expire_transfers.start");
  const db = getDb();
  const lockRows = await db.execute<{ locked: boolean }>(
    sql`select pg_try_advisory_lock(${EXPIRE_TRANSFERS_LOCK_KEY}) as locked`,
  );
  const locked = Boolean(
    (lockRows as unknown as Array<{ locked: boolean }>)[0]?.locked,
  );
  if (!locked) {
    log.info("cron.expire_transfers.skipped", {
      reason: "lock_held",
      durationMs: Date.now() - startedAt,
    });
    return NextResponse.json({ ok: true, skipped: true });
  }

  try {
    const expired = await expireStaleTransfers();
    log.info("cron.expire_transfers.ok", {
      expired,
      durationMs: Date.now() - startedAt,
    });
    return NextResponse.json({ ok: true, expired });
  } catch (error) {
    log.error("cron.expire_transfers.failed", {
      error,
      durationMs: Date.now() - startedAt,
    });
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  } finally {
    await db.execute(
      sql`select pg_advisory_unlock(${EXPIRE_TRANSFERS_LOCK_KEY})`,
    );
  }
}

export async function POST(request: Request) {
  return handle(request);
}

export async function GET(request: Request) {
  return handle(request);
}
