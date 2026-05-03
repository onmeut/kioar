/**
 * Universal Persian (Shamsi/Jalali) calendar utilities — single source of truth.
 *
 * RULES:
 *   - Database stores UTC Gregorian timestamps (Postgres timestamptz). Always.
 *   - Display layer renders Shamsi via this module. Always.
 *   - All "today / now" reasoning is anchored to Asia/Tehran wall time.
 *   - No other module in the codebase may import `date-fns-jalali` directly,
 *     and no component may hardcode Persian month names. If you need a new
 *     formatter, add it here.
 *
 * Iran abolished DST in 2022; Asia/Tehran is a stable UTC+03:30 since then.
 * Historical bookings before that may carry a different offset which the
 * IANA tz database handles transparently — we never compute offsets manually.
 */

import {
  addMonths as jAddMonths,
  endOfDay as jEndOfDay,
  endOfMonth as jEndOfMonth,
  endOfWeek as jEndOfWeek,
  format as jFormat,
  getDate as jGetDate,
  getDay as jGetDay,
  getDaysInMonth as jGetDaysInMonth,
  getMonth as jGetMonth,
  getYear as jGetYear,
  isAfter as jIsAfter,
  isBefore as jIsBefore,
  isSameDay as jIsSameDay,
  parse as jParse,
  startOfDay as jStartOfDay,
  startOfMonth as jStartOfMonth,
  startOfWeek as jStartOfWeek,
  subMonths as jSubMonths,
} from "date-fns-jalali";

// ───────────────────────────────────────────────────────────────
// Digit conversion
// ───────────────────────────────────────────────────────────────

const easternArabicNumerals = "٠١٢٣٤٥٦٧٨٩";
const persianNumerals = "۰۱۲۳۴۵۶۷۸۹";

export function toPersianDigits(value: string | number): string {
  return String(value).replace(/\d/g, (d) => persianNumerals[Number(d)]);
}

export function toEnglishDigits(input: string): string {
  return input
    .replace(/[۰-۹]/g, (d) => String(persianNumerals.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String(easternArabicNumerals.indexOf(d)));
}

// ───────────────────────────────────────────────────────────────
// Timezone — everything anchors to Asia/Tehran for "what day is it"
// ───────────────────────────────────────────────────────────────

export const IRAN_TIMEZONE = "Asia/Tehran" as const;

const tehranPartsFmt = new Intl.DateTimeFormat("en-US", {
  timeZone: IRAN_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

/**
 * Returns a `Date` whose local-zone fields (`getFullYear`, `getDate`, etc.)
 * read as Tehran wall-clock time. Use this whenever you need to feed a
 * `date-fns-jalali` arithmetic helper, since those helpers operate on local
 * fields. The returned object's UTC instant is **shifted** and is therefore
 * NOT a real timestamp — never persist or send it over the wire.
 */
export function tehranLocalView(
  input: Date | string | number = new Date(),
): Date {
  const date = input instanceof Date ? input : new Date(input);
  const parts = Object.fromEntries(
    tehranPartsFmt.formatToParts(date).map((p) => [p.type, p.value]),
  ) as Record<string, string>;
  return new Date(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour === "24" ? "0" : parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
}

// ───────────────────────────────────────────────────────────────
// Formatting — Intl with Persian calendar + Tehran timezone
// ───────────────────────────────────────────────────────────────

const dateLongFmt = new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
  timeZone: IRAN_TIMEZONE,
  year: "numeric",
  month: "long",
  day: "numeric",
});

const dateTimeLongFmt = new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
  timeZone: IRAN_TIMEZONE,
  year: "numeric",
  month: "long",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const dateShortFmt = new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
  timeZone: IRAN_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const timeFmt = new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
  timeZone: IRAN_TIMEZONE,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const monthYearFmt = new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
  timeZone: IRAN_TIMEZONE,
  year: "numeric",
  month: "long",
});

const weekdayDayMonthFmt = new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
  timeZone: IRAN_TIMEZONE,
  weekday: "long",
  day: "numeric",
  month: "long",
});

const persianNumberFmt = new Intl.NumberFormat("fa-IR");

function toDate(input: Date | string | number): Date {
  return input instanceof Date ? input : new Date(input);
}

/** ۸ اردیبهشت ۱۴۰۵ */
export function formatShamsiDate(input: Date | string | number): string {
  return dateLongFmt.format(toDate(input));
}

/** ۸ اردیبهشت ۱۴۰۵، ساعت ۱۴:۳۰ — composed so we can prefix “ساعت”. */
export function formatShamsiDateTime(input: Date | string | number): string {
  const d = toDate(input);
  // Intl outputs "۸ اردیبهشت ۱۴۰۵، ۱۴:۳۰" — we splice "ساعت" before the time.
  const date = dateLongFmt.format(d);
  const time = timeFmt.format(d);
  return `${date}، ساعت ${time}`;
}

/** ۱۴۰۵/۰۱/۲۹ */
export function formatShamsiShort(input: Date | string | number): string {
  return dateShortFmt.format(toDate(input));
}

/** ۱۴:۳۰ */
export function formatShamsiTime(input: Date | string | number): string {
  return timeFmt.format(toDate(input));
}

/** فروردین ۱۴۰۵ — header label for a Shamsi month grid. */
export function formatShamsiMonthYear(input: Date | string | number): string {
  return monthYearFmt.format(toDate(input));
}

/** پنج‌شنبه، ۸ اردیبهشت */
export function formatShamsiWeekdayDayMonth(
  input: Date | string | number,
): string {
  return weekdayDayMonthFmt.format(toDate(input));
}

/** Localised number with Persian digits, e.g. ۱٬۲۳۴ */
export function formatPersianNumber(value: number): string {
  return persianNumberFmt.format(value);
}

/**
 * Relative time in Persian — "۲ روز پیش" / "۳ ساعت دیگر".
 * Uses `Intl.RelativeTimeFormat` with `fa` locale.
 */
const relativeFmt = new Intl.RelativeTimeFormat("fa", { numeric: "auto" });
const RELATIVE_UNITS: Array<{ unit: Intl.RelativeTimeFormatUnit; ms: number }> =
  [
    { unit: "year", ms: 365 * 24 * 60 * 60 * 1000 },
    { unit: "month", ms: 30 * 24 * 60 * 60 * 1000 },
    { unit: "week", ms: 7 * 24 * 60 * 60 * 1000 },
    { unit: "day", ms: 24 * 60 * 60 * 1000 },
    { unit: "hour", ms: 60 * 60 * 1000 },
    { unit: "minute", ms: 60 * 1000 },
    { unit: "second", ms: 1000 },
  ];

export function formatShamsiRelative(
  input: Date | string | number,
  reference: Date | string | number = new Date(),
): string {
  const target = toDate(input).getTime();
  const ref = toDate(reference).getTime();
  const diff = target - ref;
  for (const { unit, ms } of RELATIVE_UNITS) {
    if (Math.abs(diff) >= ms || unit === "second") {
      return relativeFmt.format(Math.round(diff / ms), unit);
    }
  }
  return relativeFmt.format(0, "second");
}

// ───────────────────────────────────────────────────────────────
// Calendar arithmetic — operate on Jalali via date-fns-jalali on
// a Tehran-shifted view of the input. Returned `Date`s are shifted
// (Tehran-as-local) and only meant to be formatted/iterated, not
// persisted. Convert back to a real ISO string with `tehranIsoDate`.
// ───────────────────────────────────────────────────────────────

export function shamsiStartOfDay(
  input: Date | string | number = new Date(),
): Date {
  return jStartOfDay(tehranLocalView(input));
}

export function shamsiEndOfDay(
  input: Date | string | number = new Date(),
): Date {
  return jEndOfDay(tehranLocalView(input));
}

export function shamsiStartOfMonth(
  input: Date | string | number = new Date(),
): Date {
  return jStartOfMonth(tehranLocalView(input));
}

export function shamsiEndOfMonth(
  input: Date | string | number = new Date(),
): Date {
  return jEndOfMonth(tehranLocalView(input));
}

/** Saturday-first (Iranian week). */
export function shamsiStartOfWeek(
  input: Date | string | number = new Date(),
): Date {
  return jStartOfWeek(tehranLocalView(input), { weekStartsOn: 6 });
}

export function shamsiEndOfWeek(
  input: Date | string | number = new Date(),
): Date {
  return jEndOfWeek(tehranLocalView(input), { weekStartsOn: 6 });
}

export function shamsiAddMonths(
  input: Date | string | number,
  months: number,
): Date {
  return jAddMonths(tehranLocalView(input), months);
}

export function shamsiSubMonths(
  input: Date | string | number,
  months: number,
): Date {
  return jSubMonths(tehranLocalView(input), months);
}

export function shamsiDaysInMonth(
  input: Date | string | number = new Date(),
): number {
  return jGetDaysInMonth(tehranLocalView(input));
}

/** 0=Farvardin … 11=Esfand. */
export function shamsiMonth(
  input: Date | string | number = new Date(),
): number {
  return jGetMonth(tehranLocalView(input));
}

export function shamsiYear(input: Date | string | number = new Date()): number {
  return jGetYear(tehranLocalView(input));
}

export function shamsiDayOfMonth(
  input: Date | string | number = new Date(),
): number {
  return jGetDate(tehranLocalView(input));
}

/**
 * Day of week as an Iranian-week column index (Sat=0 … Fri=6). Useful for
 * laying out a calendar grid where the first column is Saturday.
 */
export function shamsiWeekdayColumn(
  input: Date | string | number = new Date(),
): number {
  // date-fns-jalali getDay returns 0=Sun..6=Sat; map to Sat=0..Fri=6.
  const dow = jGetDay(tehranLocalView(input));
  return (dow + 1) % 7;
}

export function shamsiIsSameDay(
  a: Date | string | number,
  b: Date | string | number,
): boolean {
  return jIsSameDay(tehranLocalView(a), tehranLocalView(b));
}

export function shamsiIsBefore(
  a: Date | string | number,
  b: Date | string | number,
): boolean {
  return jIsBefore(tehranLocalView(a), tehranLocalView(b));
}

export function shamsiIsAfter(
  a: Date | string | number,
  b: Date | string | number,
): boolean {
  return jIsAfter(tehranLocalView(a), tehranLocalView(b));
}

// ───────────────────────────────────────────────────────────────
// ISO dates anchored to Tehran
// ───────────────────────────────────────────────────────────────

const tehranIsoFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: IRAN_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/**
 * Returns the Gregorian YYYY-MM-DD that the given instant falls on in
 * Asia/Tehran. This is what backend booking queries expect as `dateIso`.
 */
export function tehranIsoDate(
  input: Date | string | number = new Date(),
): string {
  return tehranIsoFmt.format(toDate(input));
}

// ───────────────────────────────────────────────────────────────
// Parsing — Shamsi → Date
// ───────────────────────────────────────────────────────────────

/**
 * Parse a Shamsi date string in `yyyy/MM/dd` (or `yyyy-MM-dd`) form into a
 * real `Date` (UTC instant) representing midnight Asia/Tehran on that day.
 *
 * Accepts both Persian and English digits.
 */
export function parseShamsi(input: string): Date {
  const normalized = toEnglishDigits(input).trim().replace(/-/g, "/");
  // Use a deterministic anchor — noon — to dodge DST edges historically.
  const localView = jParse(normalized, "yyyy/MM/dd", new Date(2000, 0, 1));
  if (Number.isNaN(localView.getTime())) {
    throw new Error(`Invalid Shamsi date: ${input}`);
  }
  // localView fields are Jalali-converted Gregorian-local values. We need to
  // treat them as Tehran wall-clock time.
  const y = localView.getFullYear();
  const m = String(localView.getMonth() + 1).padStart(2, "0");
  const d = String(localView.getDate()).padStart(2, "0");
  // Tehran is UTC+3:30 (no DST since 2022); for older dates the offset may
  // differ. We construct via a known-good anchor: midnight at the date in
  // Tehran tz expressed as a UTC instant. We do this by binary-searching
  // the offset using Intl, or — simpler — by accepting the +03:30 offset
  // since pre-2022 historical data is out of scope for date pickers.
  return new Date(`${y}-${m}-${d}T00:00:00+03:30`);
}

// ───────────────────────────────────────────────────────────────
// Generic format passthrough — for the rare case a caller needs a
// custom Jalali pattern. Output digits are converted to Persian.
// ───────────────────────────────────────────────────────────────

export function formatShamsi(
  input: Date | string | number,
  pattern = "d MMMM yyyy",
): string {
  return toPersianDigits(jFormat(tehranLocalView(input), pattern));
}
