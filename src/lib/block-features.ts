/**
 * Phase 5 — block kind → feature key mapping.
 *
 * Single source of truth for "which entitlement does this block require?"
 * Used by both the public renderer (filter ungranted blocks out entirely)
 * and the editor (show ungranted blocks in a locked, read-only state with
 * an upgrade CTA).
 *
 * Add a new block kind here whenever the schema grows one — never spread
 * the mapping across multiple call sites.
 *
 * Note on `link` blocks: the current `profile_links` table has no
 * per-link "kind" discriminator (image gallery, video, audio, scheduled,
 * etc. all flow through the same row), so for now `profile_links` are
 * always considered Free-grantable (`link_url`). When per-link kinds
 * land we'll widen `LinkBlockKind` here and update the renderer to pick
 * the right feature key per row.
 */

export type BlockKind = "booking" | "form" | "link" | "product";

/**
 * Feature key required to render / interact with a block of the given
 * kind. `null` means "no gate" — the block is always visible.
 */
export function blockKindToFeatureKey(kind: BlockKind): string | null {
  switch (kind) {
    case "booking":
      // Bookings are a Business-only feature in the Phase 2 matrix.
      return "business_bookings";
    case "form":
      // The current `profile_form_blocks` schema covers custom lead-capture
      // forms (Business). Newsletter signup forms (Pro) will live on a
      // future `profile_link_blocks` row with kind=newsletter, so they're
      // intentionally NOT mapped here yet.
      return "business_lead_capture_form";
    case "product":
      // Products & services block — granted on every plan but with a
      // per-block items cap; see `products_max_items_per_block`.
      return "products_block";
    case "link":
      // No per-link kind today; the link_url base feature is on every plan.
      return null;
  }
}

/**
 * Lowest paid plan that grants `featureKey`. Used by the editor to
 * decorate locked rows with a plan-specific upgrade affordance (Pro =
 * green, Business = purple).
 *
 * Convention from the registry: feature keys are prefixed by the lowest
 * tier that grants them — `business_*` lands on Business; everything
 * else (analytics, marketing, link_*, etc.) lands on Pro. Free-grantable
 * features never appear in a locked CTA so they don't need a mapping.
 */
export type RequiredPlanTier = "pro" | "business";

export function featureKeyToRequiredPlan(featureKey: string): RequiredPlanTier {
  return featureKey.startsWith("business_") ? "business" : "pro";
}

/** Convenience for callers that already know the block kind. */
export function blockKindToRequiredPlan(
  kind: BlockKind,
): RequiredPlanTier | null {
  const key = blockKindToFeatureKey(kind);
  return key ? featureKeyToRequiredPlan(key) : null;
}
