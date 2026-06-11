import { z } from "zod";

import { normalizeIranianPhone } from "@/lib/phone";
import { toEnglishDigits } from "@/lib/persian";
import { isIconKey } from "@/lib/link-icons";
import { isPageTypeSlug } from "@/lib/page-type";
import { DEFAULT_PROFILE_DOMAIN, isProfileDomain } from "@/lib/profile-domains";
import { isReservedSlug, normalizeBlockSlug, normalizeSlug } from "@/lib/slug";

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

// Allowed link protocols. http(s) for normal links, mailto/tel/sms for
// contact presets in the add-link dialog (email, phone). Accepting
// `javascript:`, `data:`, `file:`, `vbscript:` etc. would allow XSS when
// the URL is rendered as <a href> on the public profile page.
const SAFE_LINK_PROTOCOLS = new Set([
  "http:",
  "https:",
  "mailto:",
  "tel:",
  "sms:",
]);
// Image / icon URLs always go through <img>/<Image>, so they must be http(s).
const HTTP_IMAGE_PROTOCOLS = new Set(["http:", "https:"]);

/**
 * Returns true when `value` is a fully-formed URL we're willing to render.
 *
 * - Rejects bare prefixes like `https://` / `mailto:` / `tel:` (an empty
 *   host *and* empty path is what the add-link dialog seeds when the user
 *   hasn't typed anything yet — those must not slip through autosave).
 * - Rejects any protocol outside `allowed`.
 */
function isSafeUrl(value: string, allowed: Set<string>): boolean {
  try {
    const parsed = new URL(value);
    if (!allowed.has(parsed.protocol)) return false;
    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      // Require a hostname — `https://` alone parses but is useless.
      if (!parsed.hostname) return false;
    } else {
      // mailto:/tel:/sms: have an empty hostname; the meaningful part lives
      // in `pathname`. Reject `mailto:` / `tel:` with no recipient.
      if (!parsed.pathname || parsed.pathname.trim().length === 0) return false;
    }
    return true;
  } catch {
    return false;
  }
}

export function isSafeLinkUrl(value: string): boolean {
  return isSafeUrl(normalizeLinkUrl(value), SAFE_LINK_PROTOCOLS);
}

/**
 * Normalize a URL the user typed into the dashboard. If they typed
 * `google.com` we silently prepend `https://` so the rest of the system
 * (validation, autosave, public renderer) can rely on a fully-qualified
 * URL. mailto:/tel:/sms: and any other scheme are passed through.
 */
export function normalizeLinkUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return trimmed;
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

const linkUrlSchema = z
  .string()
  .trim()
  .min(1, "نشانی لینک لازم است.")
  .transform(normalizeLinkUrl)
  .refine((v) => isSafeUrl(v, SAFE_LINK_PROTOCOLS), {
    message: "نشانی لینک معتبر نیست.",
  });

const optionalHttpUrlSchema = z
  .union([
    z.literal(""),
    z
      .string()
      .trim()
      // Root-relative URLs (e.g. `/uploads/...` from local storage in dev)
      // are passed through verbatim; they're already safe and don't need
      // the `https://` prefix.
      .transform((v) => (v.startsWith("/") ? v : normalizeLinkUrl(v)))
      .refine((v) => v.startsWith("/") || isSafeUrl(v, HTTP_IMAGE_PROTOCOLS), {
        message: "نشانی معتبر نیست.",
      }),
  ])
  .optional()
  .nullable()
  .transform((v) => (v && v.length ? v : null));

export const profileLinkSchema = z.object({
  label: z.string().trim().min(1, "عنوان لینک لازم است.").max(40),
  url: linkUrlSchema,
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
  spotlight: z.enum(["none", "pin", "animate"]).optional().default("none"),
  animationStyle: z
    .enum(["buzz", "wobble", "pop", "swipe"])
    .optional()
    .nullable()
    .transform((v) => (v ? v : null)),
});

export const profileLinksArraySchema = z.array(profileLinkSchema);

// ---------------------------------------------------------------------------
// Form blocks
// ---------------------------------------------------------------------------

export const FORM_FIELD_KINDS = [
  "name",
  "email",
  "phone",
  "country",
  "short_answer",
  "paragraph",
  "single_choice",
  "checkboxes",
  "dropdown",
  "date",
] as const;

export type FormFieldKind = (typeof FORM_FIELD_KINDS)[number];

export const FIELD_KINDS_WITH_OPTIONS: FormFieldKind[] = [
  "single_choice",
  "checkboxes",
  "dropdown",
];

export const formFieldSchema = z
  .object({
    id: z.string().optional().nullable(),
    kind: z.enum(FORM_FIELD_KINDS),
    label: z.string().trim().min(1, "عنوان فیلد لازم است.").max(200),
    required: z.boolean().optional().default(false),
    options: z
      .array(z.string().trim().min(1).max(200))
      .max(50)
      .optional()
      .nullable(),
    sortOrder: z.number().int().nonnegative(),
  })
  .superRefine((value, ctx) => {
    if (FIELD_KINDS_WITH_OPTIONS.includes(value.kind)) {
      const opts = value.options ?? [];
      if (opts.length < 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "حداقل یک گزینه لازم است.",
          path: ["options"],
        });
      }
    }
  });

export const formBlockSchema = z.object({
  name: z.string().trim().min(1, "نام فرم لازم است.").max(80),
  intro: z
    .string()
    .trim()
    .max(500)
    .optional()
    .nullable()
    .transform((v) => (v && v.length ? v : null)),
  outro: z
    .string()
    .trim()
    .max(200)
    .optional()
    .nullable()
    .transform((v) => (v && v.length ? v : "Thanks for submitting!")),
  fields: z.array(formFieldSchema).min(1, "حداقل یک فیلد لازم است.").max(20),
});

export type FormBlockInput = z.infer<typeof formBlockSchema>;
export type FormFieldInput = z.infer<typeof formFieldSchema>;

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
  domain: z
    .string()
    .trim()
    .default(DEFAULT_PROFILE_DOMAIN)
    .refine((value) => isProfileDomain(value), {
      message: "این دامنه پشتیبانی نمی‌شود.",
    }),
  seoTitle: z
    .string()
    .trim()
    .max(70, "عنوان سئو حداکثر ۷۰ کاراکتر می‌تواند باشد.")
    .optional()
    .nullable()
    .transform((v) => (v && v.length ? v : null)),
  seoDescription: z
    .string()
    .trim()
    .max(200, "توضیح سئو حداکثر ۲۰۰ کاراکتر می‌تواند باشد.")
    .optional()
    .nullable()
    .transform((v) => (v && v.length ? v : null)),
  indexEnabled: z
    .union([z.literal("on"), z.literal("off"), z.boolean()])
    .default(true)
    .transform((v) => (typeof v === "boolean" ? v : v === "on" ? true : false)),
  appIconKey: z
    .string()
    .trim()
    .optional()
    .nullable()
    .transform((v) => (v && v.length ? v : null))
    .refine((v) => v === null || isIconKey(v), {
      message: "آیکون نامعتبر است.",
    }),
  appIconColor: z
    .string()
    .trim()
    .optional()
    .nullable()
    .transform((v) => (v && v.length ? v : null))
    .refine((v) => v === null || /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(v), {
      message: "رنگ نامعتبر است.",
    }),
});

export const profileFormSchema = profileDetailsFormSchema.extend({
  links: profileLinksArraySchema,
});

/**
 * Validates the fields the "Page Settings" sheet manages.
 */
export const pageSettingsFormSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(1, "نام صفحه را وارد کنید.")
    .max(80, "نام صفحه حداکثر ۸۰ کاراکتر می‌تواند باشد."),
  title: z
    .string()
    .trim()
    .max(80, "عنوان حداکثر ۸۰ کاراکتر می‌تواند باشد.")
    .optional()
    .nullable()
    .transform((v) => (v && v.length ? v : null)),
  bio: z
    .string()
    .trim()
    .max(280, "بیو حداکثر ۲۸۰ کاراکتر می‌تواند باشد.")
    .optional()
    .nullable()
    .transform((v) => (v && v.length ? v : null)),
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
  domain: z
    .string()
    .trim()
    .default(DEFAULT_PROFILE_DOMAIN)
    .refine((value) => isProfileDomain(value), {
      message: "این دامنه پشتیبانی نمی‌شود.",
    }),
  seoTitle: z
    .string()
    .trim()
    .max(70, "عنوان سئو حداکثر ۷۰ کاراکتر می‌تواند باشد.")
    .optional()
    .nullable()
    .transform((v) => (v && v.length ? v : null)),
  seoDescription: z
    .string()
    .trim()
    .max(200, "توضیح سئو حداکثر ۲۰۰ کاراکتر می‌تواند باشد.")
    .optional()
    .nullable()
    .transform((v) => (v && v.length ? v : null)),
  indexEnabled: z
    .union([z.literal("on"), z.literal("off"), z.boolean()])
    .default(true)
    .transform((v) => (typeof v === "boolean" ? v : v === "on" ? true : false)),
  appIconKey: z
    .string()
    .trim()
    .optional()
    .nullable()
    .transform((v) => (v && v.length ? v : null))
    .refine((v) => v === null || isIconKey(v), {
      message: "آیکون نامعتبر است.",
    }),
  appIconColor: z
    .string()
    .trim()
    .optional()
    .nullable()
    .transform((v) => (v && v.length ? v : null))
    .refine((v) => v === null || /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(v), {
      message: "رنگ نامعتبر است.",
    }),
  // Discover (kioar.com/discover) — opt-in directory listing.
  discoverEnabled: z
    .union([z.literal("on"), z.literal("off"), z.boolean()])
    .default(false)
    .transform((v) => (typeof v === "boolean" ? v : v === "on" ? true : false)),
  discoverCategory: z
    .string()
    .trim()
    .optional()
    .nullable()
    .transform((v) => (v && v.length ? v : null)),
  city: z
    .string()
    .trim()
    .max(60, "نام شهر حداکثر ۶۰ کاراکتر می‌تواند باشد.")
    .optional()
    .nullable()
    .transform((v) => (v && v.length ? v : null)),
  // Page archetype (Personal | Business). Editable from page settings; not
  // plan-gated.
  pageType: z
    .string()
    .trim()
    .optional()
    .nullable()
    .transform((v) => (v && v.length ? v : null))
    .refine((v) => v === null || isPageTypeSlug(v), {
      message: "نوع صفحه نامعتبر است.",
    }),
  // Contact info — value + visibility flag together.
  publicPhone: optionalString.transform((v) =>
    v ? normalizeIranianPhone(v) : "",
  ),
  showPublicPhone: z
    .union([z.literal("on"), z.literal("off"), z.boolean()])
    .default(false)
    .transform((v) => (typeof v === "boolean" ? v : v === "on")),
  email: z
    .union([z.literal(""), z.string().trim().email("ایمیل معتبر نیست.")])
    .default(""),
  showPublicEmail: z
    .union([z.literal("on"), z.literal("off"), z.boolean()])
    .default(false)
    .transform((v) => (typeof v === "boolean" ? v : v === "on")),
});

// Onboarding captures the page's identity in four steps: slug, page name,
// page type (Personal/Business), and an optional discover category. We
// keep the field set tiny on purpose — avatars, bios, contacts and links
// are deferred to the dashboard so users can reach `/me` fast.
export const onboardingProfileSchema = z.object({
  pageName: z.string().trim().min(1, "نام صفحه را وارد کنید.").max(80),
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
  pageType: z
    .string()
    .trim()
    .optional()
    .nullable()
    .transform((v) => (v && v.length ? v : null))
    .refine((v) => v === null || isPageTypeSlug(v), {
      message: "نوع صفحه نامعتبر است.",
    }),
  // Category is skippable — Discover lists categoryless pages under "همه".
  discoverCategory: z
    .string()
    .trim()
    .optional()
    .nullable()
    .transform((v) => (v && v.length ? v : null)),
});

// NOTE: The events validation schema is rebuilt in the events module
// (Increment 4). The throwaway `eventFormSchema` (and its `isValidDateInput`
// helper) was removed when events became a page-owned block. See
// docs/EVENTS_PLAN.md.

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
  guestEmail: z.string().trim().email("ایمیل معتبر نیست.").max(120).optional().nullable(),
  guestPhone: z.string().trim().max(30).optional().nullable(),
  notes: z.string().trim().max(500).optional().nullable(),
  guestTimezone: z.string().trim().max(64).optional().nullable(),
});

export type PublicBookingSubmit = z.infer<typeof publicBookingSubmitSchema>;

// ---------------------------------------------------------------------------
// Product blocks (universal "محصولات و خدمات")
// ---------------------------------------------------------------------------
//
// Universal listing model used for menus, e-commerce items with outbound
// links, services, packages, portfolio. The `preset` field is purely a UI
// hint at create time; the data model never branches on it.
//
// Money is in **minor units** (rials for IRT, cents for USD/EUR).

export const PRODUCT_BLOCK_LAYOUTS = ["list", "grid", "cards"] as const;
export type ProductBlockLayout = (typeof PRODUCT_BLOCK_LAYOUTS)[number];

export const PRODUCT_BLOCK_DISPLAY_MODES = ["pill", "inline"] as const;
export type ProductBlockDisplayMode =
  (typeof PRODUCT_BLOCK_DISPLAY_MODES)[number];

export const PRODUCT_ITEM_PRICE_TYPES = [
  "fixed",
  "from",
  "range",
  "on_request",
  "free",
] as const;
export type ProductItemPriceType = (typeof PRODUCT_ITEM_PRICE_TYPES)[number];

export const PRODUCT_ITEM_AVAILABILITY = [
  "available",
  "sold_out",
  "hidden",
] as const;
export type ProductItemAvailability =
  (typeof PRODUCT_ITEM_AVAILABILITY)[number];

export const PRODUCT_BLOCK_CURRENCIES = ["IRT", "USD", "EUR"] as const;
export type ProductBlockCurrency = (typeof PRODUCT_BLOCK_CURRENCIES)[number];

export const PRODUCT_BLOCK_PRESETS = [
  "menu",
  "shop",
  "services",
  "packages",
  "portfolio",
  "custom",
] as const;
export type ProductBlockPreset = (typeof PRODUCT_BLOCK_PRESETS)[number];

/** Soft + hard caps. UI warns at soft, server rejects at hard. */
export const PRODUCT_ITEMS_HARD_CAP = 300;
export const PRODUCT_ITEMS_SOFT_CAP = 240;
export const PRODUCT_SECTIONS_MAX = 30;

export const productSectionInputSchema = z.object({
  id: z.string().uuid().optional().nullable(),
  title: z.string().trim().min(1, "عنوان دسته لازم است.").max(80),
  iconKey: z
    .union([z.literal(""), z.string().trim().max(32)])
    .optional()
    .nullable()
    .transform((v) => (v && v.length ? v : null)),
});

export const productItemInputSchema = z
  .object({
    id: z.string().uuid().optional().nullable(),
    /** Stable client-side id of the section this item belongs to (when
     * the user reorders unsaved drafts). Server resolves this back to a
     * persisted `section_id` after sections are inserted. */
    sectionRef: z.string().optional().nullable(),
    title: z.string().trim().min(1, "عنوان لازم است.").max(120),
    description: z
      .string()
      .trim()
      .max(280)
      .optional()
      .nullable()
      .transform((v) => (v && v.length ? v : null)),
    imageUrl: optionalHttpUrlSchema,
    priceType: z.enum(PRODUCT_ITEM_PRICE_TYPES).default("fixed"),
    priceAmount: z
      .number()
      .int()
      .min(0)
      .max(MAX_PRICE_MINOR_UNITS, "قیمت معتبر نیست.")
      .default(0),
    priceAmountMax: z
      .number()
      .int()
      .min(0)
      .max(MAX_PRICE_MINOR_UNITS, "قیمت معتبر نیست.")
      .optional()
      .nullable(),
    availability: z.enum(PRODUCT_ITEM_AVAILABILITY).default("available"),
    isFeatured: z.boolean().default(false),
    externalUrl: optionalHttpUrlSchema,
    badge: z
      .string()
      .trim()
      .max(40)
      .optional()
      .nullable()
      .transform((v) => (v && v.length ? v : null)),
    sku: z
      .string()
      .trim()
      .max(64)
      .optional()
      .nullable()
      .transform((v) => (v && v.length ? v : null)),
  })
  .superRefine((value, ctx) => {
    if (value.priceType === "range") {
      if (value.priceAmountMax === null || value.priceAmountMax === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "بازه قیمت را کامل وارد کنید.",
          path: ["priceAmountMax"],
        });
      } else if (value.priceAmountMax <= value.priceAmount) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "سقف بازه باید بیشتر از کف باشد.",
          path: ["priceAmountMax"],
        });
      }
    }
    if (value.priceType === "from" && value.priceAmount <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "قیمت پایه را وارد کنید.",
        path: ["priceAmount"],
      });
    }
    if (value.priceType === "fixed" && value.priceAmount < 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "قیمت معتبر نیست.",
        path: ["priceAmount"],
      });
    }
  });

export const productBlockInputSchema = z.object({
  id: z.string().uuid().optional().nullable(),
  name: z.string().trim().min(1, "عنوان لازم است.").max(80),
  description: z
    .string()
    .trim()
    .max(280)
    .optional()
    .nullable()
    .transform((v) => (v && v.length ? v : null)),
  preset: z
    .enum(PRODUCT_BLOCK_PRESETS)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null)),
  /** Dedicated public-page path (`/USERNAME/{slug}`). Null = inline-only.
   * Normalized to canonical form; reserved-word + per-profile uniqueness are
   * enforced in the save action (they need live data). */
  slug: z
    .string()
    .trim()
    .max(60)
    .optional()
    .nullable()
    .transform((v) => normalizeBlockSlug(v)),
  layout: z.enum(PRODUCT_BLOCK_LAYOUTS).default("list"),
  itemLabel: z
    .string()
    .trim()
    .max(40)
    .optional()
    .nullable()
    .transform((v) => (v && v.length ? v : null)),
  currency: z.enum(PRODUCT_BLOCK_CURRENCIES).default("IRT"),
  showPrices: z.boolean().default(true),
  displayMode: z.enum(PRODUCT_BLOCK_DISPLAY_MODES).default("pill"),
  pillLabel: z
    .string()
    .trim()
    .max(40)
    .optional()
    .nullable()
    .transform((v) => (v && v.length ? v : null)),
  iconKey: z
    .union([z.literal(""), z.string().trim().max(32)])
    .optional()
    .nullable()
    .transform((v) => (v && v.length ? v : null)),
  iconUrl: optionalHttpUrlSchema,
  imageUrl: optionalHttpUrlSchema,
  sections: z
    .array(productSectionInputSchema)
    .max(PRODUCT_SECTIONS_MAX, "تعداد دسته‌ها زیاد است.")
    .default([]),
  items: z
    .array(productItemInputSchema)
    .max(
      PRODUCT_ITEMS_HARD_CAP,
      `حداکثر ${PRODUCT_ITEMS_HARD_CAP} مورد قابل ثبت است.`,
    )
    .default([]),
});

export type ProductBlockInput = z.infer<typeof productBlockInputSchema>;
export type ProductSectionInput = z.infer<typeof productSectionInputSchema>;
export type ProductItemInput = z.infer<typeof productItemInputSchema>;

// ---------------------------------------------------------------------------
// Text blocks
// ---------------------------------------------------------------------------
// Notion-style content block: required free text + optional title, icon, and
// photo. Icon vocabulary mirrors links (named key OR uploaded/remote url).

/** Plain-text body cap. ~500 chars per the product spec. */
export const TEXT_BLOCK_BODY_MAX = 500;

export const textBlockInputSchema = z.object({
  title: z
    .string()
    .trim()
    .max(80, "عنوان طولانی‌تر از حد مجاز است.")
    .optional()
    .nullable()
    .transform((v) => (v && v.length ? v : null)),
  iconKey: z
    .union([z.literal(""), z.string().trim().max(32)])
    .optional()
    .nullable()
    .transform((v) => (v && v.length ? v : null)),
  iconUrl: optionalHttpUrlSchema,
  body: z
    .string()
    .trim()
    .min(1, "متن بلوک لازم است.")
    .max(TEXT_BLOCK_BODY_MAX, "متن طولانی‌تر از حد مجاز است."),
  photoUrl: optionalHttpUrlSchema,
  spotlight: z.enum(["none", "pin", "animate"]).optional().default("none"),
  animationStyle: z
    .enum(["buzz", "wobble", "pop", "swipe"])
    .optional()
    .nullable()
    .transform((v) => (v ? v : null)),
});

export type TextBlockInput = z.infer<typeof textBlockInputSchema>;

// ---------------------------------------------------------------------------
// Media blocks ("مدیا": photos / video / file)
// ---------------------------------------------------------------------------
// One engine, three modes. A block holds EITHER many photos, OR one video
// (pasted embed XOR uploaded file), OR one file. The variant card sets `mode`
// + `preset`; the editor auto-detects type from what's added. Per-file size /
// per-gallery count caps are plan-driven and enforced server-side in the
// service — this schema enforces mode/item-kind consistency + absolute ceilings
// so a malformed payload can never reach the DB.

export const MEDIA_BLOCK_MODES = ["photos", "video", "file"] as const;
export const MEDIA_ITEM_KINDS = ["image", "video", "file"] as const;
export const MEDIA_BLOCK_PRESETS = [
  "gallery",
  "video",
  "resume",
  "download",
] as const;
export type MediaBlockMode = (typeof MEDIA_BLOCK_MODES)[number];
export type MediaItemKind = (typeof MEDIA_ITEM_KINDS)[number];
export type MediaBlockPreset = (typeof MEDIA_BLOCK_PRESETS)[number];

/** Absolute ceiling on photos per gallery, regardless of plan limit. The
 * plan-driven `media_max_gallery_count` is checked in the service. */
export const MEDIA_GALLERY_HARD_CAP = 50;

export const mediaItemInputSchema = z.object({
  id: z.string().uuid().optional().nullable(),
  kind: z.enum(MEDIA_ITEM_KINDS),
  url: z
    .string()
    .trim()
    .min(1, "نشانی فایل لازم است.")
    // Both root-relative (/uploads/… in dev) and absolute https (S3) are valid.
    .refine((v) => v.startsWith("/") || /^https?:\/\//i.test(v), {
      message: "نشانی فایل معتبر نیست.",
    }),
  byteSize: z.number().int().min(0).default(0),
  mime: z
    .string()
    .trim()
    .max(100)
    .optional()
    .nullable()
    .transform((v) => (v && v.length ? v : null)),
  displayName: z
    .string()
    .trim()
    .max(120, "نام نمایشی طولانی‌تر از حد مجاز است.")
    .optional()
    .nullable()
    .transform((v) => (v && v.length ? v : null)),
  thumbnailUrl: optionalHttpUrlSchema,
});

export const mediaBlockInputSchema = z
  .object({
    id: z.string().uuid().optional().nullable(),
    mode: z.enum(MEDIA_BLOCK_MODES).default("photos"),
    preset: z
      .enum(MEDIA_BLOCK_PRESETS)
      .optional()
      .nullable()
      .transform((v) => (v ? v : null)),
    name: z
      .string()
      .trim()
      .max(80, "عنوان طولانی‌تر از حد مجاز است.")
      .optional()
      .nullable()
      .transform((v) => (v && v.length ? v : null)),
    caption: z
      .string()
      .trim()
      .max(280, "توضیح طولانی‌تر از حد مجاز است.")
      .optional()
      .nullable()
      .transform((v) => (v && v.length ? v : null)),
    /** Pasted YouTube/Aparat URL (video mode, embed). Null otherwise. */
    videoUrl: z
      .string()
      .trim()
      .max(2048)
      .optional()
      .nullable()
      .transform((v) => (v && v.length ? v : null)),
    spotlight: z.enum(["none", "pin", "animate"]).optional().default("none"),
    animationStyle: z
      .enum(["buzz", "wobble", "pop", "swipe"])
      .optional()
      .nullable()
      .transform((v) => (v ? v : null)),
    items: z
      .array(mediaItemInputSchema)
      .max(MEDIA_GALLERY_HARD_CAP, "تعداد تصاویر بیش از حد مجاز است.")
      .default([]),
  })
  .superRefine((value, ctx) => {
    const items = value.items;
    if (value.mode === "photos") {
      if (value.videoUrl) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "گالری تصاویر نمی‌تواند لینک ویدئو داشته باشد.",
          path: ["videoUrl"],
        });
      }
      if (items.some((it) => it.kind !== "image")) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "گالری فقط می‌تواند شامل تصویر باشد.",
          path: ["items"],
        });
      }
      return;
    }
    if (value.mode === "video") {
      const videoItems = items.filter((it) => it.kind === "video");
      const hasEmbed = Boolean(value.videoUrl);
      // Exactly one source: an embed URL XOR a single uploaded video item.
      if (hasEmbed && videoItems.length > 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "هم لینک و هم فایل ویدئو نمی‌توانید اضافه کنید.",
          path: ["videoUrl"],
        });
      }
      if (!hasEmbed && videoItems.length === 0) {
        // Allow an empty draft (block not yet populated) — the editor saves
        // incrementally. A populated video block is validated at publish.
        return;
      }
      if (videoItems.length > 1 || items.some((it) => it.kind === "image")) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "بلوک ویدئو فقط یک ویدئو می‌تواند داشته باشد.",
          path: ["items"],
        });
      }
      return;
    }
    // mode === "file"
    if (value.videoUrl) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "بلوک فایل نمی‌تواند لینک ویدئو داشته باشد.",
        path: ["videoUrl"],
      });
    }
    const fileItems = items.filter((it) => it.kind === "file");
    if (items.length > 1 || items.some((it) => it.kind !== "file")) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "بلوک فایل فقط یک فایل می‌تواند داشته باشد.",
        path: ["items"],
      });
    }
    void fileItems;
  });

export type MediaBlockInput = z.infer<typeof mediaBlockInputSchema>;
export type MediaItemInput = z.infer<typeof mediaItemInputSchema>;
