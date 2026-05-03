"use server";

/**
 * Phase 11 — admin actions for discount programs.
 *
 * `createDiscountCodeAction` — create or update a code by id. The form
 * uses `id=""` for "new". Code is stored verbatim + lower-cased into
 * `code_normalized` for case-insensitive lookup at validation time.
 *
 * `toggleDiscountCodeAction` — flip `is_active`. Disabled codes are
 * rejected by the validator immediately and won't carry forward through
 * recurring chains.
 *
 * Validation is deliberately permissive: ops can ship an `endsAt` in
 * the past (the validator surfaces "expired" anyway) or a code that
 * targets only Pro Annual. We just sanity-check shape + amount range.
 */

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { getDb } from "@/db";
import { discountCodes } from "@/db/schema";
import { type ActionState } from "@/lib/action-state";
import { requireAdmin } from "@/lib/auth/session";
import { normalizeDiscountCode } from "@/lib/discounts";
import { log } from "@/lib/log";

const PLAN_KEYS = ["pro", "business"] as const;
const CYCLES = ["monthly", "annual"] as const;

const upsertSchema = z
  .object({
    id: z.string().uuid().optional(),
    code: z
      .string()
      .trim()
      .min(2, "کد تخفیف کوتاه‌تر از حد مجاز است.")
      .max(40)
      .regex(/^[A-Za-z0-9_-]+$/u, "فقط حروف لاتین، عدد، _ و - مجاز است."),
    nameFa: z.string().trim().min(1, "نام برنامه الزامی است.").max(120),
    descriptionFa: z.string().trim().max(500).optional().default(""),
    discountType: z.enum(["percent", "fixed_amount", "free_months"]),
    amount: z.coerce
      .number()
      .int("مقدار باید عدد صحیح باشد.")
      .positive("مقدار باید مثبت باشد."),
    startsAt: z.string().trim().optional().default(""),
    endsAt: z.string().trim().optional().default(""),
    maxRedemptions: z
      .union([z.literal(""), z.coerce.number().int().nonnegative()])
      .optional(),
    maxPerUser: z
      .union([z.literal(""), z.coerce.number().int().nonnegative()])
      .optional(),
    firstTimeOnly: z.string().optional(),
    appliesToPlanKeys: z.array(z.enum(PLAN_KEYS)).optional().default([]),
    appliesToBillingCycles: z.array(z.enum(CYCLES)).optional().default([]),
    recurringCycles: z.coerce.number().int().min(1).max(120),
    isActive: z.string().optional(),
  })
  .refine(
    (v) => v.discountType !== "percent" || (v.amount >= 1 && v.amount <= 100),
    { path: ["amount"], message: "درصد باید بین ۱ تا ۱۰۰ باشد." },
  );

function parseDateOptional(value: string): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function arrayOrNull(arr: readonly string[] | undefined): string[] | null {
  return arr && arr.length > 0 ? [...arr] : null;
}

export async function upsertDiscountCodeAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const viewer = await requireAdmin();

  // multi-checkbox handling: form sends `appliesToPlanKeys=pro` etc.
  const planKeys = formData.getAll("appliesToPlanKeys").map(String) as string[];
  const cycles = formData
    .getAll("appliesToBillingCycles")
    .map(String) as string[];

  const parsed = upsertSchema.safeParse({
    id: formData.get("id") || undefined,
    code: formData.get("code"),
    nameFa: formData.get("nameFa"),
    descriptionFa: formData.get("descriptionFa"),
    discountType: formData.get("discountType"),
    amount: formData.get("amount"),
    startsAt: formData.get("startsAt"),
    endsAt: formData.get("endsAt"),
    maxRedemptions: formData.get("maxRedemptions") ?? "",
    maxPerUser: formData.get("maxPerUser") ?? "",
    firstTimeOnly: formData.get("firstTimeOnly"),
    appliesToPlanKeys: planKeys,
    appliesToBillingCycles: cycles,
    recurringCycles: formData.get("recurringCycles") ?? "1",
    isActive: formData.get("isActive"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      fieldErrors: parsed.error.flatten().fieldErrors,
      message: "اطلاعات کد تخفیف نامعتبر است.",
    };
  }

  const v = parsed.data;
  const codeNormalized = normalizeDiscountCode(v.code);

  const db = getDb();

  // Normalized-uniqueness preflight (with friendlier error message).
  const existing = await db.query.discountCodes.findFirst({
    where: eq(discountCodes.codeNormalized, codeNormalized),
    columns: { id: true },
  });
  if (existing && existing.id !== v.id) {
    return {
      status: "error",
      fieldErrors: { code: ["این کد تخفیف قبلاً ثبت شده است."] },
      message: "کد تخفیف تکراری است.",
    };
  }

  const values = {
    code: v.code,
    codeNormalized,
    nameFa: v.nameFa,
    descriptionFa: v.descriptionFa || null,
    discountType: v.discountType,
    amount: v.amount,
    startsAt: parseDateOptional(v.startsAt),
    endsAt: parseDateOptional(v.endsAt),
    maxRedemptions:
      typeof v.maxRedemptions === "number" ? v.maxRedemptions : null,
    maxPerUser: typeof v.maxPerUser === "number" ? v.maxPerUser : null,
    firstTimeOnly: Boolean(v.firstTimeOnly),
    appliesToPlanKeys: arrayOrNull(v.appliesToPlanKeys),
    appliesToBillingCycles: arrayOrNull(v.appliesToBillingCycles),
    recurringCycles: v.recurringCycles,
    isActive: Boolean(v.isActive ?? "on"),
    createdByUserId: viewer.user.id,
  };

  if (v.id) {
    await db
      .update(discountCodes)
      .set({ ...values, updatedAt: new Date() })
      .where(eq(discountCodes.id, v.id));
    log.info("admin.discount.update", { id: v.id, code: v.code });
  } else {
    await db.insert(discountCodes).values(values);
    log.info("admin.discount.create", { code: v.code });
  }

  revalidatePath("/admin/discounts");
  return { status: "success", message: "کد تخفیف ذخیره شد." };
}

export async function toggleDiscountCodeAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();
  const id = String(formData.get("id") || "");
  if (!id) return { status: "error", message: "شناسه نامعتبر است." };

  const db = getDb();
  const row = await db.query.discountCodes.findFirst({
    where: eq(discountCodes.id, id),
    columns: { id: true, isActive: true },
  });
  if (!row) return { status: "error", message: "کد پیدا نشد." };

  await db
    .update(discountCodes)
    .set({ isActive: !row.isActive, updatedAt: new Date() })
    .where(eq(discountCodes.id, id));

  log.info("admin.discount.toggle", { id, isActive: !row.isActive });
  revalidatePath("/admin/discounts");
  return { status: "success", message: "وضعیت کد به‌روزرسانی شد." };
}
