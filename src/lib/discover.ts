/**
 * Discover (kioar.com/discover) — DB-backed taxonomy.
 *
 * Categories are managed by admins at /admin/categories. Slugs are the
 * stable identifiers persisted in `profiles.discover_category`; slug
 * renames are handled transactionally in the admin action so all
 * referencing profile rows are updated atomically.
 *
 * Cities are a free-text-with-suggestions list — `profiles.city` is a
 * plain text column, and these are just the dropdown defaults.
 */

import { asc, eq } from "drizzle-orm";

import { getDb } from "@/db";
import { discoverCategories } from "@/db/schema";

export type DiscoverCategory = {
  id: string;
  slug: string;
  label: string;
  iconKey: string;
  sortOrder: number;
  isActive: boolean;
};

/**
 * Fetch all active categories ordered by sort_order. This is the primary
 * read path: call it once in each server component that renders pickers
 * or the directory, then pass the result as a prop to client components.
 */
export async function getDiscoverCategories(): Promise<DiscoverCategory[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(discoverCategories)
    .where(eq(discoverCategories.isActive, true))
    .orderBy(asc(discoverCategories.sortOrder));
  return rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    label: r.label,
    iconKey: r.iconKey,
    sortOrder: r.sortOrder,
    isActive: r.isActive,
  }));
}

/**
 * Fetch all categories (including inactive). Used by /admin/categories.
 */
export async function getAllDiscoverCategories(): Promise<DiscoverCategory[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(discoverCategories)
    .orderBy(asc(discoverCategories.sortOrder));
  return rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    label: r.label,
    iconKey: r.iconKey,
    sortOrder: r.sortOrder,
    isActive: r.isActive,
  }));
}

/**
 * Fetch a single category by slug. Returns null when not found or inactive.
 */
export async function getDiscoverCategoryBySlug(
  slug: string | null | undefined,
): Promise<DiscoverCategory | null> {
  if (!slug) return null;
  const db = getDb();
  const [row] = await db
    .select()
    .from(discoverCategories)
    .where(eq(discoverCategories.slug, slug))
    .limit(1);
  if (!row) return null;
  return {
    id: row.id,
    slug: row.slug,
    label: row.label,
    iconKey: row.iconKey,
    sortOrder: row.sortOrder,
    isActive: row.isActive,
  };
}

export { IRANIAN_CITIES } from "@/lib/cities";
