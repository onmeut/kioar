"use server";

import { revalidatePath } from "next/cache";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";

import { getDb } from "@/db";
import { pageEntitlements, pageSubscriptions, plans } from "@/db/schema";
import { recordAdminAudit } from "@/lib/admin-audit";
import { type ActionState } from "@/lib/action-state";
import { requireAdmin } from "@/lib/auth/session";
import { computePeriodEnd } from "@/lib/billing-pricing";
import { rebuildEntitlements } from "@/lib/entitlements";
import { log } from "@/lib/log";

const REASON_MAX = 500;
const reasonSchema = z
  .string()
  .trim()
  .min(1, "ذکر دلیل اجباری است.")
  .max(REASON_MAX);

// ---------- Entitlement grant/revoke ---------------------------------------

const grantSchema = z.object({
  pageId: z.string().uuid(),
  featureKey: z
    .string()
    .trim()
    .min(1, "کلید قابلیت اجباری است.")
    .max(120),
  expiresInDays: z
    .union([z.string(), z.undefined()])
    .transform((v) => {
      if (!v || !v.trim()) return null;
      const n = Number.parseInt(v.trim(), 10);
      return Number.isFinite(n) && n > 0 ? n : null;
    }),
  reason: reasonSchema,
});

export async function adminGrantEntitlementAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const viewer = await requireAdmin();
  const parsed = grantSchema.safeParse({
    pageId: formData.get("pageId"),
    featureKey: formData.get("featureKey"),
    expiresInDays: formData.get("expiresInDays"),
    reason: formData.get("reason"),
  });
  if (!parsed.success) {
    return {
      status: "error",
      fieldErrors: parsed.error.flatten().fieldErrors,
      message: "ورودی نامعتبر است.",
    };
  }
  const { pageId, featureKey, expiresInDays, reason } = parsed.data;

  const expiresAt = expiresInDays
    ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
    : null;

  const db = getDb();
  await db.transaction(async (tx) => {
    await tx.execute(sql`
      INSERT INTO "page_entitlements"
        ("page_id", "feature_key", "source", "expires_at")
      VALUES
        (${pageId}::uuid, ${featureKey}, 'admin_grant', ${expiresAt})
      ON CONFLICT ("page_id", "feature_key")
      DO UPDATE SET
        "source"     = 'admin_grant',
        "expires_at" = EXCLUDED."expires_at",
        "granted_at" = now()
    `);
    await recordAdminAudit(
      {
        actorUserId: viewer.user.id,
        action: "entitlement.grant",
        targetPageId: pageId,
        reason,
        metadata: { featureKey, expiresInDays: expiresInDays ?? null },
      },
      tx,
    );
  });

  log.info("admin.entitlement.grant", {
    adminId: viewer.user.id,
    pageId,
    featureKey,
    expiresInDays: expiresInDays ?? null,
  });
  revalidatePath(`/admin/billing/pages/${pageId}`);
  return { status: "success", message: "قابلیت اعطا شد." };
}

const revokeSchema = z.object({
  pageId: z.string().uuid(),
  featureKey: z.string().trim().min(1).max(120),
  reason: reasonSchema,
});

export async function adminRevokeEntitlementAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const viewer = await requireAdmin();
  const parsed = revokeSchema.safeParse({
    pageId: formData.get("pageId"),
    featureKey: formData.get("featureKey"),
    reason: formData.get("reason"),
  });
  if (!parsed.success) {
    return {
      status: "error",
      fieldErrors: parsed.error.flatten().fieldErrors,
      message: "ورودی نامعتبر است.",
    };
  }
  const { pageId, featureKey, reason } = parsed.data;

  const db = getDb();
  await db.transaction(async (tx) => {
    // Only delete admin_grant rows — never touch subscription/promo.
    await tx.execute(sql`
      DELETE FROM "page_entitlements"
      WHERE "page_id" = ${pageId}::uuid
        AND "feature_key" = ${featureKey}
        AND "source" = 'admin_grant'
    `);
    await recordAdminAudit(
      {
        actorUserId: viewer.user.id,
        action: "entitlement.revoke",
        targetPageId: pageId,
        reason,
        metadata: { featureKey },
      },
      tx,
    );
  });

  log.info("admin.entitlement.revoke", {
    adminId: viewer.user.id,
    pageId,
    featureKey,
  });
  revalidatePath(`/admin/billing/pages/${pageId}`);
  return { status: "success", message: "قابلیت لغو شد." };
}

// ---------- Manual period extension ---------------------------------------

const extendSchema = z.object({
  pageId: z.string().uuid(),
  days: z
    .string()
    .transform((v) => Number.parseInt(v, 10))
    .pipe(
      z
        .number()
        .int("باید عدد صحیح باشد.")
        .min(1, "حداقل ۱ روز.")
        .max(365, "حداکثر ۳۶۵ روز."),
    ),
  reason: reasonSchema,
});

export async function adminExtendPeriodAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const viewer = await requireAdmin();
  const parsed = extendSchema.safeParse({
    pageId: formData.get("pageId"),
    days: formData.get("days"),
    reason: formData.get("reason"),
  });
  if (!parsed.success) {
    return {
      status: "error",
      fieldErrors: parsed.error.flatten().fieldErrors,
      message: "ورودی نامعتبر است.",
    };
  }
  const { pageId, days, reason } = parsed.data;

  const db = getDb();
  const sub = await db.query.pageSubscriptions.findFirst({
    where: eq(pageSubscriptions.pageId, pageId),
  });
  if (!sub) {
    return { status: "error", message: "اشتراک یافت نشد." };
  }

  const baseline =
    sub.currentPeriodEnd > new Date() ? sub.currentPeriodEnd : new Date();
  const newEnd = new Date(baseline.getTime() + days * 24 * 60 * 60 * 1000);

  await db.transaction(async (tx) => {
    await tx
      .update(pageSubscriptions)
      .set({
        currentPeriodEnd: newEnd,
        // If the page was in grace/expired, bump back to active so it
        // stops degrading. Trial state is preserved.
        status:
          sub.status === "grace" || sub.status === "expired"
            ? "active"
            : sub.status,
        updatedAt: new Date(),
      })
      .where(eq(pageSubscriptions.pageId, pageId));

    // If we resurrected from expired, the entitlements have already been
    // wiped down to free. Rebuild against the still-attached plan so the
    // user gets their paid features back during the extension.
    if (sub.status === "expired" || sub.status === "grace") {
      await rebuildEntitlements(tx, pageId);
    }

    await recordAdminAudit(
      {
        actorUserId: viewer.user.id,
        action: "subscription.extend_period",
        targetPageId: pageId,
        reason,
        metadata: {
          days,
          previousPeriodEnd: sub.currentPeriodEnd.toISOString(),
          newPeriodEnd: newEnd.toISOString(),
          previousStatus: sub.status,
        },
      },
      tx,
    );
  });

  log.info("admin.subscription.extend_period", {
    adminId: viewer.user.id,
    pageId,
    days,
  });
  revalidatePath(`/admin/billing/pages/${pageId}`);
  return { status: "success", message: "دوره تمدید شد." };
}

// ---------- Manual plan change --------------------------------------------

const planChangeSchema = z.object({
  pageId: z.string().uuid(),
  planKey: z.enum(["free", "pro", "business"]),
  billingCycle: z.enum(["monthly", "annual"]).optional(),
  reason: reasonSchema,
});

export async function adminManualPlanChangeAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const viewer = await requireAdmin();
  const parsed = planChangeSchema.safeParse({
    pageId: formData.get("pageId"),
    planKey: formData.get("planKey"),
    billingCycle: formData.get("billingCycle") || undefined,
    reason: formData.get("reason"),
  });
  if (!parsed.success) {
    return {
      status: "error",
      fieldErrors: parsed.error.flatten().fieldErrors,
      message: "ورودی نامعتبر است.",
    };
  }
  const { pageId, planKey, billingCycle, reason } = parsed.data;

  const db = getDb();
  const targetPlan = await db.query.plans.findFirst({
    where: eq(plans.key, planKey),
  });
  if (!targetPlan) {
    return { status: "error", message: "پلن مقصد یافت نشد." };
  }

  const sub = await db.query.pageSubscriptions.findFirst({
    where: eq(pageSubscriptions.pageId, pageId),
  });
  if (!sub) return { status: "error", message: "اشتراک یافت نشد." };

  const now = new Date();
  const nextCycle = billingCycle ?? sub.billingCycle;
  // Pin the new period from now if changing to a different plan; preserve
  // existing period_end for cycle-only no-op changes.
  const samePlan = sub.planId === targetPlan.id;
  const newPeriodEnd = samePlan
    ? sub.currentPeriodEnd
    : computePeriodEnd(now, nextCycle);

  await db.transaction(async (tx) => {
    await tx
      .update(pageSubscriptions)
      .set({
        planId: targetPlan.id,
        billingCycle: nextCycle,
        // Manual override always lands as `active` (no trial, no grace).
        status: planKey === "free" ? "expired" : "active",
        currentPeriodStart: samePlan ? sub.currentPeriodStart : now,
        currentPeriodEnd:
          planKey === "free"
            ? // Free is sentinel-far-future to keep the row usable.
              new Date(now.getTime() + 100 * 365 * 24 * 60 * 60 * 1000)
            : newPeriodEnd,
        cancelAtPeriodEnd: false,
        pendingPlanChangePlanId: null,
        updatedAt: now,
      })
      .where(eq(pageSubscriptions.pageId, pageId));

    await rebuildEntitlements(tx, pageId);

    await recordAdminAudit(
      {
        actorUserId: viewer.user.id,
        action: "subscription.manual_plan_change",
        targetPageId: pageId,
        reason,
        metadata: {
          fromPlanId: sub.planId,
          toPlanKey: planKey,
          fromBillingCycle: sub.billingCycle,
          toBillingCycle: nextCycle,
          fromStatus: sub.status,
        },
      },
      tx,
    );
  });

  log.info("admin.subscription.manual_plan_change", {
    adminId: viewer.user.id,
    pageId,
    planKey,
    billingCycle: nextCycle,
  });
  revalidatePath(`/admin/billing/pages/${pageId}`);
  return { status: "success", message: "پلن تغییر کرد." };
}

// ---------- Mark invoice paid ---------------------------------------------

const markPaidSchema = z.object({
  invoiceId: z.string().uuid(),
  reason: reasonSchema,
});

export async function adminMarkInvoicePaidAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const viewer = await requireAdmin();
  const parsed = markPaidSchema.safeParse({
    invoiceId: formData.get("invoiceId"),
    reason: formData.get("reason"),
  });
  if (!parsed.success) {
    return {
      status: "error",
      fieldErrors: parsed.error.flatten().fieldErrors,
      message: "ورودی نامعتبر است.",
    };
  }
  const { invoiceId, reason } = parsed.data;

  const db = getDb();
  const inv = await db.execute(sql`
    SELECT
      i."id" AS id,
      i."page_id" AS page_id,
      i."plan_id" AS plan_id,
      i."billing_cycle"::text AS billing_cycle,
      i."status"::text AS status,
      i."total_toman" AS total_toman
    FROM "invoices" i
    WHERE i."id" = ${invoiceId}::uuid
    LIMIT 1
  `);
  const row = (inv as unknown as Array<{
    id: string;
    page_id: string;
    plan_id: string;
    billing_cycle: "monthly" | "annual";
    status: string;
    total_toman: number;
  }>)[0];
  if (!row) return { status: "error", message: "فاکتور یافت نشد." };
  if (row.status === "paid") {
    return { status: "error", message: "این فاکتور پیشاپیش پرداخت شده است." };
  }
  if (row.status === "canceled") {
    return { status: "error", message: "نمی‌توان فاکتور لغو شده را پرداخت کرد." };
  }

  const now = new Date();
  await db.transaction(async (tx) => {
    await tx.execute(sql`
      UPDATE "invoices"
      SET "status" = 'paid', "paid_at" = ${now}, "updated_at" = ${now}
      WHERE "id" = ${invoiceId}::uuid
    `);

    // Apply the invoice to the subscription: extend period from now (or
    // existing period_end if still in the future) by one billing cycle.
    const sub = await tx.query.pageSubscriptions.findFirst({
      where: eq(pageSubscriptions.pageId, row.page_id),
    });
    if (sub) {
      const baseline =
        sub.currentPeriodEnd > now ? sub.currentPeriodEnd : now;
      const newEnd = computePeriodEnd(baseline, row.billing_cycle);
      await tx
        .update(pageSubscriptions)
        .set({
          planId: row.plan_id,
          billingCycle: row.billing_cycle,
          status: "active",
          currentPeriodStart: sub.currentPeriodEnd > now ? sub.currentPeriodStart : now,
          currentPeriodEnd: newEnd,
          updatedAt: now,
        })
        .where(eq(pageSubscriptions.pageId, row.page_id));
      await rebuildEntitlements(tx, row.page_id);
    }

    await recordAdminAudit(
      {
        actorUserId: viewer.user.id,
        action: "invoice.mark_paid",
        targetPageId: row.page_id,
        targetInvoiceId: invoiceId,
        reason,
        metadata: { totalToman: row.total_toman },
      },
      tx,
    );
  });

  log.info("admin.invoice.mark_paid", {
    adminId: viewer.user.id,
    invoiceId,
    pageId: row.page_id,
  });
  revalidatePath(`/admin/billing/pages/${row.page_id}`);
  revalidatePath("/admin/billing/invoices");
  revalidatePath("/admin/billing");
  return { status: "success", message: "فاکتور به‌صورت دستی پرداخت شد." };
}

// ---------- Cancel invoice ------------------------------------------------

export async function adminCancelInvoiceAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const viewer = await requireAdmin();
  const parsed = markPaidSchema.safeParse({
    invoiceId: formData.get("invoiceId"),
    reason: formData.get("reason"),
  });
  if (!parsed.success) {
    return {
      status: "error",
      fieldErrors: parsed.error.flatten().fieldErrors,
      message: "ورودی نامعتبر است.",
    };
  }
  const { invoiceId, reason } = parsed.data;

  const db = getDb();
  const rows = (await db.execute(sql`
    SELECT "id", "page_id", "status"::text AS status
    FROM "invoices"
    WHERE "id" = ${invoiceId}::uuid
    LIMIT 1
  `)) as unknown as Array<{ id: string; page_id: string; status: string }>;
  const row = rows[0];
  if (!row) return { status: "error", message: "فاکتور یافت نشد." };
  if (row.status === "paid") {
    return { status: "error", message: "نمی‌توان فاکتور پرداخت‌شده را لغو کرد." };
  }
  if (row.status === "canceled") {
    return { status: "error", message: "این فاکتور پیشاپیش لغو شده است." };
  }

  await db.transaction(async (tx) => {
    await tx.execute(sql`
      UPDATE "invoices"
      SET "status" = 'canceled', "updated_at" = now()
      WHERE "id" = ${invoiceId}::uuid
    `);
    await recordAdminAudit(
      {
        actorUserId: viewer.user.id,
        action: "invoice.cancel",
        targetPageId: row.page_id,
        targetInvoiceId: invoiceId,
        reason,
      },
      tx,
    );
  });

  log.info("admin.invoice.cancel", {
    adminId: viewer.user.id,
    invoiceId,
  });
  revalidatePath(`/admin/billing/pages/${row.page_id}`);
  revalidatePath("/admin/billing/invoices");
  return { status: "success", message: "فاکتور لغو شد." };
}
