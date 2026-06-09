/**
 * Page-level settings bag.
 *
 * This is the **default home for new profile-level settings** (per the
 * decision recorded in CLAUDE.md / the god-table plan). Persisted as the
 * `settings` jsonb column on `profiles`. `null` falls back to
 * `DEFAULT_PAGE_SETTINGS` so existing rows behave exactly as they do today.
 *
 * Why a blob and not a column: a setting that is only ever read and
 * displayed (a toggle, a label, a preference) — never filtered, joined, or
 * indexed — can be added here as a single key with **no migration**. That
 * is what stops the `profiles` god table from growing a new column for every
 * feature. A setting that needs a `WHERE`/`JOIN`/index/FK, or bulk
 * filtering, does NOT belong here — promote it to a real column or a side
 * table keyed by `page_id` (see the §2 decision rule).
 *
 * Contrast with `lib/appearance`: appearance is a *fixed-shape* blob that
 * collapses to its default if malformed. `settings` is an *extensible bag* —
 * each key is independent and optional, so reads merge per-key onto the
 * defaults rather than discarding the whole blob when one key is missing.
 * That is what makes "add a key" forward-compatible with rows written before
 * the key existed.
 *
 * Versioning: `version` is the envelope version, not a per-key version.
 * Adding a new optional key does NOT require a version bump (old rows simply
 * lack it and read the default). Bump `version` only if the *envelope* shape
 * ever changes incompatibly, and slot the rewrite into `coercePageSettings`.
 */

export interface PageSettings {
  version: 1;
  // ---- settings keys go here -------------------------------------------
  // Each must be OPTIONAL (`?`) with a default in DEFAULT_PAGE_SETTINGS, so
  // a row written before the key existed reads the default cleanly. Add the
  // matching validator to `./schema.ts` in the same commit.
  //
  // (Intentionally empty: the mechanism ships first. The first real setting
  //  is a one-line key addition here + in schema.ts + in the defaults below.)
}

export const DEFAULT_PAGE_SETTINGS: PageSettings = {
  version: 1,
};

/**
 * Normalize anything read from the DB (`null`, a partial row written before
 * a key existed, or a forward/unknown shape) into a valid `PageSettings`.
 *
 * Strategy: start from the defaults and overlay any recognized keys present
 * on the stored value. Unknown keys are dropped on read (they were written
 * by a newer deploy and this code doesn't understand them — defaulting is
 * safe). Missing keys fall back to their default. The whole blob is only
 * discarded if it isn't an object at all.
 *
 * This is the single chokepoint a future envelope migration would live in.
 */
export function coercePageSettings(value: unknown): PageSettings {
  if (!value || typeof value !== "object") return DEFAULT_PAGE_SETTINGS;
  const stored = value as Partial<PageSettings> & Record<string, unknown>;

  // Overlay recognized keys onto the defaults. As keys are added to
  // PageSettings, copy each one here with its own type guard, e.g.:
  //   if (typeof stored.hideBranding === "boolean")
  //     next.hideBranding = stored.hideBranding;
  const next: PageSettings = { ...DEFAULT_PAGE_SETTINGS };

  return next;
}
