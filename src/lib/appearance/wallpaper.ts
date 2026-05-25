import type { CSSProperties } from "react";

import type { Wallpaper, WallpaperEffect } from "./types";

/**
 * Pure helpers that turn a `Wallpaper` value into the CSS strings + style
 * objects the renderer applies. SSR-safe (no DOM, no window). Used by
 * both the server renderer and the live editor preview so what the user
 * sees while editing matches exactly what visitors will see.
 */

/**
 * A barely-there grain overlay used when `noise: true` is set on a
 * gradient. SVG `feTurbulence` is the cheapest cross-browser way to get
 * convincing film grain — a single inline data-URI, no extra request.
 */
const NOISE_DATA_URI =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'>` +
      `<filter id='n'>` +
      `<feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/>` +
      `<feColorMatrix type='matrix' values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.5 0'/>` +
      `</filter>` +
      `<rect width='100%' height='100%' filter='url(#n)' opacity='0.45'/>` +
      `</svg>`,
  );

export function gradientCss(
  from: string,
  to: string,
  direction: "linear-up" | "linear-down" | "radial",
): string {
  switch (direction) {
    case "linear-up":
      return `linear-gradient(0deg, ${from} 0%, ${to} 100%)`;
    case "linear-down":
      return `linear-gradient(180deg, ${from} 0%, ${to} 100%)`;
    case "radial":
      return `radial-gradient(circle at 50% 30%, ${from} 0%, ${to} 100%)`;
  }
}

export function effectFilter(effect: WallpaperEffect): string | undefined {
  switch (effect) {
    case "mono":
      return "grayscale(1)";
    case "blur":
      return "blur(8px)";
    case "halftone":
      return "url(#kioar-halftone)";
    case "none":
    default:
      return undefined;
  }
}

/**
 * Inline style applied to the wallpaper layer (the absolute-positioned
 * background div behind page content). Always returned — even fills are
 * rendered as a layer so the same DOM structure works for the tint
 * overlay on `image` wallpapers.
 */
export function wallpaperLayerStyle(wallpaper: Wallpaper): CSSProperties {
  switch (wallpaper.type) {
    case "fill":
      return { backgroundColor: wallpaper.color };
    case "gradient": {
      const base = gradientCss(
        wallpaper.from,
        wallpaper.to,
        wallpaper.direction,
      );
      if (wallpaper.noise) {
        // Layer order is important: noise on top of gradient, single
        // declaration so the browser doesn't repaint twice.
        return {
          backgroundImage: `url("${NOISE_DATA_URI}"), ${base}`,
          backgroundRepeat: "repeat, no-repeat",
          backgroundSize: "160px 160px, cover",
        };
      }
      return { backgroundImage: base };
    }
    case "image": {
      const filter = effectFilter(wallpaper.effect);
      return {
        backgroundImage: `url("${wallpaper.imageUrl}")`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        // Filter is applied to the layer (not the image itself) so the
        // stored asset is never altered — toggle to "none" and the
        // original photo returns unchanged.
        filter,
        // Scale up when blurred so the blur bleed is hidden by the
        // parent's overflow:hidden instead of compositing against the
        // page background and creating a white halo at the edges.
        transform: wallpaper.effect === "blur" ? "scale(1.1)" : undefined,
      };
    }
  }
}

/**
 * Optional dark overlay rendered between the image wallpaper and the
 * page content. Returns `null` for non-image wallpapers (tint is
 * meaningless without a photo behind it).
 */
export function tintOverlayStyle(wallpaper: Wallpaper): CSSProperties | null {
  if (wallpaper.type !== "image") return null;
  const t = clamp01(wallpaper.tint / 100);
  if (t <= 0) return null;
  return {
    backgroundColor: `rgba(0, 0, 0, ${t.toFixed(3)})`,
  };
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

/**
 * "The user picked a non-default background."
 *
 * Default fill = the theme's own background token (`var(--background)` or
 * the resolved theme bg). Anything else means the user wants the wallpaper
 * to read as a frame around the card, so the renderer should inset the
 * card on mobile to let that frame show through.
 */
export function isCustomWallpaper(
  wallpaper: import("./types").Wallpaper,
  themeBg: string,
): boolean {
  if (wallpaper.type !== "fill") return true;
  const a = wallpaper.color.trim().toLowerCase();
  const b = themeBg.trim().toLowerCase();
  return a !== b && a !== "var(--background)";
}
