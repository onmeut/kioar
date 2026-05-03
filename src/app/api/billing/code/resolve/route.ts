/**
 * Phase 12+ — `POST /api/billing/code/resolve`.
 *
 * Single endpoint the checkout UI calls when the user types a code.
 * Dispatches into the unified resolver in `lib/checkout-codes.ts`,
 * which handles referral / affiliate / discount in one place.
 *
 * Body: `{ pageId, planKey, billingCycle, code }`
 *
 * Always returns HTTP 200 on auth success so the client can pivot on
 * `ok` without juggling status codes for the "wrong code" UX.
 *
 * Response shape:
 *   - `{ ok: true, kind: "discount", ...preview }`
 *   - `{ ok: true, kind: "referral",  inviter, eligible, ... }`
 *   - `{ ok: true, kind: "affiliate", inviter, eligible,
 *                  monthlyCycleWarning, ... }`
 *   - `{ ok: false, errorCode, message }`
 */
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getDb } from "@/db";
import { plans } from "@/db/schema";
import { requireUser } from "@/lib/auth/session";
import { resolveCheckoutCode } from "@/lib/checkout-codes";
import { getOwnedPageById } from "@/lib/pages";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  pageId: z.string().uuid(),
  planKey: z.enum(["pro", "business"]),
  billingCycle: z.enum(["monthly", "annual"]),
  code: z.string().trim().min(1).max(64),
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
  const plan = await db.query.plans.findFirst({
    where: eq(plans.key, parsed.planKey),
  });
  if (!plan || !plan.isActive) {
    return NextResponse.json({ error: "plan_not_found" }, { status: 404 });
  }

  const subtotalToman =
    parsed.billingCycle === "annual"
      ? plan.priceAnnualToman
      : plan.priceMonthlyToman;

  const result = await resolveCheckoutCode({
    code: parsed.code,
    userId: viewer.user.id,
    userPhone: viewer.user.phone,
    pageId: page.id,
    planKey: parsed.planKey,
    billingCycle: parsed.billingCycle,
    subtotalToman,
    plan,
  });

  return NextResponse.json(result);
}
