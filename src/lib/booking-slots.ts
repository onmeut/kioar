// ---------------------------------------------------------------------------
// Slot computation
// ---------------------------------------------------------------------------
// Pure helpers that, given a booking block's availability (weekly recurring
// windows in the block's own timezone) + the duration of a chosen booking
// type + the list of already-confirmed bookings that overlap the target day,
// return the bookable time slots for a single calendar day.
//
// All times are returned as **UTC ISO strings** so the client can render
// them in the visitor's timezone without any extra conversion logic.
//
// Design notes:
//   - We compute slot boundaries in the block's timezone by turning
//     (year, month, day, hour, minute) into a "civil time" string and then
//     back-resolving the UTC instant via the Intl timeZone offset trick.
//   - Buffers (before / after meetings) are applied by shrinking the
//     availability windows at each pass.
//   - No DST-specific hack is needed because we always work from (Y, M, D,
//     minuteOfDay) → offset → UTC instant, not from a UTC anchor.

import type { BookingAvailabilityWindow } from "@/lib/validations";

export type ConfirmedBooking = {
  startsAt: Date;
  endsAt: Date;
};

export type GenerateSlotsInput = {
  /** IANA timezone of the booking block. */
  timezone: string;
  /** The visible weekly availability windows. */
  availability: BookingAvailabilityWindow[];
  /** Duration of the picked booking type, in minutes. */
  durationMin: number;
  /** Buffer minutes before each meeting, applied to availability. */
  bufferBeforeMin: number;
  /** Buffer minutes after each meeting, applied to availability. */
  bufferAfterMin: number;
  /** ISO date ("YYYY-MM-DD") of the target day, interpreted in `timezone`. */
  targetDateIso: string;
  /** Existing confirmed bookings that could overlap this day. */
  existingBookings: ConfirmedBooking[];
  /** Slot increment in minutes — defaults to 15 like the screenshots. */
  stepMin?: number;
  /** Optional floor — slots before this instant are discarded. */
  earliest?: Date;
};

export type GeneratedSlot = {
  startIso: string;
  endIso: string;
};

const DEFAULT_STEP = 15;

/**
 * Returns the UTC offset (in minutes) of `timezone` at a given UTC instant.
 * Positive for timezones east of UTC.
 */
function timezoneOffsetMinutes(date: Date, timezone: string): number {
  // Intl returns the wall-clock time in the target zone; we diff it against
  // UTC to recover the offset. This works across DST transitions.
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

/**
 * Converts a civil time (date + minute of day) in `timezone` to a UTC Date.
 */
function civilToUtc(
  dateIso: string,
  minuteOfDay: number,
  timezone: string,
): Date {
  const [y, m, d] = dateIso.split("-").map(Number);
  // Start from the naive UTC equivalent; adjust by the tz's offset at that
  // instant. Two-pass to handle DST edges.
  const naive = new Date(
    Date.UTC(y, (m ?? 1) - 1, d ?? 1, 0, 0, 0) + minuteOfDay * 60_000,
  );
  const offset1 = timezoneOffsetMinutes(naive, timezone);
  const candidate = new Date(naive.getTime() - offset1 * 60_000);
  const offset2 = timezoneOffsetMinutes(candidate, timezone);
  if (offset1 === offset2) return candidate;
  return new Date(naive.getTime() - offset2 * 60_000);
}

/** Returns the day-of-week (0–6, Sun–Sat) of `dateIso` in `timezone`. */
export function dayOfWeekInTimezone(dateIso: string, timezone: string): number {
  const anchor = civilToUtc(dateIso, 12 * 60, timezone);
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "short",
  });
  const wk = dtf.format(anchor);
  // Sun=0 … Sat=6
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(wk);
}

/**
 * Subtract existing bookings from `[start, end)` returning the remaining
 * free intervals.
 */
function subtractBusy(
  start: Date,
  end: Date,
  busy: ConfirmedBooking[],
): Array<{ start: Date; end: Date }> {
  const overlapping = busy
    .filter((b) => b.endsAt > start && b.startsAt < end)
    .map((b) => ({
      start: b.startsAt < start ? start : b.startsAt,
      end: b.endsAt > end ? end : b.endsAt,
    }))
    .sort((a, b) => a.start.getTime() - b.start.getTime());

  const free: Array<{ start: Date; end: Date }> = [];
  let cursor = start.getTime();
  for (const b of overlapping) {
    if (b.start.getTime() > cursor) {
      free.push({ start: new Date(cursor), end: b.start });
    }
    cursor = Math.max(cursor, b.end.getTime());
  }
  if (cursor < end.getTime()) {
    free.push({ start: new Date(cursor), end });
  }
  return free;
}

export function generateBookingSlots({
  timezone,
  availability,
  durationMin,
  bufferBeforeMin,
  bufferAfterMin,
  targetDateIso,
  existingBookings,
  stepMin = DEFAULT_STEP,
  earliest,
}: GenerateSlotsInput): GeneratedSlot[] {
  if (!availability.length || durationMin <= 0) return [];

  const dow = dayOfWeekInTimezone(targetDateIso, timezone);
  const todayWindows = availability.filter((a) => a.dayOfWeek === dow);
  if (!todayWindows.length) return [];

  const slots: GeneratedSlot[] = [];

  for (const window of todayWindows) {
    const windowStart = civilToUtc(targetDateIso, window.startMinute, timezone);
    const windowEnd = civilToUtc(targetDateIso, window.endMinute, timezone);

    // Apply existing bookings + per-meeting buffers by padding busy intervals.
    const paddedBusy: ConfirmedBooking[] = existingBookings.map((b) => ({
      startsAt: new Date(b.startsAt.getTime() - bufferBeforeMin * 60_000),
      endsAt: new Date(b.endsAt.getTime() + bufferAfterMin * 60_000),
    }));

    const freeIntervals = subtractBusy(windowStart, windowEnd, paddedBusy);

    for (const free of freeIntervals) {
      // Iterate slot starts inside `[free.start, free.end - duration]`,
      // stepping by `stepMin`.
      const freeStartMs = free.start.getTime();
      const freeEndMs = free.end.getTime();
      const durationMs = durationMin * 60_000;
      const stepMs = stepMin * 60_000;

      for (let t = freeStartMs; t + durationMs <= freeEndMs; t += stepMs) {
        const startDate = new Date(t);
        if (earliest && startDate < earliest) continue;
        slots.push({
          startIso: startDate.toISOString(),
          endIso: new Date(t + durationMs).toISOString(),
        });
      }
    }
  }

  // De-duplicate + sort (unlikely duplicates when windows overlap, but safe).
  const seen = new Set<string>();
  return slots
    .filter((s) =>
      seen.has(s.startIso) ? false : (seen.add(s.startIso), true),
    )
    .sort((a, b) => a.startIso.localeCompare(b.startIso));
}
