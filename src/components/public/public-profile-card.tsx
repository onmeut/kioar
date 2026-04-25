import Image from "next/image";
import {
  AtSignIcon,
  DownloadIcon,
  PhoneIcon,
  SparklesIcon,
} from "lucide-react";

import { LinkIconBubble } from "@/components/dashboard/link-icon-picker";
import {
  PublicBookingPill,
  type PublicBookingBlockData,
} from "@/components/public/public-booking-modal";
import type { IconKey } from "@/lib/link-icons";
import { cn } from "@/lib/utils";

type PublicLink = {
  id: string;
  label: string;
  url: string;
  description?: string | null;
  imageUrl?: string | null;
  iconKey?: IconKey | null;
  iconUrl?: string | null;
  sortOrder?: number;
};

export type PublicProfileCardData = {
  fullName: string | null;
  title: string | null;
  bio: string | null;
  slug: string;
  publicPhone: string | null;
  email: string | null;
  avatarUrl: string | null;
  links: PublicLink[];
  bookingBlocks?: Array<PublicBookingBlockData & { sortOrder?: number }>;
};

function getInitials(name: string | null | undefined): string {
  if (!name) return "·";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "·";
  if (parts.length === 1) return parts[0].slice(0, 2);
  return (parts[0][0] + parts[parts.length - 1][0]).slice(0, 2);
}

/**
 * Shared visual for the public profile "card" — used on the real public
 * page and inside the dashboard live preview so what the user sees in the
 * editor is exactly what visitors see.
 *
 * Only the visual card; the host page is responsible for the outer chrome
 * (logo, theme toggle, share button, QR, footer).
 */
export function PublicProfileCard({
  profile,
  topSlot,
  headerSlot,
  footerSlot,
  flushBottom = false,
  className,
  as = "section",
  interactive = true,
}: {
  profile: PublicProfileCardData;
  /** Optional slot rendered at the very top inside the card (e.g. logo + share row). */
  headerSlot?: React.ReactNode;
  /** Optional slot rendered above the avatar (e.g. a decorative badge). */
  topSlot?: React.ReactNode;
  /** Optional slot rendered at the very bottom of the card (e.g. branding badge). */
  footerSlot?: React.ReactNode;
  /** When true, removes bottom border-radius and bottom border so the card
   *  flushes to the viewport bottom edge. */
  flushBottom?: boolean;
  className?: string;
  as?: "section" | "div";
  /** When false, link-like elements render as non-interactive spans
   *  (used inside the editor live-preview). */
  interactive?: boolean;
}) {
  const displayName = profile.fullName || "کارت دیجیتال";
  const initials = getInitials(profile.fullName);
  const hasQuickAction = Boolean(
    profile.publicPhone || profile.email || profile.slug,
  );

  const Wrapper = as;

  return (
    <Wrapper
      dir="rtl"
      className={cn(
        "relative flex flex-col overflow-hidden bg-card p-6",
        "lg:p-8 lg:shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_0_0_0.5px_rgba(0,0,0,0.06),0_2px_8px_rgba(0,0,0,0.05),0_20px_60px_-4px_rgba(0,0,0,0.10)]",
        flushBottom
          ? "pb-[max(1.5rem,calc(env(safe-area-inset-bottom)+1.5rem))] lg:rounded-t-[2rem] lg:rounded-b-none"
          : "lg:rounded-[2rem]",
        className,
      )}
    >
      {headerSlot ? <div className="relative mb-6">{headerSlot}</div> : null}

      {topSlot ? <div className="relative mb-3">{topSlot}</div> : null}

      {/* Hero */}
      <div className="relative flex flex-col items-center text-center">
        <div className="relative size-24 overflow-hidden rounded-full bg-primary/90 text-primary-foreground sm:size-28">
          {profile.avatarUrl ? (
            <Image
              src={profile.avatarUrl}
              alt={displayName}
              fill
              className="object-cover"
              priority
              sizes="112px"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-2xl font-bold sm:text-3xl">
              {initials}
            </div>
          )}
        </div>

        <h1 className="mt-4 text-[24px] font-bold leading-tight sm:text-[28px]">
          {displayName}
        </h1>
        {profile.title ? (
          <p className="mt-1 text-sm font-semibold text-muted-foreground sm:text-[15px]">
            {profile.title}
          </p>
        ) : null}
      </div>

      {/* Quick actions — icon-only, 3 columns */}
      {hasQuickAction ? (
        <div className="relative mt-6 grid grid-cols-3 gap-2.5">
          <QuickAction
            href={
              profile.publicPhone ? `tel:${profile.publicPhone}` : undefined
            }
            icon={<PhoneIcon className="size-5" />}
            label="تماس"
            interactive={interactive}
          />
          <QuickAction
            href={profile.email ? `mailto:${profile.email}` : undefined}
            icon={<AtSignIcon className="size-5" />}
            label="ایمیل"
            interactive={interactive}
          />
          <QuickAction
            href={interactive ? `/${profile.slug}/contact.vcf` : undefined}
            icon={<DownloadIcon className="size-5" />}
            label="ذخیره"
            interactive={interactive}
          />
        </div>
      ) : null}

      {/* Bio */}
      {profile.bio ? (
        <div className="relative mt-5 rounded-2xl bg-foreground/[0.04] px-4 py-3">
          <p className="text-[14px] leading-7 text-foreground">{profile.bio}</p>
        </div>
      ) : null}

      {/* Links — Linktree-style centered pills. No URL, no icon-box. */}
      <div className="relative mt-5 space-y-2.5">
        {(() => {
          type Item =
            | { kind: "link"; sortOrder: number; link: PublicLink }
            | {
                kind: "booking";
                sortOrder: number;
                block: PublicBookingBlockData;
              };
          const bookingBlocks = profile.bookingBlocks ?? [];
          const items: Item[] = [
            ...profile.links.map((link, i) => ({
              kind: "link" as const,
              sortOrder: link.sortOrder ?? i,
              link,
            })),
            ...bookingBlocks.map((block, i) => ({
              kind: "booking" as const,
              sortOrder: block.sortOrder ?? 1_000_000 + i,
              block,
            })),
          ].sort((a, b) => a.sortOrder - b.sortOrder);

          if (!items.length) {
            return (
              <div className="flex flex-col items-center gap-2 rounded-4xl border border-dashed border-foreground/15 bg-background/60 px-6 py-8 text-center text-sm text-muted-foreground">
                <SparklesIcon className="size-5 text-primary" />
                هنوز لینکی اضافه نشده است.
              </div>
            );
          }

          return items.map((item) => {
            if (item.kind === "booking") {
              return interactive ? (
                <PublicBookingPill
                  key={`b-${item.block.id}`}
                  block={item.block}
                />
              ) : (
                <span
                  key={`b-${item.block.id}`}
                  className="relative flex w-full items-center justify-center rounded-full bg-foreground/[0.04] px-4 py-4"
                  aria-disabled
                >
                  <span className="block w-full truncate px-10 text-center text-[15px] font-bold">
                    {item.block.name}
                  </span>
                </span>
              );
            }
            const link = item.link;
            const content = (
              <>
                {link.imageUrl ? (
                  <span className="absolute inset-s-3 inline-flex size-9 shrink-0 overflow-hidden rounded-2xl bg-muted">
                    <Image
                      src={link.imageUrl}
                      alt=""
                      fill
                      sizes="36px"
                      className="object-cover"
                      unoptimized
                    />
                  </span>
                ) : (
                  <span className="absolute inset-s-3 inline-flex">
                    <LinkIconBubble
                      iconKey={link.iconKey ?? "auto"}
                      iconUrl={link.iconUrl ?? null}
                      imageUrl={null}
                      url={link.url}
                      size={36}
                      className="rounded-2xl"
                    />
                  </span>
                )}
                <span className="block w-full truncate px-10 text-center text-[15px] font-bold">
                  {link.label}
                </span>
              </>
            );

            const base =
              "relative flex w-full items-center justify-center rounded-full bg-foreground/[0.04] px-4 py-4 transition-colors";

            return interactive ? (
              <a
                key={link.id}
                href={`/api/links/${link.id}/click`}
                target="_blank"
                rel="noreferrer noopener"
                className={cn(base, "hover:bg-primary/8 active:bg-primary/12")}
              >
                {content}
              </a>
            ) : (
              <span key={link.id} className={base} aria-disabled>
                {content}
              </span>
            );
          });
        })()}
      </div>

      {footerSlot ? (
        <div className="mt-auto pt-8 text-center">{footerSlot}</div>
      ) : null}
    </Wrapper>
  );
}

function QuickAction({
  href,
  icon,
  label,
  interactive,
}: {
  href?: string;
  icon: React.ReactNode;
  label: string;
  interactive: boolean;
}) {
  const base =
    "flex flex-col gap-1 items-center justify-center py-3.5 px-2 rounded-2xl bg-foreground/[0.05] text-foreground transition-colors";

  if (!href || !interactive) {
    return (
      <span
        aria-label={label}
        className={cn(base, !href && "opacity-40")}
        aria-disabled={!href}
      >
        {icon}
        <span className="text-[11px] font-semibold">{label}</span>
      </span>
    );
  }

  return (
    <a
      href={href}
      aria-label={label}
      className={cn(
        base,
        "hover:bg-foreground/[0.09] active:bg-foreground/[0.13]",
      )}
    >
      {icon}
      <span className="text-[11px] font-semibold">{label}</span>
    </a>
  );
}
