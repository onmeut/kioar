/**
 * Phase 6 — invoice total computation.
 *
 * Inputs: a plan row (with monthly + annual toman prices), the chosen
 * billing cycle, and an optional already-validated discount amount.
 * Output: an integer-toman triple `(subtotal, discount, vat, total)`.
 *
 * VAT rate is configured via `BILLING_VAT_RATE` (e.g. `0.09` for 9٪),
 * defaults to 0. We compute VAT on the post-discount base, banker's-round
 * to integer toman, and clamp the final total at >= 0 so a discount can't
 * mint negative invoices.
 *
 * Discount validation lives in Phase 11 (`lib/discounts.ts`); this module
 * stays purely arithmetic so checkout can be tested without a discounts
 * code path.
 */

export type BillingCycle = "monthly" | "annual";

export type PriceInputPlan = {
  priceMonthlyToman: number;
  priceAnnualToman: number;
};

export type PriceBreakdown = {
  subtotalToman: number;
  discountAmountToman: number;
  vatToman: number;
  totalToman: number;
};

function getVatRate(): number {
  const raw = process.env.BILLING_VAT_RATE?.trim();
  if (!raw) return 0;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return 0;
  // Sanity: nobody is collecting >50%; fail loud if env is misformatted.
  if (n > 0.5) {
    throw new Error(
      `BILLING_VAT_RATE=${raw} is out of plausible range (0..0.5).`,
    );
  }
  return n;
}

/** Banker's rounding (half-to-even) for integer toman conversion. */
function roundHalfToEven(value: number): number {
  const floor = Math.floor(value);
  const diff = value - floor;
  if (diff < 0.5) return floor;
  if (diff > 0.5) return floor + 1;
  // Exactly 0.5 — round to even.
  return floor % 2 === 0 ? floor : floor + 1;
}

export function computeBillingTotals(input: {
  plan: PriceInputPlan;
  billingCycle: BillingCycle;
  /** Pre-validated discount amount (toman). Pass 0 when no code applied. */
  discountAmountToman?: number;
}): PriceBreakdown {
  const { plan, billingCycle, discountAmountToman = 0 } = input;

  const subtotal =
    billingCycle === "annual"
      ? plan.priceAnnualToman
      : plan.priceMonthlyToman;

  if (!Number.isInteger(subtotal) || subtotal < 0) {
    throw new Error(
      `plan price (${billingCycle}) is not a non-negative integer: ${subtotal}`,
    );
  }
  if (
    !Number.isInteger(discountAmountToman) ||
    discountAmountToman < 0
  ) {
    throw new Error(
      `discountAmountToman must be a non-negative integer, got ${discountAmountToman}`,
    );
  }

  // Clamp discount at the subtotal so total can't go negative even if a
  // bad discount code slips past validation.
  const discount = Math.min(discountAmountToman, subtotal);
  const postDiscount = subtotal - discount;

  const vatRate = getVatRate();
  const vat = vatRate > 0 ? roundHalfToEven(postDiscount * vatRate) : 0;

  const total = postDiscount + vat;

  return {
    subtotalToman: subtotal,
    discountAmountToman: discount,
    vatToman: vat,
    totalToman: total,
  };
}

/**
 * Period end for a fresh paid period starting at `start`. Monthly = +1
 * calendar month; annual = +1 calendar year. We use Gregorian month/year
 * arithmetic deliberately — the user's mental model of "monthly billing"
 * is calendar-aligned, not 30-day-aligned.
 */
export function computePeriodEnd(
  start: Date,
  billingCycle: BillingCycle,
): Date {
  const end = new Date(start);
  if (billingCycle === "annual") {
    end.setUTCFullYear(end.getUTCFullYear() + 1);
  } else {
    end.setUTCMonth(end.getUTCMonth() + 1);
  }
  return end;
}
