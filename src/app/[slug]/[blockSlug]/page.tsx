import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRightIcon } from "lucide-react";

import { PageThemeProvider } from "@/components/public-page/page-theme-provider";
import { IconNodesProvider } from "@/lib/icons/icon-nodes-context";
import { resolveProfileIconNodes } from "@/lib/icons/collect-icon-nodes.server";
import { KioarBadge } from "@/components/public/kioar-badge";
import { PublicMenuPage } from "@/components/public/public-menu-page";
import { PublicServicesPage } from "@/components/public/public-services-page";
import { PublicProfileShareButton } from "@/components/public/public-profile-actions";
import type {
  PublicProductBlockData,
  PublicProductItem,
} from "@/components/public/public-product-block";
import { coerceAppearance } from "@/lib/appearance/types";
import { normalizeBlockSlug } from "@/lib/slug";
import { getPublicProfileBySlug } from "@/lib/data";
import { absoluteUrl } from "@/lib/site";

export const dynamic = "force-dynamic";

/**
 * Resolve a `{profileSlug}/{blockSlug}` pair to a product block carrying that
 * slug, off the SAME cached profile payload the main page uses (no extra read
 * path). Booking blocks with a slug fall through to the booking branch below.
 */
async function loadBlock(profileSlug: string, rawBlockSlug: string) {
  const blockSlug = normalizeBlockSlug(rawBlockSlug);
  if (!blockSlug) return null;

  const profile = await getPublicProfileBySlug(profileSlug);
  if (!profile) return null;

  const product = profile.productBlocks?.find(
    (b) => b.isActive && b.slug === blockSlug,
  );
  if (product) {
    return { kind: "product" as const, profile, block: product };
  }

  const booking = profile.bookingBlocks?.find(
    (b) => b.isActive && b.slug === blockSlug,
  );
  if (booking) {
    return { kind: "booking" as const, profile, block: booking };
  }

  return null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; blockSlug: string }>;
}): Promise<Metadata> {
  const { slug, blockSlug } = await params;
  const resolved = await loadBlock(slug, blockSlug);
  if (!resolved) return { title: "صفحه پیدا نشد", robots: { index: false } };

  const pageName = resolved.profile.fullName || "کی‌یو‌آر";
  const title = `${resolved.block.name} | ${pageName}`;
  const description =
    resolved.block.description ?? resolved.profile.seoDescription ?? undefined;

  return {
    title,
    description,
    openGraph: {
      title: resolved.block.name,
      description,
      url: absoluteUrl(`/${slug}/${blockSlug}`),
      images: resolved.profile.ogImageUrl
        ? [{ url: resolved.profile.ogImageUrl }]
        : undefined,
    },
  };
}

/** Map a DB product block (from the cached profile payload) to the public
 * render shape shared with the inline block. */
function toPublicProductBlock(
  block: NonNullable<
    Awaited<ReturnType<typeof getPublicProfileBySlug>>
  >["productBlocks"][number],
): PublicProductBlockData {
  return {
    id: block.id,
    name: block.name,
    description: block.description,
    preset: block.preset,
    slug: block.slug ?? null,
    layout: block.layout,
    itemLabel: block.itemLabel,
    currency: block.currency as PublicProductBlockData["currency"],
    showPrices: block.showPrices,
    displayMode: block.displayMode,
    pillLabel: block.pillLabel,
    iconKey: block.iconKey ?? null,
    iconUrl: block.iconUrl ?? null,
    imageUrl: block.imageUrl ?? null,
    sortOrder: block.sortOrder,
    sections: block.sections.map((s) => ({
      id: s.id,
      title: s.title,
      iconKey: s.iconKey ?? null,
    })),
    items: block.items.map(
      (it): PublicProductItem => ({
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
      }),
    ),
  };
}

export default async function PublicBlockPage({
  params,
}: {
  params: Promise<{ slug: string; blockSlug: string }>;
}) {
  const { slug, blockSlug } = await params;
  const resolved = await loadBlock(slug, blockSlug);
  if (!resolved) notFound();

  const appearance = coerceAppearance(resolved.profile.appearance);

  let content: React.ReactNode;
  if (resolved.kind === "product") {
    const data = toPublicProductBlock(resolved.block);
    // Embed nodes for any non-curated icons on this block (block + sections).
    const iconNodes = resolveProfileIconNodes({ productBlocks: [data] });
    // Default a slug-bearing product block to the menu layout unless its
    // preset says services; menu is the generic "full list" experience.
    content = (
      <IconNodesProvider value={iconNodes}>
        {data.preset === "services" ? (
          <PublicServicesPage block={data} />
        ) : (
          <PublicMenuPage block={data} />
        )}
      </IconNodesProvider>
    );
  } else {
    // Booking blocks reuse the inline booking experience full-page. Until a
    // dedicated full-page booking layout exists, send visitors to the main
    // profile where the block (and its modal) render.
    content = (
      <main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col items-center justify-center gap-4 px-4 safe-pb">
        <p className="text-center text-muted-foreground">
          برای رزرو وقت به صفحه‌ی اصلی بروید.
        </p>
        <Link
          href={`/${slug}`}
          className="inline-flex items-center gap-1.5 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground"
        >
          {resolved.block.name}
          <ArrowRightIcon className="size-4" aria-hidden />
        </Link>
      </main>
    );
  }

  const isDarkTheme = appearance.theme === "dark";
  const headerLogoSrc = isDarkTheme
    ? "/brand/logo-white.svg"
    : "/brand/logo.svg";
  const publicUrl = absoluteUrl(`/${slug}`);
  const displayName = resolved.profile.fullName || "کی‌یو‌آر";

  // Booking blocks don't get the card frame — they redirect to the main profile.
  if (resolved.kind === "booking") {
    return (
      <main
        dir="rtl"
        className="relative min-h-dvh overflow-x-hidden text-foreground"
      >
        <PageThemeProvider appearance={appearance}>{content}</PageThemeProvider>
      </main>
    );
  }

  return (
    <main
      dir="rtl"
      className="relative min-h-dvh overflow-x-hidden text-foreground"
    >
      <PageThemeProvider
        appearance={appearance}
        className="min-h-dvh w-full bg-muted"
      >
        <div className="relative mx-auto flex min-h-dvh w-full max-w-145 flex-col pt-[env(safe-area-inset-top)] lg:pt-10">
          {/* Card shell — mirrors PublicProfileCard's outer container */}
          <div className="relative flex flex-1 flex-col overflow-hidden bg-card pb-[max(1.5rem,calc(env(safe-area-inset-bottom)+1.5rem))] lg:rounded-t-[2rem] lg:shadow-card">
            {/* Header: logo + title + share */}
            <div className="relative border-b border-border/40 px-6 pt-6 pb-4 lg:px-8">
              <div className="relative flex items-center justify-between">
                {/* Block title — absolutely centered so the two buttons stay at the edges */}
                <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <span className="max-w-[55%] truncate text-center text-base font-bold">
                    {resolved.block.name}
                  </span>
                </span>
                <a
                  href={publicUrl}
                  aria-label="بازگشت به پروفایل"
                  className="tap-target inline-flex size-10 items-center justify-center rounded-full bg-foreground/[0.07] text-foreground transition-colors hover:bg-foreground/12"
                >
                  <Image
                    src={headerLogoSrc}
                    alt=""
                    width={17}
                    height={19}
                    className="h-[19px] w-auto"
                  />
                </a>
                <PublicProfileShareButton
                  url={absoluteUrl(`/${slug}/${resolved.block.slug ?? ""}`)}
                  title={`${resolved.block.name} | ${displayName}`}
                  slug={slug}
                  avatarUrl={resolved.profile.avatarUrl}
                  avatarSeed={resolved.profile.avatarSeed}
                  qrStyle={
                    (resolved.profile.qrStyle as
                      | import("@/lib/qr/types").QrStyle
                      | null) ?? null
                  }
                  className="bg-foreground/[0.07] shadow-none hover:bg-foreground/12"
                />
              </div>
            </div>

            {/* Block content */}
            {content}

            {/* Footer badge */}
            <div className="flex flex-col items-center gap-3 px-6 pt-4 pb-2 lg:px-8">
              <KioarBadge variant={isDarkTheme ? "dark" : "default"} />
            </div>
          </div>
        </div>
      </PageThemeProvider>
    </main>
  );
}
