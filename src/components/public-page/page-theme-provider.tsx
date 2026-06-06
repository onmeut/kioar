import type { CSSProperties, ReactNode } from "react";

import { getTheme, themeToCssVars } from "@/lib/appearance/themes";
import type { PageAppearance } from "@/lib/appearance/types";
import {
  isCustomWallpaper,
  tintOverlayStyle,
  wallpaperLayerStyle,
} from "@/lib/appearance/wallpaper";

import { HalftoneFilter } from "./halftone-filter";

/**
 * Wraps the public profile page subtree with the user's chosen theme +
 * wallpaper. Renders entirely on the server — there is no client-side
 * theme flash because the CSS custom properties land in the initial
 * HTML.
 *
 * Structure:
 *   <div data-page-theme="…" style={cssVars} class="page-theme-root">
 *     <div class="page-wallpaper" style={layer} />        ← image/gradient/fill
 *     <div class="page-wallpaper-tint" style={tint} />    ← only for image
 *     <HalftoneFilter />                                  ← SVG filter ref
 *     <div class="page-theme-content">{children}</div>    ← page content
 *   </div>
 *
 * The wallpaper layer is absolutely positioned behind content, so any
 * child can still use `bg-background`/`bg-card` without fighting the
 * background. The tint sits between the photo and the content so text
 * stays legible on busy images.
 *
 * The `data-custom-wallpaper` attribute is set when the user has picked
 * anything other than the theme's default fill. The mobile CSS (see
 * `globals.css`) reads it to add a small inset so the wallpaper is
 * visible as a frame around the card on phones — otherwise the card
 * eats the full viewport width and the background never shows.
 */
export function PageThemeProvider({
  appearance,
  className,
  preview,
  children,
}: {
  appearance: PageAppearance;
  className?: string;
  /** Suppresses full-viewport mobile inset styles (padding + card rounding)
   *  that only apply on the real public page. Set this on all preview uses. */
  preview?: boolean;
  children: ReactNode;
}) {
  const cssVars = themeToCssVars(appearance.theme) as CSSProperties;
  const layer = wallpaperLayerStyle(appearance.wallpaper);
  const tint = tintOverlayStyle(appearance.wallpaper);
  const themeBg = getTheme(appearance.theme).tokens.background;
  const custom = isCustomWallpaper(appearance.wallpaper, themeBg);

  return (
    <div
      data-page-theme={appearance.theme}
      data-wallpaper-kind={appearance.wallpaper.type}
      data-custom-wallpaper={custom ? "1" : undefined}
      data-preview={preview ? "" : undefined}
      className={`page-theme-root ${className ?? ""}`}
      style={cssVars}
    >
      <div className="page-wallpaper" style={layer} aria-hidden />
      {tint ? (
        <div className="page-wallpaper-tint" style={tint} aria-hidden />
      ) : null}
      <HalftoneFilter />
      <div className="page-theme-content">{children}</div>
    </div>
  );
}
