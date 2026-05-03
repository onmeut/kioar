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

  const displayName = profile.fullName || slug;
  const themeColor = profile.appIconColor || "#195c54";

  // The home-screen app should carry the user's handle so the user
  // recognises it among other installed apps. The page title is for
  // search engines & link previews — not for the launcher.
  const appName = `@${slug}`;
  const manifest = {
    name: appName,
    short_name: appName.length > 12 ? appName.slice(0, 12) : appName,
    description:
      profile.seoDescription || profile.bio || `${displayName} on Kioar`,
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
      {
        src: `/${slug}/icon.png`,
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: `/${slug}/icon-512.png`,
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
      // Manifest can be cached briefly; we revalidate when the user edits.
      "Cache-Control": "public, max-age=60, s-maxage=60",
      "Content-Type": "application/manifest+json; charset=utf-8",
    },
  });
}
