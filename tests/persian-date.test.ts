import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import {
  formatShamsi,
  formatShamsiDate,
  formatShamsiDateTime,
  formatShamsiMonthYear,
  formatShamsiShort,
  formatShamsiWeekdayDayMonth,
  parseShamsi,
  shamsiAddMonths,
  shamsiDayOfMonth,
  shamsiDaysInMonth,
  shamsiMonth,
  shamsiStartOfMonth,
  shamsiYear,
  tehranIsoDate,
  toEnglishDigits,
  toPersianDigits,
} from "@/lib/date/persian";

// April 28 2026, 12:00 UTC ≈ Ordibehesht 8, 1405, 15:30 Tehran.
const APR_28_2026 = new Date("2026-04-28T12:00:00Z");
// April 18 2026, 12:00 UTC ≈ Farvardin 29, 1405, 15:30 Tehran.
// (This is the date used in the original bug report.)
const APR_18_2026 = new Date("2026-04-18T12:00:00Z");
// March 21 2026, 06:00 UTC ≈ Farvardin 1, 1405, 09:30 Tehran (Nowruz).
const NOWRUZ_2026 = new Date("2026-03-21T06:00:00Z");
// March 20 2026, 06:00 UTC ≈ Esfand 29, 1404 — day before Nowruz.
const PRE_NOWRUZ_2026 = new Date("2026-03-20T06:00:00Z");

describe("digit conversion", () => {
  it("converts Latin → Persian digits", () => {
    assert.equal(toPersianDigits("1234567890"), "۱۲۳۴۵۶۷۸۹۰");
    assert.equal(toPersianDigits(42), "۴۲");
  });

  it("converts Persian + eastern-Arabic → Latin digits", () => {
    assert.equal(toEnglishDigits("۱۲۳۴۵۶۷۸۹۰"), "1234567890");
    assert.equal(toEnglishDigits("٠١٢٣"), "0123");
  });

  it("digit conversion round-trips", () => {
    const original = "1405/01/29";
    assert.equal(toEnglishDigits(toPersianDigits(original)), original);
  });
});

describe("Shamsi field accessors (Tehran-anchored)", () => {
  it("Apr 28 2026 → 8 Ordibehesht 1405", () => {
    assert.equal(shamsiYear(APR_28_2026), 1405);
    assert.equal(shamsiMonth(APR_28_2026), 1); // 0=Farvardin, 1=Ordibehesht
    assert.equal(shamsiDayOfMonth(APR_28_2026), 8);
  });

  it("Apr 18 2026 → 29 Farvardin 1405 (NOT 18 Ordibehesht)", () => {
    // This is the original bug — the booking calendar was rendering "18
    // Ordibehesht" because it iterated Gregorian days under a Persian
    // header. The correct conversion is 29 Farvardin.
    assert.equal(shamsiYear(APR_18_2026), 1405);
    assert.equal(shamsiMonth(APR_18_2026), 0);
    assert.equal(shamsiDayOfMonth(APR_18_2026), 29);
  });

  it("Nowruz: Mar 21 2026 → 1 Farvardin 1405", () => {
    assert.equal(shamsiYear(NOWRUZ_2026), 1405);
    assert.equal(shamsiMonth(NOWRUZ_2026), 0);
    assert.equal(shamsiDayOfMonth(NOWRUZ_2026), 1);
  });

  it("Day before Nowruz: Mar 20 2026 → 29 Esfand 1404 (year change)", () => {
    assert.equal(shamsiYear(PRE_NOWRUZ_2026), 1404);
    assert.equal(shamsiMonth(PRE_NOWRUZ_2026), 11); // Esfand
    assert.equal(shamsiDayOfMonth(PRE_NOWRUZ_2026), 29);
  });
});

describe("month arithmetic", () => {
  it("days in Farvardin 1405 = 31 (first half of year)", () => {
    assert.equal(shamsiDaysInMonth(NOWRUZ_2026), 31);
  });

  it("days in Esfand 1404 (non-leap) = 29", () => {
    // 1404 is not a leap year in the Jalali calendar; Esfand has 29 days.
    assert.equal(shamsiDaysInMonth(PRE_NOWRUZ_2026), 29);
  });

  it("addMonths crosses Jalali year boundary correctly", () => {
    // Ordibehesht 1405 + 11 months = Farvardin 1406.
    const next = shamsiAddMonths(APR_28_2026, 11);
    assert.equal(shamsiYear(next), 1406);
    assert.equal(shamsiMonth(next), 0);
  });

  it("startOfMonth is 1st of the Jalali month", () => {
    // Apr 28 2026 (8 Ordibehesht 1405) → start = 1 Ordibehesht 1405.
    const start = shamsiStartOfMonth(APR_28_2026);
    assert.equal(shamsiYear(start), 1405);
    assert.equal(shamsiMonth(start), 1);
    assert.equal(shamsiDayOfMonth(start), 1);
  });
});

describe("formatters (Persian digits + Tehran tz)", () => {
  it("formatShamsiDate produces Persian-digit Jalali date", () => {
    const out = formatShamsiDate(APR_28_2026);
    assert.match(out, /اردیبهشت/);
    assert.match(out, /۱۴۰۵/);
    assert.match(out, /۸/);
  });

  it("formatShamsiShort is yyyy/MM/dd in Persian digits", () => {
    const out = formatShamsiShort(APR_28_2026);
    assert.match(out, /^۱۴۰۵\/۰۲\/۰۸$/);
  });

  it("formatShamsiDateTime contains 'ساعت' before time", () => {
    const out = formatShamsiDateTime(APR_28_2026);
    assert.match(out, /ساعت/);
  });

  it("formatShamsiMonthYear is just month + year", () => {
    const out = formatShamsiMonthYear(APR_28_2026);
    assert.match(out, /اردیبهشت/);
    assert.match(out, /۱۴۰۵/);
    assert.doesNotMatch(out, /\d/); // no Latin digits anywhere
  });

  it("formatShamsiWeekdayDayMonth includes weekday", () => {
    const out = formatShamsiWeekdayDayMonth(APR_28_2026);
    // Apr 28 2026 is a Tuesday → سه‌شنبه
    assert.match(out, /سه‌شنبه|سه شنبه/);
  });

  it("formatShamsi accepts custom pattern", () => {
    assert.equal(formatShamsi(APR_28_2026, "yyyy-MM-dd"), "۱۴۰۵-۰۲-۰۸");
  });
});

describe("tehranIsoDate", () => {
  it("returns Gregorian YYYY-MM-DD anchored to Asia/Tehran", () => {
    // Noon UTC on Apr 28 is 15:30 Tehran → still Apr 28.
    assert.equal(tehranIsoDate(APR_28_2026), "2026-04-28");
  });

  it("Tehran date can differ from UTC date near midnight", () => {
    // 21:00 UTC = 00:30 next day Tehran.
    const lateUtc = new Date("2026-04-27T21:00:00Z");
    assert.equal(tehranIsoDate(lateUtc), "2026-04-28");
  });
});

describe("parseShamsi", () => {
  it("parses Shamsi yyyy/MM/dd back into a real Date", () => {
    const d = parseShamsi("1405/02/08");
    // The instant should land on Apr 28 2026 in Tehran.
    assert.equal(tehranIsoDate(d), "2026-04-28");
  });

  it("accepts Persian digits and dash separators", () => {
    const d = parseShamsi("۱۴۰۵-۰۲-۰۸");
    assert.equal(tehranIsoDate(d), "2026-04-28");
  });

  it("throws on garbage input", () => {
    assert.throws(() => parseShamsi("not a date"));
  });
});
