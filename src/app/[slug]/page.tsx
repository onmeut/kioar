import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { DesktopMobileQr } from "@/components/public/desktop-mobile-qr";
import { PublicProfileCard } from "@/components/public/public-profile-card";
import { PublicProfileShareButton } from "@/components/public/public-profile-actions";
import { getDb } from "@/db";
import { profileStatsByDay } from "@/db/schema";
import { sql } from "drizzle-orm";
import { getPublicProfileBySlug } from "@/lib/data";
import { isIconKey } from "@/lib/link-icons";
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
    return { title: "کارت پیدا نشد" };
  }

  return {
    title: `${profile.fullName} | کارت دیجیتال`,
    description: profile.bio || "کارت دیجیتال عمومی",
    openGraph: {
      title: profile.fullName || "کارت دیجیتال",
      description: profile.bio || "کارت دیجیتال عمومی",
      url: absoluteUrl(`/${slug}`),
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
  const displayName = profile.fullName || "کارت دیجیتال";

  return (
    <main
      dir="rtl"
      className="relative min-h-dvh overflow-x-hidden bg-card text-foreground"
    >
      <div className="relative mx-auto flex min-h-dvh w-full max-w-[580px] flex-col pt-[env(safe-area-inset-top)] lg:pt-10">
        <PublicProfileCard
          className="flex-1"
          flushBottom
          headerSlot={
            <div className="flex items-center justify-between">
              <Link
                href="https://kioar.com?ref=profile"
                aria-label="کیوآر"
                className="tap-target inline-flex size-10 items-center justify-center rounded-full bg-foreground/[0.07] text-foreground transition-colors hover:bg-foreground/[0.12]"
              >
                <Image src="/brand/logo.svg" alt="" width={17} height={21} />
              </Link>
              <PublicProfileShareButton
                url={publicUrl}
                title={displayName}
                className="bg-foreground/[0.07] shadow-none hover:bg-foreground/[0.12]"
              />
            </div>
          }
          footerSlot={
            <Link
              href="https://kioar.com?ref=profile"
              className="inline-flex items-center gap-1.5 rounded-full border border-sidebar-border bg-sidebar px-4 py-2 text-sm font-semibold text-foreground transition-opacity hover:opacity-70"
            >
              <Image src="/brand/logo.svg" alt="" width={13} height={16} />
              <span>ساخته‌شده با کیوآر</span>
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
            links: profile.links.map((link) => ({
              id: link.id,
              label: link.label,
              url: link.url,
              description: link.description,
              imageUrl: link.imageUrl,
              iconKey: isIconKey(link.iconKey) ? link.iconKey : null,
              iconUrl: link.iconUrl,
              sortOrder: link.sortOrder,
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
              types: b.types.map((t) => ({
                id: t.id,
                title: t.title,
                durationMin: t.durationMin,
                priceAmount: t.priceAmount,
                priceCurrency: t.priceCurrency,
              })),
            })),
          }}
        />
      </div>

      {/* Desktop only: scan-on-mobile QR */}
      <DesktopMobileQr url={publicUrl} />
    </main>
  );
}
