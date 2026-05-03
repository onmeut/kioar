/**
 * Universal timezone utilities — pairs with `./persian.ts`.
 *
 * RULES (locked-in, see CLAUDE.md):
 *   - All `timestamptz` columns are UTC. Always.
 *   - Future scheduled events store UTC + IANA timezone. Recurring rules
 *     must store the IANA zone (never an offset) so DST survives.
 *   - Display layer converts UTC → user's timezone here. Never store
 *     timezone offsets ("+02:00") or abbreviations ("CET") as identifiers.
 *   - Only this module and `./persian.ts` may import `date-fns-tz` /
 *     `date-fns-jalali`. Everything else imports from us.
 */

import { format as fnsFormat } from "date-fns";
import { format as jFormat } from "date-fns-jalali";
import { formatInTimeZone, fromZonedTime, toZonedTime } from "date-fns-tz";

import { IRAN_TIMEZONE, toEnglishDigits, toPersianDigits } from "./persian";

export { IRAN_TIMEZONE };

// ───────────────────────────────────────────────────────────────
// Detection
// ───────────────────────────────────────────────────────────────

/** Detect the viewer's IANA zone via the Intl API, with a safe fallback. */
export function detectUserTimezone(fallback: string = IRAN_TIMEZONE): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || fallback;
  } catch {
    return fallback;
  }
}

/** Validate that a string is a real IANA zone the runtime knows about. */
export function isValidTimezone(tz: string | null | undefined): tz is string {
  if (!tz || typeof tz !== "string") return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

// ───────────────────────────────────────────────────────────────
// Conversions
// ───────────────────────────────────────────────────────────────

function toDate(input: Date | string | number): Date {
  return input instanceof Date ? input : new Date(input);
}

/**
 * Wall-clock view of `utc` in `timezone`. The returned Date's local-zone
 * fields read as `timezone` wall time. Its UTC instant is shifted — never
 * persist or send it over the wire. Use this for date-fns arithmetic.
 */
export function toZoned(utc: Date | string | number, timezone: string): Date {
  return toZonedTime(toDate(utc), timezone);
}

/** Inverse of {@link toZoned}: wall-clock + zone → real UTC instant. */
export function fromZoned(
  localTime: Date | string | number,
  timezone: string,
): Date {
  return fromZonedTime(toDate(localTime), timezone);
}

// ───────────────────────────────────────────────────────────────
// Formatting in arbitrary timezones
// ───────────────────────────────────────────────────────────────

export type CalendarSystem = "shamsi" | "gregorian";

/**
 * Format a UTC instant in a specific timezone, in either Shamsi or
 * Gregorian. Output digits are Persian for Shamsi and English for
 * Gregorian by default.
 */
export function formatInTimezone(
  utc: Date | string | number,
  timezone: string,
  pattern: string = "yyyy-MM-dd HH:mm",
  calendar: CalendarSystem = "shamsi",
): string {
  const date = toDate(utc);
  if (calendar === "gregorian") {
    return formatInTimeZone(date, timezone, pattern);
  }
  // For Shamsi we shift the UTC instant into `timezone` wall time, then
  // hand the shifted local view to date-fns-jalali (which formats local
  // fields as Jalali).
  const zoned = toZonedTime(date, timezone);
  return toPersianDigits(jFormat(zoned, pattern));
}

/** ۸ اردیبهشت ۱۴۰۵ — Shamsi date in `timezone`. */
export function formatShamsiDateInZone(
  utc: Date | string | number,
  timezone: string,
): string {
  return formatInTimezone(utc, timezone, "d MMMM yyyy", "shamsi");
}

/** ۱۴:۳۰ — 24-hour Shamsi-formatted time in `timezone`. */
export function formatShamsiTimeInZone(
  utc: Date | string | number,
  timezone: string,
): string {
  return formatInTimezone(utc, timezone, "HH:mm", "shamsi");
}

/** ۸ اردیبهشت ۱۴۰۵، ساعت ۱۴:۳۰ — composed for the "ساعت" prefix. */
export function formatShamsiDateTimeInZone(
  utc: Date | string | number,
  timezone: string,
): string {
  const date = formatInTimezone(utc, timezone, "d MMMM yyyy", "shamsi");
  const time = formatInTimezone(utc, timezone, "HH:mm", "shamsi");
  return `${date}، ساعت ${time}`;
}

/** Tue, Apr 28, 2026 — Gregorian date in `timezone`. */
export function formatGregorianDateInZone(
  utc: Date | string | number,
  timezone: string,
  pattern = "EEE, MMM d, yyyy",
): string {
  return formatInTimezone(utc, timezone, pattern, "gregorian");
}

/** 14:30 — 24-hour Gregorian time in `timezone`. */
export function formatGregorianTimeInZone(
  utc: Date | string | number,
  timezone: string,
): string {
  return formatInTimeZone(toDate(utc), timezone, "HH:mm");
}

/**
 * Format a date that already represents a wall-clock time (e.g. a slot
 * civil time you've decoded) — useful when you have a Date not a UTC instant.
 */
export function formatWallClock(
  wallClock: Date,
  pattern = "HH:mm",
  calendar: CalendarSystem = "shamsi",
): string {
  if (calendar === "gregorian") return fnsFormat(wallClock, pattern);
  return toPersianDigits(jFormat(wallClock, pattern));
}

// ───────────────────────────────────────────────────────────────
// Offsets & labels
// ───────────────────────────────────────────────────────────────

/**
 * UTC offset (in minutes) of `timezone` at a given UTC instant. Positive
 * = east of UTC. Recomputes for DST.
 */
export function getTimezoneOffsetMinutes(
  timezone: string,
  at: Date | string | number = new Date(),
): number {
  const date = toDate(at);
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = dtf.formatToParts(date);
  const get = (t: string) =>
    Number(parts.find((p) => p.type === t)?.value ?? "0");
  const asUtcMs = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour"),
    get("minute"),
    get("second"),
  );
  return Math.round((asUtcMs - date.getTime()) / 60000);
}

/** "GMT+3:30" — recomputes for DST. */
export function formatOffset(
  timezone: string,
  at: Date | string | number = new Date(),
  digits: "english" | "persian" = "english",
): string {
  const m = getTimezoneOffsetMinutes(timezone, at);
  const sign = m >= 0 ? "+" : "−";
  const abs = Math.abs(m);
  const h = Math.floor(abs / 60);
  const min = abs % 60;
  const raw =
    min === 0
      ? `GMT${sign}${h}`
      : `GMT${sign}${h}:${String(min).padStart(2, "0")}`;
  return digits === "persian" ? toPersianDigits(raw) : raw;
}

/** "CET" / "PST" / "GMT+3:30" — short tz abbreviation if the runtime exposes one. */
export function getTimezoneAbbreviation(
  timezone: string,
  at: Date | string | number = new Date(),
  locale = "en-US",
): string {
  try {
    const parts = new Intl.DateTimeFormat(locale, {
      timeZone: timezone,
      timeZoneName: "short",
    }).formatToParts(toDate(at));
    const tz = parts.find((p) => p.type === "timeZoneName")?.value;
    if (tz && !/GMT/.test(tz)) return tz;
  } catch {
    // fall through
  }
  return formatOffset(timezone, at);
}

/**
 * "Asia/Tehran (GMT+3:30)" — human label for a zone with current offset
 * suffixed. Recomputes for DST.
 */
export function formatTimezoneLabel(
  timezone: string,
  at: Date | string | number = new Date(),
  digits: "english" | "persian" = "english",
): string {
  return `${timezone} (${formatOffset(timezone, at, digits)})`;
}

// ───────────────────────────────────────────────────────────────
// Slot resolution — DST-safe
// ───────────────────────────────────────────────────────────────

/**
 * Resolve a (calendar date in host's tz, time-of-day, host's tz) triple to
 * the UTC instant. DST-safe: handles spring-forward gaps (the missing hour
 * resolves into the next valid offset) and fall-back overlaps (the first
 * occurrence is chosen). Use this when generating booking slots from
 * recurring availability rules.
 *
 * @param dateIso "YYYY-MM-DD" — calendar date in the host's timezone.
 * @param timeOfDay "HH:mm" — 24-hour wall-clock time in the host's timezone.
 * @param timezone IANA zone of the host.
 */
export function resolveSlotToUtc(
  dateIso: string,
  timeOfDay: string,
  timezone: string,
): Date {
  const [hh, mm] = toEnglishDigits(timeOfDay).split(":").map(Number);
  const minuteOfDay = (hh ?? 0) * 60 + (mm ?? 0);
  return civilToUtc(toEnglishDigits(dateIso), minuteOfDay, timezone);
}

/**
 * Convert a civil time (date + minute of day) in `timezone` to a UTC Date.
 * Delegates to `date-fns-tz` `fromZonedTime` for DST-correct resolution
 * of spring-forward gaps and fall-back overlaps.
 */
export function civilToUtc(
  dateIso: string,
  minuteOfDay: number,
  timezone: string,
): Date {
  const hh = Math.floor(minuteOfDay / 60);
  const mm = minuteOfDay % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  // ISO-without-Z is interpreted by date-fns-tz as wall-clock time in `timezone`.
  const wall = `${dateIso}T${pad(hh)}:${pad(mm)}:00`;
  return fromZonedTime(wall, timezone);
}

// ───────────────────────────────────────────────────────────────
// ICS — TZID-aware date formatting
// ───────────────────────────────────────────────────────────────

/**
 * Format a UTC instant for inclusion in an ICS `DTSTART;TZID=…:` line.
 * Outputs the local wall-clock time in `timezone` as `yyyymmddThhmmss`
 * (no `Z` suffix — the recipient's calendar applies the TZID).
 */
export function formatIcsLocal(
  utc: Date | string | number,
  timezone: string,
): string {
  return formatInTimeZone(toDate(utc), timezone, "yyyyMMdd'T'HHmmss");
}

/** Format a UTC instant as `yyyymmddThhmmssZ` for floating ICS lines. */
export function formatIcsUtc(utc: Date | string | number): string {
  return formatInTimeZone(toDate(utc), "UTC", "yyyyMMdd'T'HHmmss'Z'");
}

// ───────────────────────────────────────────────────────────────
// Common timezone list — re-exports from `lib/timezones.ts` so callers
// only need this one entry point. Kept here as thin re-exports.
// ───────────────────────────────────────────────────────────────

export {
  buildTimezoneOptions as getAllTimezones,
  detectTimezone,
  type TimezoneOption,
} from "@/lib/timezones";
