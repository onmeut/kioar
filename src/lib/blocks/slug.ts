import "server-only";

import { getDb } from "@/db";
import { profiles } from "@/db/schema";
import { and, eq } from "drizzle-orm";

import { normalizeBlockSlug } from "@/lib/slug";
import { getProductBlocksByProfileId } from "@/lib/product-service";
import { getBookingBlocksByProfileId } from "@/lib/booking-data";

export { normalizeBlockSlug } from "@/lib/slug";

/**
 * Reserved block-slug segments.
 *
 * A block slug lives at `kioar.com/{profileSlug}/{blockSlug}` — one level below
 * the username. That makes its reserved set DIFFERENT from the top-level
 * username reserved list in `@/lib/slug`: a block slug must not collide with
 * the STATIC route segments that are siblings of `[blockSlug]` under
 * `src/app/[slug]/`. Next.js prioritises static segments over the dynamic
 * `[blockSlug]`, so a block named `e` or `bookings` would be unreachable.
 *
 * Most sibling segments contain a `.` (e.g. `contact.vcf`,
 * `manifest.webmanifest`, the icon routes) and can never be produced by
 * `normalizeSlug` (which strips dots), so the practical collisions are the
 * dotless ones. We list the full set anyway for documentation + defence.
 */
const RESERVED_BLOCK_SLUGS = new Set([
  "e", // /[slug]/e/[eventSlug] — event detail pages
  "bookings", // /[slug]/bookings — booking server actions
  "contact", // contact.vcf route (dot stripped → "contact")
  "manifest", // manifest.webmanifest (dot stripped → "manifest")
  "opengraph-image",
  "app-icon",
  "apple-icon",
  "icon",
  "icon-512",
  "icon-maskable",
]);

export type BlockSlugReason =
  | "ok"
  | "empty"
  | "too-long"
  | "reserved";

export type BlockSlugValidation =
  | { ok: true; slug: string }
  | { ok: false; reason: Exclude<BlockSlugReason, "ok">; message: string };

const MAX_BLOCK_SLUG_LENGTH = 60;

/**
 * Validate a (already-normalized or raw) block slug for storage. Returns the
 * canonical slug on success or a reason + Persian message on failure.
 *
 * Uniqueness (per-profile, cross-table) is NOT checked here — it depends on
 * the owning profile and live data, so the save action enforces it against the
 * DB. This function only covers shape + reserved words.
 */
export function validateBlockSlug(input: string | null | undefined): BlockSlugValidation {
  const slug = normalizeBlockSlug(input);
  if (!slug) {
    return { ok: false, reason: "empty", message: "نشانی صفحه را وارد کنید." };
  }
  if (slug.length > MAX_BLOCK_SLUG_LENGTH) {
    return {
      ok: false,
      reason: "too-long",
      message: `نشانی صفحه حداکثر ${MAX_BLOCK_SLUG_LENGTH} نویسه است.`,
    };
  }
  if (RESERVED_BLOCK_SLUGS.has(slug)) {
    return {
      ok: false,
      reason: "reserved",
      message: "این نشانی رزرو شده است. نشانی دیگری انتخاب کنید.",
    };
  }
  return { ok: true, slug };
}

export type ResolvedProductBlock = {
  kind: "product";
  profileId: string;
  block: Awaited<ReturnType<typeof getProductBlocksByProfileId>>[number];
};

export type ResolvedBookingBlock = {
  kind: "booking";
  profileId: string;
  block: Awaited<ReturnType<typeof getBookingBlocksByProfileId>>[number];
};

export type ResolvedBlock = ResolvedProductBlock | ResolvedBookingBlock;

/**
 * Resolve a `kioar.com/{profileSlug}/{blockSlug}` pair to the owning block.
 *
 * Looks up the profile, then searches that profile's product blocks and
 * booking blocks for one whose stored `slug` matches. Returns `null` when the
 * profile is missing/incomplete, the block slug is reserved, or no active
 * block carries that slug.
 *
 * The DB enforces per-profile slug uniqueness within each table; the reserved
 * list + cross-table check in the save action prevent a product and booking
 * block on the same profile from sharing a slug. If a collision somehow
 * existed, product blocks win (checked first) — deterministic, not random.
 */
export async function resolveBlockBySlug(
  profileSlug: string,
  blockSlug: string,
): Promise<ResolvedBlock | null> {
  const normalized = normalizeBlockSlug(blockSlug);
  if (!normalized || RESERVED_BLOCK_SLUGS.has(normalized)) return null;

  const db = getDb();
  const profile = await db.query.profiles.findFirst({
    where: and(eq(profiles.slug, profileSlug), eq(profiles.isComplete, true)),
    columns: { id: true },
  });
  if (!profile) return null;

  const [productBlocks, bookingBlocks] = await Promise.all([
    getProductBlocksByProfileId(profile.id),
    getBookingBlocksByProfileId(profile.id),
  ]);

  const product = productBlocks.find(
    (b) => b.isActive && b.slug === normalized,
  );
  if (product) {
    return { kind: "product", profileId: profile.id, block: product };
  }

  const booking = bookingBlocks.find(
    (b) => b.isActive && b.slug === normalized,
  );
  if (booking) {
    return { kind: "booking", profileId: profile.id, block: booking };
  }

  return null;
}
