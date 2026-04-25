import { z } from "zod";

import { normalizeIranianPhone } from "@/lib/phone";
import { toEnglishDigits } from "@/lib/persian";
import { isReservedSlug, normalizeSlug } from "@/lib/slug";

const optionalString = z.string().trim().optional().default("");

export const phoneSchema = z
  .string()
  .trim()
  .min(1, "شماره موبایل را وارد کنید.")
  .transform((value) => normalizeIranianPhone(value));

export const otpCodeSchema = z
  .string()
  .trim()
  .min(1, "کد تایید را وارد کنید.")
  .transform((value) => toEnglishDigits(value).replace(/\D/g, ""))
  .refine((value) => /^\d{6}$/.test(value), {
    message: "کد تایید باید ۶ رقم باشد.",
  });

export const authRequestSchema = z.object({
  phone: phoneSchema,
});

export const verifyOtpSchema = z.object({
  phone: phoneSchema,
  code: otpCodeSchema,
});

// Only http(s) URLs are safe to render as <a href> or <Image src>.
// Accepting `javascript:`, `data:`, `file:`, `vbscript:` etc. would allow XSS
// when the URL is rendered on the public profile page.
const HTTP_URL_PROTOCOLS = new Set(["http:", "https:"]);

function isSafeHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return HTTP_URL_PROTOCOLS.has(parsed.protocol);
  } catch {
    return false;
  }
}

const httpUrlSchema = z
  .string()
  .trim()
  .url("نشانی لینک معتبر نیست.")
  .refine(isSafeHttpUrl, { message: "فقط نشانی http یا https مجاز است." });

const optionalHttpUrlSchema = z
  .union([z.literal(""), httpUrlSchema])
  .optional()
  .nullable()
  .transform((v) => (v && v.length ? v : null));

export const profileLinkSchema = z.object({
  label: z.string().trim().min(1, "عنوان لینک لازم است.").max(40),
  url: httpUrlSchema,
  description: z
    .string()
    .trim()
    .max(160, "توضیح لینک طولانی‌تر از حد مجاز است.")
    .optional()
    .nullable()
    .transform((v) => (v && v.length ? v : null)),
  imageUrl: optionalHttpUrlSchema,
  iconKey: z
    .union([z.literal(""), z.string().trim().max(32)])
    .optional()
    .nullable()
    .transform((v) => (v && v.length ? v : null)),
  iconUrl: optionalHttpUrlSchema,
  sortOrder: z.number().int().nonnegative(),
  isActive: z.boolean().optional().default(true),
});

export const profileLinksArraySchema = z
  .array(profileLinkSchema)
  .max(8, "حداکثر ۸ لینک قابل ثبت است.");

export const profileDetailsFormSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, "نام و نام خانوادگی را وارد کنید.")
    .max(80),
  title: z.string().trim().min(2, "عنوان شغلی را وارد کنید.").max(80),
  bio: z.string().trim().min(8, "بیو باید حداقل ۸ کاراکتر باشد.").max(280),
  slug: z
    .string()
    .trim()
    .min(3, "شناسه عمومی خیلی کوتاه است.")
    .transform((value) => normalizeSlug(value))
    .refine((value) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value), {
      message: "شناسه باید با حروف انگلیسی، عدد و خط تیره باشد.",
    })
    .refine((value) => !isReservedSlug(value), {
      message: "این شناسه رزرو شده است. لطفاً شناسه دیگری انتخاب کنید.",
    }),
  publicPhone: optionalString.transform((value) =>
    value ? normalizeIranianPhone(value) : "",
  ),
  email: z
    .union([z.literal(""), z.string().trim().email("ایمیل معتبر نیست.")])
    .default(""),
});

export const profileFormSchema = profileDetailsFormSchema.extend({
  links: profileLinksArraySchema,
});

// Onboarding is intentionally the tiniest first-run flow: just enough data to
// claim a slug and name the card. Avatar, bio, contact methods, links, etc.
// are deferred to the dashboard so users can reach `/dashboard/links` fast.
export const onboardingProfileSchema = z.object({
  firstName: z.string().trim().min(1, "نام را وارد کنید.").max(40),
  lastName: z.string().trim().min(1, "نام خانوادگی را وارد کنید.").max(40),
  title: z.string().trim().min(2, "عنوان شغلی را وارد کنید.").max(80),
  slug: z
    .string()
    .trim()
    .min(3, "نام کاربری خیلی کوتاه است.")
    .transform((value) => normalizeSlug(value))
    .refine((value) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value), {
      message: "نام کاربری باید با حروف انگلیسی، عدد و خط تیره باشد.",
    })
    .refine((value) => !isReservedSlug(value), {
      message: "این نام کاربری رزرو شده است. نام دیگری انتخاب کنید.",
    }),
});

function isValidDateInput(value: string) {
  if (!value || !value.trim()) return false;
  return !Number.isNaN(new Date(value).getTime());
}

export const eventFormSchema = z
  .object({
    title: z.string().trim().min(2, "عنوان رویداد را وارد کنید.").max(100),
    slug: z
      .string()
      .trim()
      .min(3, "اسلاگ رویداد حداقل ۳ کاراکتر لازم دارد.")
      .transform((value) => normalizeSlug(value))
      .refine((value) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value), {
        message: "اسلاگ باید با حروف انگلیسی، عدد و خط تیره باشد.",
      }),
    description: z
      .string()
      .trim()
      .min(12, "توضیح رویداد حداقل ۱۲ کاراکتر لازم دارد.")
      .max(1200, "توضیح رویداد حداکثر ۱۲۰۰ کاراکتر می‌تواند باشد."),
    location: z
      .string()
      .trim()
      .min(2, "محل برگزاری را وارد کنید.")
      .max(160, "محل برگزاری طولانی‌تر از حد مجاز است."),
    startsAt: z
      .string()
      .trim()
      .min(1, "زمان شروع را انتخاب کنید.")
      .refine(isValidDateInput, "تاریخ و ساعت شروع معتبر نیست."),
    endsAt: z
      .string()
      .optional()
      .default("")
      .transform((value) => value?.trim() ?? ""),
    status: z.enum(["draft", "published", "closed"], {
      message: "وضعیت انتشار معتبر نیست.",
    }),
  })
  .superRefine((value, ctx) => {
    if (!value.endsAt) return;
    if (!isValidDateInput(value.endsAt)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "تاریخ و ساعت پایان معتبر نیست.",
        path: ["endsAt"],
      });
      return;
    }
    if (new Date(value.endsAt) < new Date(value.startsAt)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "زمان پایان باید بعد از زمان شروع باشد.",
        path: ["endsAt"],
      });
    }
  });

export const cardRequestSchema = z.object({
  fullName: z.string().trim().min(2, "نام دریافت‌کننده را وارد کنید.").max(80),
  phone: phoneSchema,
  deliveryInfo: z.string().trim().min(10, "اطلاعات ارسال کافی نیست.").max(500),
  cardType: z.enum(["physical", "nfc"]),
  cardDesign: z.enum(["design_1", "design_2", "design_3"]),
  notes: optionalString.transform((value) => value || ""),
});

// ---------------------------------------------------------------------------
// Bookings
// ---------------------------------------------------------------------------
// Validations mirror the shape of `profile_booking_blocks` + its children.
// We keep availability windows as simple { day, startMinute, endMinute } rows
// (same shape as the DB table) so client state and DB rows match 1:1 and we
// can replace-all on save with no diffing.

const MIN_DURATION = 5;
const MAX_DURATION = 480; // 8h upper bound — sanity check
const MAX_PRICE_MINOR_UNITS = 999_999_99;

export const bookingAvailabilityWindowSchema = z
  .object({
    dayOfWeek: z.number().int().min(0).max(6),
    startMinute: z
      .number()
      .int()
      .min(0)
      .max(24 * 60 - 1),
    endMinute: z
      .number()
      .int()
      .min(1)
      .max(24 * 60),
  })
  .refine((w) => w.endMinute > w.startMinute, {
    message: "زمان پایان باید بعد از شروع باشد.",
    path: ["endMinute"],
  });

export const bookingTypeInputSchema = z.object({
  id: z.string().uuid().optional().nullable(),
  title: z
    .string()
    .trim()
    .min(1, "عنوان نوع رزرو لازم است.")
    .max(60, "عنوان خیلی طولانی است."),
  durationMin: z
    .number()
    .int()
    .min(MIN_DURATION, "مدت‌زمان خیلی کوتاه است.")
    .max(MAX_DURATION, "مدت‌زمان خیلی طولانی است."),
  priceAmount: z
    .number()
    .int()
    .min(0)
    .max(MAX_PRICE_MINOR_UNITS, "قیمت معتبر نیست."),
  priceCurrency: z
    .string()
    .trim()
    .min(1)
    .max(8)
    .transform((v) => v.toUpperCase()),
});

export const bookingBlockInputSchema = z.object({
  id: z.string().uuid().optional().nullable(),
  name: z
    .string()
    .trim()
    .min(1, "عنوان رزرو لازم است.")
    .max(80, "عنوان طولانی‌تر از حد مجاز است."),
  description: z
    .string()
    .trim()
    .max(280)
    .optional()
    .nullable()
    .transform((v) => (v && v.length ? v : null)),
  avatarUrl: optionalHttpUrlSchema,
  timezone: z.string().trim().min(1).max(64),
  locationType: z.enum(["online", "in_person"]),
  locationAddress: z
    .string()
    .trim()
    .max(280)
    .optional()
    .nullable()
    .transform((v) => (v && v.length ? v : null)),
  locationLat: z
    .string()
    .trim()
    .max(32)
    .optional()
    .nullable()
    .transform((v) => (v && v.length ? v : null)),
  locationLng: z
    .string()
    .trim()
    .max(32)
    .optional()
    .nullable()
    .transform((v) => (v && v.length ? v : null)),
  locationPlaceId: z
    .string()
    .trim()
    .max(128)
    .optional()
    .nullable()
    .transform((v) => (v && v.length ? v : null)),
  meetingProvider: z
    .enum(["google_meet", "zoom", "skyroom", "lahzenegar", "custom"])
    .default("custom"),
  meetingLink: optionalHttpUrlSchema,
  skyroomApiKey: z
    .string()
    .trim()
    .max(128)
    .optional()
    .nullable()
    .transform((v) => (v && v.length ? v : null)),
  skyroomRoomNamePrefix: z
    .string()
    .trim()
    .max(64)
    .optional()
    .nullable()
    .transform((v) => (v && v.length ? v : null)),
  bufferBeforeMin: z.number().int().min(0).max(240),
  bufferAfterMin: z.number().int().min(0).max(240),
  calendarEmail: z
    .union([z.literal(""), z.string().trim().email("ایمیل معتبر نیست.")])
    .optional()
    .nullable()
    .transform((v) => (v && v.length ? v : null)),
  availability: z
    .array(bookingAvailabilityWindowSchema)
    .max(50, "تعداد پنجره‌های دسترس‌پذیری زیاد است."),
  types: z
    .array(bookingTypeInputSchema)
    .min(1, "حداقل یک نوع رزرو اضافه کنید.")
    .max(10, "حداکثر ۱۰ نوع رزرو قابل ثبت است."),
});

export type BookingBlockInput = z.infer<typeof bookingBlockInputSchema>;
export type BookingTypeInput = z.infer<typeof bookingTypeInputSchema>;
export type BookingAvailabilityWindow = z.infer<
  typeof bookingAvailabilityWindowSchema
>;

// Public booking submission — the form visitors fill on the public profile.
export const publicBookingSubmitSchema = z.object({
  blockId: z.string().uuid(),
  bookingTypeId: z.string().uuid(),
  // ISO string representing the slot start in UTC.
  startsAtIso: z
    .string()
    .trim()
    .min(1, "زمان جلسه را انتخاب کنید.")
    .refine((v) => !Number.isNaN(new Date(v).getTime()), {
      message: "زمان معتبر نیست.",
    }),
  guestName: z.string().trim().min(1, "نام خود را وارد کنید.").max(80),
  guestEmail: z.string().trim().email("ایمیل معتبر نیست.").max(120),
  guestPhone: z.string().trim().max(30).optional().nullable(),
  notes: z.string().trim().max(500).optional().nullable(),
  guestTimezone: z.string().trim().max(64).optional().nullable(),
});

export type PublicBookingSubmit = z.infer<typeof publicBookingSubmitSchema>;
