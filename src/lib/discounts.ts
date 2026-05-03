/**
 * Phase 11 — discount code validation + redemption pipeline.
 *
 * Public surface:
 *
 *   - `validateDiscountCode(input)` — full read-only validation.
 *     Returns either `{ ok: true, ... }` with the resolved code row +
 *     toman discount (and `freeMonths` for free_months type) or
 *     `{ ok: false, errorCode, message }` with a stable error code the
 *     UI / tests can pivot on.
 *
 *   - `findActiveRecurringRedemption(pageId, planKey, billingCycle)` —
 *     auto-apply hook. When a user starts a paid renewal without
 *     entering a code, the most recent paid redemption with
 *     `recurringCyclesRemaining > 0` for this page (and a still-valid
 *     code matching the plan/cycle) is carried forward.
 *
 *   - `recordRedemption(tx, ...)` — INSERT a redemption row + bump
 *     `discountCodes.redemptionsCount` inside the caller's TX. The
 *     caller is responsible for setting `invoices.discountCodeId` and
 *     `invoices.discountAmountToman`.
 *
 * Money is integer toman throughout. `percent` rounds via floor (the
 * user gets at most the stated percentage off — never more, due to
 * rounding). `fixed_amount` is clamped at the subtotal so a too-large
 * code can't go negative. `free_months` returns the full subtotal as
 * the discount amount and a `freeMonths` integer the caller uses to
 * extend the period — see `/api/billing/checkout`.
 *
 * Error codes (stable for UI strings + tests):
 *
 *   not_found            — no such code (or normalized form)
 *   inactive             — `is_active = false`
 *   not_started          — `starts_at` in the future
 *   expired              — `ends_at` in the past
 *   max_redemptions      — global cap reached
 *   max_per_user         — per-user cap reached
 *   first_time_only      — user already has a paid invoice
 *   plan_mismatch        — code doesn't apply to this plan
 *   cycle_mismatch       — code doesn't apply to this billing cycle
 *   free_months_requires_monthly — `free_months` only valid for monthly cycle
 *   amount_invalid       — code amount is corrupt (defensive)
 */
import { and, eq, sql } from "drizzle-orm";

import { getDb } from "@/db";
import {
  discountCodes,
  discountRedemptions,
  invoices,
  referralCodes,
  referrals,
} from "@/db/schema";

export type DiscountValidationInput = {
  code: string;
  userId: string;
  pageId: string;
  planKey: "free" | "pro" | "business";
  billingCycle: "monthly" | "annual";
  subtotalToman: number;
};

export type DiscountValidationOk = {
  ok: true;
  codeId: string;
  codeRow: typeof discountCodes.$inferSelect;
  /** Integer toman to deduct from the invoice subtotal. */
  discountAmountToman: number;
  /** Number of free calendar months to grant (only set for free_months). */
  freeMonths: number;
  /**
   * Cycles remaining AFTER this redemption is recorded. The caller
   * passes this through to `recordRedemption`. 0 ⇒ chain ends here.
   */
  recurringCyclesRemainingAfter: number;
};

export type DiscountValidationError = {
  ok: false;
  errorCode:
    | "not_found"
    | "inactive"
    | "not_started"
    | "expired"
    | "max_redemptions"
    | "max_per_user"
    | "first_time_only"
    | "plan_mismatch"
    | "cycle_mismatch"
    | "free_months_requires_monthly"
    | "amount_invalid"
    | "stacked_with_affiliate";
  message: string;
};

export type DiscountValidationResult =
  | DiscountValidationOk
  | DiscountValidationError;

const ERROR_MESSAGES_FA: Record<DiscountValidationError["errorCode"], string> =
  {
    not_found: "کد تخفیف نامعتبر است.",
    inactive: "این کد تخفیف غیرفعال شده است.",
    not_started: "این کد تخفیف هنوز فعال نشده است.",
    expired: "مهلت استفاده از این کد به پایان رسیده است.",
    max_redemptions: "ظرفیت استفاده از این کد به پایان رسیده است.",
    max_per_user: "شما قبلاً از این کد استفاده کرده‌اید.",
    first_time_only: "این کد فقط برای اولین خرید قابل استفاده است.",
    plan_mismatch: "این کد برای پلن انتخابی قابل استفاده نیست.",
    cycle_mismatch: "این کد برای چرخه‌ی صورت‌حساب انتخابی قابل استفاده نیست.",
    free_months_requires_monthly: "این کد فقط روی پلن ماهانه قابل استفاده است.",
    amount_invalid: "تنظیمات این کد نامعتبر است.",
    stacked_with_affiliate:
      "با لینک همکاری وارد شدید — استفاده‌ی همزمان از کد تخفیف مجاز نیست.",
  };

function err(
  errorCode: DiscountValidationError["errorCode"],
): DiscountValidationError {
  return { ok: false, errorCode, message: ERROR_MESSAGES_FA[errorCode] };
}

export function normalizeDiscountCode(code: string): string {
  return code.trim().toLowerCase();
}

/** Pure math: derive the toman discount + freeMonths from a code row. */
export function computeDiscountAmount(
  code: typeof discountCodes.$inferSelect,
  subtotalToman: number,
  billingCycle: "monthly" | "annual",
): DiscountValidationResult {
  if (code.discountType === "percent") {
    if (code.amount <= 0 || code.amount > 100) return err("amount_invalid");
    const discount = Math.floor((subtotalToman * code.amount) / 100);
    return {
      ok: true,
      codeId: code.id,
      codeRow: code,
      discountAmountToman: Math.min(discount, subtotalToman),
      freeMonths: 0,
      recurringCyclesRemainingAfter: Math.max(code.recurringCycles - 1, 0),
    };
  }

  if (code.discountType === "fixed_amount") {
    if (code.amount <= 0) return err("amount_invalid");
    return {
      ok: true,
      codeId: code.id,
      codeRow: code,
      discountAmountToman: Math.min(code.amount, subtotalToman),
      freeMonths: 0,
      recurringCyclesRemainingAfter: Math.max(code.recurringCycles - 1, 0),
    };
  }

  // free_months
  if (code.amount <= 0) return err("amount_invalid");
  if (billingCycle !== "monthly") return err("free_months_requires_monthly");
  return {
    ok: true,
    codeId: code.id,
    codeRow: code,
    // Total invoice goes to zero; the caller extends the period by
    // `freeMonths` months.
    discountAmountToman: subtotalToman,
    freeMonths: code.amount,
    // free_months is self-contained — no recurring chain.
    recurringCyclesRemainingAfter: 0,
  };
}

export async function validateDiscountCode(
  input: DiscountValidationInput,
): Promise<DiscountValidationResult> {
  const db = getDb();
  const normalized = normalizeDiscountCode(input.code);
  if (!normalized) return err("not_found");

  // Affiliate-discount stacking is blocked. Per spec: "affiliate code
  // wins and stacking is blocked". If the user was attributed to an
  // affiliate referral code, reject any discount-code redemption with
  // a friendly Persian message. Plain (organic) referral codes are
  // not affected because they grant their bonus automatically and do
  // not pass through this validation path.
  const affiliateAttribution = await db
    .select({ referralId: referrals.id })
    .from(referrals)
    .innerJoin(referralCodes, eq(referralCodes.id, referrals.referralCodeId))
    .where(
      and(
        eq(referrals.refereeUserId, input.userId),
        eq(referralCodes.kind, "affiliate"),
      ),
    )
    .limit(1);
  if (affiliateAttribution.length > 0) return err("stacked_with_affiliate");

  const code = await db.query.discountCodes.findFirst({
    where: eq(discountCodes.codeNormalized, normalized),
  });
  if (!code) return err("not_found");
  if (!code.isActive) return err("inactive");

  const now = new Date();
  if (code.startsAt && code.startsAt > now) return err("not_started");
  if (code.endsAt && code.endsAt < now) return err("expired");

  if (
    code.maxRedemptions !== null &&
    code.redemptionsCount >= code.maxRedemptions
  ) {
    return err("max_redemptions");
  }

  // Plan / cycle scoping.
  if (
    code.appliesToPlanKeys &&
    code.appliesToPlanKeys.length > 0 &&
    !code.appliesToPlanKeys.includes(input.planKey)
  ) {
    return err("plan_mismatch");
  }
  if (
    code.appliesToBillingCycles &&
    code.appliesToBillingCycles.length > 0 &&
    !code.appliesToBillingCycles.includes(input.billingCycle)
  ) {
    return err("cycle_mismatch");
  }

  // Per-user cap.
  if (code.maxPerUser !== null) {
    const [{ count }] = (await db
      .select({ count: sql<number>`count(*)::int` })
      .from(discountRedemptions)
      .where(
        and(
          eq(discountRedemptions.discountCodeId, code.id),
          eq(discountRedemptions.userId, input.userId),
        ),
      )) as Array<{ count: number }>;
    if (count >= code.maxPerUser) return err("max_per_user");
  }

  // First-time-only check.
  if (code.firstTimeOnly) {
    const prior = await db.query.invoices.findFirst({
      where: and(
        eq(invoices.userId, input.userId),
        eq(invoices.status, "paid"),
      ),
      columns: { id: true },
    });
    if (prior) return err("first_time_only");
  }

  return computeDiscountAmount(code, input.subtotalToman, input.billingCycle);
}

/**
 * Look up the most recent paid redemption on this page that still has
 * recurring cycles remaining and whose code is still valid for this
 * (plan, cycle). Returns the validated, ready-to-apply discount or
 * `null` when no carry-forward is in effect.
 *
 * Called from checkout when the user does NOT enter a code, so a
 * recurring promo automatically carries through renewals.
 */
export async function findActiveRecurringRedemption(input: {
  userId: string;
  pageId: string;
  planKey: "free" | "pro" | "business";
  billingCycle: "monthly" | "annual";
  subtotalToman: number;
}): Promise<DiscountValidationOk | null> {
  const db = getDb();

  const rows = (await db.execute(sql`
    SELECT dr."id"                         AS "redemptionId",
           dr."discount_code_id"           AS "codeId",
           dr."recurring_cycles_remaining" AS "remaining"
    FROM "discount_redemptions" dr
    JOIN "invoices" i ON i."id" = dr."invoice_id"
    WHERE dr."page_id" = ${input.pageId}::uuid
      AND i."status" = 'paid'
      AND dr."recurring_cycles_remaining" > 0
    ORDER BY i."paid_at" DESC NULLS LAST, dr."created_at" DESC
    LIMIT 1
  `)) as unknown as Array<{
    redemptionId: string;
    codeId: string;
    remaining: number;
  }>;

  if (rows.length === 0) return null;
  const head = rows[0]!;

  const code = await db.query.discountCodes.findFirst({
    where: eq(discountCodes.id, head.codeId),
  });
  if (!code || !code.isActive) return null;

  const now = new Date();
  if (code.startsAt && code.startsAt > now) return null;
  if (code.endsAt && code.endsAt < now) return null;

  // Still scoped to this plan/cycle?
  if (
    code.appliesToPlanKeys &&
    code.appliesToPlanKeys.length > 0 &&
    !code.appliesToPlanKeys.includes(input.planKey)
  ) {
    return null;
  }
  if (
    code.appliesToBillingCycles &&
    code.appliesToBillingCycles.length > 0 &&
    !code.appliesToBillingCycles.includes(input.billingCycle)
  ) {
    return null;
  }
  if (
    code.maxRedemptions !== null &&
    code.redemptionsCount >= code.maxRedemptions
  ) {
    return null;
  }

  const computed = computeDiscountAmount(
    code,
    input.subtotalToman,
    input.billingCycle,
  );
  if (!computed.ok) return null;

  // Override the chain counter with the prior remaining - 1 (we're
  // consuming one more cycle from the existing chain, not starting a
  // fresh one).
  return {
    ...computed,
    recurringCyclesRemainingAfter: Math.max(head.remaining - 1, 0),
  };
}

type Tx = Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0];

export async function recordRedemption(
  tx: Tx,
  input: {
    codeId: string;
    invoiceId: string;
    userId: string;
    pageId: string;
    appliedAmountToman: number;
    recurringCyclesRemainingAfter: number;
  },
): Promise<void> {
  await tx.insert(discountRedemptions).values({
    discountCodeId: input.codeId,
    invoiceId: input.invoiceId,
    userId: input.userId,
    pageId: input.pageId,
    appliedAmountToman: input.appliedAmountToman,
    recurringCyclesRemaining: input.recurringCyclesRemainingAfter,
  });
  // Bump the denormalized counter so the next validator call sees the
  // updated total without a JOIN. Do it inside the same TX so a rolled-
  // back invoice automatically rolls back the counter bump.
  await tx
    .update(discountCodes)
    .set({
      redemptionsCount: sql`${discountCodes.redemptionsCount} + 1`,
      updatedAt: new Date(),
    })
    .where(eq(discountCodes.id, input.codeId));
}

/** Add `months` calendar months to `start` in UTC. */
export function addMonthsUtc(start: Date, months: number): Date {
  const d = new Date(start);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d;
}
