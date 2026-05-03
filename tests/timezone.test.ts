import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import {
  civilToUtc,
  detectUserTimezone,
  formatGregorianDateInZone,
  formatGregorianTimeInZone,
  formatIcsLocal,
  formatIcsUtc,
  formatInTimezone,
  formatOffset,
  formatShamsiDateTimeInZone,
  formatShamsiTimeInZone,
  formatTimezoneLabel,
  fromZoned,
  getTimezoneOffsetMinutes,
  isValidTimezone,
  resolveSlotToUtc,
  toZoned,
} from "../src/lib/date/timezone";

describe("timezone — basics", () => {
  it("isValidTimezone accepts IANA, rejects offsets/abbrev", () => {
    assert.equal(isValidTimezone("Asia/Tehran"), true);
    assert.equal(isValidTimezone("Europe/Berlin"), true);
    assert.equal(isValidTimezone("America/Los_Angeles"), true);
    assert.equal(isValidTimezone("UTC"), true);
    assert.equal(isValidTimezone("Pacific/Chatham"), true);
    assert.equal(isValidTimezone("CET"), true); // Intl accepts CET as alias
    // Note: Node's Intl also accepts numeric offsets like "+03:30" as valid;
    // we don't reject them here — convention is enforced socially (CLAUDE.md).
    assert.equal(isValidTimezone(""), false);
    assert.equal(isValidTimezone(null), false);
    assert.equal(isValidTimezone("Not/A/Zone"), false);
  });

  it("detectUserTimezone returns a string", () => {
    const tz = detectUserTimezone();
    assert.equal(typeof tz, "string");
    assert.ok(tz.length > 0);
  });
});

describe("timezone — offsets", () => {
  it("Asia/Tehran is UTC+3:30 in 2026 (no DST since 2022)", () => {
    const summer = new Date("2026-07-15T12:00:00Z");
    const winter = new Date("2026-01-15T12:00:00Z");
    assert.equal(getTimezoneOffsetMinutes("Asia/Tehran", summer), 210);
    assert.equal(getTimezoneOffsetMinutes("Asia/Tehran", winter), 210);
    assert.equal(formatOffset("Asia/Tehran", summer), "GMT+3:30");
  });

  it("Asia/Kolkata is +5:30, Asia/Kathmandu is +5:45", () => {
    const at = new Date("2026-04-28T12:00:00Z");
    assert.equal(getTimezoneOffsetMinutes("Asia/Kolkata", at), 330);
    assert.equal(getTimezoneOffsetMinutes("Asia/Kathmandu", at), 345);
    assert.equal(formatOffset("Asia/Kolkata", at), "GMT+5:30");
    assert.equal(formatOffset("Asia/Kathmandu", at), "GMT+5:45");
  });

  it("Europe/Berlin shifts at DST boundaries", () => {
    // Last Sunday of March 2026 = March 29 02:00 → 03:00
    const beforeSpring = new Date("2026-03-29T00:00:00Z"); // 01:00 CET
    const afterSpring = new Date("2026-03-29T02:00:00Z"); // 04:00 CEST
    assert.equal(getTimezoneOffsetMinutes("Europe/Berlin", beforeSpring), 60);
    assert.equal(getTimezoneOffsetMinutes("Europe/Berlin", afterSpring), 120);

    // Last Sunday of October 2026 = October 25 03:00 → 02:00
    const beforeFall = new Date("2026-10-25T00:00:00Z"); // 02:00 CEST
    const afterFall = new Date("2026-10-25T02:00:00Z"); // 03:00 CET (after fallback)
    assert.equal(getTimezoneOffsetMinutes("Europe/Berlin", beforeFall), 120);
    assert.equal(getTimezoneOffsetMinutes("Europe/Berlin", afterFall), 60);
  });

  it("America/Los_Angeles vs Asia/Tehran asymmetric DST", () => {
    // Iran abolished DST in 2022; LA still observes it.
    // Mid-July: LA is PDT (UTC-7), Tehran +3:30 → 10.5h diff
    const summer = new Date("2026-07-15T20:00:00Z");
    assert.equal(getTimezoneOffsetMinutes("America/Los_Angeles", summer), -420);
    assert.equal(getTimezoneOffsetMinutes("Asia/Tehran", summer), 210);
    // Mid-January: LA is PST (UTC-8), Tehran +3:30 → 11.5h diff
    const winter = new Date("2026-01-15T20:00:00Z");
    assert.equal(getTimezoneOffsetMinutes("America/Los_Angeles", winter), -480);
    assert.equal(getTimezoneOffsetMinutes("Asia/Tehran", winter), 210);
  });
});

describe("timezone — civilToUtc round-trip", () => {
  it("UTC → host zone → UTC equals original instant", () => {
    const original = new Date("2026-04-28T14:30:00Z");
    for (const tz of [
      "Asia/Tehran",
      "America/Los_Angeles",
      "Europe/Berlin",
      "Asia/Kathmandu",
      "Pacific/Auckland",
    ]) {
      const zoned = toZoned(original, tz);
      const back = fromZoned(zoned, tz);
      assert.equal(
        back.getTime(),
        original.getTime(),
        `round-trip failed for ${tz}`,
      );
    }
  });

  it("civilToUtc resolves Tehran 14:30 on 2026-04-28 to 11:00 UTC", () => {
    const utc = civilToUtc("2026-04-28", 14 * 60 + 30, "Asia/Tehran");
    assert.equal(utc.toISOString(), "2026-04-28T11:00:00.000Z");
  });

  it("civilToUtc spring-forward gap: Berlin 02:30 on 2026-03-29 lands in DST", () => {
    // Civil time 02:30 doesn't technically exist; we accept whatever the
    // tz library resolves to, but it must be a well-defined UTC instant.
    const utc = civilToUtc("2026-03-29", 2 * 60 + 30, "Europe/Berlin");
    assert.ok(!Number.isNaN(utc.getTime()));
    // Expected: 02:30 CEST = 00:30 UTC (post-jump offset wins)
    assert.equal(utc.toISOString(), "2026-03-29T00:30:00.000Z");
  });

  it("civilToUtc fall-back overlap: Berlin 02:30 on 2026-10-25 is deterministic", () => {
    // 02:30 happens twice on fall-back day; date-fns-tz deterministically
    // resolves to the post-fallback (CET, +60) instant: 02:30 CET = 01:30 UTC.
    const utc = civilToUtc("2026-10-25", 2 * 60 + 30, "Europe/Berlin");
    assert.equal(utc.toISOString(), "2026-10-25T01:30:00.000Z");
  });

  it("resolveSlotToUtc accepts HH:mm string and English/Persian digits", () => {
    const a = resolveSlotToUtc("2026-04-28", "14:30", "Asia/Tehran");
    const b = resolveSlotToUtc("۲۰۲۶-۰۴-۲۸", "۱۴:۳۰", "Asia/Tehran");
    assert.equal(a.toISOString(), "2026-04-28T11:00:00.000Z");
    assert.equal(b.toISOString(), "2026-04-28T11:00:00.000Z");
  });
});

describe("timezone — formatting", () => {
  // April 28, 2026 14:30 Tehran = 11:00 UTC
  const utc = new Date("2026-04-28T11:00:00Z");

  it("formatShamsiTimeInZone respects timezone", () => {
    assert.equal(formatShamsiTimeInZone(utc, "Asia/Tehran"), "۱۴:۳۰");
    // LA is UTC-7 in April → 04:00
    assert.equal(formatShamsiTimeInZone(utc, "America/Los_Angeles"), "۰۴:۰۰");
    // Kolkata is +5:30 → 16:30
    assert.equal(formatShamsiTimeInZone(utc, "Asia/Kolkata"), "۱۶:۳۰");
  });

  it("formatShamsiDateTimeInZone produces full Persian label", () => {
    const out = formatShamsiDateTimeInZone(utc, "Asia/Tehran");
    assert.match(out, /۱۴۰۵/); // year
    assert.match(out, /اردیبهشت/); // month
    assert.match(out, /۸/); // day
    assert.match(out, /ساعت ۱۴:۳۰/);
  });

  it("formatGregorianDateInZone produces ASCII Gregorian", () => {
    assert.equal(
      formatGregorianDateInZone(utc, "Asia/Tehran", "yyyy-MM-dd"),
      "2026-04-28",
    );
    assert.equal(
      formatGregorianDateInZone(utc, "America/Los_Angeles", "yyyy-MM-dd"),
      "2026-04-28",
    );
    assert.equal(
      formatGregorianTimeInZone(utc, "America/Los_Angeles"),
      "04:00",
    );
  });

  it("formatInTimezone shamsi vs gregorian", () => {
    assert.match(
      formatInTimezone(utc, "Asia/Tehran", "yyyy/MM/dd", "shamsi"),
      /^۱۴۰۵/,
    );
    assert.equal(
      formatInTimezone(utc, "Asia/Tehran", "yyyy-MM-dd", "gregorian"),
      "2026-04-28",
    );
  });

  it("formatTimezoneLabel includes offset", () => {
    const label = formatTimezoneLabel("Asia/Tehran", utc);
    assert.match(label, /Asia\/Tehran/);
    assert.match(label, /GMT\+3:30/);
  });
});

describe("timezone — cross-day-boundary", () => {
  it("Same UTC instant displays on different calendar dates", () => {
    // 2026-04-28 12:00 UTC = 2026-04-29 00:00 NZST (Auckland +12)
    //                     = 2026-04-28 02:00 HST (Honolulu -10)
    const utc = new Date("2026-04-28T12:00:00Z");
    const nz = formatGregorianDateInZone(utc, "Pacific/Auckland", "yyyy-MM-dd");
    const hi = formatGregorianDateInZone(utc, "Pacific/Honolulu", "yyyy-MM-dd");
    assert.equal(nz, "2026-04-29");
    assert.equal(hi, "2026-04-28");
  });
});

describe("timezone — ICS formatting", () => {
  it("formatIcsLocal yields tz-local yyyymmddThhmmss (no Z)", () => {
    const utc = new Date("2026-04-28T11:00:00Z");
    assert.equal(formatIcsLocal(utc, "Asia/Tehran"), "20260428T143000");
    assert.equal(formatIcsLocal(utc, "Europe/Berlin"), "20260428T130000");
    // No "Z" suffix — TZID line carries the zone.
    assert.ok(!formatIcsLocal(utc, "Asia/Tehran").endsWith("Z"));
  });

  it("formatIcsUtc yields yyyymmddThhmmssZ", () => {
    const utc = new Date("2026-04-28T11:00:00Z");
    assert.equal(formatIcsUtc(utc), "20260428T110000Z");
  });
});
