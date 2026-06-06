/**
 * Dynamic OpenGraph image for referral invite links.
 *
 * Loaded by social platforms (Telegram, WhatsApp, X, etc.) when the
 * `/r/<code>` URL is shared. The /invited page references this URL via
 * its `generateMetadata` openGraph.images entry.
 *
 * Renders inviter avatar (real upload OR a deterministic colored
 * monogram) + Persian copy + the brand wordmark in a violet→fuchsia→
 * orange gradient. 1200×630 (FB/X standard).
 */
import { ImageResponse } from "next/og";
import { eq, asc } from "drizzle-orm";

import { getDb } from "@/db";
import { profiles } from "@/db/schema";
import { getReferrerByCode } from "@/lib/referrals";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  let inviterName = "دوستت";
  let avatarUrl: string | null = null;
  let initial = "K";
  let isAffiliate = false;

  try {
    const referrer = await getReferrerByCode(code);
    if (referrer) {
      isAffiliate = referrer.code.kind === "affiliate";
      const page = await getDb().query.profiles.findFirst({
        where: eq(profiles.userId, referrer.referrer.id),
        orderBy: [asc(profiles.createdAt)],
        columns: { fullName: true, slug: true, avatarUrl: true },
      });
      if (page) {
        inviterName = page.fullName?.trim() || page.slug;
        avatarUrl = page.avatarUrl;
        const trimmed = inviterName.trim();
        initial = trimmed.length > 0 ? trimmed.charAt(0).toUpperCase() : "K";
      }
    }
  } catch {
    /* fall through to default */
  }

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: "#8b5cf6",
        color: "white",
        padding: 80,
        position: "relative",
      }}
    >
      {/* decorative dots */}
      <div
        style={{
          position: "absolute",
          top: -80,
          right: -80,
          width: 380,
          height: 380,
          borderRadius: "50%",
          background: "rgba(255,255,255,0.10)",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: -120,
          left: -60,
          width: 320,
          height: 320,
          borderRadius: "50%",
          background: "rgba(255,255,255,0.08)",
        }}
      />

      {/* Top eyebrow */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          fontSize: 22,
          fontWeight: 700,
          opacity: 0.9,
          letterSpacing: 1,
        }}
      >
        <span
          style={{
            padding: "6px 14px",
            borderRadius: 999,
            background: "rgba(255,255,255,0.18)",
            backdropFilter: "blur(8px)",
          }}
        >
          {isAffiliate ? "✨ PARTNER OFFER" : "🎁 INVITATION"}
        </span>
      </div>

      {/* Avatar + name */}
      <div
        style={{
          marginTop: 56,
          display: "flex",
          alignItems: "center",
          gap: 28,
        }}
      >
        <div
          style={{
            width: 140,
            height: 140,
            borderRadius: "50%",
            overflow: "hidden",
            border: "4px solid rgba(255,255,255,0.35)",
            background: "rgba(255,255,255,0.18)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 80,
            fontWeight: 900,
          }}
        >
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatarUrl}
              alt=""
              width={140}
              height={140}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : (
            <span>{initial}</span>
          )}
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <span style={{ fontSize: 30, opacity: 0.85, fontWeight: 600 }}>
            You&apos;re invited by
          </span>
          <span style={{ fontSize: 64, fontWeight: 900, lineHeight: 1.1 }}>
            {inviterName}
          </span>
        </div>
      </div>

      {/* Headline */}
      <div
        style={{
          marginTop: "auto",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <span
          style={{
            fontSize: 68,
            fontWeight: 900,
            lineHeight: 1.05,
            letterSpacing: -1.5,
            maxWidth: 900,
          }}
        >
          {isAffiliate
            ? "Get 3 free months of Pro on the yearly plan."
            : "Get 3 free months of Pro on the yearly plan, on me."}
        </span>
        <div
          style={{
            marginTop: 32,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <span
            style={{
              fontSize: 28,
              fontWeight: 700,
              opacity: 0.9,
            }}
          >
            kioar.com — Iranian digital business card
          </span>
          <span
            style={{
              fontSize: 36,
              fontWeight: 900,
              letterSpacing: -1,
              background: "rgba(255,255,255,0.18)",
              padding: "10px 20px",
              borderRadius: 16,
            }}
          >
            کی‌یو‌آر
          </span>
        </div>
      </div>
    </div>,
    {
      width: 1200,
      height: 630,
      headers: { "Cache-Control": "public, max-age=300, s-maxage=300" },
    },
  );
}
