// Service layer for product blocks (universal "محصولات و خدمات").
//
// Mirrors form-service.ts patterns:
//  - profile-scoped, transactional CRUD
//  - authorization is the caller's responsibility (server actions enforce it)
//  - update is a diff-by-id replace so existing rows keep stable ids
//
// "Product" is intentionally generic: it covers menu items, e-commerce
// products linking out, services, packages and portfolio listings. The
// `preset` column is a UI hint at create time — the data layer never
// branches on it.

import { and, asc, eq, inArray, sql } from "drizzle-orm";

import { getDb } from "@/db";
import {
  productItems,
  productSections,
  profileBookingBlocks,
  profileProductBlocks,
} from "@/db/schema";
import { invalidateProfileCacheById } from "@/lib/cache/profile-cache";
import { validateBlockSlug } from "@/lib/blocks/slug";
import { resolveCurrentPageForOwner } from "@/lib/pages";
import {
  PRODUCT_ITEMS_HARD_CAP,
  type ProductBlockInput,
  productBlockInputSchema,
} from "@/lib/validations";

export type ProductBlockRow = typeof profileProductBlocks.$inferSelect;
export type ProductSectionRow = typeof productSections.$inferSelect;
export type ProductItemRow = typeof productItems.$inferSelect;

export type FullProductBlock = ProductBlockRow & {
  sections: ProductSectionRow[];
  items: ProductItemRow[];
};

/** UI-only preset → default copy. Never read by the data layer. */
export type ProductPresetDefaults = {
  name: string;
  itemLabel: string;
  pillLabel: string;
  description?: string;
};

export const PRODUCT_PRESETS: Record<string, ProductPresetDefaults> = {
  menu: {
    name: "منو",
    itemLabel: "غذا",
    pillLabel: "مشاهده منو",
    description: "غذاها و نوشیدنی‌های ما",
  },
  shop: {
    name: "محصولات",
    itemLabel: "محصول",
    pillLabel: "مشاهده محصولات",
  },
  services: {
    name: "خدمات",
    itemLabel: "سرویس",
    pillLabel: "مشاهده خدمات",
  },
  packages: {
    name: "پکیج‌ها",
    itemLabel: "پکیج",
    pillLabel: "مشاهده پکیج‌ها",
  },
  portfolio: {
    name: "نمونه‌کارها",
    itemLabel: "نمونه‌کار",
    pillLabel: "مشاهده نمونه‌کارها",
  },
  custom: {
    name: "محصولات",
    itemLabel: "مورد",
    pillLabel: "مشاهده",
  },
};

async function getProfileIdForUser(userId: string): Promise<string | null> {
  const page = await resolveCurrentPageForOwner(userId);
  return page?.id ?? null;
}

/**
 * Resolve a requested block slug to a unique, valid stored value for a profile.
 *
 * - `null`/blank → `null` (inline-only block, no dedicated page).
 * - Reserved or malformed → `null` (silently dropped; the editor auto-saves
 *   with no blocking UI, so we degrade to "no page" rather than throw).
 * - Collides with another product OR booking block on the same profile →
 *   auto-suffixed (`menu`, `menu-2`, `menu-3`, …). Per-profile uniqueness is
 *   also enforced by partial unique indexes; this avoids the insert failing.
 *
 * `excludeBlockId` lets an update keep its own slug without colliding with
 * itself.
 */
async function resolveUniqueBlockSlug(
  profileId: string,
  requested: string | null | undefined,
  excludeBlockId: string | null,
): Promise<string | null> {
  const validation = validateBlockSlug(requested);
  if (!validation.ok) return null;
  const base = validation.slug;

  const db = getDb();
  const [products, bookings] = await Promise.all([
    db
      .select({ id: profileProductBlocks.id, slug: profileProductBlocks.slug })
      .from(profileProductBlocks)
      .where(eq(profileProductBlocks.profileId, profileId)),
    db
      .select({ slug: profileBookingBlocks.slug })
      .from(profileBookingBlocks)
      .where(eq(profileBookingBlocks.profileId, profileId)),
  ]);

  const taken = new Set<string>();
  for (const p of products) {
    if (p.slug && p.id !== excludeBlockId) taken.add(p.slug);
  }
  for (const b of bookings) {
    if (b.slug) taken.add(b.slug);
  }

  if (!taken.has(base)) return base;
  for (let n = 2; n < 1000; n++) {
    const candidate = `${base}-${n}`;
    if (!taken.has(candidate)) return candidate;
  }
  // Astronomically unlikely; fall back to inline-only rather than loop forever.
  return null;
}

export async function getProductBlocksByProfileId(
  profileId: string,
): Promise<FullProductBlock[]> {
  const db = getDb();
  const blocks = await db
    .select()
    .from(profileProductBlocks)
    .where(eq(profileProductBlocks.profileId, profileId))
    .orderBy(asc(profileProductBlocks.sortOrder));

  if (!blocks.length) return [];

  const blockIds = blocks.map((b) => b.id);
  const [sections, items] = await Promise.all([
    db
      .select()
      .from(productSections)
      .where(inArray(productSections.blockId, blockIds))
      .orderBy(asc(productSections.sortOrder)),
    db
      .select()
      .from(productItems)
      .where(inArray(productItems.blockId, blockIds))
      .orderBy(asc(productItems.sortOrder)),
  ]);

  return blocks.map((b) => ({
    ...b,
    sections: sections.filter((s) => s.blockId === b.id),
    items: items.filter((i) => i.blockId === b.id),
  }));
}

export async function getProductBlocksByUserId(userId: string) {
  const profileId = await getProfileIdForUser(userId);
  if (!profileId) return [];
  return getProductBlocksByProfileId(profileId);
}

export async function getPublicActiveProductBlocks(profileId: string) {
  const all = await getProductBlocksByProfileId(profileId);
  return all.filter(
    (b) => b.isActive && b.items.some((i) => i.availability !== "hidden"),
  );
}

export type SaveResult =
  | { ok: true; id: string }
  | { ok: false; message: string };

/**
 * Build the persisted DB shape for an item from the validated input.
 * Resolves a transient `sectionRef` to the persisted section id when the
 * caller provides a mapping (used during create+update transactions).
 */
function buildItemRow(
  blockId: string,
  item: ProductBlockInput["items"][number],
  index: number,
  sectionIdByRef: Map<string, string>,
): typeof productItems.$inferInsert {
  const ref = item.sectionRef ?? null;
  const sectionId =
    ref && sectionIdByRef.has(ref) ? sectionIdByRef.get(ref)! : null;
  return {
    blockId,
    sectionId,
    title: item.title,
    description: item.description ?? null,
    imageUrl: item.imageUrl ?? null,
    priceType: item.priceType,
    priceAmount: item.priceAmount,
    priceAmountMax: item.priceAmountMax ?? null,
    availability: item.availability,
    isFeatured: item.isFeatured ?? false,
    externalUrl: item.externalUrl ?? null,
    badge: item.badge ?? null,
    sku: item.sku ?? null,
    sortOrder: index,
  };
}

export async function createProductBlockForUser(
  userId: string,
  input: ProductBlockInput,
  itemsLimit: number | null,
): Promise<SaveResult> {
  const parsed = productBlockInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "ورودی نامعتبر است.",
    };
  }
  // Plan-cap enforcement (defense-in-depth; UI also blocks this).
  const cap = effectiveItemsCap(itemsLimit);
  if (parsed.data.items.length > cap) {
    return {
      ok: false,
      message: `حداکثر ${cap} مورد در هر بلوک قابل ثبت است.`,
    };
  }

  const profileId = await getProfileIdForUser(userId);
  if (!profileId) {
    return { ok: false, message: "ابتدا اطلاعات پروفایل را تکمیل کنید." };
  }
  const db = getDb();

  const [{ next }] = await db
    .select({
      next: sql<number>`COALESCE(MAX(${profileProductBlocks.sortOrder}), 0) + 1`,
    })
    .from(profileProductBlocks)
    .where(eq(profileProductBlocks.profileId, profileId));

  const slug = await resolveUniqueBlockSlug(profileId, parsed.data.slug, null);

  const id = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(profileProductBlocks)
      .values({
        profileId,
        name: parsed.data.name,
        description: parsed.data.description,
        preset: parsed.data.preset,
        slug,
        layout: parsed.data.layout,
        itemLabel: parsed.data.itemLabel,
        currency: parsed.data.currency,
        showPrices: parsed.data.showPrices,
        displayMode: parsed.data.displayMode,
        pillLabel: parsed.data.pillLabel,
        iconKey: parsed.data.iconKey ?? null,
        iconUrl: parsed.data.iconUrl ?? null,
        imageUrl: parsed.data.imageUrl ?? null,
        sortOrder: Number(next ?? 0),
      })
      .returning({ id: profileProductBlocks.id });

    // Sections first, so item.sectionRef can be resolved.
    const sectionIdByRef = new Map<string, string>();
    if (parsed.data.sections.length) {
      const inserted = await tx
        .insert(productSections)
        .values(
          parsed.data.sections.map((s, index) => ({
            blockId: created.id,
            title: s.title,
            iconKey: s.iconKey ?? null,
            sortOrder: index,
          })),
        )
        .returning({ id: productSections.id });
      // Map by transient client id (the input `id` field on a section
      // doubles as ref before it's persisted).
      parsed.data.sections.forEach((s, i) => {
        const ref = s.id ?? `__new_${i}`;
        sectionIdByRef.set(ref, inserted[i].id);
      });
    }

    if (parsed.data.items.length) {
      await tx
        .insert(productItems)
        .values(
          parsed.data.items.map((it, idx) =>
            buildItemRow(created.id, it, idx, sectionIdByRef),
          ),
        );
    }

    return created.id;
  });

  await invalidateProfileCacheById(profileId);
  return { ok: true, id };
}

export async function updateProductBlockForUser(
  userId: string,
  blockId: string,
  input: ProductBlockInput,
  itemsLimit: number | null,
): Promise<SaveResult> {
  const parsed = productBlockInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "ورودی نامعتبر است.",
    };
  }
  const cap = effectiveItemsCap(itemsLimit);
  if (parsed.data.items.length > cap) {
    return {
      ok: false,
      message: `حداکثر ${cap} مورد در هر بلوک قابل ثبت است.`,
    };
  }

  const profileId = await getProfileIdForUser(userId);
  if (!profileId) return { ok: false, message: "پروفایل یافت نشد." };
  const db = getDb();

  const existing = await db.query.profileProductBlocks.findFirst({
    where: and(
      eq(profileProductBlocks.id, blockId),
      eq(profileProductBlocks.profileId, profileId),
    ),
  });
  if (!existing) return { ok: false, message: "بلوک یافت نشد." };

  const slug = await resolveUniqueBlockSlug(
    profileId,
    parsed.data.slug,
    blockId,
  );

  await db.transaction(async (tx) => {
    await tx
      .update(profileProductBlocks)
      .set({
        name: parsed.data.name,
        description: parsed.data.description,
        preset: parsed.data.preset,
        slug,
        layout: parsed.data.layout,
        itemLabel: parsed.data.itemLabel,
        currency: parsed.data.currency,
        showPrices: parsed.data.showPrices,
        displayMode: parsed.data.displayMode,
        pillLabel: parsed.data.pillLabel,
        iconKey: parsed.data.iconKey ?? null,
        iconUrl: parsed.data.iconUrl ?? null,
        imageUrl: parsed.data.imageUrl ?? null,
        updatedAt: new Date(),
      })
      .where(eq(profileProductBlocks.id, blockId));

    // -- Sections diff-by-id -------------------------------------------
    const incomingSectionIds = parsed.data.sections
      .map((s) => s.id)
      .filter((id): id is string => Boolean(id));

    if (incomingSectionIds.length) {
      await tx.delete(productSections).where(
        and(
          eq(productSections.blockId, blockId),
          sql`${productSections.id} NOT IN (${sql.join(
            incomingSectionIds.map((id) => sql`${id}::uuid`),
            sql`, `,
          )})`,
        ),
      );
    } else {
      await tx
        .delete(productSections)
        .where(eq(productSections.blockId, blockId));
    }

    const sectionIdByRef = new Map<string, string>();
    for (const [index, s] of parsed.data.sections.entries()) {
      if (s.id) {
        await tx
          .update(productSections)
          .set({ title: s.title, iconKey: s.iconKey ?? null, sortOrder: index })
          .where(
            and(
              eq(productSections.id, s.id),
              eq(productSections.blockId, blockId),
            ),
          );
        sectionIdByRef.set(s.id, s.id);
      } else {
        const [inserted] = await tx
          .insert(productSections)
          .values({
            blockId,
            title: s.title,
            iconKey: s.iconKey ?? null,
            sortOrder: index,
          })
          .returning({ id: productSections.id });
        sectionIdByRef.set(`__new_${index}`, inserted.id);
      }
    }

    // -- Items diff-by-id ----------------------------------------------
    const incomingItemIds = parsed.data.items
      .map((i) => i.id)
      .filter((id): id is string => Boolean(id));

    if (incomingItemIds.length) {
      await tx.delete(productItems).where(
        and(
          eq(productItems.blockId, blockId),
          sql`${productItems.id} NOT IN (${sql.join(
            incomingItemIds.map((id) => sql`${id}::uuid`),
            sql`, `,
          )})`,
        ),
      );
    } else {
      await tx.delete(productItems).where(eq(productItems.blockId, blockId));
    }

    for (const [index, it] of parsed.data.items.entries()) {
      const row = buildItemRow(blockId, it, index, sectionIdByRef);
      if (it.id) {
        await tx
          .update(productItems)
          .set({
            sectionId: row.sectionId,
            title: row.title,
            description: row.description,
            imageUrl: row.imageUrl,
            priceType: row.priceType,
            priceAmount: row.priceAmount,
            priceAmountMax: row.priceAmountMax,
            availability: row.availability,
            isFeatured: row.isFeatured,
            externalUrl: row.externalUrl,
            badge: row.badge,
            sku: row.sku,
            sortOrder: index,
            updatedAt: new Date(),
          })
          .where(
            and(eq(productItems.id, it.id), eq(productItems.blockId, blockId)),
          );
      } else {
        await tx.insert(productItems).values(row);
      }
    }
  });

  await invalidateProfileCacheById(profileId);
  return { ok: true, id: blockId };
}

export async function deleteProductBlockForUser(
  userId: string,
  blockId: string,
): Promise<{ ok: boolean; message?: string }> {
  const profileId = await getProfileIdForUser(userId);
  if (!profileId) return { ok: false, message: "پروفایل یافت نشد." };
  const db = getDb();
  await db
    .delete(profileProductBlocks)
    .where(
      and(
        eq(profileProductBlocks.id, blockId),
        eq(profileProductBlocks.profileId, profileId),
      ),
    );
  await invalidateProfileCacheById(profileId);
  return { ok: true };
}

export async function setProductBlockActiveForUser(
  userId: string,
  blockId: string,
  isActive: boolean,
): Promise<{ ok: boolean; message?: string }> {
  const profileId = await getProfileIdForUser(userId);
  if (!profileId) return { ok: false, message: "پروفایل یافت نشد." };
  const db = getDb();
  await db
    .update(profileProductBlocks)
    .set({ isActive })
    .where(
      and(
        eq(profileProductBlocks.id, blockId),
        eq(profileProductBlocks.profileId, profileId),
      ),
    );
  await invalidateProfileCacheById(profileId);
  return { ok: true };
}

/** Increment the click counter for an item (called by public click ping). */
export async function recordProductItemClick(itemId: string): Promise<void> {
  const db = getDb();
  await db
    .update(productItems)
    .set({ clickCount: sql`${productItems.clickCount} + 1` })
    .where(eq(productItems.id, itemId));
}

/**
 * Resolve the effective per-block item cap from the entitlement limit
 * value. Falls back to the absolute hard cap when no limit is configured
 * (admin grants, promo, mis-seeded plan).
 */
function effectiveItemsCap(itemsLimit: number | null): number {
  if (itemsLimit === null || itemsLimit < 0) return PRODUCT_ITEMS_HARD_CAP;
  return Math.min(itemsLimit, PRODUCT_ITEMS_HARD_CAP);
}

export { effectiveItemsCap };
