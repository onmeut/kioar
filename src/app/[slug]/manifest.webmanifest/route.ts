import { NextResponse } from "next/server";

import { getPublicProfileBySlug } from "@/lib/data";

// `force-dynamic` so the manifest reflects edits immediately. Cheap query.
export const dynamic = "force-dynamic";

/**
 * Per-profile PWA manifest. Lets each public profile be installed as its
 * own home-screen app with the user's chosen icon and theme color.
 *
 * `scope` is locked to `/{slug}/` so a user installing one profile doesn't
 * accidentally hijack the host app.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const profile = await getPublicProfileBySlug(slug);

  if (!profile) {
    return new NextResponse("Not found", { status: 404 });
  }

  const themeColor = profile.appIconColor || "#195c54";

  // Home-screen identity is the user's real name (with role/title as a
  // secondary line, when present). The launcher label MUST belong to the
  // owner of this page — never the "Kioar" brand and never `@slug`.
  // Order: fullName → title → @slug. Trim because users paste whitespace.
  const fullName = (profile.fullName ?? "").trim();
  const role = (profile.title ?? "").trim();
  const appName = fullName || role || `@${slug}`;
  // `short_name` lands on Android launcher tiles where space is tight
  // (~12 chars). Truncate by grapheme-safe character count, not bytes,
  // so multi-byte Persian glyphs aren't sliced mid-codepoint.
  const shortName = Array.from(appName).slice(0, 12).join("");
  const description =
    profile.seoDescription ||
    profile.bio ||
    (role ? `${appName} — ${role}` : appName);
  const manifest = {
    name: appName,
    short_name: shortName,
    description,
    id: `/${slug}/?source=pwa`,
    start_url: `/${slug}/?source=pwa`,
    scope: `/${slug}/`,
    display: "standalone",
    display_override: ["standalone", "minimal-ui", "browser"],
    orientation: "portrait",
    background_color: themeColor,
    theme_color: themeColor,
    lang: "fa-IR",
    dir: "rtl",
    prefer_related_applications: false,
    icons: [
      // PWA app icon: chromed (rounded square, avatar on brand bg). The
      // 192/512 plain favicons under `/${slug}/icon.png` are different
      // assets — those go to `<link rel="icon">` for browser tabs.
      {
        src: `/${slug}/app-icon.png`,
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: `/${slug}/icon-maskable.png`,
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };

  return NextResponse.json(manifest, {
    headers: {
      // 10 min browser / 1 h CDN / serve stale up to 24 h while revalidating.
      // Short enough that avatar/name changes propagate reasonably fast.
      "Cache-Control":
        "public, max-age=600, s-maxage=3600, stale-while-revalidate=86400",
      "Content-Type": "application/manifest+json; charset=utf-8",
    },
  });
}
