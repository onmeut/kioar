/**
 * Cross-kind block reordering for the dashboard "links" page.
 *
 * The page treats links, booking blocks and form blocks as one unified
 * list. Each kind is stored in its own table, but they share a single
 * `sort_order` namespace per profile so the public profile card can
 * merge them numerically (see `public-profile-card.tsx`).
 *
 * This action takes the desired ordering (an array of `{ kind, id }`)
 * and assigns sequential sort orders to every row, scoped to the
 * caller's profile. It silently ignores ids that do not belong to the
 * profile, so a stale/forged client payload cannot scramble another
 * user's data.
 */

import { and, eq, inArray } from "drizzle-orm";

import { getDb } from "@/db";
import {
  profileBookingBlocks,
  profileFormBlocks,
  profileLinks,
  profileProductBlocks,
} from "@/db/schema";
import { invalidateProfileCacheBySlug } from "@/lib/cache/profile-cache";
import { resolveCurrentPageForOwner } from "@/lib/pages";

export type BlockKind = "link" | "booking" | "form" | "product";

export type ReorderItem = { kind: BlockKind; id: string };

type Result = { ok: true } | { ok: false; message: string };

export async function reorderBlocksForUser(
  userId: string,
  items: ReorderItem[],
): Promise<Result> {
  const db = getDb();
  // Reorder against the currently-edited page; a user may own several
  // pages and only the current one is being arranged.
  const profile = await resolveCurrentPageForOwner(userId);
  if (!profile) return { ok: false, message: "پروفایل یافت نشد." };

  // Validate ownership per kind in a single round-trip.
  const linkIds = items.filter((i) => i.kind === "link").map((i) => i.id);
  const bookingIds = items.filter((i) => i.kind === "booking").map((i) => i.id);
  const formIds = items.filter((i) => i.kind === "form").map((i) => i.id);
  const productIds = items.filter((i) => i.kind === "product").map((i) => i.id);

  const [ownLinks, ownBookings, ownForms, ownProducts] = await Promise.all([
    linkIds.length
      ? db
          .select({ id: profileLinks.id })
          .from(profileLinks)
          .where(
            and(
              eq(profileLinks.profileId, profile.id),
              inArray(profileLinks.id, linkIds),
            ),
          )
      : Promise.resolve([] as { id: string }[]),
    bookingIds.length
      ? db
          .select({ id: profileBookingBlocks.id })
          .from(profileBookingBlocks)
          .where(
            and(
              eq(profileBookingBlocks.profileId, profile.id),
              inArray(profileBookingBlocks.id, bookingIds),
            ),
          )
      : Promise.resolve([] as { id: string }[]),
    formIds.length
      ? db
          .select({ id: profileFormBlocks.id })
          .from(profileFormBlocks)
          .where(
            and(
              eq(profileFormBlocks.profileId, profile.id),
              inArray(profileFormBlocks.id, formIds),
            ),
          )
      : Promise.resolve([] as { id: string }[]),
    productIds.length
      ? db
          .select({ id: profileProductBlocks.id })
          .from(profileProductBlocks)
          .where(
            and(
              eq(profileProductBlocks.profileId, profile.id),
              inArray(profileProductBlocks.id, productIds),
            ),
          )
      : Promise.resolve([] as { id: string }[]),
  ]);

  const ownedLinks = new Set(ownLinks.map((r) => r.id));
  const ownedBookings = new Set(ownBookings.map((r) => r.id));
  const ownedForms = new Set(ownForms.map((r) => r.id));
  const ownedProducts = new Set(ownProducts.map((r) => r.id));

  await db.transaction(async (tx) => {
    let order = 0;
    for (const item of items) {
      if (item.kind === "link" && ownedLinks.has(item.id)) {
        await tx
          .update(profileLinks)
          .set({ sortOrder: order })
          .where(
            and(
              eq(profileLinks.profileId, profile.id),
              eq(profileLinks.id, item.id),
            ),
          );
      } else if (item.kind === "booking" && ownedBookings.has(item.id)) {
        await tx
          .update(profileBookingBlocks)
          .set({ sortOrder: order })
          .where(
            and(
              eq(profileBookingBlocks.profileId, profile.id),
              eq(profileBookingBlocks.id, item.id),
            ),
          );
      } else if (item.kind === "form" && ownedForms.has(item.id)) {
        await tx
          .update(profileFormBlocks)
          .set({ sortOrder: order })
          .where(
            and(
              eq(profileFormBlocks.profileId, profile.id),
              eq(profileFormBlocks.id, item.id),
            ),
          );
      } else if (item.kind === "product" && ownedProducts.has(item.id)) {
        await tx
          .update(profileProductBlocks)
          .set({ sortOrder: order })
          .where(
            and(
              eq(profileProductBlocks.profileId, profile.id),
              eq(profileProductBlocks.id, item.id),
            ),
          );
      } else {
        // Unknown kind or not owned — skip without bumping the counter so
        // we don't leave gaps.
        continue;
      }
      order += 1;
    }
  });

  await invalidateProfileCacheBySlug(profile.slug);
  return { ok: true };
}
