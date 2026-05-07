/**
 * Phase 11 — `POST /api/billing/discount/validate`.
 *
 * Read-only price preview for a typed discount code. The dashboard
 * `<DiscountCodeInput>` calls this before checkout so the user sees
 * their final total and a clear error message if the code is invalid.
 *
 * Body: `{ pageId, planKey, billingCycle, code }`
 *
 * Always returns HTTP 200 with `{ ok: true | false, ... }` so the
 * client can pivot on `ok` without juggling status codes for the
 * "wrong code" UX. 401 / 403 / 404 still surface for auth + page
 * ownership.
 */
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getDb } from "@/db";
import { plans } from "@/db/schema";
import { requireUser } from "@/lib/auth/session";
import { computeBillingTotals } from "@/lib/billing-pricing";
import { resolveEffectivePlan } from "@/lib/billing-price-lock";
import { validateDiscountCode } from "@/lib/discounts";
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
  const planRow = await db.query.plans.findFirst({
    where: eq(plans.key, parsed.planKey),
  });
  if (!planRow || !planRow.isActive) {
    return NextResponse.json({ error: "plan_not_found" }, { status: 404 });
  }

  // Phase 5: honor any price-lock for this (page, plan) so the preview
  // matches the actual checkout total.
  const { plan } = await resolveEffectivePlan(page.id, planRow, db);

  const subtotalToman =
    parsed.billingCycle === "annual"
      ? plan.priceAnnualToman
      : plan.priceMonthlyToman;

  const validation = await validateDiscountCode({
    code: parsed.code,
    userId: viewer.user.id,
    pageId: page.id,
    planKey: parsed.planKey,
    billingCycle: parsed.billingCycle,
    subtotalToman,
  });

  if (!validation.ok) {
    return NextResponse.json({
      ok: false,
      errorCode: validation.errorCode,
      message: validation.message,
    });
  }

  const totals = computeBillingTotals({
    plan,
    billingCycle: parsed.billingCycle,
    discountAmountToman: validation.discountAmountToman,
  });

  return NextResponse.json({
    ok: true,
    nameFa: validation.codeRow.nameFa,
    discountType: validation.codeRow.discountType,
    freeMonths: validation.freeMonths,
    subtotalToman: totals.subtotalToman,
    discountAmountToman: totals.discountAmountToman,
    vatToman: totals.vatToman,
    totalToman: totals.totalToman,
  });
}
