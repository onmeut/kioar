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
          action: limitValue === null ? "plan_feature.toggle" : "plan_feature.update_limit",
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
});

export async function adminRebuildPlanEntitlementsAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const admin = await requireAdmin();
  const parsed = rebuildSchema.safeParse({ planId: formData.get("planId") });
  if (!parsed.success) {
    return { status: "error", message: "شناسه پلن نامعتبر است." };
  }
  const db = getDb();
  let rebuilt = 0;
  await db.transaction(async (tx) => {
    const rows = (await tx.execute(sql`
      SELECT "page_id" FROM "page_subscriptions"
      WHERE "plan_id" = ${parsed.data.planId}::uuid
    `)) as unknown as { page_id: string }[];
    for (const r of rows) {
      await rebuildEntitlements(tx, r.page_id);
    }
    rebuilt = rows.length;
    await recordAdminAudit(
      {
        action: "plan_feature.rebuild_all_pages",
        actorUserId: admin.user.id,
        metadata: { planId: parsed.data.planId, pageCount: rebuilt },
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
