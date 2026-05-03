/**
 * Phase 9 — `POST /api/billing/cancel`.
 *
 * Marks the page subscription's current paid period as cancel-at-end.
 * The Phase 7 cron applies the actual transition at the period boundary
 * (`cancel_at_period_end_applied`): plan→Free, status='canceled',
 * sentinel period_end, rebuild entitlements, SMS `cancellation_confirmed`.
 *
 * This route is idempotent: calling it on a subscription that already
 * has `cancelAtPeriodEnd=true` returns `ok: true` without flipping any
 * other state.
 *
 * Eligibility:
 *   - Caller must own the page (else 403).
 *   - Subscription must exist (else 404).
 *   - Plan must be paid (`pro|business`); cancelling Free is a no-op
 *     (returns 409 `not_on_paid_plan`).
 *   - Status must be one of `active | trialing | pending_renewal`.
 *     `grace`/`expired`/`canceled` rows already have a clear endgame
 *     and don't accept a cancel intent (returns 409 `bad_state`).
 *   - Setting cancel automatically clears any `pendingPlanChangePlanId`
 *     because the two intents are mutually exclusive.
 *
 * Body (JSON): `{ pageId: uuid }`.
 */
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getDb } from "@/db";
import { pageSubscriptions } from "@/db/schema";
import { requireUser } from "@/lib/auth/session";
import { log } from "@/lib/log";
import { getOwnedPageById } from "@/lib/pages";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  pageId: z.string().uuid(),
});

export async function POST(request: Request) {
  const viewer = await requireUser();

  let parsed: z.infer<typeof bodySchema>;
  try {
    parsed = bodySchema.parse(await request.json());
  } catch (err) {
    return NextResponse.json(
      { error: "invalid_body", detail: (err as Error).message },
      { status: 400 },
    );
  }

  const page = await getOwnedPageById(parsed.pageId, viewer.user.id);
  if (!page) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const db = getDb();
  const sub = await db.query.pageSubscriptions.findFirst({
    where: eq(pageSubscriptions.pageId, page.id),
    with: { plan: true },
  });
  if (!sub) {
    return NextResponse.json(
      { error: "subscription_missing" },
      { status: 404 },
    );
  }

  if (sub.plan.key === "free") {
    return NextResponse.json({ error: "not_on_paid_plan" }, { status: 409 });
  }

  if (
    sub.status !== "active" &&
    sub.status !== "trialing" &&
    sub.status !== "pending_renewal"
  ) {
    return NextResponse.json({ error: "bad_state" }, { status: 409 });
  }

  if (sub.cancelAtPeriodEnd && !sub.pendingPlanChangePlanId) {
    // Already cancelled — idempotent success.
    return NextResponse.json({
      ok: true,
      effectiveAt: (sub.trialEndsAt ?? sub.currentPeriodEnd).toISOString(),
      alreadyCancelled: true,
    });
  }

  await db
    .update(pageSubscriptions)
    .set({
      cancelAtPeriodEnd: true,
      pendingPlanChangePlanId: null,
    })
    .where(eq(pageSubscriptions.id, sub.id));

  log.info("billing.cancel.scheduled", {
    pageId: page.id,
    subscriptionId: sub.id,
    effectiveAt: (sub.trialEndsAt ?? sub.currentPeriodEnd).toISOString(),
  });

  return NextResponse.json({
    ok: true,
    effectiveAt: (sub.trialEndsAt ?? sub.currentPeriodEnd).toISOString(),
  });
}
