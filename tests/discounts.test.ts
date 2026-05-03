import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import { computeDiscountAmount, normalizeDiscountCode } from "@/lib/discounts";
import { discountCodes } from "@/db/schema";

type DiscountCodeRow = typeof discountCodes.$inferSelect;

function makeCode(over: Partial<DiscountCodeRow> = {}): DiscountCodeRow {
  return {
    id: "code-1",
    code: "WELCOME",
    codeNormalized: "welcome",
    nameFa: "خوش‌آمد",
    descriptionFa: null,
    discountType: "percent",
    amount: 20,
    startsAt: null,
    endsAt: null,
    maxRedemptions: null,
    redemptionsCount: 0,
    maxPerUser: null,
    firstTimeOnly: false,
    appliesToPlanKeys: null,
    appliesToBillingCycles: null,
    recurringCycles: 1,
    isActive: true,
    createdByUserId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...over,
  } as DiscountCodeRow;
}

describe("normalizeDiscountCode", () => {
  it("trims and lowercases", () => {
    assert.equal(normalizeDiscountCode("  Welcome20 "), "welcome20");
  });
});

describe("computeDiscountAmount — percent", () => {
  it("computes percent off and floors", () => {
    const r = computeDiscountAmount(
      makeCode({ discountType: "percent", amount: 25 }),
      149_000,
      "monthly",
    );
    assert.equal(r.ok, true);
    if (r.ok) {
      assert.equal(r.discountAmountToman, Math.floor(149_000 * 0.25));
      assert.equal(r.freeMonths, 0);
      assert.equal(r.recurringCyclesRemainingAfter, 0);
    }
  });

  it("clamps a 100% discount at the subtotal", () => {
    const r = computeDiscountAmount(
      makeCode({ discountType: "percent", amount: 100 }),
      50_000,
      "monthly",
    );
    assert.equal(r.ok, true);
    if (r.ok) assert.equal(r.discountAmountToman, 50_000);
  });

  it("rejects out-of-range percent", () => {
    const r1 = computeDiscountAmount(
      makeCode({ discountType: "percent", amount: 0 }),
      100,
      "monthly",
    );
    const r2 = computeDiscountAmount(
      makeCode({ discountType: "percent", amount: 101 }),
      100,
      "monthly",
    );
    assert.equal(r1.ok, false);
    assert.equal(r2.ok, false);
    if (!r1.ok) assert.equal(r1.errorCode, "amount_invalid");
  });

  it("decrements recurring cycles", () => {
    const r = computeDiscountAmount(
      makeCode({ discountType: "percent", amount: 10, recurringCycles: 3 }),
      100_000,
      "monthly",
    );
    assert.equal(r.ok, true);
    if (r.ok) assert.equal(r.recurringCyclesRemainingAfter, 2);
  });
});

describe("computeDiscountAmount — fixed_amount", () => {
  it("subtracts the fixed amount", () => {
    const r = computeDiscountAmount(
      makeCode({ discountType: "fixed_amount", amount: 30_000 }),
      149_000,
      "monthly",
    );
    assert.equal(r.ok, true);
    if (r.ok) assert.equal(r.discountAmountToman, 30_000);
  });

  it("clamps an oversized fixed amount", () => {
    const r = computeDiscountAmount(
      makeCode({ discountType: "fixed_amount", amount: 999_999 }),
      149_000,
      "monthly",
    );
    assert.equal(r.ok, true);
    if (r.ok) assert.equal(r.discountAmountToman, 149_000);
  });

  it("rejects zero or negative fixed amount", () => {
    const r = computeDiscountAmount(
      makeCode({ discountType: "fixed_amount", amount: 0 }),
      100,
      "monthly",
    );
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.errorCode, "amount_invalid");
  });
});

describe("computeDiscountAmount — free_months", () => {
  it("zeroes the total and surfaces freeMonths", () => {
    const r = computeDiscountAmount(
      makeCode({ discountType: "free_months", amount: 12 }),
      149_000,
      "monthly",
    );
    assert.equal(r.ok, true);
    if (r.ok) {
      assert.equal(r.discountAmountToman, 149_000);
      assert.equal(r.freeMonths, 12);
      assert.equal(r.recurringCyclesRemainingAfter, 0);
    }
  });

  it("rejects free_months on an annual cycle", () => {
    const r = computeDiscountAmount(
      makeCode({ discountType: "free_months", amount: 6 }),
      1_499_000,
      "annual",
    );
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.errorCode, "free_months_requires_monthly");
  });

  it("rejects zero or negative free_months", () => {
    const r = computeDiscountAmount(
      makeCode({ discountType: "free_months", amount: 0 }),
      100,
      "monthly",
    );
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.errorCode, "amount_invalid");
  });
});
