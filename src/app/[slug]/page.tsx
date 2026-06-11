import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { DesktopMobileQr } from "@/components/public/desktop-mobile-qr";
import { KioarBadge } from "@/components/public/kioar-badge";
import { PublicConnectAction } from "@/components/public/public-connect-action";
import { PublicLinkClickTracker } from "@/components/public/public-link-click-tracker";
import { PublicProfileCard } from "@/components/public/public-profile-card";
import { PublicProfileShareButton } from "@/components/public/public-profile-actions";
import { PageThemeProvider } from "@/components/public-page/page-theme-provider";
import { IconNodesProvider } from "@/lib/icons/icon-nodes-context";
import { resolveProfileIconNodes } from "@/lib/icons/collect-icon-nodes.server";
import {
  connectToPageAction,
  disconnectFromPageAction,
} from "@/app/[slug]/connect-actions";
import { coerceAppearance } from "@/lib/appearance/types";
import { getDb } from "@/db";
import { profileStatsByDay } from "@/db/schema";
import { sql } from "drizzle-orm";
import { getCurrentViewer } from "@/lib/auth/session";
import { isConnected } from "@/lib/connections";
import { getPublicProfileBySlug } from "@/lib/data";
import { tehranIsoDate } from "@/lib/date/persian";
import { isIconKey } from "@/lib/link-icons";
import { resolveCurrentPageForOwner } from "@/lib/pages";
import { profileShareUrl } from "@/lib/profile-domains";
import { submitFormAction } from "@/lib/public-form-actions";
import { absoluteUrl } from "@/lib/site";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const profile = await getPublicProfileBySlug(slug);

  if (!profile) {
    return {
      title: "کارت پیدا نشد",
      robots: { index: false, follow: false },
    };
  }

  const displayName = profile.fullName || "کارت دیجیتال";
  const seoTitle = profile.seoTitle || displayName;
  const description =
    profile.seoDescription ||
    profile.bio ||
    `${displayName} روی کی‌یو‌آر — لینک‌ها، تماس، فرم‌ها و رزرو وقت.`;

  const canonical = profileShareUrl(slug, profile.domain);
  // Default OG image is the brand placeholder (cream bg + black logo).
  // Users can upload a custom one in page settings.
  const ogImage = profile.ogImageUrl || "/brand/og-default.png";

  const indexable = profile.indexEnabled && profile.isComplete;

  // Home-screen / installed-app name = the user's handle. Used by the
  // PWA manifest, `apple-mobile-web-app-title`, and `applicationName`.
  // We deliberately do NOT put it in `<title>` — that's the SEO/tab
  // title (full name + role). Modern iOS (14+) and Android both honour
  // `apple-mobile-web-app-title` / `manifest.name` for the home-screen
  // label, so the install dialog still shows `@username` while the
  // browser tab and search engines see the rich title.
  const homeScreenName = displayName;

  // Cache-bust the per-profile icon/manifest URLs whenever the profile
  // changes (avatar swap, color change, slug rename, etc). Without this,
  // the CDN serves yesterday's icon for up to 24 h after an avatar swap.
  const iconVersion = String(profile.updatedAt?.getTime?.() ?? "0");
  const v = (path: string) => `${path}?v=${iconVersion}`;

  return {
    metadataBase: new URL(absoluteUrl("/")),
    // Rich SEO/tab title — full name + role. The root layout's
    // `template: "%s | کی‌یو‌آر"` would normally append the brand, but
    // for public profile pages we keep it absolute so the tab reads
    // exactly what the visitor expects.
    title: { absolute: seoTitle },
    description,
    applicationName: homeScreenName,
    authors: [{ name: displayName }],
    creator: displayName,
    keywords: [displayName, profile.title ?? "", "کی‌یو‌آر", "kioar"].filter(
      Boolean,
    ) as string[],
    manifest: v(`/${slug}/manifest.webmanifest`),
    // Override the root layout's `appleWebApp` (which sets title="Kioar")
    // so installed iOS app uses the profile's handle instead.
    appleWebApp: {
      capable: true,
      statusBarStyle: "black-translucent",
      title: homeScreenName,
      startupImage: [{ url: v(`/${slug}/apple-icon.png`) }],
    },
    icons: {
      icon: [
        { url: v(`/${slug}/icon.png`), sizes: "192x192", type: "image/png" },
        {
          url: v(`/${slug}/icon-512.png`),
          sizes: "512x512",
          type: "image/png",
        },
      ],
      apple: [
        {
          url: v(`/${slug}/apple-icon.png`),
          sizes: "180x180",
          type: "image/png",
        },
      ],
      shortcut: [{ url: v(`/${slug}/icon.png`) }],
    },
    alternates: {
      canonical,
    },
    robots: indexable
      ? {
          index: true,
          follow: true,
          googleBot: {
            index: true,
            follow: true,
            "max-image-preview": "large",
            "max-snippet": -1,
            "max-video-preview": -1,
          },
        }
      : { index: false, follow: false },
    openGraph: {
      type: "profile",
      // Rich title for social/search previews — this is where the SEO
      // value lives now that `<title>` is just the handle.
      title: seoTitle,
      description,
      siteName: "کی‌یو‌آر",
      url: canonical,
      locale: "fa_IR",
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: displayName,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: seoTitle,
      description,
      images: [ogImage],
    },
    other: {
      "apple-mobile-web-app-capable": "yes",
      "apple-mobile-web-app-status-bar-style": "black-translucent",
      "apple-mobile-web-app-title": homeScreenName,
      "mobile-web-app-capable": "yes",
      "theme-color": profile.appIconColor || "#195c54",
    },
  };
}

export default async function PublicProfilePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  /*
   * Caching architecture — read this before touching this fetch.
   *
   * `getPublicProfileBySlug` is a Redis read-through cache wrapper defined
   * in `src/lib/data.ts`. It calls `withProfileCache` (see
   * `src/lib/cache/profile-cache.ts`) which:
   *
   *   1. Checks Redis for `kioar:page:v1:{slug}` (300s TTL on hits, 60s on
   *      404 sentinels). Returns the cached payload when present.
   *   2. On cache miss, runs the real multi-table DB query via
   *      `loadPublicProfileBySlug` and writes the result back to Redis.
   *   3. Fails open on any Redis error — the DB query always runs as the
   *      fallback so the page keeps rendering even if Redis is down.
   *
   * Any write path that changes what this page renders MUST call one of
   * the `invalidateProfileCache*` helpers in `src/lib/cache/profile-cache.ts`
   * after its DB transaction commits, or visitors will see stale data for
   * up to 5 minutes. The full list of required invalidation sites is
   * documented in CLAUDE.md under "Public profile cache — MANDATORY".
   *
   * This route is marked `force-dynamic` so Next.js never tries to
   * statically prerender it — the caching layer is Redis, not the
   * Next.js build cache.
   */
  const profile = await getPublicProfileBySlug(slug);

  if (!profile) {
    notFound();
  }

  if (profile.adminDisabledAt) {
    return (
      <main
        dir="rtl"
        className="flex min-h-dvh items-center justify-center bg-muted px-4 text-center"
      >
        <div className="max-w-sm space-y-3">
          <p className="text-4xl">🚫</p>
          <h1 className="text-xl font-bold text-foreground">
            این صفحه غیرفعال شده است
          </h1>
          <p className="text-sm text-muted-foreground">
            این صفحه توسط تیم پشتیبانی کی‌یو‌آر غیرفعال شده است. برای اطلاع از
            دلیل و درخواست فعال‌سازی مجدد، با پشتیبانی تماس بگیرید.
          </p>
        </div>
      </main>
    );
  }

  // Fire-and-forget: increment today's view counter without blocking the render.
  // Day key anchors to Asia/Tehran (CLAUDE.md mandates `tehranIsoDate` for
  // backend day-keys); using UTC would shift counts off-day for ~3.5 h
  // every evening for Iranian visitors.
  const today = tehranIsoDate(new Date());
  void getDb()
    .insert(profileStatsByDay)
    .values({ profileId: profile.id, statDate: today, views: 1, linkClicks: 0 })
    .onConflictDoUpdate({
      target: [profileStatsByDay.profileId, profileStatsByDay.statDate],
      set: { views: sql`${profileStatsByDay.views} + 1` },
    })
    .catch(() => undefined);

  const publicUrl = absoluteUrl(`/${slug}`);
  const canonicalUrl = profileShareUrl(slug, profile.domain);
  const displayName = profile.fullName || "کارت دیجیتال";

  // Connect state.
  //
  // Per-viewer, so it must NOT live in the Redis-cached `profile` payload
  // (every visitor would see the same answer otherwise). One small extra
  // read for logged-in viewers; anonymous viewers skip the DB hit
  // entirely and just render the unconnected button.
  //
  // The owner viewing their own page gets no Connect tile at all — the
  // public profile card's grid auto-collapses when `connectSlot` is
  // omitted, so it doesn't leave a gap.
  const viewer = await getCurrentViewer();
  let connectSlot: React.ReactNode = null;
  if (viewer?.user.id !== profile.userId) {
    let connected = false;
    if (viewer) {
      const viewerPage = await resolveCurrentPageForOwner(viewer.user.id);
      if (viewerPage) {
        connected = await isConnected(viewerPage.id, profile.id);
      }
    }
    connectSlot = (
      <PublicConnectAction
        slug={slug}
        initialState={connected ? "connected" : "unconnected"}
        connectAction={connectToPageAction}
        disconnectAction={disconnectFromPageAction}
      />
    );
  }

  // JSON-LD: ProfilePage + Person. Helps Google build a rich card and
  // surface the user's name, title, social links and contact in SERPs.
  const personJsonLd = {
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    dateCreated: profile.createdAt?.toISOString?.() ?? undefined,
    dateModified: profile.updatedAt?.toISOString?.() ?? undefined,
    mainEntity: {
      "@type": "Person",
      name: displayName,
      url: canonicalUrl,
      jobTitle: profile.title || undefined,
      description: profile.bio || profile.seoDescription || undefined,
      image: profile.avatarUrl || undefined,
      email: profile.showPublicEmail ? (profile.email || undefined) : undefined,
      telephone: profile.showPublicPhone ? (profile.publicPhone || undefined) : undefined,
      sameAs: profile.links
        .filter((l) => l.isActive && /^https?:\/\//i.test(l.url))
        .map((l) => l.url),
    },
  };

  const appearance = coerceAppearance(profile.appearance);
  // Themes where a dark logo would be near-invisible on the page bg.
  // Right now only the `dark` neutral preset needs the inversion; if we
  // ever add another dark-leaning preset (e.g. "midnight"), add its id
  // here.
  const isDarkTheme = appearance.theme === "dark";
  const headerLogoSrc = isDarkTheme ? "/brand/logo-white.svg" : "/brand/logo.svg";

  // Embed raw SVG nodes for any non-curated Tabler icons used on this page so
  // they render inline without shipping the full icon module to the client.
  const iconNodes = resolveProfileIconNodes(profile);

  return (
    <main
      dir="rtl"
      className="relative min-h-dvh overflow-x-hidden text-foreground"
    >
      <PageThemeProvider
        appearance={appearance}
        className="min-h-dvh w-full bg-muted"
      >
      <IconNodesProvider value={iconNodes}>
      <div className="relative mx-auto flex min-h-dvh w-full max-w-145 flex-col pt-[env(safe-area-inset-top)] lg:pt-10">
        <PublicProfileCard
          className="flex-1"
          flushBottom
          connectSlot={connectSlot}
          headerSlot={
            <div className="flex items-center justify-between">
              <Link
                href="https://kioar.com?ref=profile"
                aria-label="کی‌یو‌آر"
                className="tap-target inline-flex size-10 items-center justify-center rounded-full bg-foreground/[0.07] text-foreground transition-colors hover:bg-foreground/12"
              >
                <Image src={headerLogoSrc} alt="" width={17} height={19} className="h-[19px] w-auto" />
              </Link>
              <PublicProfileShareButton
                url={publicUrl}
                title={displayName}
                slug={slug}
                avatarUrl={profile.avatarUrl}
                avatarSeed={profile.avatarSeed}
                qrStyle={
                  (profile.qrStyle as
                    | import("@/lib/qr/types").QrStyle
                    | null) ?? null
                }
                className="bg-foreground/[0.07] shadow-none hover:bg-foreground/12"
              />
            </div>
          }
          footerSlot={
            <div className="flex flex-col items-center gap-3">
              <KioarBadge variant={isDarkTheme ? "dark" : "default"} />
            </div>
          }
          profile={{
            fullName: profile.fullName,
            title: profile.title,
            bio: profile.bio,
            slug,
            publicPhone: profile.showPublicPhone ? profile.publicPhone : null,
            email: profile.showPublicEmail ? profile.email : null,
            avatarUrl: profile.avatarUrl,
            avatarSeed: profile.avatarSeed,
            city: profile.city,
            links: profile.links.map((link) => ({
              id: link.id,
              label: link.label,
              url: link.url,
              description: link.description,
              imageUrl: link.imageUrl,
              iconKey: isIconKey(link.iconKey) ? link.iconKey : null,
              iconUrl: link.iconUrl,
              sortOrder: link.sortOrder,
              spotlight: link.spotlight,
              animationStyle: link.animationStyle,
            })),
            bookingBlocks: profile.bookingBlocks.map((b) => ({
              id: b.id,
              name: b.name,
              description: b.description,
              avatarUrl: b.avatarUrl,
              ownerName: profile.fullName || null,
              locationType: b.locationType,
              locationAddress: b.locationAddress,
              meetingLink: b.meetingLink,
              timezone: b.timezone,
              sortOrder: b.sortOrder,
              spotlight: b.spotlight,
              animationStyle: b.animationStyle,
              types: b.types.map((t) => ({
                id: t.id,
                title: t.title,
                durationMin: t.durationMin,
                priceAmount: t.priceAmount,
                priceCurrency: t.priceCurrency,
              })),
            })),
            formBlocks: profile.formBlocks.map((b) => ({
              id: b.id,
              name: b.name,
              intro: b.intro,
              outro: b.outro,
              sortOrder: b.sortOrder,
              spotlight: b.spotlight,
              animationStyle: b.animationStyle,
              fields: b.fields.map((f) => ({
                id: f.id,
                kind: f.kind,
                label: f.label,
                required: f.required,
                options: f.options ?? [],
              })),
            })),
            productBlocks: profile.productBlocks.map((b) => ({
              id: b.id,
              name: b.name,
              description: b.description,
              preset: b.preset,
              slug: b.slug ?? null,
              layout: b.layout,
              itemLabel: b.itemLabel,
              currency: b.currency as "IRT" | "USD" | "EUR",
              showPrices: b.showPrices,
              displayMode: b.displayMode,
              pillLabel: b.pillLabel,
              iconKey: b.iconKey ?? null,
              iconUrl: b.iconUrl ?? null,
              imageUrl: b.imageUrl ?? null,
              sortOrder: b.sortOrder,
              spotlight: b.spotlight,
              animationStyle: b.animationStyle,
              sections: b.sections.map((s) => ({
                id: s.id,
                title: s.title,
                iconKey: s.iconKey ?? null,
              })),
              items: b.items.map((it) => ({
                id: it.id,
                sectionId: it.sectionId,
                title: it.title,
                description: it.description,
                imageUrl: it.imageUrl,
                priceType: it.priceType,
                priceAmount: it.priceAmount,
                priceAmountMax: it.priceAmountMax,
                availability: it.availability,
                isFeatured: it.isFeatured ?? false,
                externalUrl: it.externalUrl,
                badge: it.badge,
                sku: it.sku,
              })),
            })),
            eventBlocks: (profile.eventBlocks ?? []).map((e) => ({
              id: e.id,
              slug: e.slug,
              pageSlug: profile.slug,
              title: e.title,
              coverUrl: e.coverUrl,
              locationType: e.locationType,
              priceType: e.priceType,
              priceToman: e.priceToman,
              startsAt: e.startsAt,
              endsAt: e.endsAt,
              timezone: e.timezone,
              spotsRemaining: e.spotsRemaining,
              isFull: e.isFull,
              sortOrder: e.sortOrder,
              spotlight: e.spotlight,
              animationStyle: e.animationStyle,
            })),
            textBlocks: (profile.textBlocks ?? []).map((t) => ({
              id: t.id,
              title: t.title,
              iconKey: isIconKey(t.iconKey) ? t.iconKey : null,
              iconUrl: t.iconUrl ?? null,
              body: t.body,
              photoUrl: t.photoUrl ?? null,
              sortOrder: t.sortOrder,
              spotlight: t.spotlight,
              animationStyle: t.animationStyle,
            })),
            mediaBlocks: (profile.mediaBlocks ?? []).map((m) => ({
              id: m.id,
              mode: m.mode,
              name: m.name,
              caption: m.caption,
              videoUrl: m.videoUrl,
              items: m.items.map((it) => ({
                id: it.id,
                kind: it.kind,
                url: it.url,
                byteSize: Number(it.byteSize),
                mime: it.mime,
                displayName: it.displayName,
                thumbnailUrl: it.thumbnailUrl,
              })),
              sortOrder: m.sortOrder,
              spotlight: m.spotlight,
              animationStyle: m.animationStyle,
            })),
          }}
          formSubmitAction={submitFormAction}
        />
      </div>

      {/* Desktop only: scan-on-mobile QR */}
      <DesktopMobileQr
        url={publicUrl}
        isDark={isDarkTheme}
        qrStyle={
          (profile.qrStyle as import("@/lib/qr/types").QrStyle | null) ?? null
        }
      />
      <PublicLinkClickTracker />
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(personJsonLd) }}
      />
      </IconNodesProvider>
      </PageThemeProvider>
    </main>
  );
}
