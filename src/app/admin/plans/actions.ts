"use server";

import { revalidatePath } from "next/cache";
import { sql } from "drizzle-orm";
import { z } from "zod";

import { getDb } from "@/db";
import { recordAdminAudit } from "@/lib/admin-audit";
import { type ActionState } from "@/lib/action-state";
import { requireAdmin } from "@/lib/auth/session";
import { rebuildEntitlements } from "@/lib/entitlements";

const togglePlanFeatureSchema = z.object({
  planId: z.string().uuid(),
  featureId: z.string().uuid(),
  enabled: z.enum(["true", "false"]),
  limitValue: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v && v.length > 0 ? Number(v) : null)),
});

export async function adminTogglePlanFeatureAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const admin = await requireAdmin();
  const parsed = togglePlanFeatureSchema.safeParse({
    planId: formData.get("planId"),
    featureId: formData.get("featureId"),
    enabled: formData.get("enabled"),
    limitValue: formData.get("limitValue"),
  });
  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "ورودی نامعتبر است.",
    };
  }
  const { planId, featureId, enabled, limitValue } = parsed.data;
  if (limitValue !== null && (Number.isNaN(limitValue) || limitValue < 0)) {
    return { status: "error", message: "مقدار سقف نامعتبر است." };
  }

  const db = getDb();
  await db.transaction(async (tx) => {
    if (enabled === "true") {
      await tx.execute(sql`
        INSERT INTO "plan_features" ("plan_id", "feature_id", "limit_value")
        VALUES (${planId}::uuid, ${featureId}::uuid, ${limitValue})
        ON CONFLICT ("plan_id", "feature_id")
        DO UPDATE SET "limit_value" = EXCLUDED."limit_value"
      `);
      await recordAdminAudit(
        {
          action:
            limitValue === null
              ? "plan_feature.toggle"
              : "plan_feature.update_limit",
          actorUserId: admin.user.id,
          metadata: { planId, featureId, enabled: true, limitValue },
        },
        tx,
      );
    } else {
      await tx.execute(sql`
        DELETE FROM "plan_features"
        WHERE "plan_id" = ${planId}::uuid AND "feature_id" = ${featureId}::uuid
      `);
      await recordAdminAudit(
        {
          action: "plan_feature.toggle",
          actorUserId: admin.user.id,
          metadata: { planId, featureId, enabled: false },
        },
        tx,
      );
    }
  });

  revalidatePath("/admin/plans");
  return {
    status: "success",
    message:
      "تغییر ذخیره شد. برای اعمال روی صفحه‌های موجود، دکمه «بازسازی برای همه صفحات این پلن» را بزنید.",
  };
}

const rebuildSchema = z.object({
  planId: z.string().uuid(),
  /**
   * Scope of the rebuild:
   *   - `all_now`     → rebuild every page currently on this plan now.
   *                     Existing subscribers immediately see the new
   *                     matrix (added features unlock, removed features
   *                     lock). Admin-grant + promo entitlements are
   *                     preserved by `rebuildEntitlements`.
   *   - `future_only` → no-op against existing pages. The `plan_features`
   *                     matrix was already saved by the toggle action,
   *                     so any *new* subscription, plan change, trial
   *                     start, or renewal will pick it up automatically
   *                     (every billing transition calls
   *                     `rebuildEntitlements`). Existing subscribers keep
   *                     their current entitlements until their next
   *                     billing event.
   */
  scope: z.enum(["all_now", "future_only"]).default("all_now"),
});

export async function adminRebuildPlanEntitlementsAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const admin = await requireAdmin();
  const parsed = rebuildSchema.safeParse({
    planId: formData.get("planId"),
    scope: formData.get("scope") ?? "all_now",
  });
  if (!parsed.success) {
    return { status: "error", message: "شناسه پلن نامعتبر است." };
  }
  const { planId, scope } = parsed.data;
  const db = getDb();

  if (scope === "future_only") {
    // Count affected (informational) but do not rebuild. The matrix
    // change is already persisted; new/renewing subscribers will pick
    // it up on their next billing transition (`rebuildEntitlements` is
    // called from checkout, change-plan, trial start/expiry, and the
    // billing-state transitions in `lib/billing-state.ts`).
    let pageCount = 0;
    await db.transaction(async (tx) => {
      const rows = (await tx.execute(sql`
        SELECT COUNT(*)::int AS c FROM "page_subscriptions"
        WHERE "plan_id" = ${planId}::uuid
      `)) as unknown as { c: number }[];
      pageCount = rows[0]?.c ?? 0;
      await recordAdminAudit(
        {
          action: "plan_feature.rebuild_future_only",
          actorUserId: admin.user.id,
          metadata: { planId, scope: "future_only", pageCount },
        },
        tx,
      );
    });
    revalidatePath("/admin/plans");
    return {
      status: "success",
      message:
        "ماتریس برای اشتراک‌های جدید و تمدیدها از این لحظه اعمال می‌شود. اشتراک‌های فعلی تا پایان دوره کنونی بدون تغییر می‌مانند.",
    };
  }

  let rebuilt = 0;
  await db.transaction(async (tx) => {
    const rows = (await tx.execute(sql`
      SELECT "page_id" FROM "page_subscriptions"
      WHERE "plan_id" = ${planId}::uuid
    `)) as unknown as { page_id: string }[];
    for (const r of rows) {
      await rebuildEntitlements(tx, r.page_id);
    }
    rebuilt = rows.length;
    await recordAdminAudit(
      {
        action: "plan_feature.rebuild_all_pages",
        actorUserId: admin.user.id,
        metadata: { planId, scope: "all_now", pageCount: rebuilt },
      },
      tx,
    );
  });
  revalidatePath("/admin/plans");
  return {
    status: "success",
    message: `قابلیت‌های ${rebuilt.toLocaleString("fa-IR")} صفحه بازسازی شد.`,
  };
}
