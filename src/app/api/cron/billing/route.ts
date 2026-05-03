/**
 * Phase 7 — daily billing state machine cron.
 *
 *   POST/GET /api/cron/billing
 *   Authorization: Bearer <CRON_SECRET>
 *
 * Designed to be called once per day by the same external timer that
 * already calls `/api/cron/cleanup` (systemd `*.timer` + `*.service` —
 * see `docs/cron.md`). Calling it twice (or N times) on the same day
 * is a no-op: per-transition idempotency lives in
 * `billing_transitions_log`, not in this route.
 *
 * Concurrency
 *   `pg_try_advisory_lock` keeps two overlapping invocations from doing
 *   the same scan in parallel. If we lose the lock we exit with
 *   `skipped: true` — same shape as `cron/cleanup`. The advisory lock
 *   is a perf/IO guard, not a correctness guard; correctness is owned
 *   by the per-row PK in `billing_transitions_log`.
 *
 * Auth
 *   `Bearer CRON_SECRET` matched with a constant-time compare. Missing
 *   secret = 503 (fail closed) so a misconfigured deployment cannot
 *   leave this route world-callable.
 *
 * The actual transition catalog + apply logic lives in
 * `lib/billing-state.ts`. This route is just transport.
 */
import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";

import { getDb } from "@/db";
import { transitionForToday } from "@/lib/billing-state";
import { log } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Stable, arbitrary 64-bit identifier for the advisory-lock namespace.
// Must differ from `cron/cleanup`'s key so the two crons don't fight.
const BILLING_LOCK_KEY = BigInt("7427301519462396");

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
    sql`select pg_try_advisory_lock(${BILLING_LOCK_KEY}) as locked`,
  );
  const locked = Boolean(
    (lockRows as unknown as Array<{ locked: boolean }>)[0]?.locked,
  );
  if (!locked) {
    log.info("cron.billing.skipped", { reason: "lock_held" });
    return NextResponse.json({ ok: true, skipped: true });
  }

  try {
    const result = await transitionForToday(new Date());

    log.info("cron.billing", {
      scanned: result.scanned,
      applied: result.applied.length,
      skipped: result.skipped.length,
      errors: result.errors.length,
    });

    return NextResponse.json({
      ok: true,
      scanned: result.scanned,
      applied: result.applied.length,
      skipped: result.skipped.length,
      errors: result.errors.length,
      // Surface a small per-transition trail so an operator running this
      // by hand can see what happened. We don't paginate — this list is
      // bounded by the number of non-Free subscriptions × transitions/row,
      // which stays small in practice.
      transitions: result.applied,
      errorDetails: result.errors,
    });
  } finally {
    await db.execute(sql`select pg_advisory_unlock(${BILLING_LOCK_KEY})`);
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
