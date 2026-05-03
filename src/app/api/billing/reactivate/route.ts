/**
 * Phase 9 — `POST /api/billing/reactivate`.
 *
 * Clears `cancelAtPeriodEnd` on a page subscription so the cron's
 * boundary-day cancel transition no longer fires. Pure inverse of
 * `/api/billing/cancel`.
 *
 * Idempotent: a subscription with `cancelAtPeriodEnd=false` still
 * returns `ok: true`.
 *
 * Eligibility:
 *   - Caller must own the page.
 *   - Subscription must exist (404 `subscription_missing`).
 *   - Status must be one of `active | trialing | pending_renewal`. Once a
 *     cancel has actually applied (`status='canceled'` on the Free plan),
 *     reactivation requires a fresh checkout via `change-plan` — we
 *     surface that with 409 `already_canceled`.
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
  });
  if (!sub) {
    return NextResponse.json(
      { error: "subscription_missing" },
      { status: 404 },
    );
  }

  if (sub.status === "canceled" || sub.status === "expired") {
    return NextResponse.json({ error: "already_canceled" }, { status: 409 });
  }

  if (
    sub.status !== "active" &&
    sub.status !== "trialing" &&
    sub.status !== "pending_renewal"
  ) {
    return NextResponse.json({ error: "bad_state" }, { status: 409 });
  }

  if (!sub.cancelAtPeriodEnd) {
    return NextResponse.json({ ok: true, alreadyActive: true });
  }

  await db
    .update(pageSubscriptions)
    .set({ cancelAtPeriodEnd: false })
    .where(eq(pageSubscriptions.id, sub.id));

  log.info("billing.reactivate.success", {
    pageId: page.id,
    subscriptionId: sub.id,
  });

  return NextResponse.json({ ok: true });
}
