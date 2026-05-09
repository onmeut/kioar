import type { Metadata, Route } from "next";
import Image from "next/image";
import Link from "next/link";

import { DiscoverEmptyState } from "@/components/discover/discover-empty-state";
import { KioarAvatar } from "@/components/shared/kioar-avatar";
import { getDb } from "@/db";
import { profiles, profileStatsByDay } from "@/db/schema";
import { tehranIsoDate } from "@/lib/date/persian";
import {
  DISCOVER_CATEGORIES,
  getDiscoverCategory,
  isDiscoverCategorySlug,
} from "@/lib/discover";
import { absoluteUrl } from "@/lib/site";
import { cn } from "@/lib/utils";
import { and, desc, eq, gte, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 24;
const POPULAR_WINDOW_DAYS = 30;

type SortKey = "newest" | "popular";

const SORT_OPTIONS: ReadonlyArray<{ key: SortKey; label: string }> = [
  { key: "newest", label: "جدیدترین" },
  { key: "popular", label: "محبوب‌ترین" },
];

export const metadata: Metadata = {
  metadataBase: new URL(absoluteUrl("/")),
  title: { absolute: "دیسکاور کیوآر — کشف بهترین صفحات" },
  description:
    "گشتن میان صفحه‌های منتشرشده روی کیوآر — موسیقی، طراحی، آموزش، فروشگاه و بیشتر. صفحه‌ی محبوب بعدی‌ات اینجاست.",
  alternates: { canonical: absoluteUrl("/discover") },
  openGraph: {
    type: "website",
    title: "دیسکاور کیوآر — کشف بهترین صفحات",
    description:
      "گشتن میان صفحه‌های منتشرشده روی کیوآر — موسیقی، طراحی، آموزش، فروشگاه و بیشتر.",
    url: absoluteUrl("/discover"),
    siteName: "کی‌یو‌آر",
    locale: "fa_IR",
    images: ["/brand/og-default.png"],
  },
  twitter: {
    card: "summary_large_image",
    title: "دیسکاور کیوآر — کشف بهترین صفحات",
    description:
      "گشتن میان صفحه‌های منتشرشده روی کیوآر — موسیقی، طراحی، آموزش، فروشگاه و بیشتر.",
    images: ["/brand/og-default.png"],
  },
};

type SearchParams = Record<string, string | string[] | undefined>;

function readParam(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function buildHref({
  category,
  sort,
  page,
}: {
  category: string | null;
  sort: SortKey;
  page: number;
}): Route {
  const params = new URLSearchParams();
  if (category) params.set("category", category);
  if (sort !== "newest") params.set("sort", sort);
  if (page > 1) params.set("page", String(page));
  const qs = params.toString();
  return (qs ? `/discover?${qs}` : "/discover") as Route;
}

export default async function DiscoverPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const categoryRaw = readParam(sp.category);
  const category = isDiscoverCategorySlug(categoryRaw) ? categoryRaw : null;
  const sortRaw = readParam(sp.sort);
  const sort: SortKey = sortRaw === "popular" ? "popular" : "newest";
  const pageRaw = readParam(sp.page);
  const pageNum = Math.max(1, Number.parseInt(pageRaw ?? "1", 10) || 1);
  const offset = (pageNum - 1) * PAGE_SIZE;

  const db = getDb();

  // Listing filter: opt-in + complete + published. Plan-level gating is
  // intentionally NOT applied here — Discover is product-level (anyone
  // can opt in, no entitlement).
  const filters = and(
    eq(profiles.discoverEnabled, true),
    eq(profiles.isComplete, true),
    eq(profiles.isPublished, true),
    category ? eq(profiles.discoverCategory, category) : undefined,
  );

  // Popular sort: sum of `views` from `profile_stats_by_day` over the
  // trailing 30 days (Tehran day-keys). Aggregate in a subquery so we
  // can LEFT JOIN it and still return profiles with zero recent views.
  const sinceIso = (() => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - POPULAR_WINDOW_DAYS);
    return tehranIsoDate(d);
  })();

  const recentViews = db
    .select({
      profileId: profileStatsByDay.profileId,
      total: sql<number>`coalesce(sum(${profileStatsByDay.views}), 0)::int`.as(
        "recent_views",
      ),
    })
    .from(profileStatsByDay)
    .where(gte(profileStatsByDay.statDate, sinceIso))
    .groupBy(profileStatsByDay.profileId)
    .as("recent_views");

  const baseQuery = db
    .select({
      id: profiles.id,
      slug: profiles.slug,
      fullName: profiles.fullName,
      title: profiles.title,
      avatarUrl: profiles.avatarUrl,
      avatarSeed: profiles.avatarSeed,
      discoverCategory: profiles.discoverCategory,
      createdAt: profiles.createdAt,
      recentViews: sql<number>`coalesce(${recentViews.total}, 0)::int`,
    })
    .from(profiles)
    .leftJoin(recentViews, eq(recentViews.profileId, profiles.id))
    .where(filters);

  const orderedQuery =
    sort === "popular"
      ? baseQuery.orderBy(
          desc(sql`coalesce(${recentViews.total}, 0)`),
          desc(profiles.createdAt),
        )
      : baseQuery.orderBy(desc(profiles.createdAt));

  // Fetch one extra row to know whether a "next page" exists without a
  // separate COUNT query.
  const rows = await orderedQuery.limit(PAGE_SIZE + 1).offset(offset);
  const hasMore = rows.length > PAGE_SIZE;
  const items = hasMore ? rows.slice(0, PAGE_SIZE) : rows;
  const hasPrev = pageNum > 1;

  return (
    <main
      dir="rtl"
      className="relative min-h-dvh bg-muted pt-[env(safe-area-inset-top)] font-sans"
    >
      {/* Floating pill navbar */}
      <div className="sticky top-4 z-30 mx-auto w-full max-w-295 px-4 md:top-6 md:px-6">
        <header className="flex h-18 w-full items-center justify-between rounded-full bg-card pl-2 pr-6 ring-1 ring-border">
          {/* Right Group: Logo + Nav */}
          <div className="flex items-center gap-8 md:gap-10">
            {/* Logo (RTL: right side) */}
            <Link
              href="/"
              aria-label="کیوآر"
              className="tap-target flex items-center gap-2.5"
            >
              <Image src="/brand/logo.svg" alt="" width={24} height={28} />
              <span className="hidden text-2xl font-bold sm:inline">کیوآر</span>
            </Link>

            {/* Nav Links (Desktop only) */}
            <nav className="hidden items-center gap-6 md:flex md:gap-8 text-base text-muted-foreground/90 font-medium">
              <Link
                href="#"
                className="transition-colors hover:text-foreground"
              >
                قالب‌ها
              </Link>
              <Link
                href="/discover"
                className="text-foreground transition-colors hover:text-foreground font-bold"
              >
                دیسکاور
              </Link>
              <Link
                href="/pricing"
                className="transition-colors hover:text-foreground"
              >
                تعرفه‌ها
              </Link>
              <Link
                href="#"
                className="transition-colors hover:text-foreground"
              >
                آموزش
              </Link>
            </nav>
          </div>

          {/* Left Group: Auth */}
          <div className="flex items-center gap-2">
            <Link
              href="/auth"
              className="hidden h-14 items-center justify-center rounded-full bg-accent px-7 text-base font-bold text-accent-foreground transition-colors hover:bg-accent/80 sm:flex"
            >
              ورود
            </Link>
            <Link
              href="/auth"
              className="flex h-14 items-center justify-center rounded-full bg-foreground px-7 text-base font-bold text-background transition-colors hover:bg-foreground/90"
            >
              ثبت‌نام رایگان
            </Link>
          </div>
        </header>
      </div>

      {/* Hero — centered */}
      <section className="pb-2 pt-16 md:pb-4 md:pt-29">
        <div className="mx-auto flex w-full max-w-295 flex-col items-center px-4 text-center md:px-6">
          <h1 className="text-4xl font-bold leading-[1.15] text-foreground md:text-6xl">
            جامعه‌ی کیوآر رو کشف کن
          </h1>
          <p className="mt-4 max-w-sm text-base text-muted-foreground md:max-w-2xl md:text-xl">
            همه‌چیزی که محبوب‌ترین سازندگان به اشتراک می‌گذارند، در یک جا.
          </p>

          {/* Category pills */}
          <nav aria-label="دسته‌بندی‌ها" className="mt-10 w-full">
            {/* Mobile: single-row scroll */}
            <ul className="-mx-4 flex items-center gap-2 overflow-x-auto px-4 pt-1 pb-2 no-scrollbar md:hidden">
              <li>
                <CategoryPill
                  href={buildHref({ category: null, sort, page: 1 })}
                  active={category === null}
                >
                  همه
                </CategoryPill>
              </li>
              {DISCOVER_CATEGORIES.map((c) => (
                <li key={c.slug} className="shrink-0">
                  <CategoryPill
                    href={buildHref({ category: c.slug, sort, page: 1 })}
                    active={category === c.slug}
                  >
                    <span className="me-1.5">{c.emoji}</span>
                    {c.label}
                  </CategoryPill>
                </li>
              ))}
            </ul>
            {/* Desktop: wrap + center */}
            <ul className="hidden flex-wrap justify-center gap-2 md:flex">
              <li>
                <CategoryPill
                  href={buildHref({ category: null, sort, page: 1 })}
                  active={category === null}
                >
                  همه
                </CategoryPill>
              </li>
              {DISCOVER_CATEGORIES.map((c) => (
                <li key={c.slug}>
                  <CategoryPill
                    href={buildHref({ category: c.slug, sort, page: 1 })}
                    active={category === c.slug}
                  >
                    <span className="me-1.5">{c.emoji}</span>
                    {c.label}
                  </CategoryPill>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </section>

      <div className="mx-auto w-full max-w-295 px-4 py-8 md:px-6 md:py-10">
        {/* Sort */}
        <div className="mb-6 flex justify-center items-center gap-3">
          <div className="inline-flex items-center gap-1 rounded-full bg-card p-1 ring-1 ring-border">
            {SORT_OPTIONS.map((s) => (
              <Link
                key={s.key}
                href={buildHref({ category, sort: s.key, page: 1 })}
                className={cn(
                  "rounded-full px-4 py-2 text-sm font-bold transition-colors",
                  sort === s.key
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {s.label}
              </Link>
            ))}
          </div>
        </div>

        {/* Grid */}
        <div className="mt-2">
          {items.length === 0 ? (
            <DiscoverEmptyState />
          ) : (
            <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((item) => (
                <li key={item.id}>
                  <DiscoverCard
                    slug={item.slug}
                    fullName={item.fullName}
                    title={item.title}
                    avatarUrl={item.avatarUrl}
                    avatarSeed={item.avatarSeed}
                    discoverCategory={item.discoverCategory}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Pagination */}
        {(hasPrev || hasMore) && items.length > 0 ? (
          <div className="mt-10 flex items-center justify-between gap-3">
            {hasPrev ? (
              <Link
                href={buildHref({ category, sort, page: pageNum - 1 })}
                className="inline-flex h-11 items-center rounded-2xl border border-border bg-card px-5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
              >
                → قبلی
              </Link>
            ) : (
              <span className="inline-flex h-11 items-center rounded-2xl border border-border bg-card px-5 text-sm font-medium text-muted-foreground/40">
                → قبلی
              </span>
            )}
            <span className="text-xs text-muted-foreground">
              صفحه‌ی {pageNum}
            </span>
            {hasMore ? (
              <Link
                href={buildHref({ category, sort, page: pageNum + 1 })}
                className="inline-flex h-11 items-center rounded-2xl bg-foreground px-5 text-sm font-semibold text-background transition-colors hover:bg-foreground/85"
              >
                بعدی ←
              </Link>
            ) : (
              <span className="inline-flex h-11 items-center rounded-2xl bg-foreground/30 px-5 text-sm font-semibold text-background">
                بعدی ←
              </span>
            )}
          </div>
        ) : null}
      </div>
    </main>
  );
}

function CategoryPill({
  href,
  active,
  children,
}: {
  href: Route;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "tap-target inline-flex h-12 items-center whitespace-nowrap rounded-full border px-6 text-md font-medium transition-colors",
        active
          ? "border-foreground bg-foreground text-background"
          : "border-border bg-card text-foreground hover:bg-muted",
      )}
    >
      {children}
    </Link>
  );
}

function DiscoverCard({
  slug,
  fullName,
  title,
  avatarUrl,
  avatarSeed,
  discoverCategory,
}: {
  slug: string;
  fullName: string | null;
  title: string | null;
  avatarUrl: string | null;
  avatarSeed: string | null;
  discoverCategory: string | null;
}) {
  const displayName = fullName?.trim() || title?.trim() || slug;
  const category = getDiscoverCategory(discoverCategory);

  return (
    <Link
      href={`/${slug}` as Route}
      className="group relative flex h-full min-h-72 flex-col rounded-[32px] bg-card p-9 transition-all hover:-translate-y-1 focus-visible:outline-none"
    >
      {/* Top section: Avatar and Text */}
      <div className="flex flex-col items-start text-start">
        {/* Avatar */}
        <div className="mb-5 size-24 overflow-hidden rounded-full bg-muted">
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatarUrl}
              alt=""
              className="size-full object-cover"
              loading="lazy"
            />
          ) : (
            <KioarAvatar seed={avatarSeed} size={96} />
          )}
        </div>

        {/* Content */}
        <div className="w-full">
          <h2 className="line-clamp-2 text-3xl font-bold leading-[1.1] text-foreground">
            {displayName}
          </h2>
          {category && (
            <p className="mt-1.5 text-sm font-medium text-muted-foreground/80">
              {category.label}
            </p>
          )}
        </div>
      </div>

      {/* spacer to push URL chip to the bottom */}
      <div className="flex-1 mt-6"></div>

      {/* URL Chip */}
      <div className="mt-auto flex w-full justify-start">
        <span
          dir="ltr"
          className="inline-flex h-14 items-center justify-center gap-2.5 rounded-full border border-border bg-transparent px-4 text-base font-medium text-foreground transition-colors group-hover:bg-muted"
        >
          <Image
            src="/brand/logo.svg"
            alt=""
            width={18}
            height={24}
            className="opacity-100"
          />
          <span className="inline-flex items-center mt-0.5">
            <span>kioar.com/</span>
            {slug}
          </span>
        </span>
      </div>
    </Link>
  );
}
