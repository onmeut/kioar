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
import { and, asc, desc, eq, gte, sql } from "drizzle-orm";

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
  title: { absolute: "دیسکاور کیوار — کشف بهترین صفحات" },
  description:
    "گشتن میان صفحه‌های منتشرشده روی کیوار — موسیقی، طراحی، آموزش، فروشگاه و بیشتر. صفحه‌ی محبوب بعدی‌ات اینجاست.",
  alternates: { canonical: absoluteUrl("/discover") },
  openGraph: {
    type: "website",
    title: "دیسکاور کیوار — کشف بهترین صفحات",
    description:
      "گشتن میان صفحه‌های منتشرشده روی کیوار — موسیقی، طراحی، آموزش، فروشگاه و بیشتر.",
    url: absoluteUrl("/discover"),
    siteName: "کی‌یو‌آر",
    locale: "fa_IR",
    images: ["/brand/og-default.png"],
  },
  twitter: {
    card: "summary_large_image",
    title: "دیسکاور کیوار — کشف بهترین صفحات",
    description:
      "گشتن میان صفحه‌های منتشرشده روی کیوار — موسیقی، طراحی، آموزش، فروشگاه و بیشتر.",
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
      bio: profiles.bio,
      avatarUrl: profiles.avatarUrl,
      avatarSeed: profiles.avatarSeed,
      city: profiles.city,
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
      className="relative min-h-dvh bg-[#f3f3f2] pt-[env(safe-area-inset-top)] font-sans"
    >
      {/* Floating pill navbar */}
      <div className="sticky top-4 z-30 mx-auto w-full max-w-[1080px] px-4 md:top-6 md:px-6">
        <header className="flex h-[68px] w-full items-center justify-between rounded-[34px] bg-white px-2 pe-6 shadow-[0_2px_16px_rgba(0,0,0,0.04)]">
          {/* Logo (RTL: right side) */}
          <Link
            href="/"
            aria-label="کیوار"
            className="tap-target flex items-center gap-2.5"
          >
            <Image src="/brand/logo.svg" alt="" width={20} height={24} />
            <span className="hidden text-[17px] font-black tracking-tight sm:inline">
              کیوار
            </span>
          </Link>

          {/* Center Links (Desktop only) */}
          <nav className="hidden items-center gap-8 text-[15px] font-semibold text-muted-foreground md:flex">
            <Link href="#" className="transition-colors hover:text-foreground">
              قالب‌ها
            </Link>
            <Link href="/discover" className="text-foreground transition-colors hover:text-foreground">
              دیسکاور
            </Link>
            <Link href="/pricing" className="transition-colors hover:text-foreground">
              تعرفه‌ها
            </Link>
            <Link href="#" className="transition-colors hover:text-foreground">
              آموزش
            </Link>
          </nav>

          {/* Auth (RTL: left side) */}
          <div className="flex items-center gap-2">
            <Link
              href="/auth"
              className="hidden h-12 items-center justify-center rounded-full bg-[#f3f3f2] px-6 text-[15px] font-semibold text-foreground transition-colors hover:bg-[#e9e9e8] sm:flex"
            >
              ورود
            </Link>
            <Link
              href="/auth"
              className="flex h-12 items-center justify-center rounded-full bg-[#1a1a1a] px-6 text-[15px] font-semibold text-white transition-opacity hover:opacity-90"
            >
              ثبت‌نام رایگان
            </Link>
          </div>
        </header>
      </div>

      {/* Hero — centered */}
      <section className="bg-white pb-9 pt-10 md:pb-14 md:pt-16">
        <div className="mx-auto flex w-full max-w-[1080px] flex-col items-center px-4 text-center md:px-6">
          <h1 className="text-[2.5rem] font-black leading-[1.15] tracking-tight text-foreground md:text-[4rem]">
            جامعه‌ی کیوار رو کشف کن
          </h1>
          <p className="mt-4 max-w-sm text-[16px] text-muted-foreground md:max-w-2xl md:text-[19px]">
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
                  همه دسته‌بندی‌ها
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
                  همه دسته‌بندی‌ها
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

      <div className="mx-auto w-full max-w-[1080px] px-4 py-8 md:px-6 md:py-10">
        {/* Sort */}
        <div className="mb-6 flex items-center gap-3">
          <div className="inline-flex items-center gap-1 rounded-full bg-white p-1 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
            {SORT_OPTIONS.map((s) => (
              <Link
                key={s.key}
                href={buildHref({ category, sort: s.key, page: 1 })}
                className={cn(
                  "rounded-full px-4 py-2 text-[14px] font-bold transition-colors",
                  sort === s.key
                    ? "bg-[#1a1a1a] text-white"
                    : "text-muted-foreground hover:bg-[#f3f3f2] hover:text-foreground",
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
                    bio={item.bio}
                    avatarUrl={item.avatarUrl}
                    avatarSeed={item.avatarSeed}
                    city={item.city}
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
                className="inline-flex h-11 items-center rounded-2xl border bg-white px-5 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-muted"
              >
                → قبلی
              </Link>
            ) : (
              <span className="inline-flex h-11 items-center rounded-2xl border bg-white px-5 text-sm font-medium text-muted-foreground opacity-40">
                → قبلی
              </span>
            )}
            <span className="text-[12px] text-muted-foreground">
              صفحه‌ی {pageNum}
            </span>
            {hasMore ? (
              <Link
                href={buildHref({ category, sort, page: pageNum + 1 })}
                className="inline-flex h-11 items-center rounded-2xl bg-foreground px-5 text-sm font-semibold text-background shadow-sm transition-opacity hover:opacity-85"
              >
                بعدی ←
              </Link>
            ) : (
              <span className="inline-flex h-11 items-center rounded-2xl bg-foreground px-5 text-sm font-semibold text-background opacity-30">
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
        "tap-target inline-flex h-9 items-center whitespace-nowrap rounded-full border px-4 text-[13px] font-semibold transition-colors",
        active
          ? "border-foreground bg-foreground text-background"
          : "border-border bg-white text-foreground hover:bg-muted",
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
  bio,
  avatarUrl,
  avatarSeed,
  city,
  discoverCategory,
}: {
  slug: string;
  fullName: string | null;
  title: string | null;
  bio: string | null;
  avatarUrl: string | null;
  avatarSeed: string | null;
  city: string | null;
  discoverCategory: string | null;
}) {
  const displayName = fullName?.trim() || title?.trim() || slug;
  const category = getDiscoverCategory(discoverCategory);
  
  return (
    <Link
      href={`/${slug}` as Route}
      className="group relative flex h-[280px] flex-col items-center justify-between rounded-[32px] bg-white p-6 shadow-[0_2px_12px_rgba(0,0,0,0.04)] ring-1 ring-black/5 transition-all hover:-translate-y-1 hover:shadow-[0_8px_24px_rgba(0,0,0,0.08)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black"
    >
      <div className="flex flex-col items-center text-center">
        {/* Avatar */}
        <div className="mb-5 size-[96px] overflow-hidden rounded-full shadow-sm ring-1 ring-black/5">
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
        <h2 className="line-clamp-1 text-[20px] font-black tracking-tight text-foreground">
          {displayName}
        </h2>
        {category && (
          <p className="mt-1 text-[15px] font-semibold text-muted-foreground/80">
            {category.label}
          </p>
        )}
      </div>

      {/* URL Chip */}
      <div className="mt-4 flex w-full justify-center">
        <span dir="ltr" className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-full bg-[#f3f3f2] px-4 text-[15px] font-bold text-foreground transition-colors group-hover:bg-[#e9e9e8]">
          <Image
            src="/brand/logo.svg"
            alt=""
            width={12}
            height={14}
            className="opacity-50"
          />
          <span className="inline-flex">
            <span className="opacity-40">kioar.com/</span>
            {slug}
          </span>
        </span>
      </div>
    </Link>
  );
}
