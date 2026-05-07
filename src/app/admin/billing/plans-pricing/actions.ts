"use server";

import { revalidatePath } from "next/cache";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";

import { getDb } from "@/db";
import {
  plans,
  pageSubscriptions,
  subscriptionPriceLocks,
  subscriptionPriceChangeEvents,
} from "@/db/schema";
import { recordAdminAudit } from "@/lib/admin-audit";
import { type ActionState } from "@/lib/action-state";
import { requireAdmin } from "@/lib/auth/session";
import { enqueueSms } from "@/lib/sms-queue";
import { log } from "@/lib/log";

/**
 * Plan price editor — Phase 4.
 *
 * Two policies, picked at save time:
 *
 *   always_current → simply update the new prices on `plans`. Every
 *                    subscription (existing or future) renews at the
 *                    new price. No locks are created.
 *
 *   grandfather    → update the new prices, AND insert one
 *                    `subscription_price_locks` row per page that's
 *                    currently subscribed to this plan, snapshotting the
 *                    OLD prices. Renewals consult locks first, plans
 *                    second (Phase 5 wires this on the read side).
 *
 * Either way, one row is appended to `subscription_price_change_events`
 * with the before/after numbers and the actor. Optional SMS notification
 * (queued only when the checkbox is on).
 */

const updateSchema = z.object({
  planId: z.string().uuid(),
  /** Toman, integer, >= 0. Empty string means "leave as is". */
  priceMonthlyToman: z.coerce.number().int().min(0).max(1_000_000_000),
  priceAnnualToman: z.coerce.number().int().min(0).max(10_000_000_000),
  /** Optional UI helper; pricing math reads the absolute fields. */
  annualDiscountPercent: z
    .union([z.string(), z.number(), z.null(), z.undefined()])
    .transform((v) => {
      if (v === null || v === undefined || v === "") return null;
      const n = typeof v === "number" ? v : Number.parseInt(String(v), 10);
      return Number.isFinite(n) && n >= 0 && n <= 95 ? n : null;
    }),
  policy: z.enum(["always_current", "grandfather"]),
  notifySubscribers: z
    .union([z.literal("on"), z.literal("off"), z.string(), z.undefined()])
    .transform((v) => v === "on"),
  reason: z.string().trim().max(500).optional(),
});

export async function adminUpdatePlanPricingAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const viewer = await requireAdmin();

  const parsed = updateSchema.safeParse({
    planId: formData.get("planId"),
    priceMonthlyToman: formData.get("priceMonthlyToman"),
    priceAnnualToman: formData.get("priceAnnualToman"),
    annualDiscountPercent: formData.get("annualDiscountPercent"),
    policy: formData.get("policy"),
    notifySubscribers: formData.get("notifySubscribers"),
    reason: formData.get("reason") ?? undefined,
  });
  if (!parsed.success) {
    return {
      status: "error",
      message: "ورودی نامعتبر است.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }
  const data = parsed.data;

  const db = getDb();

  // Snapshot the previous prices BEFORE any update.
  const planRow = await db.query.plans.findFirst({
    where: eq(plans.id, data.planId),
  });
  if (!planRow) {
    return { status: "error", message: "پلن یافت نشد." };
  }
  if (planRow.key === "free") {
    return {
      status: "error",
      message: "قیمت پلن رایگان قابل تغییر نیست.",
    };
  }

  const previousMonthly = planRow.priceMonthlyToman;
  const previousAnnual = planRow.priceAnnualToman;
  const previousDiscountPercent = planRow.annualDiscountPercent;

  const noChange =
    previousMonthly === data.priceMonthlyToman &&
    previousAnnual === data.priceAnnualToman &&
    previousDiscountPercent === data.annualDiscountPercent;

  if (noChange) {
    return { status: "error", message: "هیچ تغییری اعمال نشد." };
  }

  let grandfatheredCount = 0;
  let notifiedPhones: string[] = [];

  await db.transaction(async (tx) => {
    // 1. Update the plan row itself.
    await tx
      .update(plans)
      .set({
        priceMonthlyToman: data.priceMonthlyToman,
        priceAnnualToman: data.priceAnnualToman,
        annualDiscountPercent: data.annualDiscountPercent,
        updatedAt: new Date(),
      })
      .where(eq(plans.id, data.planId));

    // 2. If grandfather: snapshot OLD prices for every active page on
    //    this plan that doesn't already have a lock. We never overwrite
    //    an existing lock — older locks win (an admin who locked someone
    //    earlier had a reason).
    if (data.policy === "grandfather") {
      const result = (await tx.execute(sql`
        INSERT INTO "subscription_price_locks"
          ("page_id", "plan_id", "billing_cycle",
           "locked_monthly_toman", "locked_annual_toman",
           "reason", "locked_by_user_id")
        SELECT
          s."page_id",
          s."plan_id",
          s."billing_cycle",
          ${previousMonthly}::int,
          ${previousAnnual}::int,
          ${`grandfathered on plan price change ${new Date().toISOString()}`}::text,
          ${viewer.user.id}::uuid
        FROM "page_subscriptions" s
        WHERE s."plan_id" = ${data.planId}::uuid
          AND s."status" IN ('active','trialing','pending_renewal','grace')
          AND NOT EXISTS (
            SELECT 1 FROM "subscription_price_locks" l
            WHERE l."page_id" = s."page_id"
          )
        RETURNING "page_id"
      `)) as unknown as Array<{ page_id: string }>;
      grandfatheredCount = result.length;
    }

    // 3. Audit + price-change-event row.
    await tx.insert(subscriptionPriceChangeEvents).values({
      planId: data.planId,
      actorUserId: viewer.user.id,
      previousMonthlyToman: previousMonthly,
      previousAnnualToman: previousAnnual,
      previousAnnualDiscountPercent: previousDiscountPercent,
      newMonthlyToman: data.priceMonthlyToman,
      newAnnualToman: data.priceAnnualToman,
      newAnnualDiscountPercent: data.annualDiscountPercent,
      policy: data.policy,
      grandfatheredCount,
      notificationSent: false,
      reason: data.reason?.trim() || null,
    });

    await recordAdminAudit(
      {
        actorUserId: viewer.user.id,
        action:
          data.policy === "grandfather"
            ? "plan_settings.price_change_with_grandfather"
            : "plan_settings.price_change_without_grandfather",
        reason: data.reason?.trim() || null,
        metadata: {
          planId: data.planId,
          planKey: planRow.key,
          previousMonthly,
          previousAnnual,
          previousAnnualDiscountPercent: previousDiscountPercent,
          newMonthly: data.priceMonthlyToman,
          newAnnual: data.priceAnnualToman,
          newAnnualDiscountPercent: data.annualDiscountPercent,
          grandfatheredCount,
        },
      },
      tx,
    );

    // 4. Optional notification — collect phones for affected subs that
    //    will see the new price (i.e. NOT grandfathered).
    if (data.notifySubscribers && data.policy === "always_current") {
      const phones = (await tx.execute(sql`
        SELECT u."phone" AS phone
        FROM "page_subscriptions" s
        JOIN "profiles" pr ON pr."id" = s."page_id"
        JOIN "users"    u  ON u."id"  = pr."user_id"
        WHERE s."plan_id" = ${data.planId}::uuid
          AND s."status" IN ('active','trialing','pending_renewal','grace')
      `)) as unknown as Array<{ phone: string }>;
      notifiedPhones = phones.map((p) => p.phone).filter(Boolean);
    }
  });

  // SMS enqueue happens OUTSIDE the TX so a transient SMS-queue write
  // failure can't roll back the price change. The price change is
  // committed; notifications are best-effort.
  if (notifiedPhones.length > 0) {
    const stamp = new Date().toISOString().slice(0, 10);
    for (const phone of notifiedPhones) {
      try {
        await enqueueSms({
          templateKey: "price_change_notice",
          phone,
          idempotencyKey: `price_change_notice:${data.planId}:${phone}:${stamp}`,
          variables: {
            plan: planRow.nameFa,
          },
        });
      } catch (err) {
        log.warn("admin.plan_pricing.sms_enqueue_failed", {
          phone,
          error: (err as Error).message,
        });
      }
    }
    // Mark notification_sent on the most recent event row for this plan.
    await db.execute(sql`
      UPDATE "subscription_price_change_events"
      SET "notification_sent" = true
      WHERE "id" = (
        SELECT "id" FROM "subscription_price_change_events"
        WHERE "plan_id" = ${data.planId}::uuid
        ORDER BY "created_at" DESC
        LIMIT 1
      )
    `);
  }

  log.info("admin.plan_pricing.update", {
    adminId: viewer.user.id,
    planId: data.planId,
    policy: data.policy,
    grandfatheredCount,
    notified: notifiedPhones.length,
  });

  revalidatePath("/admin/billing/plans-pricing");
  revalidatePath("/admin/plans");

  return {
    status: "success",
    message:
      data.policy === "grandfather"
        ? `قیمت بروزرسانی شد. ${grandfatheredCount} اشتراک قفل قیمت قدیم گرفتند.`
        : "قیمت بروزرسانی شد. همه اشتراک‌ها در تجدید بعدی قیمت جدید را خواهند پرداخت.",
  };
}
