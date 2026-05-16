"use server";

import { revalidatePath } from "next/cache";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";

import { getDb } from "@/db";
import { pageEntitlements, pageSubscriptions, plans, profiles } from "@/db/schema";
import { recordAdminAudit } from "@/lib/admin-audit";
import { type ActionState } from "@/lib/action-state";
import { requireAdmin } from "@/lib/auth/session";
import { computePeriodEnd } from "@/lib/billing-pricing";
import { rebuildEntitlements } from "@/lib/entitlements";
import { invalidateProfileCacheById } from "@/lib/cache/profile-cache";
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
  featureKey: z.string().trim().min(1, "کلید قابلیت اجباری است.").max(120),
  expiresInDays: z.union([z.string(), z.undefined()]).transform((v) => {
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

  // Entitlement granted → cached page may be missing the new feature
  // (e.g. bookings) → invalidate so it shows up immediately.
  await invalidateProfileCacheById(pageId);

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

  // Entitlement revoked → the public page must stop rendering blocks
  // that just lost their gate.
  await invalidateProfileCacheById(pageId);

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

  // Period change can resurrect from grace/expired → entitlements come
  // back → invalidate so the public page reflects the new state.
  await invalidateProfileCacheById(pageId);

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
  reason: z.string().trim().max(REASON_MAX).optional(),
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
        planKey,
        billingCycle: nextCycle,
        // Manual override always lands as `active` (no trial, no grace).
        status: planKey === "free" ? "expired" : "active",
        isAdminOverride: planKey !== "free",
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

    // Phase 5: a manual plan change drops any existing price-lock — the
    // lock was scoped to the OLD plan and would silently undercharge
    // (or overcharge) the page on its new plan. We DELETE all locks for
    // this page; if the admin needs to re-lock at the new plan they
    // can do so explicitly via the page-level lock UI (Phase 8).
    if (!samePlan) {
      const dropped = (await tx.execute(sql`
        DELETE FROM "subscription_price_locks"
        WHERE "page_id" = ${pageId}::uuid
        RETURNING "plan_id", "locked_monthly_toman", "locked_annual_toman"
      `)) as unknown as Array<{
        plan_id: string;
        locked_monthly_toman: number;
        locked_annual_toman: number;
      }>;

      if (dropped.length > 0) {
        await recordAdminAudit(
          {
            actorUserId: viewer.user.id,
            action: "subscription.price_lock_dropped_on_plan_change",
            targetPageId: pageId,
            reason: "automatic on manual plan change",
            metadata: {
              fromPlanId: sub.planId,
              toPlanId: targetPlan.id,
              droppedLocks: dropped,
            },
          },
          tx,
        );
      }
    }

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

  // Plan changed → entitlement set changed → drop the cached page.
  await invalidateProfileCacheById(pageId);

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
      p."key" AS plan_key,
      i."billing_cycle"::text AS billing_cycle,
      i."status"::text AS status,
      i."total_toman" AS total_toman
    FROM "invoices" i
    JOIN "plans" p ON p."id" = i."plan_id"
    WHERE i."id" = ${invoiceId}::uuid
    LIMIT 1
  `);
  const row = (
    inv as unknown as Array<{
      id: string;
      page_id: string;
      plan_id: string;
      plan_key: string;
      billing_cycle: "monthly" | "annual";
      status: string;
      total_toman: number;
    }>
  )[0];
  if (!row) return { status: "error", message: "فاکتور یافت نشد." };
  if (row.status === "paid") {
    return { status: "error", message: "این فاکتور پیشاپیش پرداخت شده است." };
  }
  if (row.status === "canceled") {
    return {
      status: "error",
      message: "نمی‌توان فاکتور لغو شده را پرداخت کرد.",
    };
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
      const baseline = sub.currentPeriodEnd > now ? sub.currentPeriodEnd : now;
      const newEnd = computePeriodEnd(baseline, row.billing_cycle);
      await tx
        .update(pageSubscriptions)
        .set({
          planId: row.plan_id,
          planKey: row.plan_key,
          billingCycle: row.billing_cycle,
          status: "active",
          currentPeriodStart:
            sub.currentPeriodEnd > now ? sub.currentPeriodStart : now,
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

  // Plan/period possibly changed (resurrected from grace) and
  // entitlements rebuilt → invalidate the public page cache.
  await invalidateProfileCacheById(row.page_id);

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
    return {
      status: "error",
      message: "نمی‌توان فاکتور پرداخت‌شده را لغو کرد.",
    };
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

// ---------------------------------------------------------------------------
// Phase 8 — page-level subscription extensions.
//
// Force-expire, lock/unlock price for the current plan, queue a discount
// for the next renewal. Each goes through the same admin → audit pattern.
// ---------------------------------------------------------------------------

const forceExpireSchema = z.object({
  pageId: z.string().uuid(),
  reason: reasonSchema,
});

export async function adminForceExpireSubscriptionAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const viewer = await requireAdmin();
  const parsed = forceExpireSchema.safeParse({
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
  const sub = await db.query.pageSubscriptions.findFirst({
    where: eq(pageSubscriptions.pageId, pageId),
  });
  if (!sub) return { status: "error", message: "اشتراک یافت نشد." };
  if (sub.status === "expired") {
    return { status: "error", message: "این اشتراک هم‌اکنون منقضی است." };
  }

  const now = new Date();
  await db.transaction(async (tx) => {
    await tx
      .update(pageSubscriptions)
      .set({
        status: "expired",
        currentPeriodEnd: now,
        cancelAtPeriodEnd: false,
        pendingPlanChangePlanId: null,
        updatedAt: now,
      })
      .where(eq(pageSubscriptions.pageId, pageId));

    // Strip subscription-sourced entitlements; admin grants survive.
    await rebuildEntitlements(tx, pageId);

    await recordAdminAudit(
      {
        actorUserId: viewer.user.id,
        action: "subscription.force_expire",
        targetPageId: pageId,
        reason,
        metadata: {
          previousStatus: sub.status,
          previousPeriodEnd: sub.currentPeriodEnd.toISOString(),
        },
      },
      tx,
    );
  });

  // Force-expire dropped entitlements to free → invalidate cached page.
  await invalidateProfileCacheById(pageId);

  log.info("admin.subscription.force_expire", {
    adminId: viewer.user.id,
    pageId,
  });
  revalidatePath(`/admin/billing/pages/${pageId}`);
  return { status: "success", message: "اشتراک منقضی شد." };
}

const priceLockSchema = z.object({
  pageId: z.string().uuid(),
  lockedMonthlyToman: z.coerce.number().int().min(0).max(1_000_000_000),
  lockedAnnualToman: z.coerce.number().int().min(0).max(1_000_000_000),
  reason: reasonSchema,
});

export async function adminSetPriceLockAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const viewer = await requireAdmin();
  const parsed = priceLockSchema.safeParse({
    pageId: formData.get("pageId"),
    lockedMonthlyToman: formData.get("lockedMonthlyToman"),
    lockedAnnualToman: formData.get("lockedAnnualToman"),
    reason: formData.get("reason"),
  });
  if (!parsed.success) {
    return {
      status: "error",
      fieldErrors: parsed.error.flatten().fieldErrors,
      message: "ورودی نامعتبر است.",
    };
  }
  const { pageId, lockedMonthlyToman, lockedAnnualToman, reason } = parsed.data;

  const db = getDb();
  const sub = await db.query.pageSubscriptions.findFirst({
    where: eq(pageSubscriptions.pageId, pageId),
    with: { plan: true },
  });
  if (!sub) return { status: "error", message: "اشتراک یافت نشد." };
  if (sub.plan.key === "free") {
    return {
      status: "error",
      message: "قفل قیمت برای پلن رایگان معنا ندارد.",
    };
  }

  await db.transaction(async (tx) => {
    await tx.execute(sql`
      INSERT INTO "subscription_price_locks"
        ("page_id", "plan_id", "billing_cycle",
         "locked_monthly_toman", "locked_annual_toman",
         "reason", "locked_by_user_id", "locked_at")
      VALUES (
        ${pageId}::uuid, ${sub.planId}::uuid, NULL,
        ${lockedMonthlyToman}, ${lockedAnnualToman},
        ${reason}, ${viewer.user.id}::uuid, now()
      )
      ON CONFLICT ("page_id") DO UPDATE SET
        "plan_id"              = EXCLUDED."plan_id",
        "locked_monthly_toman" = EXCLUDED."locked_monthly_toman",
        "locked_annual_toman"  = EXCLUDED."locked_annual_toman",
        "reason"               = EXCLUDED."reason",
        "locked_by_user_id"    = EXCLUDED."locked_by_user_id",
        "locked_at"            = now()
    `);

    await recordAdminAudit(
      {
        actorUserId: viewer.user.id,
        action: "subscription.price_lock_set",
        targetPageId: pageId,
        reason,
        metadata: {
          planId: sub.planId,
          lockedMonthlyToman,
          lockedAnnualToman,
        },
      },
      tx,
    );
  });

  log.info("admin.subscription.price_lock_set", {
    adminId: viewer.user.id,
    pageId,
  });
  revalidatePath(`/admin/billing/pages/${pageId}`);
  return { status: "success", message: "قفل قیمت اعمال شد." };
}

const removeLockSchema = z.object({
  pageId: z.string().uuid(),
  reason: reasonSchema,
});

export async function adminRemovePriceLockAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const viewer = await requireAdmin();
  const parsed = removeLockSchema.safeParse({
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
  let dropped = 0;
  await db.transaction(async (tx) => {
    const result = (await tx.execute(sql`
      DELETE FROM "subscription_price_locks"
      WHERE "page_id" = ${pageId}::uuid
      RETURNING "plan_id", "locked_monthly_toman", "locked_annual_toman"
    `)) as unknown as Array<{
      plan_id: string;
      locked_monthly_toman: number;
      locked_annual_toman: number;
    }>;
    dropped = result.length;
    if (dropped === 0) return;

    await recordAdminAudit(
      {
        actorUserId: viewer.user.id,
        action: "subscription.price_lock_remove",
        targetPageId: pageId,
        reason,
        metadata: { droppedLocks: result },
      },
      tx,
    );
  });

  if (dropped === 0) {
    return { status: "error", message: "قفل قیمتی برای این صفحه ثبت نشده." };
  }

  log.info("admin.subscription.price_lock_remove", {
    adminId: viewer.user.id,
    pageId,
  });
  revalidatePath(`/admin/billing/pages/${pageId}`);
  return { status: "success", message: "قفل قیمت حذف شد." };
}

const applyDiscountSchema = z.object({
  pageId: z.string().uuid(),
  discountCodeId: z.string().uuid(),
  reason: reasonSchema,
});

export async function adminApplyDiscountToNextRenewalAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const viewer = await requireAdmin();
  const parsed = applyDiscountSchema.safeParse({
    pageId: formData.get("pageId"),
    discountCodeId: formData.get("discountCodeId"),
    reason: formData.get("reason"),
  });
  if (!parsed.success) {
    return {
      status: "error",
      fieldErrors: parsed.error.flatten().fieldErrors,
      message: "ورودی نامعتبر است.",
    };
  }
  const { pageId, discountCodeId, reason } = parsed.data;

  const db = getDb();
  const codeRows = (await db.execute(sql`
    SELECT "id", "code", "is_active", "deleted_at"
    FROM "discount_codes"
    WHERE "id" = ${discountCodeId}::uuid
    LIMIT 1
  `)) as unknown as Array<{
    id: string;
    code: string;
    is_active: boolean;
    deleted_at: Date | null;
  }>;
  const code = codeRows[0];
  if (!code) return { status: "error", message: "کد تخفیف یافت نشد." };
  if (!code.is_active || code.deleted_at) {
    return { status: "error", message: "کد تخفیف فعال نیست." };
  }

  const sub = await db.query.pageSubscriptions.findFirst({
    where: eq(pageSubscriptions.pageId, pageId),
  });
  if (!sub) return { status: "error", message: "اشتراک یافت نشد." };

  const now = new Date();
  await db.transaction(async (tx) => {
    await tx
      .update(pageSubscriptions)
      .set({
        pendingDiscountCodeId: discountCodeId,
        pendingDiscountQueuedAt: now,
        pendingDiscountAppliedAt: null,
        updatedAt: now,
      })
      .where(eq(pageSubscriptions.pageId, pageId));

    await recordAdminAudit(
      {
        actorUserId: viewer.user.id,
        action: "subscription.apply_discount_to_next_renewal",
        targetPageId: pageId,
        reason,
        metadata: {
          discountCodeId,
          code: code.code,
          previousPendingDiscountCodeId: sub.pendingDiscountCodeId,
        },
      },
      tx,
    );
  });

  log.info("admin.subscription.apply_discount_to_next_renewal", {
    adminId: viewer.user.id,
    pageId,
    discountCodeId,
  });
  revalidatePath(`/admin/billing/pages/${pageId}`);
  return { status: "success", message: "کد تخفیف برای تمدید بعدی ثبت شد." };
}

// ---------- Disable / enable page -----------------------------------------

const disablePageSchema = z.object({
  pageId: z.string().uuid(),
});

export async function adminDisablePageAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const viewer = await requireAdmin();
  const parsed = disablePageSchema.safeParse({
    pageId: formData.get("pageId"),
  });
  if (!parsed.success) {
    return { status: "error", message: "ورودی نامعتبر است." };
  }
  const { pageId } = parsed.data;

  const db = getDb();
  const page = await db.query.profiles.findFirst({
    where: eq(profiles.id, pageId),
    columns: { id: true, adminDisabledAt: true, slug: true },
  });
  if (!page) return { status: "error", message: "صفحه یافت نشد." };
  if (page.adminDisabledAt) {
    return { status: "error", message: "این صفحه قبلاً غیرفعال شده است." };
  }

  const now = new Date();
  await db.transaction(async (tx) => {
    await tx
      .update(profiles)
      .set({ adminDisabledAt: now, updatedAt: now })
      .where(eq(profiles.id, pageId));

    await recordAdminAudit(
      {
        actorUserId: viewer.user.id,
        action: "page.admin_disable",
        targetPageId: pageId,
      },
      tx,
    );
  });

  await invalidateProfileCacheById(pageId);

  log.info("admin.page.disable", { adminId: viewer.user.id, pageId });
  revalidatePath(`/admin/billing/pages/${pageId}`);
  revalidatePath("/admin/pages");
  revalidatePath("/admin/billing/pages");
  return { status: "success", message: "صفحه غیرفعال شد." };
}

export async function adminEnablePageAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const viewer = await requireAdmin();
  const parsed = disablePageSchema.safeParse({
    pageId: formData.get("pageId"),
  });
  if (!parsed.success) {
    return { status: "error", message: "ورودی نامعتبر است." };
  }
  const { pageId } = parsed.data;

  const db = getDb();
  const page = await db.query.profiles.findFirst({
    where: eq(profiles.id, pageId),
    columns: { id: true, adminDisabledAt: true },
  });
  if (!page) return { status: "error", message: "صفحه یافت نشد." };
  if (!page.adminDisabledAt) {
    return { status: "error", message: "این صفحه در حال حاضر فعال است." };
  }

  const now = new Date();
  await db.transaction(async (tx) => {
    await tx
      .update(profiles)
      .set({ adminDisabledAt: null, updatedAt: now })
      .where(eq(profiles.id, pageId));

    await recordAdminAudit(
      {
        actorUserId: viewer.user.id,
        action: "page.admin_enable",
        targetPageId: pageId,
      },
      tx,
    );
  });

  await invalidateProfileCacheById(pageId);

  log.info("admin.page.enable", { adminId: viewer.user.id, pageId });
  revalidatePath(`/admin/billing/pages/${pageId}`);
  revalidatePath("/admin/pages");
  revalidatePath("/admin/billing/pages");
  return { status: "success", message: "صفحه مجدداً فعال شد." };
}
