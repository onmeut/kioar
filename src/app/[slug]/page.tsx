import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { DesktopMobileQr } from "@/components/public/desktop-mobile-qr";
import { PublicLinkClickTracker } from "@/components/public/public-link-click-tracker";
import { PublicProfileCard } from "@/components/public/public-profile-card";
import { PublicProfileShareButton } from "@/components/public/public-profile-actions";
import { getDb } from "@/db";
import { profileStatsByDay } from "@/db/schema";
import { sql } from "drizzle-orm";
import { getPublicProfileBySlug } from "@/lib/data";
import { isIconKey } from "@/lib/link-icons";
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
  const titleBase =
    profile.seoTitle ||
    (profile.title ? `${displayName} — ${profile.title}` : displayName);
  const description =
    profile.seoDescription ||
    profile.bio ||
    `${displayName} روی کی‌یو‌آر — لینک‌ها، تماس، فرم‌ها و رزرو وقت.`;

  const canonical = profileShareUrl(slug, profile.domain);
  const ogImage = profile.ogImageUrl || `/${slug}/opengraph-image`;

  const indexable = profile.indexEnabled && profile.isComplete;

  return {
    metadataBase: new URL(absoluteUrl("/")),
    title: titleBase,
    description,
    applicationName: displayName,
    authors: [{ name: displayName }],
    creator: displayName,
    keywords: [displayName, profile.title ?? "", "کی‌یو‌آر", "kioar"].filter(
      Boolean,
    ) as string[],
    manifest: `/${slug}/manifest.webmanifest`,
    icons: {
      icon: [
        { url: `/${slug}/icon.png`, sizes: "192x192", type: "image/png" },
        { url: `/${slug}/icon-512.png`, sizes: "512x512", type: "image/png" },
      ],
      apple: [
        { url: `/${slug}/apple-icon.png`, sizes: "180x180", type: "image/png" },
      ],
      shortcut: [{ url: `/${slug}/icon.png` }],
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
      title: titleBase,
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
      title: titleBase,
      description,
      images: [ogImage],
    },
    other: {
      "apple-mobile-web-app-capable": "yes",
      "apple-mobile-web-app-status-bar-style": "black-translucent",
      "apple-mobile-web-app-title": displayName,
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
  const profile = await getPublicProfileBySlug(slug);

  if (!profile) {
    notFound();
  }

  // Fire-and-forget: increment today's view counter without blocking the render.
  const today = new Date().toISOString().slice(0, 10);
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
      email: profile.email || undefined,
      telephone: profile.publicPhone || undefined,
      sameAs: profile.links
        .filter((l) => l.isActive && /^https?:\/\//i.test(l.url))
        .map((l) => l.url),
    },
  };

  return (
    <main
      dir="rtl"
      className="relative min-h-dvh overflow-x-hidden bg-card text-foreground"
    >
      <div className="relative mx-auto flex min-h-dvh w-full max-w-145 flex-col pt-[env(safe-area-inset-top)] lg:pt-10">
        <PublicProfileCard
          className="flex-1"
          flushBottom
          headerSlot={
            <div className="flex items-center justify-between">
              <Link
                href="https://kioar.com?ref=profile"
                aria-label="کی‌یو‌آر"
                className="tap-target inline-flex size-10 items-center justify-center rounded-full bg-foreground/[0.07] text-foreground transition-colors hover:bg-foreground/12"
              >
                <Image src="/brand/logo.svg" alt="" width={17} height={21} />
              </Link>
              <PublicProfileShareButton
                url={publicUrl}
                title={displayName}
                className="bg-foreground/[0.07] shadow-none hover:bg-foreground/12"
              />
            </div>
          }
          footerSlot={
            <Link
              href="https://kioar.com?ref=profile"
              className="inline-flex items-center gap-1.5 rounded-full border border-sidebar-border bg-sidebar px-4 py-2 text-sm font-semibold text-foreground transition-opacity hover:opacity-70"
            >
              <Image src="/brand/logo.svg" alt="" width={13} height={16} />
              <span>ساخته‌شده با کی‌یو‌آر</span>
            </Link>
          }
          profile={{
            fullName: profile.fullName,
            title: profile.title,
            bio: profile.bio,
            slug,
            publicPhone: profile.publicPhone,
            email: profile.email,
            avatarUrl: profile.avatarUrl,
            avatarSeed: profile.avatarSeed,
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
      <DesktopMobileQr url={publicUrl} />
      <PublicLinkClickTracker />
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(personJsonLd) }}
      />
    </main>
  );
}
