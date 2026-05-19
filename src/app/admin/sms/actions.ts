"use server";

import { revalidatePath } from "next/cache";
import { and, eq, lt } from "drizzle-orm";
import { z } from "zod";

import { getDb } from "@/db";
import { smsQueue, smsTemplates } from "@/db/schema";
import { type ActionState } from "@/lib/action-state";
import { requireAdmin } from "@/lib/auth/session";
import { log } from "@/lib/log";
import { processSmsQueue, sendSmsTemplateTest } from "@/lib/sms-queue";

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

/**
 * Manually drain up to 50 due rows from the SMS queue.
 * Equivalent to one tick of the /api/cron/sms worker.
 *
 * The worker itself throttles outbound Kavenegar calls
 * (see `INTER_CALL_DELAY_MS` in `lib/sms-queue.ts`), so back-to-back
 * clicks are safe at the provider layer. The UI also enforces a short
 * client-side cooldown to discourage runaway clicking.
 */
export async function flushSmsQueueAction(
  _prev: ActionState,
  _formData: FormData,
): Promise<ActionState> {
  await requireAdmin();
  try {
    const result = await processSmsQueue({ limit: 50 });
    log.info("admin.sms.flush", result);
    revalidatePath("/admin/sms");
    return {
      status: "success",
      message: `بررسی شد: ${result.scanned} پیام — ارسال: ${result.sent} · تلاش مجدد: ${result.retried} · ناموفق: ${result.failed}`,
    };
  } catch (err) {
    return {
      status: "error",
      message: `خطا در پردازش صف: ${(err as Error).message}`,
    };
  }
}

/**
 * Reset rows truly stuck in 'sending' back to 'queued'. We require the
 * row to have been in `sending` for at least 5 minutes — otherwise we
 * might be racing an in-flight dispatch and could trigger a duplicate
 * send. A healthy Kavenegar call finishes in well under that window.
 */
const STUCK_THRESHOLD_MINUTES = 5;

export async function resetStuckSendingAction(
  _prev: ActionState,
  _formData: FormData,
): Promise<ActionState> {
  await requireAdmin();
  const db = getDb();
  const cutoff = new Date(Date.now() - STUCK_THRESHOLD_MINUTES * 60 * 1000);
  const rows = await db
    .update(smsQueue)
    .set({
      status: "queued",
      scheduledFor: new Date(),
      updatedAt: new Date(),
    })
    .where(and(eq(smsQueue.status, "sending"), lt(smsQueue.updatedAt, cutoff)))
    .returning({ id: smsQueue.id });
  const count = rows.length;
  log.info("admin.sms.reset_stuck", {
    count,
    thresholdMinutes: STUCK_THRESHOLD_MINUTES,
  });
  revalidatePath("/admin/sms");
  return {
    status: "success",
    message: `${count} پیام گیر کرده به صف بازگشتند.`,
  };
}

/**
 * Mark old `queued` rows as `failed` with reason `stale_backlog`
 * instead of sending them. Used to drain a backlog of messages whose
 * timing has passed (e.g. "trial started 14 days ago" → don't send).
 *
 * Cutoff comes from the form (whole days). Defaults to 3 days if the
 * value is missing or invalid. Capped at 365 to avoid foot-guns.
 */
export async function purgeStaleQueuedAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();
  const raw = Number(formData.get("olderThanDays"));
  const days =
    Number.isFinite(raw) && raw >= 1 && raw <= 365 ? Math.floor(raw) : 3;
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const db = getDb();
  const rows = await db
    .update(smsQueue)
    .set({
      status: "failed",
      lastError: "stale_backlog",
      updatedAt: new Date(),
    })
    .where(and(eq(smsQueue.status, "queued"), lt(smsQueue.createdAt, cutoff)))
    .returning({ id: smsQueue.id });
  const count = rows.length;
  log.info("admin.sms.purge_stale", { count, days });
  revalidatePath("/admin/sms");
  return {
    status: "success",
    message: `${count} پیام قدیمی‌تر از ${days} روز به‌عنوان منقضی علامت خوردند.`,
  };
}
