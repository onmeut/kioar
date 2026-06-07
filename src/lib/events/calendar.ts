/**
 * Add-to-calendar builders. Pure (no DB / server-only) so they're testable and
 * usable on the client. Two outputs:
 *   - a full `.ics` document (Apple Calendar / Outlook / most clients) with a
 *     `VTIMEZONE`-aware `DTSTART;TZID=` via `formatIcsLocal`,
 *   - a Google Calendar event-template URL.
 *
 * Timezone correctness: DTSTART/DTEND carry the host's IANA zone as a TZID; the
 * Google URL uses UTC `Z` instants with an explicit `ctz` so both render the
 * same wall-clock to the attendee regardless of their device zone.
 */

import { formatIcsLocal, formatIcsUtc } from "@/lib/date/timezone";

export type CalendarEventInput = {
  title: string;
  description?: string | null;
  /** Physical address or, for approved attendees, the online URL. */
  location?: string | null;
  startsAt: Date;
  /** Defaults to start + 1h when absent (calendars require an end). */
  endsAt?: Date | null;
  timezone: string;
  /** Stable id for the ICS UID (the event id). */
  uid: string;
  /** Canonical public URL, appended to the description. */
  url?: string | null;
};

function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

function endOrDefault(input: CalendarEventInput): Date {
  if (input.endsAt) return input.endsAt;
  return new Date(input.startsAt.getTime() + 60 * 60 * 1000);
}

/**
 * Build a complete `.ics` document string. Uses `DTSTART;TZID=` local wall-clock
 * lines (the recipient's calendar resolves the zone); `DTSTAMP` is UTC.
 */
export function buildIcs(input: CalendarEventInput): string {
  const end = endOrDefault(input);
  const tz = input.timezone;

  const descParts = [input.description?.trim(), input.url?.trim()].filter(
    Boolean,
  ) as string[];
  const description = descParts.join("\n\n");

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Kioar//Events//FA",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${input.uid}@kioar`,
    `DTSTAMP:${formatIcsUtc(new Date())}`,
    `DTSTART;TZID=${tz}:${formatIcsLocal(input.startsAt, tz)}`,
    `DTEND;TZID=${tz}:${formatIcsLocal(end, tz)}`,
    `SUMMARY:${escapeIcsText(input.title)}`,
  ];
  if (description) lines.push(`DESCRIPTION:${escapeIcsText(description)}`);
  if (input.location?.trim()) {
    lines.push(`LOCATION:${escapeIcsText(input.location.trim())}`);
  }
  lines.push("END:VEVENT", "END:VCALENDAR");

  // CRLF line endings per RFC 5545.
  return lines.join("\r\n");
}

/**
 * Build a Google Calendar "add event" template URL. `dates` are UTC instants;
 * `ctz` pins the display timezone so the wall-clock matches the host's zone.
 */
export function buildGoogleCalendarUrl(input: CalendarEventInput): string {
  const end = endOrDefault(input);
  const dates = `${formatIcsUtc(input.startsAt)}/${formatIcsUtc(end)}`;

  const descParts = [input.description?.trim(), input.url?.trim()].filter(
    Boolean,
  ) as string[];

  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: input.title,
    dates,
    ctz: input.timezone,
  });
  if (descParts.length) params.set("details", descParts.join("\n\n"));
  if (input.location?.trim()) params.set("location", input.location.trim());

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
