/**
 * Public-page appearance settings.
 *
 * Versioned, serializable, and forward-compatible. Persisted as the
 * `appearance` jsonb column on `profiles`. `null` falls back to
 * `DEFAULT_APPEARANCE` so existing rows render exactly as they do today.
 *
 * When adding a new field that changes the rendered shape, bump `version`
 * and write a forward migration in `lib/appearance/migrate.ts` (currently
 * unused — the shape is at v1). Never re-shape v1 in place.
 */

export type PageThemeId =
  | "light"
  | "dark"
  | "sand"
  | "ocean"
  | "forest"
  | "rose"
  | "slate"
  | "mono"
  | "ember"
  | "sunlight"
  | "tangerine"
  | "orchid"
  | "blossom"
  | "cocoa";

export type WallpaperEffect = "none" | "mono" | "blur" | "halftone";

export type GradientDirection = "linear-up" | "linear-down" | "radial";

export type Wallpaper =
  | { type: "fill"; color: string }
  | {
      type: "gradient";
      from: string;
      to: string;
      direction: GradientDirection;
      noise?: boolean;
    }
  | {
      type: "image";
      imageUrl: string;
      effect: WallpaperEffect;
      /** 0–100, dark overlay strength above the image for legibility. */
      tint: number;
    };

export interface PageAppearance {
  version: 1;
  theme: PageThemeId;
  wallpaper: Wallpaper;
}

export const DEFAULT_APPEARANCE: PageAppearance = {
  version: 1,
  theme: "light",
  wallpaper: { type: "fill", color: "var(--background)" },
};

/**
 * Normalize anything we read from the DB (possibly `null`, possibly a
 * future shape) to a valid PageAppearance. Right now there's only v1, so
 * unknown values collapse to the default — this is the single chokepoint
 * a future migration step would slot into.
 */
export function coerceAppearance(value: unknown): PageAppearance {
  if (!value || typeof value !== "object") return DEFAULT_APPEARANCE;
  const v = value as Partial<PageAppearance>;
  if (v.version !== 1) return DEFAULT_APPEARANCE;
  if (!v.theme || !v.wallpaper) return DEFAULT_APPEARANCE;
  return v as PageAppearance;
}
