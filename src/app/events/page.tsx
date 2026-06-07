import type { Metadata, Route } from "next";
import Image from "next/image";
import Link from "next/link";

import { PublicEventCard } from "@/components/events/public-event-card";
import { listPublicEvents } from "@/lib/events/queries";
import { absoluteUrl } from "@/lib/site";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 24;

type PriceKey = "all" | "free" | "paid";
type LocationKey = "all" | "online" | "physical";

const PRICE_OPTIONS: ReadonlyArray<{ key: PriceKey; label: string }> = [
  { key: "all", label: "همه" },
  { key: "free", label: "رایگان" },
  { key: "paid", label: "غیررایگان" },
];

const LOCATION_OPTIONS: ReadonlyArray<{ key: LocationKey; label: string }> = [
  { key: "all", label: "همه" },
  { key: "physical", label: "حضوری" },
  { key: "online", label: "آنلاین" },
];

export const metadata: Metadata = {
  metadataBase: new URL(absoluteUrl("/")),
  title: { absolute: "رویدادهای کیوآر — رویدادهای پیش‌رو" },
  description:
    "گشتن میان رویدادهای منتشرشده روی کیوآر — میت‌آپ‌ها، کارگاه‌ها و رویدادهای جامعه. رویداد بعدی‌ات را اینجا پیدا کن.",
  alternates: { canonical: absoluteUrl("/events") },
  openGraph: {
    type: "website",
    title: "رویدادهای کیوآر",
    description: "رویدادهای پیش‌روی جامعهٔ کیوآر را کشف کن.",
    url: absoluteUrl("/events"),
    siteName: "کی‌یو‌آر",
    locale: "fa_IR",
  },
};

type SearchParams = Record<string, string | string[] | undefined>;

function readParam(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function buildHref({
  q,
  price,
  location,
  page,
}: {
  q: string | null;
  price: PriceKey;
  location: LocationKey;
  page: number;
}): Route {
  const params = new URLSearchParams();
  if (q && q.trim()) params.set("q", q.trim());
  if (price !== "all") params.set("price", price);
  if (location !== "all") params.set("location", location);
  if (page > 1) params.set("page", String(page));
  const qs = params.toString();
  return (qs ? `/events?${qs}` : "/events") as Route;
}

export default async function EventsDiscoveryPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const qRaw = readParam(sp.q);
  const q = qRaw ? qRaw.trim().slice(0, 80) : "";
  const priceRaw = readParam(sp.price);
  const price: PriceKey =
    priceRaw === "free" || priceRaw === "paid" ? priceRaw : "all";
  const locationRaw = readParam(sp.location);
  const location: LocationKey =
    locationRaw === "online" || locationRaw === "physical"
      ? locationRaw
      : "all";
  const pageRaw = readParam(sp.page);
  const pageNum = Math.max(1, Number.parseInt(pageRaw ?? "1", 10) || 1);

  const { items, hasMore } = await listPublicEvents({
    page: pageNum,
    pageSize: PAGE_SIZE,
    q,
    price: price === "all" ? null : price,
    location: location === "all" ? null : location,
  });

  const hasPrev = pageNum > 1;
  const cards = items.map((e) => ({
    ...e,
    startsAt: e.startsAt.toISOString(),
  }));

  return (
    <main
      dir="rtl"
      className="relative min-h-dvh bg-muted pt-[env(safe-area-inset-top)] font-sans"
    >
      {/* Floating pill navbar */}
      <div className="sticky top-4 z-30 mx-auto w-full max-w-295 px-4 md:top-6 md:px-6">
        <header className="flex h-18 w-full items-center justify-between rounded-full bg-card pl-2 pr-6 ring-1 ring-border">
          <Link
            href="/"
            aria-label="کیوآر"
            className="tap-target flex items-center gap-2.5"
          >
            <Image src="/brand/logo.svg" alt="" width={24} height={28} className="h-7 w-auto" />
            <span className="hidden text-2xl font-bold sm:inline">کیوآر</span>
          </Link>
          <div className="flex items-center gap-2">
            <Link
              href="/discover"
              className="hidden h-14 items-center justify-center rounded-full px-7 text-base font-bold text-muted-foreground transition-colors hover:text-foreground sm:flex"
            >
              دیسکاور
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
      <section className="pb-2 pt-12 md:pb-4 md:pt-20">
        <div className="mx-auto flex w-full max-w-295 flex-col items-center px-4 text-center md:px-6">
          <h1 className="text-4xl font-bold leading-[1.15] text-foreground md:text-6xl">
            رویدادهای پیش‌رو
          </h1>
          <p className="mt-4 max-w-sm text-base text-muted-foreground md:max-w-2xl md:text-xl">
            میت‌آپ‌ها و رویدادهای جامعهٔ کیوآر — رویداد بعدی‌ات را پیدا کن.
          </p>
        </div>
      </section>

      {/* Controls */}
      <section className="mx-auto w-full max-w-295 px-4 pt-8 md:px-6 md:pt-10">
        <form action="/events" className="flex flex-col gap-3">
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="جستجوی رویداد"
            inputMode="search"
            enterKeyHint="search"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            className="h-12 w-full rounded-full border border-border bg-card px-5 text-base outline-none focus:ring-2 focus:ring-foreground/20"
          />
          {/* Preserve active filters across a new search */}
          {price !== "all" ? (
            <input type="hidden" name="price" value={price} />
          ) : null}
          {location !== "all" ? (
            <input type="hidden" name="location" value={location} />
          ) : null}
        </form>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <FilterGroup
            options={PRICE_OPTIONS}
            active={price}
            hrefFor={(key) =>
              buildHref({ q: q || null, price: key, location, page: 1 })
            }
          />
          <span className="mx-1 h-5 w-px bg-border" />
          <FilterGroup
            options={LOCATION_OPTIONS}
            active={location}
            hrefFor={(key) =>
              buildHref({ q: q || null, price, location: key, page: 1 })
            }
          />
        </div>
      </section>

      <div className="mx-auto w-full max-w-295 px-4 py-8 md:px-6 md:py-10">
        {cards.length === 0 ? (
          <p className="rounded-4xl border border-dashed border-border bg-card p-12 text-center text-sm text-muted-foreground">
            {q
              ? `رویدادی برای «${q}» پیدا نشد.`
              : "فعلاً رویداد پیش‌رویی نیست."}
          </p>
        ) : (
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {cards.map((event) => (
              <li key={event.id}>
                <PublicEventCard event={event} />
              </li>
            ))}
          </ul>
        )}

        {(hasPrev || hasMore) && cards.length > 0 ? (
          <div className="mt-10 flex items-center justify-between gap-3">
            {hasPrev ? (
              <Link
                href={buildHref({
                  q: q || null,
                  price,
                  location,
                  page: pageNum - 1,
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
              صفحهٔ {pageNum}
            </span>
            {hasMore ? (
              <Link
                href={buildHref({
                  q: q || null,
                  price,
                  location,
                  page: pageNum + 1,
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

function FilterGroup<T extends string>({
  options,
  active,
  hrefFor,
}: {
  options: ReadonlyArray<{ key: T; label: string }>;
  active: T;
  hrefFor: (key: T) => Route;
}) {
  return (
    <div className="inline-flex items-center gap-1 rounded-full bg-card p-1 ring-1 ring-border">
      {options.map((o) => (
        <Link
          key={o.key}
          href={hrefFor(o.key)}
          className={cn(
            "rounded-full px-4 py-2 text-sm font-medium transition-colors",
            active === o.key
              ? "bg-foreground text-background"
              : "text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
        >
          {o.label}
        </Link>
      ))}
    </div>
  );
}
