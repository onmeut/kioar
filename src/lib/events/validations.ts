import { z } from "zod";

import { isValidTimezone } from "@/lib/date/timezone";
import { isSafeLinkUrl, normalizeLinkUrl } from "@/lib/validations";

/**
 * Event form validation. Self-contained to the events module.
 *
 * Dates arrive as a Gregorian civil date (`YYYY-MM-DD`, produced by the
 * Shamsi picker after Jalali→Gregorian conversion) plus a `HH:mm` time, in
 * the host's IANA timezone. The service converts to a UTC instant via
 * `civilToUtc` — we never store wall-clock or Shamsi strings as truth.
 */

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export const eventQuestionKinds = [
  "short_text",
  "long_text",
  "single_select",
  "multi_select",
] as const;

export const eventQuestionSchema = z
  .object({
    id: z.string().uuid().nullable().optional(),
    kind: z.enum(eventQuestionKinds),
    label: z.string().trim().min(1, "متن سؤال را وارد کنید.").max(160),
    required: z.boolean().default(false),
    options: z.array(z.string().trim().min(1).max(80)).max(20).nullable(),
  })
  .superRefine((q, ctx) => {
    const needsOptions =
      q.kind === "single_select" || q.kind === "multi_select";
    if (needsOptions && (!q.options || q.options.length < 2)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "برای سؤال چندگزینه‌ای حداقل دو گزینه لازم است.",
        path: ["options"],
      });
    }
  });

export const eventDiscountCodeSchema = z
  .object({
    id: z.string().uuid().nullable().optional(),
    code: z
      .string()
      .trim()
      .min(2, "کد تخفیف حداقل ۲ کاراکتر است.")
      .max(40)
      .regex(/^[A-Za-z0-9_-]+$/, "کد فقط حروف انگلیسی، عدد و خط تیره."),
    type: z.enum(["percentage", "fixed"]),
    value: z.coerce.number().int().positive("مقدار باید بزرگ‌تر از صفر باشد."),
    usageLimit: z.coerce
      .number()
      .int()
      .positive()
      .nullable()
      .optional()
      .default(null),
    expiresAt: z.string().nullable().optional().default(null),
    isActive: z.boolean().default(true),
  })
  .superRefine((d, ctx) => {
    if (d.type === "percentage" && (d.value < 1 || d.value > 100)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "درصد تخفیف باید بین ۱ تا ۱۰۰ باشد.",
        path: ["value"],
      });
    }
  });

export const eventFormSchema = z
  .object({
    title: z.string().trim().min(2, "عنوان رویداد را وارد کنید.").max(120),
    description: z
      .string()
      .trim()
      .max(4000, "توضیح رویداد طولانی‌تر از حد مجاز است.")
      .nullable()
      .optional()
      .transform((v) => (v && v.length ? v : null)),
    locationType: z.enum(["physical", "online"]),
    locationAddress: z
      .string()
      .trim()
      .max(300)
      .nullable()
      .optional()
      .transform((v) => (v && v.length ? v : null)),
    onlineUrl: z
      .string()
      .trim()
      .max(2000)
      .nullable()
      .optional()
      .transform((v) => (v && v.length ? v : null)),
    timezone: z
      .string()
      .trim()
      .refine((tz) => isValidTimezone(tz), "منطقهٔ زمانی نامعتبر است."),
    startDate: z.string().regex(DATE_RE, "تاریخ شروع را انتخاب کنید."),
    startTime: z.string().regex(TIME_RE, "ساعت شروع را انتخاب کنید."),
    endDate: z
      .string()
      .optional()
      .default("")
      .transform((v) => v?.trim() ?? ""),
    endTime: z
      .string()
      .optional()
      .default("")
      .transform((v) => v?.trim() ?? ""),
    capacity: z.coerce
      .number()
      .int()
      .positive("ظرفیت باید بزرگ‌تر از صفر باشد.")
      .nullable()
      .optional()
      .default(null),
    priceType: z.enum(["free", "paid"]),
    priceToman: z.coerce
      .number()
      .int()
      .nonnegative("قیمت نمی‌تواند منفی باشد.")
      .default(0),
    paymentInstructions: z
      .string()
      .trim()
      .max(1000, "حداکثر ۱۰۰۰ نویسه.")
      .nullable()
      .optional()
      .default(null),
    approvalRequired: z.boolean().default(false),
    receiptUploadEnabled: z.boolean().default(false),
    waitlistEnabled: z.boolean().default(false),
    status: z.enum(["draft", "published", "cancelled"]).default("draft"),
    questions: z.array(eventQuestionSchema).max(20).default([]),
    discountCodes: z.array(eventDiscountCodeSchema).max(50).default([]),
  })
  .superRefine((v, ctx) => {
    // Physical events need an address; online events need a valid URL.
    if (v.locationType === "physical" && !v.locationAddress) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "آدرس محل برگزاری را وارد کنید.",
        path: ["locationAddress"],
      });
    }
    if (v.locationType === "online") {
      if (!v.onlineUrl) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "لینک رویداد آنلاین را وارد کنید.",
          path: ["onlineUrl"],
        });
      } else if (!isSafeLinkUrl(normalizeLinkUrl(v.onlineUrl))) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "لینک رویداد معتبر نیست.",
          path: ["onlineUrl"],
        });
      }
    }

    // Paid events need a positive price.
    if (v.priceType === "paid" && v.priceToman <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "برای رویداد پولی قیمت را وارد کنید.",
        path: ["priceToman"],
      });
    }

    // End must be after start when provided. Comparison is done on the civil
    // strings here as a cheap guard; the service re-validates on UTC instants.
    if (v.endDate || v.endTime) {
      if (!DATE_RE.test(v.endDate) || !TIME_RE.test(v.endTime)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "تاریخ و ساعت پایان را کامل وارد کنید.",
          path: ["endTime"],
        });
      } else {
        const start = `${v.startDate}T${v.startTime}`;
        const end = `${v.endDate}T${v.endTime}`;
        if (end <= start) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "زمان پایان باید بعد از زمان شروع باشد.",
            path: ["endTime"],
          });
        }
      }
    }
  });

export type EventFormInput = z.input<typeof eventFormSchema>;
export type EventFormValues = z.output<typeof eventFormSchema>;
export type EventQuestionInput = z.input<typeof eventQuestionSchema>;
export type EventDiscountCodeInput = z.input<typeof eventDiscountCodeSchema>;
