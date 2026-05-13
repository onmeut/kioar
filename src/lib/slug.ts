const RESERVED_SLUGS = new Set([
  "admin",
  "api",
  "auth",
  "dashboard",
  "insights",
  "discover",
  "events",
  "onboarding",
  "u",
  "app",
  "signin",
  "signup",
  "signout",
  "login",
  "logout",
  "register",
  "verify",
  "settings",
  "about",
  "contact",
  "help",
  "support",
  "legal",
  "privacy",
  "terms",
  "pricing",
  "features",
  "blog",
  "docs",
  "home",
  "pwa",
  "manifest",
  "manifest.webmanifest",
  "robots.txt",
  "sitemap.xml",
  "favicon.ico",
  "apple-icon",
  "icon",
  "sw.js",
  "workbox",
  "static",
  "public",
  "assets",
  "brand",
  "icons",
  "fallback",
  "swe-worker",
  "robots",
  "sitemap",
  "opengraph-image",
  "twitter-image",
]);

export function normalizeSlug(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/[\u200c\u200f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function isReservedSlug(slug: string) {
  const normalized = normalizeSlug(slug);
  if (!normalized) return true;
  if (normalized.startsWith("_")) return true;
  if (normalized.startsWith("~")) return true;
  return RESERVED_SLUGS.has(normalized);
}

export function generateSlugSuggestion(source: string) {
  const base = normalizeSlug(source);

  if (base.length >= 3 && !isReservedSlug(base)) {
    return base;
  }

  return `kioar-${Math.random().toString(36).slice(2, 7)}`;
}
