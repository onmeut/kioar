/**
 * Phase 9 — `POST /api/billing/change-plan`.
 *
 * Single endpoint for plan upgrades, downgrades, and cycle confirmations.
 * The route resolves the right disposition from current subscription state
 * and delegates to one of three branches:
 *
 *   1. **Fresh full-period checkout** (Free → paid, or grace/expired/
 *      canceled → paid). Same pipeline as `/api/billing/checkout`:
 *      allocate invoice → Zarinpal request → return redirectUrl. The
 *      callback applies the plan change at full period.
 *
 *   2. **Prorated upgrade** (paid → paid, same cycle, higher price).
 *      Compute `(newPrice - oldPrice) * remainingDays / periodDays` via
 *      `lib/billing-math.ts`, allocate a proration invoice tagged
 *      `metadata.kind = "proration"`, hand off to Zarinpal. The callback
 *      flips planId + clears flags but PRESERVES `currentPeriodStart` /
 *      `currentPeriodEnd` (the user already paid for this period; they're
 *      only paying the delta to upgrade in place).
 *
 *   3. **Scheduled downgrade** (paid → cheaper paid, or paid → free).
 *      Write `pendingPlanChangePlanId` and clear `cancelAtPeriodEnd`
 *      (mutually exclusive intents). No invoice, no Zarinpal. The Phase 7
 *      cron applies the change at the period boundary; downgrade-to-Free
 *      auto-applies, downgrade-to-paid drops to grace per Phase 7 rules.
 *
 * Body (JSON):
 *   { pageId: uuid, planKey: "free"|"pro"|"business",
 *     billingCycle: "monthly"|"annual" }
 *
 * Errors return JSON `{ error, detail? }` with one of these stable codes:
 *   - 400 invalid_body
 *   - 403 forbidden
 *   - 404 page_not_found · plan_not_found · subscription_missing
 *   - 409 already_on_plan · in_trial · cycle_change_unsupported · period_lapsed
 *   - 502 gateway_unavailable
 */
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getDb } from "@/db";
import { invoices, pageSubscriptions, payments, plans } from "@/db/schema";
import { requireUser } from "@/lib/auth/session";
import { computeProration } from "@/lib/billing-math";
import { computeBillingTotals, computePeriodEnd } from "@/lib/billing-pricing";
import { applyPriceLock, loadPriceLock } from "@/lib/billing-price-lock";
import {
  attributeReferralAtCheckout,
  resolveCheckoutCode,
  type CheckoutCodeOk,
} from "@/lib/checkout-codes";
import {
  addMonthsUtc,
  recordRedemption,
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
  planKey: z.enum(["free", "pro", "business"]),
  billingCycle: z.enum(["monthly", "annual"]),
  /**
   * Optional invite / discount code typed at checkout. Resolved
   * through `lib/checkout-codes.ts` — handles referral, affiliate,
   * and admin discount codes. Only applied on the fresh-checkout
   * branch (Free → paid / trial → paid / period-lapsed → paid).
   * Proration upgrades intentionally ignore the code: attribution
   * codes are first-purchase-only by spec, and discount stacking on
   * a partial-period invoice is out of scope.
   */
  code: z.string().trim().min(1).max(64).optional(),
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

  const [targetPlanRow, sub] = await Promise.all([
    db.query.plans.findFirst({ where: eq(plans.key, parsed.planKey) }),
    db.query.pageSubscriptions.findFirst({
      where: eq(pageSubscriptions.pageId, page.id),
      with: { plan: true },
    }),
  ]);

  if (!targetPlanRow || !targetPlanRow.isActive) {
    return NextResponse.json({ error: "plan_not_found" }, { status: 404 });
  }
  if (!sub) {
    log.error("billing.change_plan.subscription_missing", { pageId: page.id });
    return NextResponse.json(
      { error: "subscription_missing" },
      { status: 404 },
    );
  }

  // Phase 5: a grandfathered subscriber on this plan keeps their old
  // price even when changing cycles. Manual plan-change in admin drops
  // the lock; user-initiated change-plan honors it.
  const priceLock = await loadPriceLock(db, page.id, targetPlanRow.id);
  const targetPlan = applyPriceLock(targetPlanRow, priceLock);

  // Trialing pages are allowed to convert to a paid plan early. We treat
  // it as a fresh full-period checkout further down (see `isFreshCheckout`).
  // Cycle-changes inside an active trial are also fine because there's
  // nothing to prorate.

  const currentPlanKey = sub.plan.key as "free" | "pro" | "business";
  const targetPlanKey = parsed.planKey;
  const targetCycle = parsed.billingCycle;

  // Same plan + same cycle ⇒ no-op. We do allow the user to "confirm"
  // the same plan in cancelAtPeriodEnd mode by hitting reactivate, not
  // change-plan. Exception: a trialing user picking the SAME plan is
  // converting their trial into a paid subscription — fall through so
  // the fresh-checkout branch handles it.
  if (
    currentPlanKey === targetPlanKey &&
    sub.billingCycle === targetCycle &&
    !sub.pendingPlanChangePlanId &&
    sub.status !== "trialing"
  ) {
    return NextResponse.json({ error: "already_on_plan" }, { status: 409 });
  }

  // Target = Free.
  if (targetPlanKey === "free") {
    if (currentPlanKey === "free") {
      return NextResponse.json({ error: "already_on_plan" }, { status: 409 });
    }
    // Schedule downgrade. Cron applies at boundary (Phase 7 auto-applies
    // downgrade-to-Free). Clear cancelAtPeriodEnd because that intent is
    // mutually exclusive with a pending plan change.
    await db
      .update(pageSubscriptions)
      .set({
        pendingPlanChangePlanId: targetPlan.id,
        cancelAtPeriodEnd: false,
      })
      .where(eq(pageSubscriptions.id, sub.id));

    log.info("billing.change_plan.scheduled_downgrade", {
      pageId: page.id,
      from: currentPlanKey,
      to: "free",
      effectiveAt: sub.currentPeriodEnd.toISOString(),
    });

    return NextResponse.json({
      ok: true,
      kind: "scheduled_downgrade",
      effectiveAt: sub.currentPeriodEnd.toISOString(),
      message: "تغییر پلن در پایان دوره‌ی فعلی اعمال می‌شود.",
    });
  }

  // From here on, target is a paid plan (pro|business).
  const now = new Date();
  const periodLapsed =
    sub.currentPeriodEnd <= now ||
    sub.status === "grace" ||
    sub.status === "expired" ||
    sub.status === "canceled";

  const isFreshCheckout =
    currentPlanKey === "free" || periodLapsed || sub.status === "trialing";

  // ----- Branch A: fresh full-period checkout ---------------------------
  if (isFreshCheckout) {
    // Resolve any code typed at checkout. We do this BEFORE pricing so
    // a discount code can affect totals, and BEFORE the Zarinpal hop so
    // a referral / affiliate attribution row is in place at conversion
    // time. Invalid codes hard-fail with `code_invalid` so the UI can
    // surface the message; the resolver itself returns a Persian
    // string in `message`.
    const subtotalToman =
      targetCycle === "annual"
        ? targetPlan.priceAnnualToman
        : targetPlan.priceMonthlyToman;

    let appliedDiscount: DiscountValidationOk | null = null;
    let appliedReferralCode: string | null = null;

    if (parsed.code) {
      const resolved = await resolveCheckoutCode({
        code: parsed.code,
        userId: viewer.user.id,
        userPhone: viewer.user.phone,
        pageId: page.id,
        planKey: targetPlanKey,
        billingCycle: targetCycle,
        subtotalToman,
        plan: targetPlan,
      });
      if (!resolved.ok) {
        return NextResponse.json(
          {
            error: "code_invalid",
            errorCode: resolved.errorCode,
            message: resolved.message,
          },
          { status: 400 },
        );
      }
      const ok = resolved as CheckoutCodeOk;
      if (ok.kind === "discount") {
        // We need the underlying validation row (with codeId +
        // recurringCyclesRemainingAfter) so the redemption ledger can
        // be written. Re-validate via the same path the existing
        // checkout uses; the lookup is cheap and keeps a single source
        // of truth.
        const { validateDiscountCode } = await import("@/lib/discounts");
        const v = await validateDiscountCode({
          code: parsed.code,
          userId: viewer.user.id,
          pageId: page.id,
          planKey: targetPlanKey,
          billingCycle: targetCycle,
          subtotalToman,
        });
        if (v.ok) appliedDiscount = v;
      } else if (ok.kind === "referral" || ok.kind === "affiliate") {
        // Attribution at checkout overrides any cookie-based row. The
        // resolver already filtered self-referral / inactive cases;
        // attribution itself is best-effort (eligibility for the
        // bonus is decided downstream at conversion).
        appliedReferralCode = parsed.code;
        if (ok.eligible) {
          await attributeReferralAtCheckout({
            userId: viewer.user.id,
            userPhone: viewer.user.phone,
            code: parsed.code,
          });
        }
      }
    }

    const totals = computeBillingTotals({
      plan: targetPlan,
      billingCycle: targetCycle,
      discountAmountToman: appliedDiscount?.discountAmountToman ?? 0,
    });

    const description = `${targetPlan.nameFa} — ${
      targetCycle === "annual" ? "اشتراک سالانه" : "اشتراک ماهانه"
    }`;
    const dueAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    // Zero-total path (e.g. discount=100% / free_months / price=0):
    // apply directly without a Zarinpal round-trip.
    if (totals.totalToman === 0) {
      return await applyFreeTotalChange({
        page,
        userId: viewer.user.id,
        userPhone: viewer.user.phone,
        plan: targetPlan,
        billingCycle: targetCycle,
        totals,
        kind: "fresh_checkout",
        appliedDiscount,
      });
    }

    const invoiceCreated = await db.transaction(async (tx) => {
      const { number } = await allocateInvoiceNumber(tx);
      const [invoice] = await tx
        .insert(invoices)
        .values({
          number,
          userId: viewer.user.id,
          pageId: page.id,
          planId: targetPlan.id,
          billingCycle: targetCycle,
          subtotalToman: totals.subtotalToman,
          discountCodeId: appliedDiscount?.codeId ?? null,
          discountAmountToman: totals.discountAmountToman,
          vatToman: totals.vatToman,
          totalToman: totals.totalToman,
          status: "unpaid",
          dueAt,
          metadata: {
            source: "change_plan",
            kind: "fresh_checkout",
            ...(appliedReferralCode
              ? { referralCodeAtCheckout: appliedReferralCode }
              : {}),
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
          plan_key: targetPlanKey,
          cycle: targetCycle,
          kind: "fresh_checkout",
        },
      });
    } catch (err) {
      log.warn("billing.change_plan.gateway_failed", {
        invoiceId: invoiceCreated.id,
        error: (err as Error).message,
      });
      await db
        .update(invoices)
        .set({ status: "expired" })
        .where(eq(invoices.id, invoiceCreated.id));
      return NextResponse.json(
        { error: "gateway_unavailable" },
        { status: 502 },
      );
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
      kind: "fresh_checkout",
      invoiceNumber: invoiceCreated.number,
      redirectUrl: zarinpal.redirectUrl,
    });
  }

  // ----- Paid → paid path (in-period) -----------------------------------
  // We deliberately disallow cycle changes in the same hop. A user who
  // wants to swap monthly→annual on the same plan should let the period
  // run out and re-checkout. This keeps proration math single-cycle.
  if (sub.billingCycle !== targetCycle) {
    return NextResponse.json(
      { error: "cycle_change_unsupported" },
      { status: 409 },
    );
  }

  const oldPlanWithLock = applyPriceLock(
    sub.plan,
    await loadPriceLock(db, page.id, sub.plan.id),
  );
  const oldPriceToman =
    sub.billingCycle === "annual"
      ? oldPlanWithLock.priceAnnualToman
      : oldPlanWithLock.priceMonthlyToman;
  const newPriceToman =
    targetCycle === "annual"
      ? targetPlan.priceAnnualToman
      : targetPlan.priceMonthlyToman;

  // Downgrade (cheaper paid plan) ⇒ schedule for boundary; no invoice.
  if (newPriceToman <= oldPriceToman) {
    if (targetPlan.id === sub.planId) {
      return NextResponse.json({ error: "already_on_plan" }, { status: 409 });
    }
    await db
      .update(pageSubscriptions)
      .set({
        pendingPlanChangePlanId: targetPlan.id,
        cancelAtPeriodEnd: false,
      })
      .where(eq(pageSubscriptions.id, sub.id));

    log.info("billing.change_plan.scheduled_downgrade", {
      pageId: page.id,
      from: currentPlanKey,
      to: targetPlanKey,
      effectiveAt: sub.currentPeriodEnd.toISOString(),
    });

    return NextResponse.json({
      ok: true,
      kind: "scheduled_downgrade",
      effectiveAt: sub.currentPeriodEnd.toISOString(),
      message: "تغییر پلن در پایان دوره‌ی فعلی اعمال می‌شود.",
    });
  }

  // Upgrade ⇒ prorated invoice via Zarinpal.
  const proration = computeProration({
    oldPriceToman,
    newPriceToman,
    currentPeriodStart: sub.currentPeriodStart,
    currentPeriodEnd: sub.currentPeriodEnd,
    now,
  });

  if (proration.remainingDays <= 0) {
    // Defensive — `periodLapsed` should already capture this, but handle
    // off-by-one between calendar-day arithmetic and timestamp compare.
    return NextResponse.json({ error: "period_lapsed" }, { status: 409 });
  }

  // Apply VAT to the prorated subtotal so the user pays the same VAT
  // rate they would on a fresh checkout.
  const proratedTotals = computeBillingTotals({
    plan: {
      priceMonthlyToman: proration.proratedToman,
      priceAnnualToman: proration.proratedToman,
    },
    billingCycle: "monthly",
    discountAmountToman: 0,
  });

  // Edge case: prorated subtotal rounds to 0 (e.g. last day of period).
  // Apply the upgrade in-place at no charge — same TX shape as the
  // free-total path so `payments` history stays consistent.
  if (proratedTotals.totalToman === 0) {
    return await applyFreeTotalChange({
      page,
      userId: viewer.user.id,
      userPhone: viewer.user.phone,
      plan: targetPlan,
      billingCycle: targetCycle,
      totals: proratedTotals,
      kind: "proration",
      preservePeriod: {
        currentPeriodStart: sub.currentPeriodStart,
        currentPeriodEnd: sub.currentPeriodEnd,
      },
    });
  }

  const description = `ارتقای پلن به ${targetPlan.nameFa} (پیش‌پرداخت تناسبی)`;
  const dueAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const invoiceCreated = await db.transaction(async (tx) => {
    const { number } = await allocateInvoiceNumber(tx);
    const [invoice] = await tx
      .insert(invoices)
      .values({
        number,
        userId: viewer.user.id,
        pageId: page.id,
        planId: targetPlan.id,
        billingCycle: targetCycle,
        subtotalToman: proratedTotals.subtotalToman,
        discountAmountToman: proratedTotals.discountAmountToman,
        vatToman: proratedTotals.vatToman,
        totalToman: proratedTotals.totalToman,
        status: "unpaid",
        dueAt,
        metadata: {
          source: "change_plan",
          kind: "proration",
          fromPlanId: sub.planId,
          remainingDays: proration.remainingDays,
          periodDays: proration.periodDays,
          // Frozen so the callback can restore them verbatim regardless
          // of how much time elapses before the user pays.
          currentPeriodStart: sub.currentPeriodStart.toISOString(),
          currentPeriodEnd: sub.currentPeriodEnd.toISOString(),
        },
      })
      .returning({ id: invoices.id, number: invoices.number });
    return invoice!;
  });

  let zarinpal;
  try {
    zarinpal = await requestPayment({
      amountToman: proratedTotals.totalToman,
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
        plan_key: targetPlanKey,
        cycle: targetCycle,
        kind: "proration",
      },
    });
  } catch (err) {
    log.warn("billing.change_plan.gateway_failed", {
      invoiceId: invoiceCreated.id,
      error: (err as Error).message,
    });
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
    amountToman: proratedTotals.totalToman,
    status: "initiated",
  });

  return NextResponse.json({
    ok: true,
    kind: "proration",
    invoiceNumber: invoiceCreated.number,
    redirectUrl: zarinpal.redirectUrl,
  });
}

/**
 * Apply a zero-total plan change directly (no Zarinpal hop). Mirrors the
 * free-total branch in `/api/billing/checkout` but supports an optional
 * `preservePeriod` for in-place proration upgrades where the period
 * timestamps must NOT be reset.
 */
async function applyFreeTotalChange(input: {
  page: { id: string; slug: string };
  userId: string;
  userPhone: string;
  plan: typeof plans.$inferSelect;
  billingCycle: "monthly" | "annual";
  totals: ReturnType<typeof computeBillingTotals>;
  kind: "fresh_checkout" | "proration";
  preservePeriod?: {
    currentPeriodStart: Date;
    currentPeriodEnd: Date;
  };
  /**
   * Set when a discount code brought the total to zero. Used to write
   * `invoices.discount_code_id` and the `discount_redemptions` row in
   * the same TX. `free_months` codes also extend the period by N
   * calendar months instead of the regular cycle.
   */
  appliedDiscount?: DiscountValidationOk | null;
}) {
  const db = getDb();
  const now = new Date();
  const freeMonths = input.appliedDiscount?.freeMonths ?? 0;
  const periodStart = input.preservePeriod?.currentPeriodStart ?? now;
  const periodEnd =
    input.preservePeriod?.currentPeriodEnd ??
    (freeMonths > 0
      ? addMonthsUtc(now, freeMonths)
      : computePeriodEnd(now, input.billingCycle));

  const result = await db.transaction(async (tx) => {
    const { number } = await allocateInvoiceNumber(tx);

    const [invoice] = await tx
      .insert(invoices)
      .values({
        number,
        userId: input.userId,
        pageId: input.page.id,
        planId: input.plan.id,
        billingCycle: input.billingCycle,
        subtotalToman: input.totals.subtotalToman,
        discountCodeId: input.appliedDiscount?.codeId ?? null,
        discountAmountToman: input.totals.discountAmountToman,
        vatToman: input.totals.vatToman,
        totalToman: 0,
        status: "paid",
        dueAt: now,
        paidAt: now,
        metadata: {
          source: "change_plan",
          kind: input.kind,
          freeTotal: true,
          ...(freeMonths > 0 ? { freeMonths } : {}),
        },
      })
      .returning({ id: invoices.id, number: invoices.number });

    if (input.appliedDiscount) {
      await recordRedemption(tx, {
        codeId: input.appliedDiscount.codeId,
        invoiceId: invoice!.id,
        userId: input.userId,
        pageId: input.page.id,
        appliedAmountToman: input.appliedDiscount.discountAmountToman,
        recurringCyclesRemainingAfter:
          input.appliedDiscount.recurringCyclesRemainingAfter,
      });
    }

    await tx
      .update(pageSubscriptions)
      .set({
        planId: input.plan.id,
        planKey: input.plan.key,
        billingCycle: input.billingCycle,
        status: "active",
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd,
        cancelAtPeriodEnd: false,
        pendingPlanChangePlanId: null,
      })
      .where(eq(pageSubscriptions.pageId, input.page.id));

    await rebuildEntitlements(tx, input.page.id);

    return invoice!;
  });

  await enqueueSms({
    templateKey: "plan_changed",
    phone: input.userPhone,
    idempotencyKey: `plan_changed:${result.id}`,
    variables: { plan: input.plan.nameFa },
  });

  return NextResponse.json({
    ok: true,
    kind: input.kind,
    free: true,
    invoiceNumber: result.number,
    redirectUrl: absoluteUrl(
      `/account/billing/${input.page.id}?paid=${result.number}`,
    ),
  });
}
