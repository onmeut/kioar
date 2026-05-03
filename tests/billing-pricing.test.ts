import { strict as assert } from "node:assert";
import { afterEach, beforeEach, describe, it } from "node:test";

import { computeBillingTotals, computePeriodEnd } from "@/lib/billing-pricing";

describe("computeBillingTotals", () => {
  const plan = { priceMonthlyToman: 149_000, priceAnnualToman: 1_499_000 };
  const originalVat = process.env.BILLING_VAT_RATE;

  beforeEach(() => {
    delete process.env.BILLING_VAT_RATE;
  });

  afterEach(() => {
    if (originalVat === undefined) delete process.env.BILLING_VAT_RATE;
    else process.env.BILLING_VAT_RATE = originalVat;
  });

  it("returns the monthly subtotal when no discount and no VAT", () => {
    const r = computeBillingTotals({ plan, billingCycle: "monthly" });
    assert.equal(r.subtotalToman, 149_000);
    assert.equal(r.discountAmountToman, 0);
    assert.equal(r.vatToman, 0);
    assert.equal(r.totalToman, 149_000);
  });

  it("returns the annual subtotal", () => {
    const r = computeBillingTotals({ plan, billingCycle: "annual" });
    assert.equal(r.subtotalToman, 1_499_000);
    assert.equal(r.totalToman, 1_499_000);
  });

  it("subtracts a discount and never goes negative", () => {
    const r = computeBillingTotals({
      plan,
      billingCycle: "monthly",
      discountAmountToman: 200_000,
    });
    assert.equal(r.discountAmountToman, 149_000); // clamped
    assert.equal(r.totalToman, 0);
  });

  it("applies VAT on the post-discount base, banker's rounded", () => {
    process.env.BILLING_VAT_RATE = "0.09";
    const r = computeBillingTotals({
      plan,
      billingCycle: "monthly",
      discountAmountToman: 49_000,
    });
    // post-discount = 100_000; vat = round(9_000) = 9_000
    assert.equal(r.vatToman, 9_000);
    assert.equal(r.totalToman, 109_000);
  });

  it("rejects a non-integer or negative subtotal", () => {
    assert.throws(() =>
      computeBillingTotals({
        plan: { priceMonthlyToman: -1, priceAnnualToman: 0 },
        billingCycle: "monthly",
      }),
    );
  });

  it("rejects a negative discount", () => {
    assert.throws(() =>
      computeBillingTotals({
        plan,
        billingCycle: "monthly",
        discountAmountToman: -1,
      }),
    );
  });

  it("rejects an out-of-range VAT rate from env", () => {
    process.env.BILLING_VAT_RATE = "0.95";
    assert.throws(() =>
      computeBillingTotals({ plan, billingCycle: "monthly" }),
    );
  });
});

describe("computePeriodEnd", () => {
  it("adds one calendar month for monthly", () => {
    const start = new Date(Date.UTC(2026, 0, 15, 12, 0, 0));
    const end = computePeriodEnd(start, "monthly");
    assert.equal(end.getUTCFullYear(), 2026);
    assert.equal(end.getUTCMonth(), 1);
    assert.equal(end.getUTCDate(), 15);
  });

  it("adds one calendar year for annual", () => {
    const start = new Date(Date.UTC(2026, 4, 1, 0, 0, 0));
    const end = computePeriodEnd(start, "annual");
    assert.equal(end.getUTCFullYear(), 2027);
    assert.equal(end.getUTCMonth(), 4);
    assert.equal(end.getUTCDate(), 1);
  });

  it("rolls month-end overflow with JS Date semantics", () => {
    // Jan 31 + 1 month overflows into March 3 (non-leap) — same JS
    // semantics computeBillingTotals' callers already rely on.
    const start = new Date(Date.UTC(2026, 0, 31, 0, 0, 0));
    const end = computePeriodEnd(start, "monthly");
    assert.equal(end.getUTCMonth(), 2); // March
  });
});
