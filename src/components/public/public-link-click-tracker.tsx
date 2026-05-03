"use client";

import { useEffect } from "react";

/**
 * Mounts a single delegated click listener on the document that fires a
 * non-blocking analytics beacon whenever a visitor activates an anchor with
 * `data-track-link-id`. Anchors point directly at the destination URL so the
 * browser navigates without a server round-trip — this keeps SEO and UX
 * clean while we still record clicks asynchronously.
 */
export function PublicLinkClickTracker() {
  useEffect(() => {
    function handler(event: MouseEvent) {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest<HTMLAnchorElement>("a[data-track-link-id]");
      if (!anchor) return;
      const id = anchor.dataset.trackLinkId;
      if (!id) return;
      const url = `/api/links/${encodeURIComponent(id)}/click`;
      try {
        if (
          typeof navigator !== "undefined" &&
          typeof navigator.sendBeacon === "function"
        ) {
          // Empty Blob keeps it a same-origin POST without preflight.
          navigator.sendBeacon(url, new Blob([], { type: "text/plain" }));
          return;
        }
      } catch {
        // fall through to fetch
      }
      try {
        void fetch(url, {
          method: "POST",
          keepalive: true,
          credentials: "omit",
          cache: "no-store",
        });
      } catch {
        // best-effort; never block navigation
      }
    }

    document.addEventListener("click", handler, { capture: true });
    // auxclick covers middle-click / cmd-click opens in new tabs
    document.addEventListener("auxclick", handler, { capture: true });
    return () => {
      document.removeEventListener("click", handler, { capture: true });
      document.removeEventListener("auxclick", handler, { capture: true });
    };
  }, []);

  return null;
}
