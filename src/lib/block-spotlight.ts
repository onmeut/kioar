/**
 * Spotlight — the per-block highlight a creator can apply to a link,
 * form, or booking on a public page.
 *
 * - "none"    : default; render in normal sort order, no decoration.
 * - "pin"     : pre-empt sort order so the block lands at the top of the
 *               page. For form/booking blocks this also implies "render
 *               already expanded" so visitors see the form on landing.
 * - "animate" : apply a looping CSS animation (`animationStyle`) to the
 *               rendered pill to draw attention. Sort order is unchanged.
 *
 * The two states are mutually exclusive — picking "Pin" clears
 * `animationStyle`, picking "Animate" leaves the block in its sort
 * position. The combination is intentionally limited to keep public
 * pages calm and the editor flow simple.
 *
 * Plan gating (per the feature registry):
 * - "animate" → `link_animations`
 * - "pin"     → `featured_links`
 *
 * Both gates are on Pro + Business; neither is available on Free.
 */

export type BlockSpotlight = "none" | "pin" | "animate";

export type BlockAnimationStyle = "buzz" | "wobble" | "pop" | "swipe";

export const BLOCK_ANIMATION_STYLES: BlockAnimationStyle[] = [
  "buzz",
  "wobble",
  "pop",
  "swipe",
];

export const DEFAULT_ANIMATION_STYLE: BlockAnimationStyle = "buzz";

export const SPOTLIGHT_FEATURE_KEY: Record<
  Exclude<BlockSpotlight, "none">,
  string
> = {
  pin: "featured_links",
  animate: "link_animations",
};

/**
 * Numeric sort key — pinned blocks are pulled to the top regardless of
 * their stored `sortOrder`. We preserve relative ordering between
 * multiple pinned blocks via the original sort.
 */
export function spotlightSortKey(
  spotlight: BlockSpotlight,
  sortOrder: number,
): number {
  if (spotlight === "pin") {
    // Large negative offset keeps pinned items above all natural sorts
    // while preserving order amongst themselves.
    return Number.MIN_SAFE_INTEGER + sortOrder;
  }
  return sortOrder;
}

/**
 * Tailwind class for the looping public animation. Returns null when the
 * block has no animation (or animation is disabled by spotlight state).
 */
export function spotlightAnimationClass(
  spotlight: BlockSpotlight,
  animationStyle: BlockAnimationStyle | null,
): string | null {
  if (spotlight !== "animate" || !animationStyle) return null;
  switch (animationStyle) {
    case "buzz":
      return "anim-block-buzz";
    case "wobble":
      return "anim-block-wobble";
    case "pop":
      return "anim-block-pop";
    case "swipe":
      return "anim-block-swipe";
  }
}

/**
 * One-shot variant — plays once, then stops. Used for JS-controlled
 * periodic triggers (public page blocks every 10 s). The class is removed
 * by the caller after `animationend` and re-added on the next interval.
 */
export function spotlightAnimationClassOnce(
  spotlight: BlockSpotlight,
  animationStyle: BlockAnimationStyle | null,
): string | null {
  if (spotlight !== "animate" || !animationStyle) return null;
  switch (animationStyle) {
    case "buzz":
      return "anim-block-buzz-once";
    case "wobble":
      return "anim-block-wobble-once";
    case "pop":
      return "anim-block-pop-once";
    case "swipe":
      return "anim-block-swipe-once";
  }
}

/**
 * Persian display labels (admin & modal copy).
 */
export const SPOTLIGHT_LABELS_FA: Record<BlockSpotlight, string> = {
  none: "بدون اولویت",
  pin: "سنجاق به بالا",
  animate: "انیمیشن",
};

export const ANIMATION_LABELS: Record<BlockAnimationStyle, string> = {
  buzz: "BUZZ",
  wobble: "WOBBLE",
  pop: "POP",
  swipe: "SWIPE",
};
