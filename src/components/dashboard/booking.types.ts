import type { BookingBlockInput } from "@/lib/validations";
import type {
  BlockAnimationStyle,
  BlockSpotlight,
} from "@/lib/block-spotlight";
import { detectTimezone } from "@/lib/timezones";

// Client-side editable view of a booking block. Maps 1:1 to the server-side
// `BookingBlockInput` validation schema, plus an optional id for existing
// blocks so the dashboard can edit-in-place.
export type EditableBookingBlock = BookingBlockInput;

export type EditableBookingBlockWithId = EditableBookingBlock & {
  id: string;
  isActive: boolean;
  sortOrder: number;
  spotlight: BlockSpotlight;
  animationStyle: BlockAnimationStyle | null;
  bookingsCount?: number;
};

// Mirrors the server-side `ProviderConnectionStatus` from
// `src/lib/oauth/connections.ts`. Threaded into the dialog so it can render
// real "Connect to Google" / "Connected as foo@…" UI.
export type ProviderConnection = {
  provider: "google" | "zoom";
  connected: boolean;
  email: string | null;
  available: boolean;
};

export const DEFAULT_BOOKING_BLOCK: EditableBookingBlock = {
  id: null,
  name: "",
  description: null,
  avatarUrl: null,
  timezone: detectTimezone(),
  locationType: "online",
  locationAddress: null,
  locationLat: null,
  locationLng: null,
  locationPlaceId: null,
  meetingProvider: "custom",
  meetingLink: null,
  skyroomApiKey: null,
  skyroomRoomNamePrefix: null,
  bufferBeforeMin: 15,
  bufferAfterMin: 15,
  calendarEmail: null,
  // Default: Sat–Wed 9:00–17:00 (Iran work week)
  availability: [6, 0, 1, 2, 3].map((dayOfWeek) => ({
    dayOfWeek,
    startMinute: 9 * 60,
    endMinute: 17 * 60,
  })),
  types: [],
};

// dayOfWeek in the DB is 0=Sun … 6=Sat (JavaScript Date.getDay()). The
// Persian week starts on Saturday; this maps UI row index → DB integer.
export const FA_DAY_ORDER = [6, 0, 1, 2, 3, 4, 5] as const;
export const WEEKDAY_LABELS_FA = [
  "شنبه",
  "یکشنبه",
  "دوشنبه",
  "سه‌شنبه",
  "چهارشنبه",
  "پنج‌شنبه",
  "جمعه",
];
export const WEEKDAY_LABELS_FA_SHORT = ["ش", "ی", "د", "س", "چ", "پ", "ج"];

export const CURRENCY_OPTIONS = [
  { code: "IRT", label: "تومان" },
  { code: "USD", label: "دلار آمریکا" },
  { code: "EUR", label: "یورو" },
] as const;

export const DURATION_OPTIONS_MIN = [
  15, 20, 30, 45, 60, 75, 90, 120, 150, 180,
] as const;

export const BUFFER_OPTIONS_MIN = [0, 5, 10, 15, 20, 30, 45, 60] as const;
