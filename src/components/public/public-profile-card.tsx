import Image from "next/image";
import Link from "next/link";
import {
  AtSignIcon,
  CalendarDaysIcon,
  CalendarIcon,
  FormInputIcon,
  PhoneIcon,
  SparklesIcon,
} from "lucide-react";

import { LinkIconBubble } from "@/components/dashboard/link-icon-picker";
import {
  PublicBookingPill,
  type PublicBookingBlockData,
  type PublicBookingSlotsAction,
  type PublicBookingSubmitAction,
} from "@/components/public/public-booking-modal";
import {
  PublicFormPill,
  type PublicFormBlockData,
} from "@/components/public/public-form-modal";
import {
  PublicProductInline,
  PublicProductPill,
  type PublicProductBlockData,
} from "@/components/public/public-product-block";
import {
  PublicMediaBlock,
  type PublicMediaBlockData,
} from "@/components/public/public-media-block";
import { PublicAnimatedBlock } from "@/components/public/public-animated-block";
import { KioarAvatar } from "@/components/shared/kioar-avatar";
import type { ActionState } from "@/lib/action-state";

import {
  spotlightAnimationClassOnce,
  spotlightSortKey,
  type BlockAnimationStyle,
  type BlockSpotlight,
} from "@/lib/block-spotlight";
import type { IconKey } from "@/lib/link-icons";
import { toPersianDigits } from "@/lib/date/persian";
import { formatShamsiDateTimeInZone } from "@/lib/date/timezone";
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
  spotlight?: BlockSpotlight;
  animationStyle?: BlockAnimationStyle | null;
};

export type PublicProfileCardData = {
  fullName: string | null;
  title: string | null;
  bio: string | null;
  slug: string;
  publicPhone: string | null;
  email: string | null;
  avatarUrl: string | null;
  /** Stable seed used by the DiceBear fallback when no avatar is set. */
  avatarSeed: string | null;
  /** Free-text city — displayed under the name if available. */
  city?: string | null;
  links: PublicLink[];
  bookingBlocks?: Array<
    PublicBookingBlockData & {
      sortOrder?: number;
      spotlight?: BlockSpotlight;
      animationStyle?: BlockAnimationStyle | null;
    }
  >;
  formBlocks?: Array<
    PublicFormBlockData & {
      sortOrder?: number;
      spotlight?: BlockSpotlight;
      animationStyle?: BlockAnimationStyle | null;
    }
  >;
  productBlocks?: Array<
    PublicProductBlockData & {
      sortOrder?: number;
      spotlight?: BlockSpotlight;
      animationStyle?: BlockAnimationStyle | null;
    }
  >;
  eventBlocks?: PublicEventCardData[];
  textBlocks?: PublicTextBlockData[];
  mediaBlocks?: Array<
    PublicMediaBlockData & {
      sortOrder?: number;
      spotlight?: BlockSpotlight;
      animationStyle?: BlockAnimationStyle | null;
    }
  >;
};

/** Public-page render shape for a text block. */
export type PublicTextBlockData = {
  id: string;
  title: string | null;
  iconKey: IconKey | null;
  iconUrl: string | null;
  body: string;
  photoUrl: string | null;
  sortOrder?: number;
  spotlight?: BlockSpotlight;
  animationStyle?: BlockAnimationStyle | null;
};

/** Public-page render shape for an upcoming event card (one per event). */
export type PublicEventCardData = {
  id: string;
  slug: string;
  pageSlug: string;
  title: string;
  coverUrl: string | null;
  locationType: "physical" | "online";
  priceType: "free" | "paid";
  priceToman: number;
  startsAt: Date | string;
  endsAt: Date | string | null;
  timezone: string;
  spotsRemaining: number | null;
  isFull: boolean;
  sortOrder?: number;
  spotlight?: BlockSpotlight;
  animationStyle?: BlockAnimationStyle | null;
};

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
  connectSlot,
  flushBottom = false,
  className,
  as = "section",
  interactive = true,
  formSubmitAction,
  bookingSlotsAction,
  bookingSubmitAction,
}: {
  profile: PublicProfileCardData;
  /** Optional slot rendered at the very top inside the card (e.g. logo + share row). */
  headerSlot?: React.ReactNode;
  /** Optional slot rendered above the avatar (e.g. a decorative badge). */
  topSlot?: React.ReactNode;
  /** Optional slot rendered at the very bottom of the card (e.g. branding badge). */
  footerSlot?: React.ReactNode;
  /**
   * Quick-action tile rendered in the third slot of the actions row
   * (replaces the legacy "ذخیره" download). When omitted (editor live
   * preview, owner's own page), the third tile is skipped entirely and
   * the grid collapses to whichever of phone/email are present.
   */
  connectSlot?: React.ReactNode;
  /** When true, removes bottom border-radius and bottom border so the card
   *  flushes to the viewport bottom edge. */
  flushBottom?: boolean;
  className?: string;
  as?: "section" | "div";
  /** When false, link-like elements render as non-interactive spans
   *  (used inside the editor live-preview). */
  interactive?: boolean;
  /** Server action invoked when a visitor submits a form pill. Required
   *  whenever `profile.formBlocks` is non-empty AND `interactive` is true. */
  formSubmitAction?: (
    state: ActionState,
    formData: FormData,
  ) => Promise<ActionState>;
  /** Optional overrides for previews/tests that should use the real booking UI
   * without the production DB-backed public booking actions. */
  bookingSlotsAction?: PublicBookingSlotsAction;
  bookingSubmitAction?: PublicBookingSubmitAction;
}) {
  const displayName = profile.fullName || "کارت دیجیتال";
  const Wrapper = as;

  return (
    <Wrapper
      dir="rtl"
      className={cn(
        "relative flex flex-col overflow-hidden bg-card p-6",
        "lg:p-8 lg:shadow-card",
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
        <div className="relative size-25 overflow-hidden rounded-full bg-card">
          {profile.avatarUrl ? (
            <Image
              src={profile.avatarUrl}
              alt={displayName}
              fill
              className="object-cover"
              priority
              sizes="112px"
              // User-uploaded avatars are pre-optimized server-side via
              // sharp (≤2400px webp/png). Skip the Next image optimizer
              // to avoid `/_next/image` 400s in standalone Docker builds
              // and reduce a hop on first paint.
              unoptimized
            />
          ) : (
            <KioarAvatar seed={profile.avatarSeed} size={100} />
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
        {profile.city ? (
          <p className="mt-2 text-[12px] font-medium text-muted-foreground">
            {profile.city}
          </p>
        ) : null}
      </div>

      {/* Quick actions — phone/email show when opted in; Connect comes
          from `connectSlot` (the public route decides whether to render
          it based on viewer identity). The grid auto-sizes to however
          many tiles end up populated. */}
      {(() => {
        const tileCount =
          (profile.publicPhone ? 1 : 0) +
          (profile.email ? 1 : 0) +
          (connectSlot ? 1 : 0);
        if (tileCount === 0) return null;
        return (
          <div
            className="relative mt-6 grid gap-2.5"
            style={{
              gridTemplateColumns: `repeat(${tileCount}, minmax(0,1fr))`,
            }}
          >
            {profile.publicPhone ? (
              <QuickAction
                href={interactive ? `tel:${profile.publicPhone}` : undefined}
                icon={<PhoneIcon className="size-5" />}
                label="تماس"
                interactive={interactive}
              />
            ) : null}
            {profile.email ? (
              <QuickAction
                href={interactive ? `mailto:${profile.email}` : undefined}
                icon={<AtSignIcon className="size-5" />}
                label="ایمیل"
                interactive={interactive}
              />
            ) : null}
            {connectSlot}
          </div>
        );
      })()}

      {/* Bio */}
      {profile.bio ? (
        <div className="relative mt-5 rounded-2xl bg-foreground/4 px-4 py-3">
          <p className="text-[14px] leading-7 text-foreground">{profile.bio}</p>
        </div>
      ) : null}

      {/* Links — Linktree-style centered pills. No URL, no icon-box. */}
      <div className="relative mt-5 space-y-2.5">
        {(() => {
          type Item =
            | {
                kind: "link";
                sortOrder: number;
                link: PublicLink;
                spotlight: BlockSpotlight;
                animationStyle: BlockAnimationStyle | null;
              }
            | {
                kind: "booking";
                sortOrder: number;
                block: PublicBookingBlockData;
                spotlight: BlockSpotlight;
                animationStyle: BlockAnimationStyle | null;
              }
            | {
                kind: "form";
                sortOrder: number;
                block: PublicFormBlockData;
                spotlight: BlockSpotlight;
                animationStyle: BlockAnimationStyle | null;
              }
            | {
                kind: "product";
                sortOrder: number;
                block: PublicProductBlockData;
                spotlight: BlockSpotlight;
                animationStyle: BlockAnimationStyle | null;
              }
            | {
                kind: "event";
                sortOrder: number;
                event: PublicEventCardData;
                spotlight: BlockSpotlight;
                animationStyle: BlockAnimationStyle | null;
              }
            | {
                kind: "text";
                sortOrder: number;
                block: PublicTextBlockData;
                spotlight: BlockSpotlight;
                animationStyle: BlockAnimationStyle | null;
              }
            | {
                kind: "media";
                sortOrder: number;
                block: PublicMediaBlockData;
                spotlight: BlockSpotlight;
                animationStyle: BlockAnimationStyle | null;
              };
          const bookingBlocks = profile.bookingBlocks ?? [];
          const formBlocks = profile.formBlocks ?? [];
          const productBlocks = profile.productBlocks ?? [];
          const eventBlocks = profile.eventBlocks ?? [];
          const textBlocks = profile.textBlocks ?? [];
          const mediaBlocks = profile.mediaBlocks ?? [];
          const items: Item[] = [
            ...profile.links.map((link, i) => {
              const spotlight = link.spotlight ?? "none";
              const baseSort = link.sortOrder ?? i;
              return {
                kind: "link" as const,
                sortOrder: spotlightSortKey(spotlight, baseSort),
                link,
                spotlight,
                animationStyle: link.animationStyle ?? null,
              };
            }),
            ...bookingBlocks.map((block, i) => {
              const spotlight = block.spotlight ?? "none";
              const baseSort = block.sortOrder ?? 1_000_000 + i;
              return {
                kind: "booking" as const,
                sortOrder: spotlightSortKey(spotlight, baseSort),
                block,
                spotlight,
                animationStyle: block.animationStyle ?? null,
              };
            }),
            ...formBlocks.map((block, i) => {
              const spotlight = block.spotlight ?? "none";
              const baseSort = block.sortOrder ?? 2_000_000 + i;
              return {
                kind: "form" as const,
                sortOrder: spotlightSortKey(spotlight, baseSort),
                block,
                spotlight,
                animationStyle: block.animationStyle ?? null,
              };
            }),
            ...productBlocks.map((block, i) => {
              const spotlight = block.spotlight ?? "none";
              const baseSort = block.sortOrder ?? 3_000_000 + i;
              return {
                kind: "product" as const,
                sortOrder: spotlightSortKey(spotlight, baseSort),
                block,
                spotlight,
                animationStyle: block.animationStyle ?? null,
              };
            }),
            ...eventBlocks.map((event, i) => {
              const spotlight = event.spotlight ?? "none";
              const baseSort = event.sortOrder ?? 4_000_000 + i;
              return {
                kind: "event" as const,
                sortOrder: spotlightSortKey(spotlight, baseSort),
                event,
                spotlight,
                animationStyle: event.animationStyle ?? null,
              };
            }),
            ...textBlocks.map((block, i) => {
              const spotlight = block.spotlight ?? "none";
              const baseSort = block.sortOrder ?? 5_000_000 + i;
              return {
                kind: "text" as const,
                sortOrder: spotlightSortKey(spotlight, baseSort),
                block,
                spotlight,
                animationStyle: block.animationStyle ?? null,
              };
            }),
            ...mediaBlocks.map((block, i) => {
              const spotlight = block.spotlight ?? "none";
              const baseSort = block.sortOrder ?? 6_000_000 + i;
              return {
                kind: "media" as const,
                sortOrder: spotlightSortKey(spotlight, baseSort),
                block,
                spotlight,
                animationStyle: block.animationStyle ?? null,
              };
            }),
          ].sort((a, b) => a.sortOrder - b.sortOrder);

          if (!items.length) {
            return (
              <div className="flex flex-col items-center gap-2 rounded-4xl border border-dashed border-foreground/15 bg-background/60 px-6 py-8 text-center text-sm text-muted-foreground">
                <SparklesIcon className="size-5 text-primary" />
                هنوز لینکی اضافه نشده است.
              </div>
            );
          }

          return items.map((item, idx) => {
            const animClassOnce = spotlightAnimationClassOnce(
              item.spotlight,
              item.animationStyle,
            );
            const autoOpen = item.spotlight === "pin";
            if (item.kind === "booking") {
              return interactive ? (
                <PublicAnimatedBlock
                  key={`b-${item.block.id}`}
                  animClass={animClassOnce}
                  intervalSec={10}
                  index={idx}
                >
                  <PublicBookingPill
                    block={item.block}
                    defaultOpen={autoOpen}
                    getSlotsAction={bookingSlotsAction}
                    submitBookingAction={bookingSubmitAction}
                  />
                </PublicAnimatedBlock>
              ) : (
                <span
                  key={`b-${item.block.id}`}
                  className="relative flex w-full items-center justify-center rounded-full bg-foreground/4 px-4 py-4"
                  aria-disabled
                >
                  <span className="absolute inset-s-3 inline-flex size-9 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    {item.block.avatarUrl ? (
                      <Image
                        src={item.block.avatarUrl}
                        alt=""
                        width={36}
                        height={36}
                        className="size-full rounded-2xl object-cover"
                        unoptimized
                      />
                    ) : (
                      <CalendarIcon className="size-5" />
                    )}
                  </span>
                  <span className="block w-full truncate px-10 text-center text-[15px] font-bold">
                    {item.block.name}
                  </span>
                </span>
              );
            }
            if (item.kind === "form") {
              return interactive && formSubmitAction ? (
                <PublicAnimatedBlock
                  key={`f-${item.block.id}`}
                  animClass={animClassOnce}
                  intervalSec={10}
                  index={idx}
                >
                  <PublicFormPill
                    block={item.block}
                    submitAction={formSubmitAction}
                    defaultOpen={autoOpen}
                  />
                </PublicAnimatedBlock>
              ) : (
                <span
                  key={`f-${item.block.id}`}
                  className="relative flex w-full items-center justify-center rounded-full bg-foreground/4 px-4 py-4"
                  aria-disabled
                >
                  <span className="absolute inset-s-3 inline-flex size-9 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <FormInputIcon className="size-5" />
                  </span>
                  <span className="block w-full truncate px-10 text-center text-[15px] font-bold">
                    {item.block.name}
                  </span>
                </span>
              );
            }
            if (item.kind === "product") {
              if (item.block.displayMode === "inline") {
                return (
                  <PublicAnimatedBlock
                    key={`p-${item.block.id}`}
                    animClass={animClassOnce}
                    intervalSec={10}
                    index={idx}
                  >
                    <PublicProductInline
                      block={item.block}
                      profileSlug={profile.slug}
                    />
                  </PublicAnimatedBlock>
                );
              }
              return interactive ? (
                <PublicAnimatedBlock
                  key={`p-${item.block.id}`}
                  animClass={animClassOnce}
                  intervalSec={10}
                  index={idx}
                >
                  <PublicProductPill
                    block={item.block}
                    profileSlug={profile.slug}
                  />
                </PublicAnimatedBlock>
              ) : (
                <span
                  key={`p-${item.block.id}`}
                  className="relative flex w-full items-center justify-center rounded-full bg-foreground/4 px-4 py-4"
                  aria-disabled
                >
                  <span className="absolute inset-s-3 inline-flex size-9 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    {item.block.iconKey ||
                    item.block.iconUrl ||
                    item.block.imageUrl ? (
                      <LinkIconBubble
                        iconKey={
                          (item.block.iconKey as Parameters<
                            typeof LinkIconBubble
                          >[0]["iconKey"]) ?? "auto"
                        }
                        iconUrl={item.block.iconUrl ?? null}
                        imageUrl={item.block.imageUrl ?? null}
                        url=""
                        size={36}
                        className="rounded-2xl"
                      />
                    ) : (
                      <SparklesIcon className="size-5" />
                    )}
                  </span>
                  <span className="block w-full truncate px-10 text-center text-[15px] font-bold">
                    {item.block.pillLabel || item.block.name}
                  </span>
                </span>
              );
            }
            if (item.kind === "event") {
              const ev = item.event;
              const dateLabel = formatShamsiDateTimeInZone(
                ev.startsAt instanceof Date
                  ? ev.startsAt
                  : new Date(ev.startsAt),
                ev.timezone,
              );
              const priceLabel =
                ev.priceType === "free"
                  ? "رایگان"
                  : `${toPersianDigits(ev.priceToman.toLocaleString("en-US"))} تومان`;
              const spotLabel = ev.isFull
                ? "تکمیل ظرفیت"
                : ev.spotsRemaining != null
                  ? `${toPersianDigits(ev.spotsRemaining)} جای باقی‌مانده`
                  : null;
              const inner = (
                <span className="flex items-center gap-3">
                  <span className="relative inline-flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-primary/10 text-primary">
                    {ev.coverUrl ? (
                      <Image
                        src={ev.coverUrl}
                        alt=""
                        fill
                        sizes="56px"
                        className="object-cover"
                        unoptimized
                      />
                    ) : (
                      <CalendarDaysIcon className="size-6" />
                    )}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col text-start">
                    <span className="truncate text-[15px] font-bold">
                      {ev.title}
                    </span>
                    <span className="truncate text-xs text-muted-foreground">
                      {dateLabel}
                    </span>
                    <span className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                      <span className="rounded-full bg-foreground/6 px-2 py-0.5">
                        {priceLabel}
                      </span>
                      {spotLabel ? <span>{spotLabel}</span> : null}
                    </span>
                  </span>
                </span>
              );
              return interactive ? (
                <PublicAnimatedBlock
                  key={`e-${ev.id}`}
                  animClass={animClassOnce}
                  intervalSec={10}
                  index={idx}
                >
                  <Link
                    href={`/${ev.pageSlug}/e/${ev.slug}`}
                    className="block w-full rounded-3xl bg-foreground/4 p-3 transition-colors hover:bg-foreground/8"
                  >
                    {inner}
                  </Link>
                </PublicAnimatedBlock>
              ) : (
                <span
                  key={`e-${ev.id}`}
                  className="block w-full rounded-3xl bg-foreground/4 p-3"
                  aria-disabled
                >
                  {inner}
                </span>
              );
            }
            if (item.kind === "text") {
              const tb = item.block;
              const hasIcon = Boolean(tb.iconKey || tb.iconUrl);
              return (
                <PublicAnimatedBlock
                  key={`t-${tb.id}`}
                  animClass={animClassOnce}
                  intervalSec={10}
                  index={idx}
                >
                  <div className="w-full space-y-3 rounded-2xl bg-foreground/4 px-4 py-3 text-start">
                    {/* Icon + title row (either may be absent) */}
                    {hasIcon || tb.title ? (
                      <div className="flex items-center gap-2.5">
                        {hasIcon ? (
                          <LinkIconBubble
                            iconKey={tb.iconKey ?? "auto"}
                            iconUrl={tb.iconUrl ?? null}
                            imageUrl={null}
                            url=""
                            size={36}
                            className="rounded-2xl"
                          />
                        ) : null}
                        {tb.title ? (
                          <h3 className="min-w-0 flex-1 truncate text-[15px] font-bold text-foreground">
                            {tb.title}
                          </h3>
                        ) : null}
                      </div>
                    ) : null}

                    {/* Body */}
                    <p className="whitespace-pre-wrap break-words text-[14px] leading-7 text-foreground">
                      {tb.body}
                    </p>

                    {/* Photo — full width of the block, below the text */}
                    {tb.photoUrl ? (
                      <span className="block w-full overflow-hidden rounded-2xl bg-muted">
                        <Image
                          src={tb.photoUrl}
                          alt=""
                          width={640}
                          height={360}
                          sizes="(max-width: 640px) 100vw, 640px"
                          className="h-auto w-full object-cover"
                          unoptimized
                        />
                      </span>
                    ) : null}
                  </div>
                </PublicAnimatedBlock>
              );
            }
            if (item.kind === "media") {
              return (
                <PublicAnimatedBlock
                  key={`m-${item.block.id}`}
                  animClass={animClassOnce}
                  intervalSec={10}
                  index={idx}
                >
                  <PublicMediaBlock
                    block={item.block}
                    interactive={interactive}
                  />
                </PublicAnimatedBlock>
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
              "relative flex w-full items-center justify-center rounded-full bg-foreground/4 px-4 py-4 transition-colors";

            return (
              <PublicAnimatedBlock
                key={link.id}
                animClass={animClassOnce}
                intervalSec={10}
                index={idx}
              >
                {interactive ? (
                  <a
                    href={link.url}
                    target="_blank"
                    rel="nofollow ugc noopener noreferrer external"
                    referrerPolicy="no-referrer"
                    data-track-link-id={link.id}
                    className={cn(
                      base,
                      "hover:bg-primary/8 active:bg-primary/12",
                    )}
                  >
                    {content}
                  </a>
                ) : (
                  <span className={base} aria-disabled>
                    {content}
                  </span>
                )}
              </PublicAnimatedBlock>
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
    "flex flex-col gap-1 items-center justify-center py-3.5 px-2 rounded-2xl bg-foreground/5 text-foreground transition-colors";

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
      className={cn(base, "hover:bg-foreground/9 active:bg-foreground/13")}
    >
      {icon}
      <span className="text-[11px] font-semibold">{label}</span>
    </a>
  );
}
