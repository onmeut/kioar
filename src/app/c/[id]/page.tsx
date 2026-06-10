import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { CardActivateLanding } from "@/components/cards/card-activate-landing";
import { CardInactive } from "@/components/cards/card-inactive";
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
import { getDb } from "@/db";
import { profileStatsByDay } from "@/db/schema";
import { sql } from "drizzle-orm";
import { coerceAppearance } from "@/lib/appearance/types";
import { getCurrentViewer } from "@/lib/auth/session";
import { resolveCard } from "@/lib/cards/card-resolve";
import { isValidCardId } from "@/lib/cards/card-id";
import { isConnected } from "@/lib/connections";
import { getPublicProfileBySlug } from "@/lib/data";
import { tehranIsoDate } from "@/lib/date/persian";
import { isIconKey } from "@/lib/link-icons";
import { listPagesForOwner, resolveCurrentPageForOwner } from "@/lib/pages";
import { submitFormAction } from "@/lib/public-form-actions";
import { ipRateKey, getClientIp } from "@/lib/request-ip";
import { checkRateLimit } from "@/lib/rate-limit";
import { absoluteUrl } from "@/lib/site";

/**
 * Permanent physical-card route — `/c/{id}`.
 *
 * The printed QR and the locked NFC chip both encode `https://kioar.com/c/{id}`.
 * This route is STANDALONE (it never touches the `/[slug]` route) and resolves
 * the card to its bound page, then renders that page's public profile DIRECTLY
 * (HTTP 200 — never a redirect). The address bar stays `/c/{id}`, so a username
 * change never breaks a card and there are no redirect bugs.
 *
 * States:
 *   - assigned   → render the bound page's profile inline.
 *   - unassigned → "activate this card" landing (gift-card activation-on-tap).
 *   - dead       → "card inactive / not found".
 *
 * Caching: resolution is via the slug-keyed `getPublicProfileBySlug` cache
 * (shared with `/[slug]`), plus a small `id → slug` cache in `card-resolve.ts`.
 * No CDN — origin handles the volume. Light rate-limiting deters ID
 * enumeration.
 */

export const dynamic = "force-dynamic";

// Cards must never be indexed (the canonical content lives at /{slug}).
export const metadata: Metadata = {
  robots: { index: false, follow: false },
  title: "کی‌یو‌آر",
};

export default async function CardResolvePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // Cheap structural guard before any DB/cache work — rejects obvious junk.
  if (!isValidCardId(id)) {
    return <CardInactive />;
  }

  // Light rate-limit per IP to deter id enumeration. Generous (cards are
  // tapped by real people), fail-open if the limiter is unavailable.
  const ip = await getClientIp();
  const limit = await checkRateLimit(ipRateKey("card-tap", ip), 60, 60);
  if (!limit.allowed) {
    return <CardInactive rateLimited />;
  }

  const resolution = await resolveCard(id);

  if (resolution.kind === "dead") {
    return <CardInactive />;
  }

  if (resolution.kind === "unassigned") {
    const viewer = await getCurrentViewer();
    const pages = viewer?.user
      ? (await listPagesForOwner(viewer.user.id)).map((p) => ({
          id: p.id,
          slug: p.slug,
          fullName: p.fullName,
        }))
      : [];
    return (
      <CardActivateLanding
        cardId={id}
        isLoggedIn={Boolean(viewer?.user)}
        pages={pages}
      />
    );
  }

  // ---- assigned: render the bound page's public profile inline -------------
  const { slug } = resolution;
  const profile = await getPublicProfileBySlug(slug);

  // The card resolved to a slug but the page vanished/incomplete between the
  // two cached reads — treat as inactive rather than 404-ing the card.
  if (!profile || profile.adminDisabledAt) {
    return <CardInactive />;
  }

  // Fire-and-forget view counter (Tehran day-key, same as the slug route).
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
  const displayName = profile.fullName || "کارت دیجیتال";

  // Per-viewer connect state (must not be cached in the shared payload).
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

  const appearance = coerceAppearance(profile.appearance);
  const isDarkTheme = appearance.theme === "dark";
  const headerLogoSrc = isDarkTheme
    ? "/brand/logo-white.svg"
    : "/brand/logo.svg";

  return (
    <main
      dir="rtl"
      className="relative min-h-dvh overflow-x-hidden text-foreground"
    >
      <PageThemeProvider appearance={appearance} className="min-h-dvh w-full bg-muted">
        <IconNodesProvider value={resolveProfileIconNodes(profile)}>
        <div className="relative mx-auto flex min-h-dvh w-full max-w-145 flex-col pt-[env(safe-area-inset-top)] lg:pt-10">
          <PublicProfileCard
            className="flex-1"
            flushBottom
            connectSlot={connectSlot}
            headerSlot={
              <div className="flex items-center justify-between">
                <Link
                  href="https://kioar.com?ref=card"
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
            }}
            formSubmitAction={submitFormAction}
          />
        </div>

        {/* Desktop only: scan-on-mobile QR */}
        <DesktopMobileQr
          url={publicUrl}
          isDark={isDarkTheme}
          qrStyle={(profile.qrStyle as import("@/lib/qr/types").QrStyle | null) ?? null}
        />
        <PublicLinkClickTracker />
        </IconNodesProvider>
      </PageThemeProvider>
    </main>
  );
}
