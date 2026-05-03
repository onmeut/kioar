import "server-only";

import { ImageResponse } from "next/og";
import type { CSSProperties } from "react";

import { getPublicProfileBySlug } from "@/lib/data";
import { resolveIconEntry } from "@/lib/link-icons";

type Variant = "any" | "maskable" | "apple";

/**
 * Render a square PNG for use as the per-profile favicon, PWA icon, or
 * apple-touch-icon. When the user has picked an `appIconKey`, we render
 * that icon centered on a colored background. Otherwise we fall back to
 * the user's initial.
 *
 * The maskable variant adds a safe-area inset so iOS/Android can crop
 * to a circle without clipping the glyph.
 */
export async function renderProfileIcon(
  slug: string,
  size: number,
  variant: Variant = "any",
): Promise<Response> {
  const profile = await getPublicProfileBySlug(slug);
  if (!profile) {
    return new Response("Not found", { status: 404 });
  }

  const bg = profile.appIconColor || "#195c54";
  const inset = variant === "maskable" ? Math.round(size * 0.18) : 0;
  const iconSize = Math.round((size - inset * 2) * 0.6);
  const radius =
    variant === "apple" ? Math.round(size * 0.22) : Math.round(size * 0.18);

  const containerStyle: CSSProperties = {
    width: "100%",
    height: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: bg,
    borderRadius: variant === "maskable" ? 0 : radius,
    color: "white",
  };

  let body: React.ReactNode;
  if (profile.appIconKey) {
    const entry = resolveIconEntry(profile.appIconKey, "");
    body = (
      <entry.Icon
        width={iconSize}
        height={iconSize}
        color="white"
        stroke="white"
      />
    );
  } else {
    const ch =
      (profile.fullName || profile.slug || "K").trim().charAt(0).toUpperCase() ||
      "K";
    body = (
      <div
        style={{
          fontSize: Math.round(size * 0.55),
          fontWeight: 900,
          letterSpacing: -2,
          fontFamily: "sans-serif",
        }}
      >
        {ch}
      </div>
    );
  }

  return new ImageResponse(<div style={containerStyle}>{body}</div>, {
    width: size,
    height: size,
    headers: {
      "Cache-Control": "public, max-age=300, s-maxage=300",
      "Content-Type": "image/png",
    },
  });
}
