"use client";

import { useEffect } from "react";

/**
 * When the app is launched as an installed PWA (display-mode: standalone),
 * lock the visual viewport so iOS/Android can't pinch-zoom — that breaks
 * native-feeling app shells, accidentally triggers on scroll, and leaves
 * the layout offset.
 *
 * In a regular browser tab the viewport meta stays at the default (zoom
 * allowed) so accessibility users can still zoom. We only mutate it when
 * we detect standalone mode at runtime.
 */
export function StandaloneZoomLock() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    const isStandalone =
      window.matchMedia?.("(display-mode: standalone)").matches ||
      // iOS Safari pre-display-mode flag
      (window.navigator as Navigator & { standalone?: boolean }).standalone ===
        true;

    if (!isStandalone) return;

    const meta = document.querySelector<HTMLMetaElement>(
      'meta[name="viewport"]',
    );
    if (!meta) return;
    meta.setAttribute(
      "content",
      "width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover, interactive-widget=resizes-content",
    );
  }, []);

  return null;
}
