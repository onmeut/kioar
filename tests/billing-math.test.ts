import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import { computeProration, roundHalfToEven } from "@/lib/billing-math";

describe("roundHalfToEven", () => {
  it("rounds half to even, both signs", () => {
    assert.equal(roundHalfToEven(0.5), 0);
    assert.equal(roundHalfToEven(1.5), 2);
    assert.equal(roundHalfToEven(2.5), 2);
    assert.equal(roundHalfToEven(3.5), 4);
    // -0.5 rounds to 0 (which JS represents as -0; both are equal under ===).
    assert.ok(roundHalfToEven(-0.5) === 0);
    assert.equal(roundHalfToEven(-1.5), -2);
    assert.equal(roundHalfToEven(-2.5), -2);
  });

  it("rounds <0.5 down and >0.5 up", () => {
    assert.equal(roundHalfToEven(0.4), 0);
    assert.equal(roundHalfToEven(0.6), 1);
    assert.equal(roundHalfToEven(2.4999), 2);
    assert.equal(roundHalfToEven(2.5001), 3);
  });

  it("throws on non-finite input", () => {
    assert.throws(() => roundHalfToEven(Number.NaN));
    assert.throws(() => roundHalfToEven(Number.POSITIVE_INFINITY));
  });
});

describe("computeProration", () => {
  const start = new Date(Date.UTC(2026, 3, 1));
  const end = new Date(Date.UTC(2026, 4, 1)); // 30 days

  it("upgrade in the middle of the period charges a fraction", () => {
    const now = new Date(Date.UTC(2026, 3, 16)); // 15 days remaining
    const r = computeProration({
      oldPriceToman: 149_000,
      newPriceToman: 299_000,
      currentPeriodStart: start,
      currentPeriodEnd: end,
      now,
    });
    assert.equal(r.remainingDays, 15);
    assert.equal(r.periodDays, 30);
    assert.equal(r.priceDeltaToman, 150_000);
    // (150_000 * 15) / 30 = 75_000
    assert.equal(r.proratedToman, 75_000);
  });

  it("downgrade is never billed", () => {
    const now = new Date(Date.UTC(2026, 3, 5));
    const r = computeProration({
      oldPriceToman: 299_000,
      newPriceToman: 149_000,
      currentPeriodStart: start,
      currentPeriodEnd: end,
      now,
    });
    assert.equal(r.priceDeltaToman, -150_000);
    assert.equal(r.proratedToman, 0);
  });

  it("expired period prorates to zero", () => {
    const now = new Date(Date.UTC(2026, 4, 2)); // past end
    const r = computeProration({
      oldPriceToman: 149_000,
      newPriceToman: 299_000,
      currentPeriodStart: start,
      currentPeriodEnd: end,
      now,
    });
    assert.equal(r.remainingDays, 0);
    assert.equal(r.proratedToman, 0);
  });

  it("upgrade with zero days remaining prorates to zero", () => {
    const now = new Date(Date.UTC(2026, 4, 1));
    const r = computeProration({
      oldPriceToman: 149_000,
      newPriceToman: 299_000,
      currentPeriodStart: start,
      currentPeriodEnd: end,
      now,
    });
    assert.equal(r.proratedToman, 0);
  });

  it("upgrade at start of period charges full delta", () => {
    const now = new Date(Date.UTC(2026, 3, 1));
    const r = computeProration({
      oldPriceToman: 149_000,
      newPriceToman: 299_000,
      currentPeriodStart: start,
      currentPeriodEnd: end,
      now,
    });
    assert.equal(r.proratedToman, 150_000);
  });

  it("rejects non-integer prices", () => {
    assert.throws(() =>
      computeProration({
        oldPriceToman: 1.5,
        newPriceToman: 2,
        currentPeriodStart: start,
        currentPeriodEnd: end,
        now: start,
      }),
    );
  });
});
