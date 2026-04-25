// Timezone helpers shared by the booking owner setup flow and the public
// booking modal. We keep a curated list of IANA zones with friendly labels
// in Persian (where natural) so the dropdown isn't a wall of text.
//
// `Intl.supportedValuesOf("timeZone")` is great but ships ~600 entries; for
// a Persian-first product we surface the common ones with the user's local
// zone pinned to the top + searchable fallbacks.

export type TimezoneOption = {
  value: string; // IANA, e.g. "Asia/Tehran"
  label: string; // human label, RTL-safe
  region: string; // grouping label
};

/** Detect the visitor's IANA timezone with a safe fallback. */
export function detectTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Tehran";
  } catch {
    return "Asia/Tehran";
  }
}

/** Curated set of common timezones, prioritising Iran + nearby + global hubs. */
const CURATED: TimezoneOption[] = [
  {
    value: "Asia/Tehran",
    label: "تهران (Asia/Tehran)",
    region: "ایران و خاورمیانه",
  },
  {
    value: "Asia/Dubai",
    label: "دبی (Asia/Dubai)",
    region: "ایران و خاورمیانه",
  },
  {
    value: "Asia/Qatar",
    label: "دوحه (Asia/Qatar)",
    region: "ایران و خاورمیانه",
  },
  {
    value: "Asia/Riyadh",
    label: "ریاض (Asia/Riyadh)",
    region: "ایران و خاورمیانه",
  },
  {
    value: "Asia/Baghdad",
    label: "بغداد (Asia/Baghdad)",
    region: "ایران و خاورمیانه",
  },
  {
    value: "Asia/Istanbul",
    label: "استانبول (Asia/Istanbul)",
    region: "ایران و خاورمیانه",
  },
  {
    value: "Asia/Yerevan",
    label: "ایروان (Asia/Yerevan)",
    region: "ایران و خاورمیانه",
  },
  {
    value: "Asia/Baku",
    label: "باکو (Asia/Baku)",
    region: "ایران و خاورمیانه",
  },

  { value: "Europe/London", label: "London (UTC+0/+1)", region: "اروپا" },
  { value: "Europe/Berlin", label: "Berlin (UTC+1/+2)", region: "اروپا" },
  { value: "Europe/Paris", label: "Paris (UTC+1/+2)", region: "اروپا" },
  { value: "Europe/Amsterdam", label: "Amsterdam", region: "اروپا" },
  { value: "Europe/Madrid", label: "Madrid", region: "اروپا" },
  { value: "Europe/Rome", label: "Rome", region: "اروپا" },
  { value: "Europe/Moscow", label: "Moscow", region: "اروپا" },

  { value: "America/New_York", label: "New York (Eastern)", region: "آمریکا" },
  { value: "America/Chicago", label: "Chicago (Central)", region: "آمریکا" },
  { value: "America/Denver", label: "Denver (Mountain)", region: "آمریکا" },
  {
    value: "America/Los_Angeles",
    label: "Los Angeles (Pacific)",
    region: "آمریکا",
  },
  { value: "America/Toronto", label: "Toronto", region: "آمریکا" },
  { value: "America/Sao_Paulo", label: "São Paulo", region: "آمریکا" },

  { value: "Asia/Tokyo", label: "Tokyo", region: "آسیا و اقیانوسیه" },
  { value: "Asia/Shanghai", label: "Shanghai", region: "آسیا و اقیانوسیه" },
  { value: "Asia/Singapore", label: "Singapore", region: "آسیا و اقیانوسیه" },
  { value: "Asia/Hong_Kong", label: "Hong Kong", region: "آسیا و اقیانوسیه" },
  {
    value: "Asia/Kolkata",
    label: "Mumbai/Delhi (Asia/Kolkata)",
    region: "آسیا و اقیانوسیه",
  },
  { value: "Asia/Bangkok", label: "Bangkok", region: "آسیا و اقیانوسیه" },
  { value: "Australia/Sydney", label: "Sydney", region: "آسیا و اقیانوسیه" },
  { value: "Pacific/Auckland", label: "Auckland", region: "آسیا و اقیانوسیه" },

  { value: "UTC", label: "UTC", region: "سایر" },
];

/**
 * Build the dropdown options. The detected zone is always at the top
 * (even if it isn't in the curated set) and we never duplicate it in
 * its region group.
 */
export function buildTimezoneOptions(detected?: string): TimezoneOption[] {
  const zone = detected || detectTimezone();
  const all = expandWithSupportedZones(CURATED);

  const seen = new Set<string>();
  const ordered: TimezoneOption[] = [];

  // Pin detected zone first.
  const detectedItem =
    all.find((o) => o.value === zone) ||
    ({ value: zone, label: zone, region: "موقعیت شما" } as TimezoneOption);
  ordered.push({ ...detectedItem, region: "موقعیت شما" });
  seen.add(zone);

  for (const o of all) {
    if (seen.has(o.value)) continue;
    ordered.push(o);
    seen.add(o.value);
  }

  return ordered;
}

/**
 * Append any IANA zones the runtime knows about that we didn't curate,
 * grouped under "سایر". This guarantees we never reject a user's
 * detected zone, even something niche like `Pacific/Chatham`.
 */
function expandWithSupportedZones(curated: TimezoneOption[]): TimezoneOption[] {
  let supported: string[] = [];
  try {
    // Available in modern runtimes.
    supported =
      (
        Intl as unknown as {
          supportedValuesOf?: (k: string) => string[];
        }
      ).supportedValuesOf?.("timeZone") ?? [];
  } catch {
    supported = [];
  }
  if (!supported.length) return curated;

  const known = new Set(curated.map((c) => c.value));
  const extras: TimezoneOption[] = [];
  for (const tz of supported) {
    if (!known.has(tz)) {
      extras.push({ value: tz, label: tz, region: "سایر" });
    }
  }
  return [...curated, ...extras];
}

/**
 * Compute the UTC offset (in minutes) of a zone at a specific instant,
 * using the runtime's Intl data.
 */
export function getTimezoneOffsetMinutes(
  zone: string,
  at: Date = new Date(),
): number {
  try {
    const dtf = new Intl.DateTimeFormat("en-US", {
      timeZone: zone,
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    const parts = dtf.formatToParts(at);
    const map: Record<string, string> = {};
    for (const p of parts) if (p.type !== "literal") map[p.type] = p.value;
    const asUtc = Date.UTC(
      Number(map.year),
      Number(map.month) - 1,
      Number(map.day),
      Number(map.hour),
      Number(map.minute),
      Number(map.second),
    );
    return Math.round((asUtc - at.getTime()) / 60000);
  } catch {
    return 0;
  }
}

/** Pretty offset string, e.g. "GMT+3:30". */
export function formatOffset(zone: string, at: Date = new Date()): string {
  const m = getTimezoneOffsetMinutes(zone, at);
  const sign = m >= 0 ? "+" : "−";
  const abs = Math.abs(m);
  const h = Math.floor(abs / 60);
  const min = abs % 60;
  return min === 0
    ? `GMT${sign}${h}`
    : `GMT${sign}${h}:${String(min).padStart(2, "0")}`;
}
