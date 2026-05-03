import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import { formatAmount, formatPriceDisplay, formatToman } from "@/lib/money";

describe("formatToman", () => {
  it("formats minor rials → toman with Persian digits", () => {
    // 100_000 rials = 10_000 toman
    assert.equal(formatToman(100_000), "۱۰٬۰۰۰ تومان");
  });
  it("handles zero", () => {
    assert.equal(formatToman(0), "۰ تومان");
  });
});

describe("formatAmount", () => {
  it("IRT → suffix toman with Persian digits", () => {
    // 50_000 rials in minor = 5_000 toman major
    const out = formatAmount(50_000, "IRT");
    assert.match(out, /تومان$/);
    assert.match(out, /[۰-۹]/);
  });
  it("USD → $-prefixed Latin digits with 2 fraction digits when needed", () => {
    // 1234 cents → $12.34
    assert.equal(formatAmount(1234, "USD"), "$12.34");
    // 1200 cents → $12 (no fraction when zero)
    assert.equal(formatAmount(1200, "USD"), "$12");
  });
  it("EUR → €-prefixed Latin digits", () => {
    assert.equal(formatAmount(999, "EUR"), "€9.99");
  });
});

describe("formatPriceDisplay — all 5 price types × 3 currencies", () => {
  for (const currency of ["IRT", "USD", "EUR"] as const) {
    it(`free (${currency})`, () => {
      assert.equal(
        formatPriceDisplay(
          { priceType: "free", priceAmount: 0, priceAmountMax: null },
          currency,
        ),
        "رایگان",
      );
    });
    it(`on_request (${currency})`, () => {
      assert.equal(
        formatPriceDisplay(
          { priceType: "on_request", priceAmount: 0, priceAmountMax: null },
          currency,
        ),
        "تماس بگیرید",
      );
    });
    it(`fixed (${currency}) renders an amount`, () => {
      const out = formatPriceDisplay(
        { priceType: "fixed", priceAmount: 1000, priceAmountMax: null },
        currency,
      );
      assert.notEqual(out, "");
    });
    it(`from (${currency}) prefixes "از"`, () => {
      const out = formatPriceDisplay(
        { priceType: "from", priceAmount: 5000, priceAmountMax: null },
        currency,
      );
      assert.match(out, /^از /);
    });
    it(`range (${currency}) renders "lo – hi"`, () => {
      const out = formatPriceDisplay(
        { priceType: "range", priceAmount: 1000, priceAmountMax: 5000 },
        currency,
      );
      assert.match(out, / – /);
    });
    it(`range (${currency}) without max falls back to floor`, () => {
      const out = formatPriceDisplay(
        { priceType: "range", priceAmount: 1000, priceAmountMax: null },
        currency,
      );
      assert.equal(/ – /.test(out), false);
    });
  }
});
