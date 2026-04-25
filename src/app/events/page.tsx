import type { Route } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  CalendarDaysIcon,
  CheckCircle2Icon,
  ClockIcon,
  MapPinIcon,
  TicketIcon,
  UsersIcon,
} from "lucide-react";

import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { getCurrentViewer } from "@/lib/auth/session";
import { getPublishedEvents, getRegisteredEventIds } from "@/lib/data";
import {
  formatPersianDate,
  formatPersianTime,
  toPersianDigits,
} from "@/lib/persian";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

type EventRow = Awaited<ReturnType<typeof getPublishedEvents>>[number];

function splitUpcomingPast(events: EventRow[]) {
  const now = Date.now();
  const upcoming: EventRow[] = [];
  const past: EventRow[] = [];

  for (const event of events) {
    const endTime = (event.endsAt ?? event.startsAt).getTime();
    if (endTime >= now) {
      upcoming.push(event);
    } else {
      past.push(event);
    }
  }

  upcoming.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
  past.sort((a, b) => b.startsAt.getTime() - a.startsAt.getTime());

  return { upcoming, past };
}

function EventCard({
  event,
  isRegistered,
}: {
  event: EventRow;
  isRegistered: boolean;
}) {
  const startDate = formatPersianDate(event.startsAt);
  const startTime = formatPersianTime(event.startsAt);

  return (
    <Link
      href={`/events/${event.slug}` as Route}
      className="marketing-card group relative grid gap-4 overflow-hidden p-3 transition hover:-translate-y-0.5 hover:shadow-[0_40px_80px_-50px_rgba(15,23,42,0.4)] sm:grid-cols-[14rem_1fr] sm:p-4"
    >
      <div className="relative aspect-[4/3] overflow-hidden rounded-[1.4rem] bg-[linear-gradient(135deg,#d9efe7,#f4e5c8)] sm:aspect-square">
        {event.coverUrl ? (
          <Image
            src={event.coverUrl}
            alt={event.title}
            fill
            className="object-cover transition duration-500 group-hover:scale-[1.03]"
            sizes="(min-width: 1024px) 22rem, 100vw"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground/70">
            <TicketIcon className="size-10" />
          </div>
        )}
        {isRegistered ? (
          <div className="absolute top-3 right-3">
            <Badge className="rounded-full bg-emerald-500/90 text-white shadow">
              <CheckCircle2Icon className="size-3.5" />
              ثبت‌نام شده
            </Badge>
          </div>
        ) : null}
      </div>

      <div className="flex flex-col justify-between gap-4 p-1">
        <div className="space-y-3">
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-primary">
              <CalendarDaysIcon className="size-3.5" />
              {startDate}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <ClockIcon className="size-3.5" />
              {startTime}
            </span>
          </div>

          <h3 className="text-2xl leading-tight font-bold headline-balance">
            {event.title}
          </h3>

          <p className="line-clamp-2 text-sm leading-7 text-muted-foreground">
            {event.description}
          </p>
        </div>

        <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
          <span className="inline-flex min-w-0 items-center gap-1.5">
            <MapPinIcon className="size-4 text-primary" />
            <span className="truncate">{event.location}</span>
          </span>
          <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-primary">
            مشاهده و ثبت‌نام
            <span aria-hidden>←</span>
          </span>
        </div>
      </div>
    </Link>
  );
}

export default async function EventsPage() {
  const viewer = await getCurrentViewer();
  const [events, registeredEventIds] = await Promise.all([
    getPublishedEvents(),
    viewer
      ? getRegisteredEventIds(viewer.user.id)
      : Promise.resolve(new Set<string>()),
  ]);

  const { upcoming, past } = splitUpcomingPast(events);

  return (
    <>
      <SiteHeader />

      <main className="overflow-hidden bg-[#fcfbf8] text-foreground#0f1318]">
        <section className="relative overflow-hidden border-b border-black/6">
          <div className="marketing-grid pointer-events-none absolute inset-0 opacity-65" />
          <div className="pointer-events-none absolute top-[-14%] left-[-4%] h-[28rem] w-[28rem] rounded-full bg-[radial-gradient(circle,_rgba(101,159,240,0.12),_transparent_68%)],_rgba(54,84,122,0.2),_transparent_70%)]" />
          <div className="pointer-events-none absolute right-[-6%] bottom-[-20%] h-[26rem] w-[26rem] rounded-full bg-[radial-gradient(circle,_rgba(243,201,138,0.14),_transparent_68%)],_rgba(126,90,50,0.2),_transparent_72%)]" />

          <div className="marketing-shell relative py-14 sm:py-18">
            <div className="mx-auto max-w-3xl text-center">
              <div className="marketing-pill mx-auto w-fit">
                <CalendarDaysIcon className="size-4 text-primary" />
                <span>رویدادهای کیوآر</span>
              </div>
              <h1 className="mt-6 text-5xl leading-[1.1] font-bold headline-balance sm:text-6xl">
                رویدادهایی که می‌توانید همین الآن در آن‌ها حضور داشته باشید
              </h1>
              <p className="mx-auto mt-5 max-w-2xl text-base leading-8 text-muted-foreground sm:text-lg">
                ثبت‌نام با همان شماره موبایل، ادامه ارتباط با همان پروفایل
                دیجیتال. تجربه‌ای نزدیک به{" "}
                <span className="font-semibold">Luma</span> برای جامعه
                فارسی‌زبان.
              </p>
              <div className="mt-7 flex flex-wrap items-center justify-center gap-2 text-sm text-muted-foreground">
                <span className="marketing-pill">
                  <UsersIcon className="size-4 text-primary" />
                  {toPersianDigits(events.length)} رویداد فعال
                </span>
              </div>
            </div>
          </div>
        </section>

        <section className="marketing-shell py-12 sm:py-16">
          {upcoming.length === 0 && past.length === 0 ? (
            <div className="marketing-card p-3 sm:p-4">
              <EmptyState
                icon={CalendarDaysIcon}
                title="رویدادی منتشر نشده است"
                description="وقتی رویداد جدیدی منتشر شود از همین‌جا قابل مشاهده و ثبت‌نام خواهد بود."
                cta={{
                  href: "/auth",
                  label: "ورود و آماده‌سازی کارت",
                }}
              />
            </div>
          ) : null}

          {upcoming.length > 0 ? (
            <div className="space-y-5">
              <div className="flex items-end justify-between gap-3">
                <div className="space-y-1">
                  <Badge className="rounded-full bg-primary/10 text-primary">
                    آینده
                  </Badge>
                  <h2 className="text-2xl font-bold sm:text-3xl">
                    رویدادهای پیش‌رو
                  </h2>
                </div>
                <span className="text-sm text-muted-foreground">
                  {toPersianDigits(upcoming.length)} مورد
                </span>
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                {upcoming.map((event) => (
                  <EventCard
                    key={event.id}
                    event={event}
                    isRegistered={registeredEventIds.has(event.id)}
                  />
                ))}
              </div>
            </div>
          ) : null}

          {past.length > 0 ? (
            <div className="mt-14 space-y-5">
              <div className="flex items-end justify-between gap-3">
                <div className="space-y-1">
                  <Badge className="rounded-full bg-muted text-foreground">
                    گذشته
                  </Badge>
                  <h2 className="text-2xl font-bold sm:text-3xl">
                    رویدادهای گذشته
                  </h2>
                </div>
                <span className="text-sm text-muted-foreground">
                  {toPersianDigits(past.length)} مورد
                </span>
              </div>
              <div
                className={cn(
                  "grid gap-4 opacity-85 lg:grid-cols-2",
                  "grayscale-[0.1]",
                )}
              >
                {past.map((event) => (
                  <EventCard
                    key={event.id}
                    event={event}
                    isRegistered={registeredEventIds.has(event.id)}
                  />
                ))}
              </div>
            </div>
          ) : null}

          {viewer ? null : upcoming.length > 0 ? (
            <div className="marketing-card mt-12 flex flex-col items-center gap-3 p-6 text-center sm:flex-row sm:justify-between sm:text-right">
              <div className="space-y-1">
                <h3 className="text-lg font-bold">هنوز وارد نشده‌اید؟</h3>
                <p className="text-sm leading-7 text-muted-foreground">
                  فقط با شماره موبایل وارد شوید — بعد مستقیم به ثبت‌نام رویداد
                  برمی‌گردید.
                </p>
              </div>
              <Link
                href="/auth"
                className={cn(
                  buttonVariants({ size: "lg" }),
                  "marketing-primary-button h-12 min-w-40 text-base font-bold",
                )}
              >
                ورود با پیامک
              </Link>
            </div>
          ) : null}
        </section>
      </main>

      <SiteFooter />
    </>
  );
}
