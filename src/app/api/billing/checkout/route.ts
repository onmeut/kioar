/**
 * Phase 6 — `POST /api/billing/checkout`.
 *
 * Body (JSON):
 *   {
 *     "pageId":        uuid,             // page to upgrade (must be owned)
 *     "planKey":       "pro" | "business",
 *     "billingCycle":  "monthly" | "annual",
 *     "discountCode":  string  // optional; validated in Phase 11
 *   }
 *
 * Flow:
 *   1. Authenticate the caller; assert they own `pageId`.
 *   2. Resolve the target plan + price from the registry.
 *   3. Compute totals (subtotal/discount/vat/total).
 *   4a. Free-total invoice (e.g. discount = 100%) → mark paid in the same
 *       TX, advance subscription period, rebuild entitlements, return
 *       `{ ok: true, invoiceNumber, redirectUrl: "/dashboard/...?paid=1" }`.
 *   4b. Non-zero total → INSERT invoice (number from Phase 6 numbering),
 *       call Zarinpal `requestPayment`, INSERT a `payments` row carrying
 *       the `authority`, return `{ ok: true, redirectUrl }`. The user
 *       lands on Zarinpal; the gateway calls `/api/billing/callback`.
 *
 * Discounts: this route deliberately does NOT validate the code. Phase 11
 * adds `lib/discounts.ts` and threads it in here. For Phase 6 the field is
 * accepted, ignored (treated as `discountAmountToman = 0`), and a TODO
 * comment marks the integration point.
 *
 * Errors:
 *   - 401 if no session.
 *   - 403 if the page isn't owned by the caller.
 *   - 404 if the plan key is not active in the registry.
 *   - 400 on schema validation failure.
 *   - 502 on a Zarinpal-side failure (we surface the gateway error).
 */
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getDb } from "@/db";
import { invoices, pageSubscriptions, payments, plans } from "@/db/schema";
import { requireUser } from "@/lib/auth/session";
import {
  computeBillingTotals,
  computePeriodEnd,
  type BillingCycle,
} from "@/lib/billing-pricing";
import { resolveEffectivePlan } from "@/lib/billing-price-lock";
import {
  addMonthsUtc,
  findActiveRecurringRedemption,
  recordRedemption,
  validateDiscountCode,
  type DiscountValidationOk,
} from "@/lib/discounts";
import { rebuildEntitlements } from "@/lib/entitlements";
import { allocateInvoiceNumber } from "@/lib/invoice-numbering";
import { log } from "@/lib/log";
import { getOwnedPageById } from "@/lib/pages";
import { absoluteUrl } from "@/lib/site";
import { enqueueSms } from "@/lib/sms-queue";
import { requestPayment } from "@/lib/zarinpal";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  pageId: z.string().uuid(),
  planKey: z.enum(["pro", "business"]),
  billingCycle: z.enum(["monthly", "annual"]),
  discountCode: z.string().trim().min(1).max(64).optional(),
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

  // Ownership: surface 403 explicitly so the client can render a useful
  // error rather than silently treating "not owned" as "not found".
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

  // Phase 5: a grandfathered subscriber on this plan keeps their old
  // price. The lock substitutes both monthly + annual on the plan
  // record passed to all downstream pricing math (discount validation,
  // computeBillingTotals).
  const { plan, lock: priceLock } = await resolveEffectivePlan(
    page.id,
    planRow,
    db,
  );

  // Phase 11: resolve the discount before computing totals. Two paths:
  //   - User typed a code → full validation pipeline.
  //   - No code typed → look for an active recurring chain on this page
  //     and auto-apply if the prior code is still valid.
  const subtotalToman =
    parsed.billingCycle === "annual"
      ? plan.priceAnnualToman
      : plan.priceMonthlyToman;

  let appliedDiscount: DiscountValidationOk | null = null;

  if (parsed.discountCode) {
    const validation = await validateDiscountCode({
      code: parsed.discountCode,
      userId: viewer.user.id,
      pageId: page.id,
      planKey: parsed.planKey,
      billingCycle: parsed.billingCycle,
      subtotalToman,
    });
    if (!validation.ok) {
      return NextResponse.json(
        {
          error: "discount_invalid",
          discountErrorCode: validation.errorCode,
          message: validation.message,
        },
        { status: 400 },
      );
    }
    appliedDiscount = validation;
  } else {
    appliedDiscount = await findActiveRecurringRedemption({
      userId: viewer.user.id,
      pageId: page.id,
      planKey: parsed.planKey,
      billingCycle: parsed.billingCycle,
      subtotalToman,
    });
  }

  const discountAmountToman = appliedDiscount?.discountAmountToman ?? 0;
  const discountCodeId: string | null = appliedDiscount?.codeId ?? null;
  const freeMonths = appliedDiscount?.freeMonths ?? 0;

  const totals = computeBillingTotals({
    plan,
    billingCycle: parsed.billingCycle,
    discountAmountToman,
  });

  const description = `${plan.nameFa} — ${
    parsed.billingCycle === "annual" ? "اشتراک سالانه" : "اشتراک ماهانه"
  }`;

  const dueAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h to pay

  // Free-total path: skip Zarinpal entirely and apply the upgrade in one
  // TX. Same shape (number + invoice + paid status) so admin/invoices UI
  // sees a single source of truth regardless of whether money moved.
  if (totals.totalToman === 0) {
    const result = await db.transaction(async (tx) => {
      const { number } = await allocateInvoiceNumber(tx);
      const now = new Date();
      // free_months extends the period by N calendar months from `now`;
      // every other free-total path uses the regular cycle period.
      const periodEnd =
        freeMonths > 0
          ? addMonthsUtc(now, freeMonths)
          : computePeriodEnd(now, parsed.billingCycle);

      const [invoice] = await tx
        .insert(invoices)
        .values({
          number,
          userId: viewer.user.id,
          pageId: page.id,
          planId: plan.id,
          billingCycle: parsed.billingCycle,
          subtotalToman: totals.subtotalToman,
          discountCodeId,
          discountAmountToman: totals.discountAmountToman,
          vatToman: totals.vatToman,
          totalToman: 0,
          status: "paid",
          dueAt,
          paidAt: now,
          metadata: {
            freeTotal: true,
            freeMonths: freeMonths > 0 ? freeMonths : undefined,
          },
        })
        .returning({ id: invoices.id, number: invoices.number });

      if (appliedDiscount) {
        await recordRedemption(tx, {
          codeId: appliedDiscount.codeId,
          invoiceId: invoice!.id,
          userId: viewer.user.id,
          pageId: page.id,
          appliedAmountToman: appliedDiscount.discountAmountToman,
          recurringCyclesRemainingAfter:
            appliedDiscount.recurringCyclesRemainingAfter,
        });
      }

      await tx
        .update(pageSubscriptions)
        .set({
          planId: plan.id,
          planKey: plan.key,
          billingCycle: parsed.billingCycle,
          status: "active",
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
          cancelAtPeriodEnd: false,
          pendingPlanChangePlanId: null,
        })
        .where(eq(pageSubscriptions.pageId, page.id));

      await rebuildEntitlements(tx, page.id);

      return invoice!;
    });

    await enqueueSms({
      templateKey: "payment_received",
      phone: viewer.user.phone,
      idempotencyKey: `payment_received:${result.id}`,
      variables: {
        invoice: result.number,
        plan: plan.nameFa,
      },
    });

    if (appliedDiscount) {
      await enqueueSms({
        templateKey: "discount_applied",
        phone: viewer.user.phone,
        idempotencyKey: `discount_applied:${result.id}`,
        variables: {
          code: appliedDiscount.codeRow.code,
          amount: appliedDiscount.discountAmountToman,
        },
      });
    }

    return NextResponse.json({
      ok: true,
      free: true,
      invoiceNumber: result.number,
      redirectUrl: absoluteUrl(
        `/account/billing/${page.id}?paid=${result.number}`,
      ),
    });
  }

  // Paid path: create the invoice + payment row first, THEN call Zarinpal.
  // We persist `authority` immediately so the callback handler always has
  // a row to land on, even if the user takes hours to return.
  const invoiceCreated = await db.transaction(async (tx) => {
    const { number } = await allocateInvoiceNumber(tx);
    const [invoice] = await tx
      .insert(invoices)
      .values({
        number,
        userId: viewer.user.id,
        pageId: page.id,
        planId: plan.id,
        billingCycle: parsed.billingCycle,
        subtotalToman: totals.subtotalToman,
        discountCodeId,
        discountAmountToman: totals.discountAmountToman,
        vatToman: totals.vatToman,
        totalToman: totals.totalToman,
        status: "unpaid",
        dueAt,
      })
      .returning({ id: invoices.id, number: invoices.number });

    if (appliedDiscount) {
      await recordRedemption(tx, {
        codeId: appliedDiscount.codeId,
        invoiceId: invoice!.id,
        userId: viewer.user.id,
        pageId: page.id,
        appliedAmountToman: appliedDiscount.discountAmountToman,
        recurringCyclesRemainingAfter:
          appliedDiscount.recurringCyclesRemainingAfter,
      });
    }

    return invoice!;
  });

  let zarinpal;
  try {
    zarinpal = await requestPayment({
      amountToman: totals.totalToman,
      callbackUrl: absoluteUrl(
        `/api/billing/callback?invoice=${invoiceCreated.id}`,
      ),
      description,
      mobile: viewer.user.phone.startsWith("98")
        ? `0${viewer.user.phone.slice(2)}`
        : viewer.user.phone,
      metadata: {
        invoice: invoiceCreated.number,
        page_id: page.id,
        plan_key: parsed.planKey,
        cycle: parsed.billingCycle,
      },
    });
  } catch (err) {
    log.warn("billing.checkout.zarinpal_request_failed", {
      invoiceId: invoiceCreated.id,
      error: (err as Error).message,
    });
    // Mark the invoice as expired so the user can retry by issuing a fresh
    // checkout call instead of double-charging on the same row.
    await db
      .update(invoices)
      .set({ status: "expired" })
      .where(eq(invoices.id, invoiceCreated.id));
    return NextResponse.json({ error: "gateway_unavailable" }, { status: 502 });
  }

  await db.insert(payments).values({
    invoiceId: invoiceCreated.id,
    provider: "zarinpal",
    authority: zarinpal.authority,
    amountToman: totals.totalToman,
    status: "initiated",
  });

  return NextResponse.json({
    ok: true,
    free: false,
    invoiceNumber: invoiceCreated.number,
    redirectUrl: zarinpal.redirectUrl,
  });
}
