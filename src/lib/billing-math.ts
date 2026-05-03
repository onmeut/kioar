/**
 * Phase 9 — proration math for plan changes.
 *
 * Pure arithmetic, no I/O, no DB, no cycle-arithmetic side effects. Every
 * number is integer toman; rounding uses banker's (half-to-even) so a
 * symmetric +/- delta rounds to the same integer in both directions.
 *
 * Proration model (paid → paid upgrade)
 * -------------------------------------
 *
 *   prorated = round_half_to_even(
 *     (newPriceToman - oldPriceToman) * remainingDays / periodDays
 *   )
 *
 * Where:
 *   - `oldPriceToman` is the subtotal the page is currently being billed
 *     at (matching the page's existing `billingCycle`).
 *   - `newPriceToman` is the subtotal of the target plan at the SAME
 *     cycle (we deliberately don't let plan-change flip cycle in one hop;
 *     a cycle change goes through a fresh checkout when the period rolls
 *     over).
 *   - `remainingDays` = whole calendar days from `now` to
 *     `currentPeriodEnd` (clamped at 0). UTC-day boundaries — we never
 *     proportion sub-day increments because the user-visible "days left"
 *     is what they'll be charged for.
 *   - `periodDays` = whole calendar days the current paid period covers,
 *     i.e. `currentPeriodEnd - currentPeriodStart`. Always derived from
 *     the actual subscription columns so a renewed sub uses its own
 *     period length, not a hardcoded 30/365.
 *
 * If `newPrice <= oldPrice`, this is a downgrade and proration returns 0
 * — downgrades are scheduled via `pendingPlanChangePlanId`, never billed.
 *
 * If `remainingDays <= 0` (period already expired), proration also
 * returns 0 — the route handler should reject that path and require a
 * fresh checkout instead.
 */

export type ProrationInput = {
  oldPriceToman: number;
  newPriceToman: number;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  now: Date;
};

export type ProrationResult = {
  /** Raw price delta in toman (can be negative on downgrade). */
  priceDeltaToman: number;
  /** Whole days remaining in the current period (>= 0). */
  remainingDays: number;
  /** Whole days the full period covers (>= 1). */
  periodDays: number;
  /**
   * Prorated charge in integer toman. 0 when the change is a downgrade
   * (delta <= 0) or the period has already lapsed.
   */
  proratedToman: number;
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function utcDayStart(d: Date): Date {
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
  );
}

function diffWholeDays(from: Date, to: Date): number {
  const ms = utcDayStart(to).getTime() - utcDayStart(from).getTime();
  return Math.round(ms / MS_PER_DAY);
}

/** Banker's rounding (half-to-even). Identical to billing-pricing's helper. */
export function roundHalfToEven(value: number): number {
  if (!Number.isFinite(value)) {
    throw new Error(`roundHalfToEven: non-finite input ${value}`);
  }
  const sign = value < 0 ? -1 : 1;
  const abs = Math.abs(value);
  const floor = Math.floor(abs);
  const diff = abs - floor;
  let rounded: number;
  if (diff < 0.5) rounded = floor;
  else if (diff > 0.5) rounded = floor + 1;
  else rounded = floor % 2 === 0 ? floor : floor + 1;
  return sign * rounded;
}

export function computeProration(input: ProrationInput): ProrationResult {
  const {
    oldPriceToman,
    newPriceToman,
    currentPeriodStart,
    currentPeriodEnd,
    now,
  } = input;

  if (!Number.isInteger(oldPriceToman) || oldPriceToman < 0) {
    throw new Error(
      `oldPriceToman must be non-negative integer: ${oldPriceToman}`,
    );
  }
  if (!Number.isInteger(newPriceToman) || newPriceToman < 0) {
    throw new Error(
      `newPriceToman must be non-negative integer: ${newPriceToman}`,
    );
  }

  const remainingDays = Math.max(0, diffWholeDays(now, currentPeriodEnd));
  const periodDays = Math.max(
    1,
    diffWholeDays(currentPeriodStart, currentPeriodEnd),
  );

  const priceDeltaToman = newPriceToman - oldPriceToman;

  if (priceDeltaToman <= 0 || remainingDays <= 0) {
    return {
      priceDeltaToman,
      remainingDays,
      periodDays,
      proratedToman: 0,
    };
  }

  const raw = (priceDeltaToman * remainingDays) / periodDays;
  const proratedToman = Math.max(0, roundHalfToEven(raw));

  return {
    priceDeltaToman,
    remainingDays,
    periodDays,
    proratedToman,
  };
}
