/// <reference lib="webworker" />
//
// Custom service worker glue, imported automatically by next-pwa into the
// generated /sw.js. Runs in addition to the workbox-managed precache and
// runtime caching.
//
// Sole responsibility right now: PURGE the legacy Cache Storage buckets
// from the previous (broken) PWA configuration. Before the fix in
// next.config.ts, the SW used NetworkFirst on every same-origin HTML and
// RSC document and stored the responses in caches named `pages`,
// `pages-rsc`, `pages-rsc-prefetch`, `apis` and `cross-origin`. Those
// responses are keyed only by URL so they leak auth state across users
// (e.g. clicking the page-switcher hydrated the dashboard with the
// previous page's RSC payload, triggering React error #418 and a hard
// fallback to the unauth landing page).
//
// New deployments must guarantee that any client returning to kioar.com
// throws those buckets away the first time the new SW activates, even
// though the app no longer creates them. We keep the list narrow and
// allow-list the cache name prefix `workbox-` plus our own runtime caches
// (currently none) so we never accidentally nuke a future legitimate
// cache.

declare const self: ServiceWorkerGlobalScope;

const POISONED_LEGACY_CACHES = new Set([
  "pages",
  "pages-rsc",
  "pages-rsc-prefetch",
  "apis",
  "cross-origin",
  "next-data",
  "static-data-assets",
  "next-static-js-assets",
  "static-js-assets",
  "static-style-assets",
]);

self.addEventListener("activate", (event: ExtendableEvent) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((name) => POISONED_LEGACY_CACHES.has(name))
          .map((name) => caches.delete(name)),
      );
    })(),
  );
});
