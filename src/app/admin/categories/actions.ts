"use server";

import { and, asc, eq, gt, lt, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getDb } from "@/db";
import { discoverCategories, profiles } from "@/db/schema";
import { recordAdminAudit } from "@/lib/admin-audit";
import { requireAdmin } from "@/lib/auth/session";
import { normalizeSlug } from "@/lib/slug";

const categorySchema = z.object({
  slug: z
    .string()
    .trim()
    .min(2)
    .max(64)
    .transform((v) => v.toLowerCase().replace(/\s+/g, "_")),
  label: z.string().trim().min(1).max(60),
  iconKey: z.string().trim().min(1).max(80).default("t:star"),
  isActive: z
    .union([z.literal("on"), z.literal("off"), z.boolean()])
    .default(true)
    .transform((v) => (typeof v === "boolean" ? v : v === "on")),
});

export type AdminCategoryActionResult =
  | { ok: true }
  | { ok: false; error: string };

export async function adminCreateCategoryAction(
  _prevState: unknown,
  formData: FormData,
): Promise<AdminCategoryActionResult> {
  const viewer = await requireAdmin();
  const parsed = categorySchema.safeParse({
    slug: formData.get("slug"),
    label: formData.get("label"),
    iconKey: formData.get("iconKey") || "t:star",
    isActive: formData.get("isActive") === "on",
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "خطا" };
  }
  const { slug, label, iconKey, isActive } = parsed.data;

  const db = getDb();
  const existing = await db
    .select({ id: discoverCategories.id })
    .from(discoverCategories)
    .where(eq(discoverCategories.slug, slug))
    .limit(1);
  if (existing.length > 0) {
    return { ok: false, error: "این شناسه قبلاً ثبت شده است." };
  }

  // Append at the end by finding the max sort_order
  const [maxRow] = await db
    .select({ max: sql<number>`COALESCE(MAX(${discoverCategories.sortOrder}), -1)` })
    .from(discoverCategories);
  const sortOrder = (maxRow?.max ?? -1) + 1;

  await db.insert(discoverCategories).values({ slug, label, iconKey, isActive, sortOrder });
  await recordAdminAudit({
    actorUserId: viewer.user.id,
    action: "discover_category.create",
    metadata: { slug, label, iconKey },
  });
  revalidatePath("/admin/categories");
  return { ok: true };
}

export async function adminUpdateCategoryAction(
  _prevState: unknown,
  formData: FormData,
): Promise<AdminCategoryActionResult> {
  const viewer = await requireAdmin();
  const id = formData.get("id") as string;
  if (!id) return { ok: false, error: "شناسه نامعتبر" };

  const parsed = categorySchema.safeParse({
    slug: formData.get("slug"),
    label: formData.get("label"),
    iconKey: formData.get("iconKey") || "t:star",
    isActive: formData.get("isActive") === "on",
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "خطا" };
  }
  const { slug, label, iconKey, isActive } = parsed.data;

  const db = getDb();

  // Load current row to detect slug change
  const [current] = await db
    .select()
    .from(discoverCategories)
    .where(eq(discoverCategories.id, id))
    .limit(1);
  if (!current) return { ok: false, error: "دسته‌بندی یافت نشد." };

  const slugChanged = current.slug !== slug;
  if (slugChanged) {
    // Check uniqueness of new slug
    const conflict = await db
      .select({ id: discoverCategories.id })
      .from(discoverCategories)
      .where(and(eq(discoverCategories.slug, slug), sql`${discoverCategories.id} <> ${id}`))
      .limit(1);
    if (conflict.length > 0) {
      return { ok: false, error: "این شناسه قبلاً ثبت شده است." };
    }

    // Atomically update category + all referencing profile rows
    await db.transaction(async (tx) => {
      await tx
        .update(discoverCategories)
        .set({ slug, label, iconKey, isActive, updatedAt: new Date() })
        .where(eq(discoverCategories.id, id));
      await tx
        .update(profiles)
        .set({ discoverCategory: slug })
        .where(eq(profiles.discoverCategory, current.slug));
    });
  } else {
    await db
      .update(discoverCategories)
      .set({ label, iconKey, isActive, updatedAt: new Date() })
      .where(eq(discoverCategories.id, id));
  }

  await recordAdminAudit({
    actorUserId: viewer.user.id,
    action: "discover_category.update",
    metadata: {
      id,
      oldSlug: current.slug,
      newSlug: slug,
      label,
      iconKey,
      slugChanged,
    },
  });
  revalidatePath("/admin/categories");
  return { ok: true };
}

export async function adminDeleteCategoryAction(
  formData: FormData,
): Promise<AdminCategoryActionResult> {
  const viewer = await requireAdmin();
  const id = formData.get("id") as string;
  if (!id) return { ok: false, error: "شناسه نامعتبر" };

  const db = getDb();
  const [row] = await db
    .select()
    .from(discoverCategories)
    .where(eq(discoverCategories.id, id))
    .limit(1);
  if (!row) return { ok: false, error: "دسته‌بندی یافت نشد." };

  // Soft-delete by deactivating (preserve slug history on profiles)
  await db
    .update(discoverCategories)
    .set({ isActive: false, updatedAt: new Date() })
    .where(eq(discoverCategories.id, id));

  await recordAdminAudit({
    actorUserId: viewer.user.id,
    action: "discover_category.deactivate",
    metadata: { id, slug: row.slug, label: row.label },
  });
  revalidatePath("/admin/categories");
  return { ok: true };
}

export async function adminMoveCategoryAction(
  formData: FormData,
): Promise<AdminCategoryActionResult> {
  const viewer = await requireAdmin();
  const id = formData.get("id") as string;
  const direction = formData.get("direction") as "up" | "down";
  if (!id || (direction !== "up" && direction !== "down")) {
    return { ok: false, error: "ورودی نامعتبر" };
  }

  const db = getDb();
  const [current] = await db
    .select()
    .from(discoverCategories)
    .where(eq(discoverCategories.id, id))
    .limit(1);
  if (!current) return { ok: false, error: "دسته‌بندی یافت نشد." };

  // Find the adjacent row
  const [adjacent] = await db
    .select()
    .from(discoverCategories)
    .where(
      direction === "up"
        ? lt(discoverCategories.sortOrder, current.sortOrder)
        : gt(discoverCategories.sortOrder, current.sortOrder),
    )
    .orderBy(
      direction === "up"
        ? sql`${discoverCategories.sortOrder} DESC`
        : asc(discoverCategories.sortOrder),
    )
    .limit(1);

  if (!adjacent) return { ok: true }; // already at boundary — no-op

  // Swap sort_orders
  await db.transaction(async (tx) => {
    await tx
      .update(discoverCategories)
      .set({ sortOrder: adjacent.sortOrder, updatedAt: new Date() })
      .where(eq(discoverCategories.id, current.id));
    await tx
      .update(discoverCategories)
      .set({ sortOrder: current.sortOrder, updatedAt: new Date() })
      .where(eq(discoverCategories.id, adjacent.id));
  });

  revalidatePath("/admin/categories");
  return { ok: true };
}
