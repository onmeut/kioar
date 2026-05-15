import type { Metadata, Route } from "next";
import Image from "next/image";
import Link from "next/link";

import { DiscoverEmptyState } from "@/components/discover/discover-empty-state";
import { DiscoverSearchBar } from "@/components/discover/discover-search-bar";
import { KioarAvatar } from "@/components/shared/kioar-avatar";
import { getDb } from "@/db";
import { profiles, profileStatsByDay } from "@/db/schema";
import { tehranIsoDate } from "@/lib/date/persian";
import {
  type AccountType,
  type DiscoverCategory,
  getAllActiveCategories,
  getPopulatedDiscoverCategories,
} from "@/lib/discover";
import {
  type DiscoverCacheParams,
  withDiscoverCache,
} from "@/lib/cache/page-list-cache";
import { resolveIconEntry } from "@/lib/link-icons";
import { absoluteUrl } from "@/lib/site";
import { cn } from "@/lib/utils";
import { and, desc, eq, gte, or, ilike, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 24;
const POPULAR_WINDOW_DAYS = 30;

type SortKey = "newest" | "popular";
type TypeKey = "all" | "personal" | "business";

const SORT_OPTIONS: ReadonlyArray<{ key: SortKey; label: string }> = [
  { key: "newest", label: "جدیدترین" },
  { key: "popular", label: "محبوب‌ترین" },
];

const TYPE_OPTIONS: ReadonlyArray<{ key: TypeKey; label: string }> = [
  { key: "all", label: "همه" },
  { key: "business", label: "کسب‌وکارها" },
  { key: "personal", label: "اشخاص" },
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

function parseType(raw: string | null): TypeKey {
  if (raw === "business" || raw === "personal") return raw;
  return "all";
}

function typeToAccountType(t: TypeKey): AccountType | null {
  return t === "all" ? null : t;
}

function buildHref({
  type,
  category,
  sort,
  page,
  q,
}: {
  type: TypeKey;
  category: string | null;
  sort: SortKey;
  page: number;
  q: string | null;
}): Route {
  const params = new URLSearchParams();
  if (type !== "all") params.set("type", type);
  if (category) params.set("category", category);
  if (sort !== "newest") params.set("sort", sort);
  if (page > 1) params.set("page", String(page));
  if (q && q.trim()) params.set("q", q.trim());
  const qs = params.toString();
  return (qs ? `/discover?${qs}` : "/discover") as Route;
}

export default async function DiscoverPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const typeRaw = readParam(sp.type);
  const type = parseType(typeRaw);
  const accountType = typeToAccountType(type);

  const categoryRaw = readParam(sp.category);
  const sortRaw = readParam(sp.sort);
  const sort: SortKey = sortRaw === "popular" ? "popular" : "newest";
  const pageRaw = readParam(sp.page);
  const pageNum = Math.max(1, Number.parseInt(pageRaw ?? "1", 10) || 1);
  const offset = (pageNum - 1) * PAGE_SIZE;
  const qRaw = readParam(sp.q);
  const q = qRaw ? qRaw.trim().slice(0, 80) : "";

  const searching = q.length > 0;

  // ---------------------------------------------------------------------------
  // Data: wrapped in a read-through Redis cache.
  // Free-text queries (q != "") bypass the cache — unbounded key cardinality.
  // All other combinations of (type, category, sort, page) are cached for
  // DISCOVER_TTL_SECONDS. The cache version is bumped whenever any profile
  // mutation touches discover-visible fields.
  // ---------------------------------------------------------------------------
  const cacheParams: DiscoverCacheParams = {
    type,
    categoryRaw,
    sort,
    page: pageNum,
    q,
  };

  const { categoriesForRail, category, items, hasMore } =
    await withDiscoverCache(cacheParams, async () => {
      // Categories — needed for the filter rail and to validate the
      // `category` URL param against slugs that actually have profiles.
      const [railCategories, allActiveCategories] = await Promise.all([
        getPopulatedDiscoverCategories(accountType),
        getAllActiveCategories(),
      ]);

      const labelBySlug = new Map(
        allActiveCategories.map((c) => [c.slug, c.titleFa]),
      );

      const validSlugs = new Set(railCategories.map((c) => c.slug));
      const validatedCategory =
        categoryRaw && validSlugs.has(categoryRaw) ? categoryRaw : null;

      const db = getDb();

      const filters = and(
        eq(profiles.discoverEnabled, true),
        eq(profiles.isComplete, true),
        eq(profiles.isPublished, true),
        accountType ? eq(profiles.pageType, accountType) : undefined,
        validatedCategory
          ? eq(profiles.discoverCategory, validatedCategory)
          : undefined,
        q
          ? or(
              ilike(profiles.fullName, `%${q}%`),
              ilike(profiles.title, `%${q}%`),
              ilike(profiles.slug, `%${q}%`),
            )
          : undefined,
      );

      const sinceIso = (() => {
        const d = new Date();
        d.setUTCDate(d.getUTCDate() - POPULAR_WINDOW_DAYS);
        return tehranIsoDate(d);
      })();

      const recentViews = db
        .select({
          profileId: profileStatsByDay.profileId,
          total:
            sql<number>`coalesce(sum(${profileStatsByDay.views}), 0)::int`.as(
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
        !searching && sort === "popular"
          ? baseQuery.orderBy(
              desc(sql`coalesce(${recentViews.total}, 0)`),
              desc(profiles.createdAt),
            )
          : baseQuery.orderBy(desc(profiles.createdAt));

      const rows = await orderedQuery.limit(PAGE_SIZE + 1).offset(offset);
      const pageHasMore = rows.length > PAGE_SIZE;
      const pageItems: ResultRow[] = rows.slice(0, PAGE_SIZE).map((r) => ({
        id: r.id,
        slug: r.slug,
        fullName: r.fullName,
        title: r.title,
        avatarUrl: r.avatarUrl,
        avatarSeed: r.avatarSeed,
        categoryLabel:
          (r.discoverCategory && labelBySlug.get(r.discoverCategory)) ?? null,
      }));

      return {
        categoriesForRail: railCategories,
        category: validatedCategory,
        items: pageItems,
        hasMore: pageHasMore,
      };
    });

  const hasPrev = pageNum > 1;

  // The "preserved" querystring keeps tab/category/sort when the search bar
  // replaces the URL.
  const preservedParams = new URLSearchParams();
  if (type !== "all") preservedParams.set("type", type);
  if (category) preservedParams.set("category", category);
  if (sort !== "newest") preservedParams.set("sort", sort);
  const preservedQuery = preservedParams.toString();

  return (
    <main
      dir="rtl"
      className="relative min-h-dvh bg-muted pt-[env(safe-area-inset-top)] font-sans"
    >
      {/* Floating pill navbar */}
      <div className="sticky top-4 z-30 mx-auto w-full max-w-295 px-4 md:top-6 md:px-6">
        <header className="flex h-18 w-full items-center justify-between rounded-full bg-card pl-2 pr-6 ring-1 ring-border">
          <div className="flex items-center gap-8 md:gap-10">
            <Link
              href="/"
              aria-label="کیوآر"
              className="tap-target flex items-center gap-2.5"
            >
              <Image src="/brand/logo.svg" alt="" width={24} height={28} />
              <span className="hidden text-2xl font-bold sm:inline">کیوآر</span>
            </Link>
            <nav className="hidden items-center gap-6 md:flex md:gap-8 text-base text-muted-foreground/90 font-medium">
              <Link
                href="#"
                className="transition-colors hover:text-foreground"
              >
                قالب‌ها
              </Link>
              <Link
                href="/discover"
                className="font-bold text-foreground transition-colors hover:text-foreground"
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
          <div className="flex items-center gap-2">
            <Link
              href="/auth"
              className="hidden h-14 items-center justify-center rounded-full bg-accent px-7 text-base font-bold text-accent-foreground transition-colors hover:bg-accent/80 sm:flex"
            >
              ورود
            </Link>
            <Link
              href="/start"
              className="flex h-14 items-center justify-center rounded-full bg-foreground px-7 text-base font-bold text-background transition-colors hover:bg-foreground/90"
            >
              ثبت‌نام رایگان
            </Link>
          </div>
        </header>
      </div>

      {/* Hero */}
      <section className="pb-2 pt-12 md:pb-4 md:pt-24">
        <div className="mx-auto flex w-full max-w-295 flex-col items-center px-4 text-center md:px-6">
          <h1 className="text-4xl font-bold leading-[1.15] text-foreground md:text-6xl">
            جامعه‌ی کیوآر رو کشف کن
          </h1>
          <p className="mt-4 max-w-sm text-base text-muted-foreground md:max-w-2xl md:text-xl">
            همه‌چیزی که محبوب‌ترین سازندگان به اشتراک می‌گذارند، در یک جا.
          </p>
        </div>
      </section>

      {/* Controls: tabs + search + categories rail */}
      <section className="mx-auto w-full max-w-295 px-4 pt-8 md:px-6 md:pt-10">
        {/* Row 1: type tabs + search bar */}
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-4">
          {/* Type tabs */}
          <nav
            aria-label="نوع صفحه"
            className="inline-flex shrink-0 items-center gap-1 rounded-full bg-card p-1 ring-1 ring-border"
          >
            {TYPE_OPTIONS.map((t) => {
              const active = type === t.key;
              return (
                <Link
                  key={t.key}
                  href={buildHref({
                    type: t.key,
                    category: null,
                    sort,
                    page: 1,
                    q: q || null,
                  })}
                  className={cn(
                    "inline-flex h-10 flex-1 items-center justify-center whitespace-nowrap rounded-full px-5 text-sm font-bold transition-colors md:h-12 md:px-6 md:text-base",
                    active
                      ? "bg-foreground text-background"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                  aria-current={active ? "page" : undefined}
                >
                  {t.label}
                </Link>
              );
            })}
          </nav>

          {/* Search bar */}
          <div className="flex-1">
            <DiscoverSearchBar
              initialQuery={q}
              preservedQuery={preservedQuery}
            />
          </div>
        </div>

        {/* Row 2: category rail — single-row scrollable */}
        {categoriesForRail.length > 0 ? (
          <nav aria-label="دسته‌بندی‌ها" className="mt-4">
            <ul className="-mx-4 flex items-center gap-2 overflow-x-auto px-4 pb-2 pt-1 no-scrollbar md:-mx-6 md:px-6">
              <li className="shrink-0">
                <CategoryPill
                  href={buildHref({
                    type,
                    category: null,
                    sort,
                    page: 1,
                    q: q || null,
                  })}
                  active={category === null}
                >
                  همه
                </CategoryPill>
              </li>
              {categoriesForRail.map((c) => (
                <li key={c.slug} className="shrink-0">
                  <CategoryPill
                    href={buildHref({
                      type,
                      category: c.slug,
                      sort,
                      page: 1,
                      q: q || null,
                    })}
                    active={category === c.slug}
                  >
                    <DiscoverCategoryIcon
                      iconKey={c.iconKey}
                      className="me-1.5 size-4"
                    />
                    {c.label}
                  </CategoryPill>
                </li>
              ))}
            </ul>
          </nav>
        ) : null}
      </section>

      <div className="mx-auto w-full max-w-295 px-4 py-8 md:px-6 md:py-10">
        {/* Sort toggle — hidden during search (Meili ranks by relevance) */}
        {!searching ? (
          <div className="mb-6 flex items-center justify-center gap-3">
            <div className="inline-flex items-center gap-1 rounded-full bg-card p-1 ring-1 ring-border">
              {SORT_OPTIONS.map((s) => (
                <Link
                  key={s.key}
                  href={buildHref({
                    type,
                    category,
                    sort: s.key,
                    page: 1,
                    q: null,
                  })}
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
        ) : null}

        {/* Search status */}
        {searching ? (
          <div className="mb-6 text-center text-sm text-muted-foreground">
            نتایج جست‌وجو برای{" "}
            <span className="font-bold text-foreground">«{q}»</span>
            {items.length === 0 ? " — چیزی پیدا نشد." : null}
          </div>
        ) : null}

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
                    categoryLabel={item.categoryLabel}
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
                href={buildHref({
                  type,
                  category,
                  sort,
                  page: pageNum - 1,
                  q: q || null,
                })}
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
                href={buildHref({
                  type,
                  category,
                  sort,
                  page: pageNum + 1,
                  q: q || null,
                })}
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

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ResultRow = {
  id: string;
  slug: string;
  fullName: string | null;
  title: string | null;
  avatarUrl: string | null;
  avatarSeed: string | null;
  categoryLabel: string | null;
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function DiscoverCategoryIcon({
  iconKey,
  className,
}: {
  iconKey: string;
  className?: string;
}) {
  const entry = resolveIconEntry(iconKey, null);
  const Icon = entry.Icon;
  return <Icon className={className} />;
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
        "tap-target inline-flex h-11 items-center whitespace-nowrap rounded-full border px-5 text-sm font-medium transition-colors md:h-12 md:px-6 md:text-[15px]",
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
  categoryLabel,
}: {
  slug: string;
  fullName: string | null;
  title: string | null;
  avatarUrl: string | null;
  avatarSeed: string | null;
  categoryLabel: string | null;
}) {
  const displayName = fullName?.trim() || title?.trim() || slug;

  return (
    <Link
      href={`/${slug}` as Route}
      className="group relative flex h-full min-h-72 flex-col rounded-[32px] bg-card p-9 transition-all hover:-translate-y-1 focus-visible:outline-none"
    >
      <div className="flex flex-col items-start text-start">
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

        <div className="w-full">
          <h2 className="line-clamp-2 text-3xl font-bold leading-[1.1] text-foreground">
            {displayName}
          </h2>
          {categoryLabel && (
            <p className="mt-1.5 text-sm font-medium text-muted-foreground/80">
              {categoryLabel}
            </p>
          )}
        </div>
      </div>

      <div className="mt-6 flex-1"></div>

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
          <span className="mt-0.5 inline-flex items-center">
            <span>kioar.com/</span>
            {slug}
          </span>
        </span>
      </div>
    </Link>
  );
}
