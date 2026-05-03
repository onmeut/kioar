import { ImageResponse } from "next/og";

import { getPublicProfileBySlug } from "@/lib/data";

export const dynamic = "force-dynamic";

const SIZE = { width: 1200, height: 630 };

/**
 * Auto-generated OG image for profiles without a custom upload.
 * Black background, circular avatar, name + @username — Linktree-style.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const profile = await getPublicProfileBySlug(slug);
  if (!profile) {
    return new Response("Not found", { status: 404 });
  }

  const displayName = profile.fullName || `@${slug}`;
  const initial = displayName.trim().charAt(0).toUpperCase() || "K";

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 32,
        background: "#0a0a0a",
        color: "white",
        fontFamily: "sans-serif",
      }}
    >
      {/* Avatar circle */}
      <div
        style={{
          width: 200,
          height: 200,
          borderRadius: "50%",
          overflow: "hidden",
          border: "3px solid rgba(255,255,255,0.15)",
          background: "rgba(255,255,255,0.08)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        {profile.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={profile.avatarUrl}
            alt=""
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <span style={{ fontSize: 120, fontWeight: 900 }}>{initial}</span>
        )}
      </div>

      {/* Name + handle */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 12,
        }}
      >
        <span style={{ fontSize: 72, fontWeight: 900, lineHeight: 1 }}>
          {displayName}
        </span>
        <span
          style={{
            fontSize: 36,
            color: "rgba(255,255,255,0.45)",
            lineHeight: 1,
          }}
        >
          @{slug}
        </span>
      </div>
    </div>,
    {
      ...SIZE,
      headers: {
        "Cache-Control": "public, max-age=300, s-maxage=300",
      },
    },
  );
}
