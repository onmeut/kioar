/**
 * Discover (kioar.com/discover) — two-level taxonomy (industries → categories).
 *
 * `profiles.discover_category` continues to store a category slug. The slug
 * is the stable identifier; renames are handled transactionally in the admin
 * action so all referencing profile rows are updated atomically.
 *
 * The legacy `DiscoverCategory` shape ({ id, slug, label, iconKey, sortOrder,
 * isActive }) is preserved as a flat view onto the new tables so the
 * onboarding picker and page-settings dropdown keep working unchanged. The
 * `label` field is sourced from `categories.title_fa`.
 *
 * Industry-aware helpers (`getIndustries`, `getCategoriesByAccountType`, …)
 * power the new admin UI and the upcoming onboarding revamp.
 */

import { and, asc, eq, gt, inArray, sql } from "drizzle-orm";

import { getDb } from "@/db";
import { categories, industries, profiles } from "@/db/schema";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type AccountType = "personal" | "business";

export type Industry = {
  id: string;
  slug: string;
  titleFa: string;
  titleEn: string;
  iconKey: string;
  accountTypes: AccountType[];
  sortOrder: number;
  isActive: boolean;
  categoryCount?: number;
};

export type Category = {
  id: string;
  industryId: string;
  industrySlug: string;
  slug: string;
  titleFa: string;
  titleEn: string;
  iconKey: string;
  accountType: AccountType;
  sortOrder: number;
  isActive: boolean;
};

/**
 * Legacy flat shape used by onboarding-form and page-settings-sheet. `label`
 * maps to `title_fa` from the new schema; `sortOrder` is the per-industry
 * order plus an offset derived from the parent industry's `sort_order` so
 * the overall ordering is stable.
 */
export type DiscoverCategory = {
  id: string;
  slug: string;
  label: string;
  iconKey: string;
  sortOrder: number;
  isActive: boolean;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toAccountTypes(arr: string[]): AccountType[] {
  return arr.filter(
    (a): a is AccountType => a === "personal" || a === "business",
  );
}

function toAccountType(s: string): AccountType {
  return s === "business" ? "business" : "personal";
}

// ---------------------------------------------------------------------------
// New API — industries
// ---------------------------------------------------------------------------

export async function getIndustries(opts?: {
  includeInactive?: boolean;
}): Promise<Industry[]> {
  const db = getDb();
  const rows = opts?.includeInactive
    ? await db.select().from(industries).orderBy(asc(industries.sortOrder))
    : await db
        .select()
        .from(industries)
        .where(eq(industries.isActive, true))
        .orderBy(asc(industries.sortOrder));
  return rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    titleFa: r.titleFa,
    titleEn: r.titleEn,
    iconKey: r.iconKey,
    accountTypes: toAccountTypes(r.accountTypes),
    sortOrder: r.sortOrder,
    isActive: r.isActive,
  }));
}

/** Industries with a `categoryCount` joined in. Used by the admin list. */
export async function getIndustriesWithCounts(): Promise<Industry[]> {
  const db = getDb();
  const rows = await db
    .select({
      id: industries.id,
      slug: industries.slug,
      titleFa: industries.titleFa,
      titleEn: industries.titleEn,
      iconKey: industries.iconKey,
      accountTypes: industries.accountTypes,
      sortOrder: industries.sortOrder,
      isActive: industries.isActive,
      categoryCount: sql<number>`(
        SELECT COUNT(*) FROM ${categories}
        WHERE ${categories.industryId} = ${industries.id}
          AND ${categories.isActive} = true
      )`.mapWith(Number),
    })
    .from(industries)
    .orderBy(asc(industries.sortOrder));
  return rows.map((r) => ({
    ...r,
    accountTypes: toAccountTypes(r.accountTypes),
  }));
}

export async function getIndustryBySlug(
  slug: string,
): Promise<Industry | null> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(industries)
    .where(eq(industries.slug, slug))
    .limit(1);
  if (!row) return null;
  return {
    id: row.id,
    slug: row.slug,
    titleFa: row.titleFa,
    titleEn: row.titleEn,
    iconKey: row.iconKey,
    accountTypes: toAccountTypes(row.accountTypes),
    sortOrder: row.sortOrder,
    isActive: row.isActive,
  };
}

// ---------------------------------------------------------------------------
// New API — categories
// ---------------------------------------------------------------------------

function rowToCategory(
  r: typeof categories.$inferSelect,
  industrySlug: string,
): Category {
  return {
    id: r.id,
    industryId: r.industryId,
    industrySlug,
    slug: r.slug,
    titleFa: r.titleFa,
    titleEn: r.titleEn,
    iconKey: r.iconKey,
    accountType: toAccountType(r.accountType),
    sortOrder: r.sortOrder,
    isActive: r.isActive,
  };
}

export async function getCategoriesByIndustryId(
  industryId: string,
  opts?: { includeInactive?: boolean },
): Promise<Category[]> {
  const db = getDb();
  const where = opts?.includeInactive
    ? eq(categories.industryId, industryId)
    : and(eq(categories.industryId, industryId), eq(categories.isActive, true));
  const rows = await db
    .select({ cat: categories, industrySlug: industries.slug })
    .from(categories)
    .innerJoin(industries, eq(categories.industryId, industries.id))
    .where(where)
    .orderBy(asc(categories.sortOrder));
  return rows.map((r) => rowToCategory(r.cat, r.industrySlug));
}

/** Active categories filtered by the user's account type. */
export async function getCategoriesByAccountType(
  accountType: AccountType,
): Promise<Category[]> {
  const db = getDb();
  const rows = await db
    .select({ cat: categories, industrySlug: industries.slug })
    .from(categories)
    .innerJoin(industries, eq(categories.industryId, industries.id))
    .where(
      and(
        eq(categories.accountType, accountType),
        eq(categories.isActive, true),
        eq(industries.isActive, true),
      ),
    )
    .orderBy(asc(industries.sortOrder), asc(categories.sortOrder));
  return rows.map((r) => rowToCategory(r.cat, r.industrySlug));
}

/** Active categories across all industries — used when the consumer needs
 * to filter client-side (e.g. onboarding form decides accountType mid-flow). */
export async function getAllActiveCategories(): Promise<Category[]> {
  const db = getDb();
  const rows = await db
    .select({ cat: categories, industrySlug: industries.slug })
    .from(categories)
    .innerJoin(industries, eq(categories.industryId, industries.id))
    .where(and(eq(categories.isActive, true), eq(industries.isActive, true)))
    .orderBy(asc(industries.sortOrder), asc(categories.sortOrder));
  return rows.map((r) => rowToCategory(r.cat, r.industrySlug));
}

export async function getCategoryBySlug(
  slug: string | null | undefined,
): Promise<Category | null> {
  if (!slug) return null;
  const db = getDb();
  const [row] = await db
    .select({ cat: categories, industrySlug: industries.slug })
    .from(categories)
    .innerJoin(industries, eq(categories.industryId, industries.id))
    .where(eq(categories.slug, slug))
    .limit(1);
  if (!row) return null;
  return rowToCategory(row.cat, row.industrySlug);
}

// ---------------------------------------------------------------------------
// Legacy compatibility — flat DiscoverCategory[] for callers we haven't
// migrated yet (onboarding-form, page-settings-sheet, profile pages).
// ---------------------------------------------------------------------------

function toDiscoverCategory(
  c: typeof categories.$inferSelect,
  globalIndex: number,
): DiscoverCategory {
  return {
    id: c.id,
    slug: c.slug,
    label: c.titleFa,
    iconKey: c.iconKey,
    sortOrder: globalIndex,
    isActive: c.isActive,
  };
}

export async function getDiscoverCategories(): Promise<DiscoverCategory[]> {
  const db = getDb();
  const rows = await db
    .select({ cat: categories })
    .from(categories)
    .innerJoin(industries, eq(categories.industryId, industries.id))
    .where(and(eq(categories.isActive, true), eq(industries.isActive, true)))
    .orderBy(asc(industries.sortOrder), asc(categories.sortOrder));
  return rows.map((r, idx) => toDiscoverCategory(r.cat, idx));
}

export async function getAllDiscoverCategories(): Promise<DiscoverCategory[]> {
  const db = getDb();
  const rows = await db
    .select({ cat: categories })
    .from(categories)
    .innerJoin(industries, eq(categories.industryId, industries.id))
    .orderBy(asc(industries.sortOrder), asc(categories.sortOrder));
  return rows.map((r, idx) => toDiscoverCategory(r.cat, idx));
}

export async function getDiscoverCategoryBySlug(
  slug: string | null | undefined,
): Promise<DiscoverCategory | null> {
  const cat = await getCategoryBySlug(slug);
  if (!cat) return null;
  return {
    id: cat.id,
    slug: cat.slug,
    label: cat.titleFa,
    iconKey: cat.iconKey,
    sortOrder: cat.sortOrder,
    isActive: cat.isActive,
  };
}

/**
 * Returns active categories that have at least one discover-listed profile.
 *
 * A profile counts when: `discover_enabled = true AND is_complete = true
 * AND is_published = true`.
 *
 * @param accountType  When provided, also filters by `profiles.page_type`.
 *                     Pass `null` for the "All" tab.
 */
export async function getPopulatedDiscoverCategories(
  accountType: AccountType | null,
): Promise<DiscoverCategory[]> {
  const db = getDb();

  // Aggregate: category slug → count of eligible profiles.
  const profileFilters = and(
    eq(profiles.discoverEnabled, true),
    eq(profiles.isComplete, true),
    eq(profiles.isPublished, true),
    accountType ? eq(profiles.pageType, accountType) : undefined,
  );

  const counts = await db
    .select({
      slug: profiles.discoverCategory,
      count: sql<number>`count(*)::int`.as("profile_count"),
    })
    .from(profiles)
    .where(profileFilters)
    .groupBy(profiles.discoverCategory)
    .having(gt(sql<number>`count(*)`, 0));

  const populatedSlugs = new Set(
    counts.map((r) => r.slug).filter((s): s is string => s !== null),
  );

  if (populatedSlugs.size === 0) return [];

  const rows = await db
    .select({ cat: categories })
    .from(categories)
    .innerJoin(industries, eq(categories.industryId, industries.id))
    .where(
      and(
        eq(categories.isActive, true),
        eq(industries.isActive, true),
        inArray(categories.slug, [...populatedSlugs]),
      ),
    )
    .orderBy(asc(industries.sortOrder), asc(categories.sortOrder));

  return rows.map((r, idx) => toDiscoverCategory(r.cat, idx));
}

export { IRANIAN_CITIES } from "@/lib/cities";
