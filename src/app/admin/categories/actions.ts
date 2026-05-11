"use server";

import { and, asc, desc, eq, gt, lt, ne, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getDb } from "@/db";
import { categories, industries, profiles } from "@/db/schema";
import { recordAdminAudit } from "@/lib/admin-audit";
import { requireAdmin } from "@/lib/auth/session";

// ---------------------------------------------------------------------------
// Shared types & helpers
// ---------------------------------------------------------------------------

export type AdminActionResult = { ok: true } | { ok: false; error: string };

const ACCOUNT_TYPES = ["personal", "business"] as const;
const accountTypeEnum = z.enum(ACCOUNT_TYPES);

const slugSchema = z
  .string()
  .trim()
  .min(2)
  .max(64)
  .regex(/^[a-z0-9][a-z0-9-]*[a-z0-9]$/, {
    message: "شناسه باید با حروف انگلیسی کوچک و خط تیره باشد.",
  });

function pickFormString(fd: FormData, key: string): string | undefined {
  const v = fd.get(key);
  return typeof v === "string" ? v : undefined;
}

function pickFormBool(fd: FormData, key: string): boolean {
  return fd.get(key) === "on";
}

function pickFormStringArray(fd: FormData, key: string): string[] {
  return fd.getAll(key).filter((v): v is string => typeof v === "string");
}

// ===========================================================================
// INDUSTRIES
// ===========================================================================

const industrySchema = z.object({
  slug: slugSchema,
  titleFa: z.string().trim().min(1).max(80),
  titleEn: z.string().trim().min(1).max(80),
  iconKey: z.string().trim().min(1).max(80).default("t:star"),
  accountTypes: z.array(accountTypeEnum).min(1, {
    message: "حداقل یک نوع حساب باید انتخاب شود.",
  }),
  isActive: z.boolean().default(true),
});

export async function adminCreateIndustryAction(
  _prevState: unknown,
  formData: FormData,
): Promise<AdminActionResult> {
  const viewer = await requireAdmin();
  const parsed = industrySchema.safeParse({
    slug: pickFormString(formData, "slug"),
    titleFa: pickFormString(formData, "titleFa"),
    titleEn: pickFormString(formData, "titleEn"),
    iconKey: pickFormString(formData, "iconKey") || "t:star",
    accountTypes: pickFormStringArray(formData, "accountTypes"),
    isActive: pickFormBool(formData, "isActive"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "خطا" };
  }
  const { slug, titleFa, titleEn, iconKey, accountTypes, isActive } =
    parsed.data;

  const db = getDb();
  const conflict = await db
    .select({ id: industries.id })
    .from(industries)
    .where(eq(industries.slug, slug))
    .limit(1);
  if (conflict.length > 0) {
    return { ok: false, error: "این شناسه قبلاً ثبت شده است." };
  }

  const [maxRow] = await db
    .select({ max: sql<number>`COALESCE(MAX(${industries.sortOrder}), -10)` })
    .from(industries);
  const sortOrder = (maxRow?.max ?? -10) + 10;

  await db.insert(industries).values({
    slug,
    titleFa,
    titleEn,
    iconKey,
    accountTypes,
    isActive,
    sortOrder,
  });
  await recordAdminAudit({
    actorUserId: viewer.user.id,
    action: "industry.create",
    metadata: { slug, titleFa, titleEn, accountTypes },
  });
  revalidatePath("/admin/categories");
  return { ok: true };
}

export async function adminUpdateIndustryAction(
  _prevState: unknown,
  formData: FormData,
): Promise<AdminActionResult> {
  const viewer = await requireAdmin();
  const id = pickFormString(formData, "id");
  if (!id) return { ok: false, error: "شناسه نامعتبر" };

  const parsed = industrySchema.safeParse({
    slug: pickFormString(formData, "slug"),
    titleFa: pickFormString(formData, "titleFa"),
    titleEn: pickFormString(formData, "titleEn"),
    iconKey: pickFormString(formData, "iconKey") || "t:star",
    accountTypes: pickFormStringArray(formData, "accountTypes"),
    isActive: pickFormBool(formData, "isActive"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "خطا" };
  }
  const { slug, titleFa, titleEn, iconKey, accountTypes, isActive } =
    parsed.data;

  const db = getDb();
  const [current] = await db
    .select()
    .from(industries)
    .where(eq(industries.id, id))
    .limit(1);
  if (!current) return { ok: false, error: "صنف یافت نشد." };

  if (current.slug !== slug) {
    const conflict = await db
      .select({ id: industries.id })
      .from(industries)
      .where(and(eq(industries.slug, slug), ne(industries.id, id)))
      .limit(1);
    if (conflict.length > 0) {
      return { ok: false, error: "این شناسه قبلاً ثبت شده است." };
    }
  }

  await db
    .update(industries)
    .set({
      slug,
      titleFa,
      titleEn,
      iconKey,
      accountTypes,
      isActive,
      updatedAt: new Date(),
    })
    .where(eq(industries.id, id));

  await recordAdminAudit({
    actorUserId: viewer.user.id,
    action: "industry.update",
    metadata: { id, oldSlug: current.slug, newSlug: slug, titleFa },
  });
  revalidatePath("/admin/categories");
  revalidatePath(`/admin/categories/${slug}`);
  if (current.slug !== slug) {
    revalidatePath(`/admin/categories/${current.slug}`);
  }
  return { ok: true };
}

export async function adminDeleteIndustryAction(
  formData: FormData,
): Promise<AdminActionResult> {
  const viewer = await requireAdmin();
  const id = pickFormString(formData, "id");
  if (!id) return { ok: false, error: "شناسه نامعتبر" };

  const db = getDb();
  const [row] = await db
    .select()
    .from(industries)
    .where(eq(industries.id, id))
    .limit(1);
  if (!row) return { ok: false, error: "صنف یافت نشد." };

  // Soft-delete: deactivate industry and all its categories.
  await db.transaction(async (tx) => {
    await tx
      .update(industries)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(industries.id, id));
    await tx
      .update(categories)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(categories.industryId, id));
  });

  await recordAdminAudit({
    actorUserId: viewer.user.id,
    action: "industry.deactivate",
    metadata: { id, slug: row.slug, titleFa: row.titleFa },
  });
  revalidatePath("/admin/categories");
  return { ok: true };
}

export async function adminMoveIndustryAction(
  formData: FormData,
): Promise<AdminActionResult> {
  await requireAdmin();
  const id = pickFormString(formData, "id");
  const direction = pickFormString(formData, "direction");
  if (!id || (direction !== "up" && direction !== "down")) {
    return { ok: false, error: "ورودی نامعتبر" };
  }

  const db = getDb();
  const [current] = await db
    .select()
    .from(industries)
    .where(eq(industries.id, id))
    .limit(1);
  if (!current) return { ok: false, error: "صنف یافت نشد." };

  const [adjacent] = await db
    .select()
    .from(industries)
    .where(
      direction === "up"
        ? lt(industries.sortOrder, current.sortOrder)
        : gt(industries.sortOrder, current.sortOrder),
    )
    .orderBy(
      direction === "up"
        ? desc(industries.sortOrder)
        : asc(industries.sortOrder),
    )
    .limit(1);

  if (!adjacent) return { ok: true };

  await db.transaction(async (tx) => {
    await tx
      .update(industries)
      .set({ sortOrder: adjacent.sortOrder, updatedAt: new Date() })
      .where(eq(industries.id, current.id));
    await tx
      .update(industries)
      .set({ sortOrder: current.sortOrder, updatedAt: new Date() })
      .where(eq(industries.id, adjacent.id));
  });

  revalidatePath("/admin/categories");
  return { ok: true };
}

// ===========================================================================
// CATEGORIES
// ===========================================================================

const categorySchema = z.object({
  industryId: z.string().uuid(),
  slug: slugSchema,
  titleFa: z.string().trim().min(1).max(80),
  titleEn: z.string().trim().min(1).max(80),
  iconKey: z.string().trim().min(1).max(80).default("t:star"),
  accountType: accountTypeEnum,
  isActive: z.boolean().default(true),
});

export async function adminCreateCategoryAction(
  _prevState: unknown,
  formData: FormData,
): Promise<AdminActionResult> {
  const viewer = await requireAdmin();
  const parsed = categorySchema.safeParse({
    industryId: pickFormString(formData, "industryId"),
    slug: pickFormString(formData, "slug"),
    titleFa: pickFormString(formData, "titleFa"),
    titleEn: pickFormString(formData, "titleEn"),
    iconKey: pickFormString(formData, "iconKey") || "t:star",
    accountType: pickFormString(formData, "accountType"),
    isActive: pickFormBool(formData, "isActive"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "خطا" };
  }
  const data = parsed.data;

  const db = getDb();
  const [industry] = await db
    .select()
    .from(industries)
    .where(eq(industries.id, data.industryId))
    .limit(1);
  if (!industry) return { ok: false, error: "صنف نامعتبر." };

  const conflict = await db
    .select({ id: categories.id })
    .from(categories)
    .where(eq(categories.slug, data.slug))
    .limit(1);
  if (conflict.length > 0) {
    return { ok: false, error: "این شناسه قبلاً ثبت شده است." };
  }

  const [maxRow] = await db
    .select({ max: sql<number>`COALESCE(MAX(${categories.sortOrder}), -10)` })
    .from(categories)
    .where(eq(categories.industryId, data.industryId));
  const sortOrder = (maxRow?.max ?? -10) + 10;

  await db.insert(categories).values({
    industryId: data.industryId,
    slug: data.slug,
    titleFa: data.titleFa,
    titleEn: data.titleEn,
    iconKey: data.iconKey,
    accountType: data.accountType,
    isActive: data.isActive,
    sortOrder,
  });

  await recordAdminAudit({
    actorUserId: viewer.user.id,
    action: "category.create",
    metadata: {
      industrySlug: industry.slug,
      slug: data.slug,
      titleFa: data.titleFa,
      accountType: data.accountType,
    },
  });
  revalidatePath("/admin/categories");
  revalidatePath(`/admin/categories/${industry.slug}`);
  return { ok: true };
}

export async function adminUpdateCategoryAction(
  _prevState: unknown,
  formData: FormData,
): Promise<AdminActionResult> {
  const viewer = await requireAdmin();
  const id = pickFormString(formData, "id");
  if (!id) return { ok: false, error: "شناسه نامعتبر" };

  const parsed = categorySchema.safeParse({
    industryId: pickFormString(formData, "industryId"),
    slug: pickFormString(formData, "slug"),
    titleFa: pickFormString(formData, "titleFa"),
    titleEn: pickFormString(formData, "titleEn"),
    iconKey: pickFormString(formData, "iconKey") || "t:star",
    accountType: pickFormString(formData, "accountType"),
    isActive: pickFormBool(formData, "isActive"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "خطا" };
  }
  const data = parsed.data;

  const db = getDb();
  const [current] = await db
    .select()
    .from(categories)
    .where(eq(categories.id, id))
    .limit(1);
  if (!current) return { ok: false, error: "دسته‌بندی یافت نشد." };

  const [industry] = await db
    .select()
    .from(industries)
    .where(eq(industries.id, data.industryId))
    .limit(1);
  if (!industry) return { ok: false, error: "صنف نامعتبر." };

  const slugChanged = current.slug !== data.slug;
  if (slugChanged) {
    const conflict = await db
      .select({ id: categories.id })
      .from(categories)
      .where(and(eq(categories.slug, data.slug), ne(categories.id, id)))
      .limit(1);
    if (conflict.length > 0) {
      return { ok: false, error: "این شناسه قبلاً ثبت شده است." };
    }
  }

  // If moving to a different industry, place it at the bottom of the target list.
  let nextSortOrder = current.sortOrder;
  if (current.industryId !== data.industryId) {
    const [maxRow] = await db
      .select({
        max: sql<number>`COALESCE(MAX(${categories.sortOrder}), -10)`,
      })
      .from(categories)
      .where(eq(categories.industryId, data.industryId));
    nextSortOrder = (maxRow?.max ?? -10) + 10;
  }

  await db.transaction(async (tx) => {
    await tx
      .update(categories)
      .set({
        industryId: data.industryId,
        slug: data.slug,
        titleFa: data.titleFa,
        titleEn: data.titleEn,
        iconKey: data.iconKey,
        accountType: data.accountType,
        isActive: data.isActive,
        sortOrder: nextSortOrder,
        updatedAt: new Date(),
      })
      .where(eq(categories.id, id));
    if (slugChanged) {
      await tx
        .update(profiles)
        .set({ discoverCategory: data.slug })
        .where(eq(profiles.discoverCategory, current.slug));
    }
  });

  await recordAdminAudit({
    actorUserId: viewer.user.id,
    action: "category.update",
    metadata: {
      id,
      industrySlug: industry.slug,
      oldSlug: current.slug,
      newSlug: data.slug,
      slugChanged,
    },
  });
  revalidatePath("/admin/categories");
  revalidatePath(`/admin/categories/${industry.slug}`);
  return { ok: true };
}

export async function adminDeleteCategoryAction(
  formData: FormData,
): Promise<AdminActionResult> {
  const viewer = await requireAdmin();
  const id = pickFormString(formData, "id");
  if (!id) return { ok: false, error: "شناسه نامعتبر" };

  const db = getDb();
  const [row] = await db
    .select()
    .from(categories)
    .where(eq(categories.id, id))
    .limit(1);
  if (!row) return { ok: false, error: "دسته‌بندی یافت نشد." };

  await db
    .update(categories)
    .set({ isActive: false, updatedAt: new Date() })
    .where(eq(categories.id, id));

  await recordAdminAudit({
    actorUserId: viewer.user.id,
    action: "category.deactivate",
    metadata: { id, slug: row.slug, titleFa: row.titleFa },
  });
  revalidatePath("/admin/categories");
  return { ok: true };
}

export async function adminMoveCategoryAction(
  formData: FormData,
): Promise<AdminActionResult> {
  await requireAdmin();
  const id = pickFormString(formData, "id");
  const direction = pickFormString(formData, "direction");
  if (!id || (direction !== "up" && direction !== "down")) {
    return { ok: false, error: "ورودی نامعتبر" };
  }

  const db = getDb();
  const [current] = await db
    .select()
    .from(categories)
    .where(eq(categories.id, id))
    .limit(1);
  if (!current) return { ok: false, error: "دسته‌بندی یافت نشد." };

  const [adjacent] = await db
    .select()
    .from(categories)
    .where(
      and(
        eq(categories.industryId, current.industryId),
        direction === "up"
          ? lt(categories.sortOrder, current.sortOrder)
          : gt(categories.sortOrder, current.sortOrder),
      ),
    )
    .orderBy(
      direction === "up"
        ? desc(categories.sortOrder)
        : asc(categories.sortOrder),
    )
    .limit(1);
  if (!adjacent) return { ok: true };

  await db.transaction(async (tx) => {
    await tx
      .update(categories)
      .set({ sortOrder: adjacent.sortOrder, updatedAt: new Date() })
      .where(eq(categories.id, current.id));
    await tx
      .update(categories)
      .set({ sortOrder: current.sortOrder, updatedAt: new Date() })
      .where(eq(categories.id, adjacent.id));
  });

  revalidatePath("/admin/categories");
  return { ok: true };
}
