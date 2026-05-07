"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { getDb } from "@/db";
import { smsTemplates } from "@/db/schema";
import { type ActionState } from "@/lib/action-state";
import { requireAdmin } from "@/lib/auth/session";
import { log } from "@/lib/log";
import { sendSmsTemplateTest } from "@/lib/sms-queue";

const updateMappingSchema = z.object({
  key: z.string().trim().min(1),
  kavenegarTemplate: z
    .string()
    .trim()
    .max(120, "نام تمپلیت طولانی‌تر از حد مجاز است.")
    .optional()
    .default(""),
  // Base UI's Switch posts "on" when checked and omits the field when
  // unchecked. Treat any non-empty value as enabled.
  isActive: z.string().optional(),
});

export async function updateSmsTemplateMappingAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();

  const parsed = updateMappingSchema.safeParse({
    key: formData.get("key"),
    kavenegarTemplate: formData.get("kavenegarTemplate"),
    isActive: formData.get("isActive"),
  });
  if (!parsed.success) {
    return {
      status: "error",
      fieldErrors: parsed.error.flatten().fieldErrors,
      message: "اطلاعات تمپلیت نامعتبر است.",
    };
  }

  const db = getDb();
  const existing = await db.query.smsTemplates.findFirst({
    where: eq(smsTemplates.key, parsed.data.key),
  });
  if (!existing) {
    return { status: "error", message: "تمپلیت پیدا نشد." };
  }

  await db
    .update(smsTemplates)
    .set({
      kavenegarTemplate: parsed.data.kavenegarTemplate
        ? parsed.data.kavenegarTemplate
        : null,
      isActive: Boolean(parsed.data.isActive),
      updatedAt: new Date(),
    })
    .where(eq(smsTemplates.key, parsed.data.key));

  log.info("admin.sms.template.update", {
    key: parsed.data.key,
    isActive: Boolean(parsed.data.isActive),
    hasMapping: Boolean(parsed.data.kavenegarTemplate),
  });

  revalidatePath("/admin/sms");
  return { status: "success", message: "تمپلیت ذخیره شد." };
}

const bodyPreviewSchema = z.object({
  key: z.string().trim().min(1),
  bodyFaPreview: z
    .string()
    .trim()
    .max(2000, "پیش‌نمایش پیامک بیش از حد طولانی است.")
    .optional()
    .default(""),
});

export async function updateSmsBodyPreviewAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();

  const parsed = bodyPreviewSchema.safeParse({
    key: formData.get("key"),
    bodyFaPreview: formData.get("bodyFaPreview"),
  });
  if (!parsed.success) {
    return {
      status: "error",
      fieldErrors: parsed.error.flatten().fieldErrors,
      message: "اطلاعات پیش‌نمایش نامعتبر است.",
    };
  }

  const db = getDb();
  const existing = await db.query.smsTemplates.findFirst({
    where: eq(smsTemplates.key, parsed.data.key),
  });
  if (!existing) return { status: "error", message: "تمپلیت پیدا نشد." };

  await db
    .update(smsTemplates)
    .set({
      bodyFaPreview: parsed.data.bodyFaPreview
        ? parsed.data.bodyFaPreview
        : null,
      bodyPreviewUpdatedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(smsTemplates.key, parsed.data.key));

  log.info("admin.sms.template.body_preview_update", {
    key: parsed.data.key,
    length: parsed.data.bodyFaPreview.length,
  });

  revalidatePath("/admin/sms");
  return { status: "success", message: "پیش‌نمایش ذخیره شد." };
}

const reconcileSchema = z.object({
  key: z.string().trim().min(1),
});

export async function reconcileSmsTemplateAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();

  const parsed = reconcileSchema.safeParse({ key: formData.get("key") });
  if (!parsed.success) {
    return { status: "error", message: "تمپلیت نامعتبر است." };
  }

  const db = getDb();
  const existing = await db.query.smsTemplates.findFirst({
    where: eq(smsTemplates.key, parsed.data.key),
  });
  if (!existing) return { status: "error", message: "تمپلیت پیدا نشد." };

  const now = new Date();
  await db
    .update(smsTemplates)
    .set({ kavenegarSyncedAt: now, updatedAt: now })
    .where(eq(smsTemplates.key, parsed.data.key));

  log.info("admin.sms.template.reconcile", { key: parsed.data.key });

  revalidatePath("/admin/sms");
  return { status: "success", message: "وضعیت همگام‌سازی به‌روزرسانی شد." };
}

const testSendSchema = z.object({
  key: z.string().trim().min(1),
  phone: z
    .string()
    .trim()
    .regex(/^98\d{10}$/u, "شماره موبایل نامعتبر است (قالب: 98XXXXXXXXXX)."),
});

export async function testSmsTemplateAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();

  const parsed = testSendSchema.safeParse({
    key: formData.get("key"),
    phone: formData.get("phone"),
  });
  if (!parsed.success) {
    return {
      status: "error",
      fieldErrors: parsed.error.flatten().fieldErrors,
      message: "اطلاعات ارسال آزمایشی نامعتبر است.",
    };
  }

  const db = getDb();
  const template = await db.query.smsTemplates.findFirst({
    where: eq(smsTemplates.key, parsed.data.key),
  });
  if (!template) return { status: "error", message: "تمپلیت پیدا نشد." };

  // Build a placeholder payload from the variable schema so the
  // operator sees the template variables resolved on the receiver.
  const variables: Record<string, string> = {};
  for (const variableKey of template.variableSchema ?? []) {
    variables[variableKey] = `{${variableKey}}`;
  }

  const result = await sendSmsTemplateTest({
    templateKey: parsed.data.key,
    phone: parsed.data.phone,
    variables,
  });

  if (!result.ok) {
    return {
      status: "error",
      message: `ارسال آزمایشی ناموفق بود: ${result.error}`,
    };
  }

  log.info("admin.sms.template.test", {
    key: parsed.data.key,
    provider: result.provider,
  });

  return {
    status: "success",
    message:
      result.provider === "console"
        ? "ارسال آزمایشی در حالت توسعه (لاگ کنسول) انجام شد."
        : "پیامک آزمایشی ارسال شد.",
  };
}
