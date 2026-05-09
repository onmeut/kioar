"use server";

/**
 * Phase 9 — admin test tools (non-production only).
 *
 * Three diagnostic actions that exercise the billing pipeline without
 * touching real money or sending real network traffic:
 *
 *   1. `simulateRenewalDryRunAction(pageId)` — runs `evaluateTransitions`
 *      against the latest sub state at "now" and returns the candidate
 *      list. No writes, no SMS, no entitlement changes.
 *   2. `fireSmsNowAction(pageId, templateKey)` — bypasses the cron and
 *      enqueues an SMS for the page owner immediately. The SMS worker
 *      then drains it normally.
 *   3. `mockZarinpalVerifyAction(invoiceId, refId)` — runs the same
 *      `applyVerifiedPayment` path the real callback would, with a
 *      synthetic ref/raw response. Useful for exercising entitlement
 *      rebuilds without touching Zarinpal.
 *
 * Hard gate: every action throws if `NODE_ENV === "production"`. The
 * route handler is gated identically.
 */
import { revalidatePath } from "next/cache";
import { sql } from "drizzle-orm";
import { z } from "zod";

import { getDb } from "@/db";
import { recordAdminAudit } from "@/lib/admin-audit";
import { type ActionState } from "@/lib/action-state";
import { requireAdmin } from "@/lib/auth/session";
import { applyVerifiedPayment } from "@/lib/billing-apply";
import { evaluateTransitions } from "@/lib/billing-state";
import { log } from "@/lib/log";
import { enqueueSms, type SmsTemplateKey } from "@/lib/sms-queue";

import { TEST_TOOLS_SMS_TEMPLATE_KEYS } from "./constants";

function assertNonProd() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("test-tools disabled in production");
  }
}

const reasonSchema = z.string().trim().min(3).max(500);

// ---------- 1. simulate renewal dry-run -----------------------------------

const dryRunSchema = z.object({
  pageId: z.string().uuid(),
  reason: reasonSchema,
});

export type DryRunResult = ActionState & {
  candidates?: Array<{ type: string; keyDate: string }>;
};

export async function simulateRenewalDryRunAction(
  _prev: DryRunResult,
  formData: FormData,
): Promise<DryRunResult> {
  assertNonProd();
  const viewer = await requireAdmin();
  const parsed = dryRunSchema.safeParse({
    pageId: formData.get("pageId"),
    reason: formData.get("reason"),
  });
  if (!parsed.success) {
    return {
      status: "error",
      fieldErrors: parsed.error.flatten().fieldErrors,
      message: "ورودی نامعتبر است.",
    };
  }
  const { pageId, reason } = parsed.data;

  const db = getDb();
  const rows = (await db.execute(sql`
    SELECT
      s."id"                          AS "id",
      s."page_id"                     AS "pageId",
      s."plan_id"                     AS "planId",
      s."billing_cycle"               AS "billingCycle",
      s."status"                      AS "status",
      s."current_period_start"        AS "currentPeriodStart",
      s."current_period_end"          AS "currentPeriodEnd",
      s."trial_ends_at"               AS "trialEndsAt",
      s."cancel_at_period_end"        AS "cancelAtPeriodEnd",
      s."pending_plan_change_plan_id" AS "pendingPlanChangePlanId",
      p."key"                         AS "planKey",
      p."name_fa"                     AS "planNameFa",
      coalesce(l."locked_monthly_toman", p."price_monthly_toman")
                                      AS "priceMonthlyToman",
      coalesce(l."locked_annual_toman", p."price_annual_toman")
                                      AS "priceAnnualToman",
      pr."user_id"                    AS "userId",
      u."phone"                       AS "phone"
    FROM "page_subscriptions" s
    JOIN "plans"    p  ON p."id"  = s."plan_id"
    JOIN "profiles" pr ON pr."id" = s."page_id"
    JOIN "users"    u  ON u."id"  = pr."user_id"
    LEFT JOIN "subscription_price_locks" l
      ON l."page_id" = s."page_id" AND l."plan_id" = s."plan_id"
    WHERE s."page_id" = ${pageId}::uuid
    LIMIT 1
  `)) as unknown as Array<{
    id: string;
    pageId: string;
    planId: string;
    billingCycle: "monthly" | "annual";
    status:
      | "trialing"
      | "active"
      | "pending_renewal"
      | "grace"
      | "canceled"
      | "expired";
    currentPeriodStart: Date;
    currentPeriodEnd: Date;
    trialEndsAt: Date | null;
    cancelAtPeriodEnd: boolean;
    pendingPlanChangePlanId: string | null;
    planKey: "free" | "pro" | "business";
    planNameFa: string;
    priceMonthlyToman: number;
    priceAnnualToman: number;
    userId: string;
    phone: string;
  }>;

  const sub = rows[0];
  if (!sub) {
    return { status: "error", message: "اشتراکی برای این صفحه یافت نشد." };
  }

  const now = new Date();
  const candidates = evaluateTransitions(sub, now);

  await recordAdminAudit({
    actorUserId: viewer.user.id,
    action: "subscription.simulate_renewal_dry_run",
    targetPageId: pageId,
    reason,
    metadata: {
      now: now.toISOString(),
      candidateCount: candidates.length,
      candidates: candidates.map((c) => ({
        type: c.type,
        keyDate: c.keyDate.toISOString(),
      })),
    },
  });

  log.info("admin.test_tools.simulate_renewal_dry_run", {
    adminId: viewer.user.id,
    pageId,
    candidateCount: candidates.length,
  });

  return {
    status: "success",
    message: `${candidates.length} رویداد در صف قرار خواهد گرفت (آزمایشی، بدون ثبت).`,
    candidates: candidates.map((c) => ({
      type: c.type,
      keyDate: c.keyDate.toISOString(),
    })),
  };
}

// ---------- 2. fire SMS now ----------------------------------------------

const fireSmsSchema = z.object({
  pageId: z.string().uuid(),
  templateKey: z.enum(
    TEST_TOOLS_SMS_TEMPLATE_KEYS as unknown as [
      SmsTemplateKey,
      ...SmsTemplateKey[],
    ],
  ),
  reason: reasonSchema,
});

export async function fireSmsNowAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  assertNonProd();
  const viewer = await requireAdmin();
  const parsed = fireSmsSchema.safeParse({
    pageId: formData.get("pageId"),
    templateKey: formData.get("templateKey"),
    reason: formData.get("reason"),
  });
  if (!parsed.success) {
    return {
      status: "error",
      fieldErrors: parsed.error.flatten().fieldErrors,
      message: "ورودی نامعتبر است.",
    };
  }
  const { pageId, templateKey, reason } = parsed.data;

  const db = getDb();
  const rows = (await db.execute(sql`
    SELECT pr."user_id" AS "userId", u."phone" AS "phone",
           p."name_fa" AS "planNameFa"
    FROM "profiles" pr
    JOIN "users" u ON u."id" = pr."user_id"
    JOIN "page_subscriptions" s ON s."page_id" = pr."id"
    JOIN "plans" p ON p."id" = s."plan_id"
    WHERE pr."id" = ${pageId}::uuid
    LIMIT 1
  `)) as unknown as Array<{
    userId: string;
    phone: string;
    planNameFa: string;
  }>;

  const owner = rows[0];
  if (!owner) {
    return { status: "error", message: "صفحه یا کاربر یافت نشد." };
  }

  const stamp = Date.now();
  await enqueueSms({
    templateKey,
    phone: owner.phone,
    userId: owner.userId,
    idempotencyKey: `admin_test:${templateKey}:${pageId}:${stamp}`,
    variables: {
      plan: owner.planNameFa,
      daysLeft: 1,
      graceDays: 7,
      invoice: "TEST-0000",
      amount: 0,
      ref: "TEST",
    },
  });

  await recordAdminAudit({
    actorUserId: viewer.user.id,
    action: "subscription.fire_sms_now",
    targetPageId: pageId,
    reason,
    metadata: { templateKey, stamp },
  });

  log.info("admin.test_tools.fire_sms_now", {
    adminId: viewer.user.id,
    pageId,
    templateKey,
  });

  revalidatePath("/admin/billing/test-tools");
  return { status: "success", message: "پیامک در صف قرار گرفت." };
}

// ---------- 3. mock zarinpal verify --------------------------------------

const mockVerifySchema = z.object({
  invoiceId: z.string().uuid(),
  refId: z.string().trim().min(1).max(64),
  reason: reasonSchema,
});

export async function mockZarinpalVerifyAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  assertNonProd();
  const viewer = await requireAdmin();
  const parsed = mockVerifySchema.safeParse({
    invoiceId: formData.get("invoiceId"),
    refId: formData.get("refId"),
    reason: formData.get("reason"),
  });
  if (!parsed.success) {
    return {
      status: "error",
      fieldErrors: parsed.error.flatten().fieldErrors,
      message: "ورودی نامعتبر است.",
    };
  }
  const { invoiceId, refId, reason } = parsed.data;

  const db = getDb();
  const rows = (await db.execute(sql`
    SELECT
      i."id"             AS "invoiceId",
      i."page_id"        AS "pageId",
      i."plan_id"        AS "planId",
      p."key"            AS "planKey",
      i."billing_cycle"  AS "billingCycle",
      i."metadata"       AS "metadata",
      i."status"::text   AS "status",
      pay."id"           AS "paymentId"
    FROM "invoices" i
    JOIN "plans" p ON p."id" = i."plan_id"
    LEFT JOIN "payments" pay ON pay."invoice_id" = i."id"
    WHERE i."id" = ${invoiceId}::uuid
    ORDER BY pay."created_at" DESC NULLS LAST
    LIMIT 1
  `)) as unknown as Array<{
    invoiceId: string;
    pageId: string;
    planId: string;
    billingCycle: "monthly" | "annual";
    metadata: Record<string, unknown> | null;
    status: string;
    paymentId: string | null;
  }>;

  const inv = rows[0] as ((typeof rows)[0] & { planKey: string }) | undefined;
  if (!inv) {
    return { status: "error", message: "فاکتور یافت نشد." };
  }
  if (inv.status === "paid") {
    return { status: "error", message: "این فاکتور قبلاً پرداخت شده است." };
  }
  if (!inv.paymentId) {
    return {
      status: "error",
      message: "هیچ ردیف پرداختی برای این فاکتور ساخته نشده است.",
    };
  }

  const result = await applyVerifiedPayment({
    payment: { id: inv.paymentId, invoiceId: inv.invoiceId },
    invoice: {
      id: inv.invoiceId,
      pageId: inv.pageId,
      planId: inv.planId,
      billingCycle: inv.billingCycle,
      metadata: inv.metadata,
    },
    planKey: inv.planKey,
    refId,
    rawResponse: { source: "admin_mock_verify", refId },
  });

  await recordAdminAudit({
    actorUserId: viewer.user.id,
    action: "subscription.mock_zarinpal_verify",
    targetPageId: inv.pageId,
    reason,
    metadata: {
      invoiceId,
      refId,
      newPeriodStart: result.newPeriodStart.toISOString(),
      newPeriodEnd: result.newPeriodEnd.toISOString(),
    },
  });

  log.info("admin.test_tools.mock_zarinpal_verify", {
    adminId: viewer.user.id,
    invoiceId,
    pageId: inv.pageId,
  });

  revalidatePath(`/admin/billing/pages/${inv.pageId}`);
  revalidatePath("/admin/billing/test-tools");
  return { status: "success", message: "تأیید آزمایشی پرداخت اعمال شد." };
}
