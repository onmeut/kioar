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
  profileTextBlocks,
} from "@/db/schema";
import { invalidateProfileCacheBySlug } from "@/lib/cache/profile-cache";
import { resolveCurrentPageForOwner } from "@/lib/pages";

export type BlockKind = "link" | "booking" | "form" | "product" | "text";

export type ReorderItem = { kind: BlockKind; id: string };

type Result = { ok: true } | { ok: false; message: string };

// All block ids are uuid columns. The client occasionally holds temporary,
// non-uuid placeholder ids (e.g. the activation wizard's `wizard-<key>-<ts>`
// strings) before the server round-trips the real ids back. Feeding a
// non-uuid into `inArray(<uuid column>, …)` makes Postgres throw `22P02`
// (invalid input syntax for type uuid) and aborts the whole batch — which
// previously crashed every wizard-driven reorder. Per this module's contract
// ("silently ignores ids that do not belong to the profile"), we drop any id
// that isn't a well-formed uuid before it ever reaches the query.
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function reorderBlocksForUser(
  userId: string,
  items: ReorderItem[],
): Promise<Result> {
  const db = getDb();
  // Reorder against the currently-edited page; a user may own several
  // pages and only the current one is being arranged.
  const profile = await resolveCurrentPageForOwner(userId);
  if (!profile) return { ok: false, message: "پروفایل یافت نشد." };

  // Drop any items whose id isn't a real uuid (stale client placeholders).
  // This both prevents the `22P02` crash and keeps the rest of the batch
  // working when one bad id slips in alongside valid ones.
  items = items.filter((i) => UUID_RE.test(i.id));

  // Validate ownership per kind in a single round-trip.
  const linkIds = items.filter((i) => i.kind === "link").map((i) => i.id);
  const bookingIds = items.filter((i) => i.kind === "booking").map((i) => i.id);
  const formIds = items.filter((i) => i.kind === "form").map((i) => i.id);
  const productIds = items.filter((i) => i.kind === "product").map((i) => i.id);
  const textIds = items.filter((i) => i.kind === "text").map((i) => i.id);

  const [ownLinks, ownBookings, ownForms, ownProducts, ownTexts] =
    await Promise.all([
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
    textIds.length
      ? db
          .select({ id: profileTextBlocks.id })
          .from(profileTextBlocks)
          .where(
            and(
              eq(profileTextBlocks.profileId, profile.id),
              inArray(profileTextBlocks.id, textIds),
            ),
          )
      : Promise.resolve([] as { id: string }[]),
  ]);

  const ownedLinks = new Set(ownLinks.map((r) => r.id));
  const ownedBookings = new Set(ownBookings.map((r) => r.id));
  const ownedForms = new Set(ownForms.map((r) => r.id));
  const ownedProducts = new Set(ownProducts.map((r) => r.id));
  const ownedTexts = new Set(ownTexts.map((r) => r.id));

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
      } else if (item.kind === "text" && ownedTexts.has(item.id)) {
        await tx
          .update(profileTextBlocks)
          .set({ sortOrder: order })
          .where(
            and(
              eq(profileTextBlocks.profileId, profile.id),
              eq(profileTextBlocks.id, item.id),
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
