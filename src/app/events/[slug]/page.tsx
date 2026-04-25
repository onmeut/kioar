import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { and, eq } from "drizzle-orm";
import {
  CalendarDaysIcon,
  CheckCircle2Icon,
  ClockIcon,
  LockIcon,
  MapPinIcon,
  ShareIcon,
  TicketIcon,
  UsersIcon,
} from "lucide-react";
import { notFound } from "next/navigation";

import { registerForEventAction } from "@/app/events/actions";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";
import { SubmitButton } from "@/components/shared/submit-button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { getDb } from "@/db";
import { eventRegistrations } from "@/db/schema";
import { getCurrentViewer } from "@/lib/auth/session";
import {
  getEventBySlug,
  getEventRecentAttendees,
  getEventRegisteredCount,
} from "@/lib/data";
import {
  formatPersianDate,
  formatPersianTime,
  toPersianDigits,
} from "@/lib/persian";
import { absoluteUrl } from "@/lib/site";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const event = await getEventBySlug(slug);

  if (!event) {
    return {
      title: "رویداد پیدا نشد",
    };
  }

  return {
    title: `${event.title} | رویداد`,
    description: event.description,
    openGraph: {
      title: event.title,
      description: event.description,
      url: absoluteUrl(`/events/${slug}`),
      images: event.coverUrl ? [{ url: event.coverUrl }] : undefined,
    },
  };
}

function initials(name: string | null) {
  if (!name) return "•";
  const parts = name.trim().split(/\s+/);
  return parts
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function eventDurationLabel(startsAt: Date, endsAt: Date | null) {
  const startDate = formatPersianDate(startsAt);
  const startTime = formatPersianTime(startsAt);

  if (!endsAt) {
    return { primary: startDate, secondary: `ساعت ${startTime}` };
  }

  const sameDay = startsAt.toDateString() === endsAt.toDateString();
  const endTime = formatPersianTime(endsAt);

  if (sameDay) {
    return {
      primary: startDate,
      secondary: `از ${startTime} تا ${endTime}`,
    };
  }

  const endDate = formatPersianDate(endsAt);
  return {
    primary: `${startDate} → ${endDate}`,
    secondary: `از ${startTime} تا ${endTime}`,
  };
}

export default async function EventPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ registered?: string }>;
}) {
  const { slug } = await params;
  const event = await getEventBySlug(slug);
  const viewer = await getCurrentViewer();
  const paramsQuery = await searchParams;

  if (!event || event.status !== "published") {
    notFound();
  }

  const db = getDb();
  const [registration, registeredCount, recentAttendees] = await Promise.all([
    viewer
      ? db.query.eventRegistrations.findFirst({
          where: and(
            eq(eventRegistrations.eventId, event.id),
            eq(eventRegistrations.userId, viewer.user.id),
          ),
        })
      : Promise.resolve(null),
    getEventRegisteredCount(event.id),
    getEventRecentAttendees(event.id, 8),
  ]);

  const isRegistered =
    Boolean(registration) && registration?.status === "registered";
  const duration = eventDurationLabel(event.startsAt, event.endsAt ?? null);
  const hasStarted = event.startsAt.getTime() <= Date.now();
  const isPast = event.endsAt
    ? event.endsAt.getTime() < Date.now()
    : event.startsAt.getTime() + 1000 * 60 * 60 * 4 < Date.now();

  return (
    <>
      <SiteHeader />

      <main className="overflow-hidden bg-[#fcfbf8] text-foreground#0f1318]">
        {/* Gradient accent backdrop */}
        <div className="relative border-b border-black/5">
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute top-[-30%] left-[-10%] h-[32rem] w-[32rem] rounded-full bg-[radial-gradient(circle,_rgba(101,159,240,0.14),_transparent_70%)],_rgba(54,84,122,0.22),_transparent_72%)]" />
            <div className="absolute right-[-10%] bottom-[-30%] h-[30rem] w-[30rem] rounded-full bg-[radial-gradient(circle,_rgba(243,201,138,0.14),_transparent_70%)],_rgba(126,90,50,0.22),_transparent_72%)]" />
          </div>

          <section className="marketing-shell relative py-10 sm:py-14 lg:py-16">
            <div className="grid gap-8 lg:grid-cols-[0.95fr_1.05fr] lg:gap-12">
              {/* Cover */}
              <div className="order-1">
                <div className="relative aspect-[4/3] overflow-hidden rounded-[2rem] bg-[linear-gradient(135deg,#d8efe5,#f3e3c4)] shadow-[0_40px_80px_-50px_rgba(15,23,42,0.35)]">
                  {event.coverUrl ? (
                    <Image
                      src={event.coverUrl}
                      alt={event.title}
                      fill
                      className="object-cover"
                      priority
                      sizes="(min-width: 1024px) 45vw, 100vw"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-muted-foreground">
                      <TicketIcon className="size-14 opacity-50" />
                    </div>
                  )}
                </div>
              </div>

              {/* Meta column */}
              <div className="order-2 space-y-6">
                <div className="flex flex-wrap items-center gap-2">
                  {isPast ? (
                    <Badge className="rounded-full bg-muted text-foreground">
                      رویداد گذشته
                    </Badge>
                  ) : hasStarted ? (
                    <Badge className="rounded-full bg-emerald-500/12 text-emerald-700">
                      در حال برگزاری
                    </Badge>
                  ) : (
                    <Badge className="rounded-full bg-primary/12 text-primary">
                      در انتظار برگزاری
                    </Badge>
                  )}
                  {isRegistered ? (
                    <Badge className="rounded-full bg-emerald-500/12 text-emerald-700">
                      <CheckCircle2Icon className="size-3.5" />
                      ثبت‌نام شما انجام شده
                    </Badge>
                  ) : null}
                </div>

                <h1 className="text-4xl leading-tight font-bold headline-balance sm:text-5xl lg:text-6xl">
                  {event.title}
                </h1>

                {/* When & Where compact card */}
                <div className="marketing-card divide-y divide-black/6 p-0">
                  <div className="flex items-center gap-4 p-5">
                    <div className="flex size-12 shrink-0 flex-col items-center justify-center rounded-2xl bg-primary/10 text-primary">
                      <CalendarDaysIcon className="size-5" />
                    </div>
                    <div className="min-w-0 space-y-0.5">
                      <p className="font-semibold">{duration.primary}</p>
                      <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <ClockIcon className="size-3.5" />
                        {duration.secondary}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 p-5">
                    <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                      <MapPinIcon className="size-5" />
                    </div>
                    <div className="min-w-0 space-y-0.5">
                      <p className="truncate font-semibold">{event.location}</p>
                      <p className="text-sm text-muted-foreground">
                        محل برگزاری رویداد
                      </p>
                    </div>
                  </div>
                </div>

                {/* Register card */}
                <div className="marketing-card p-5 sm:p-6">
                  {paramsQuery.registered === "1" ? (
                    <div className="mb-4 flex items-center gap-2 rounded-3xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700">
                      <CheckCircle2Icon className="size-4" />
                      ثبت‌نام شما انجام شد. همین کارت دیجیتال در روز رویداد
                      همراه شما خواهد بود.
                    </div>
                  ) : null}

                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground uppercase">
                        ثبت‌نام
                      </p>
                      <p className="text-lg font-bold">
                        {isPast
                          ? "این رویداد پایان یافته است"
                          : isRegistered
                            ? "شما ثبت‌نام کرده‌اید"
                            : "رایگان · با پروفایل کیوآر"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <UsersIcon className="size-4 text-primary" />
                      <span>{toPersianDigits(registeredCount)} نفر</span>
                    </div>
                  </div>

                  {isRegistered ? (
                    <Link
                      href="/dashboard"
                      className={cn(
                        buttonVariants({ size: "lg" }),
                        "marketing-primary-button h-12 w-full text-base font-bold",
                      )}
                    >
                      بازگشت به داشبورد
                    </Link>
                  ) : isPast ? (
                    <div className="flex items-center gap-2 rounded-3xl bg-background/70 border border-border px-4 py-3 text-sm text-muted-foreground">
                      <LockIcon className="size-4" />
                      ثبت‌نام بسته شده است
                    </div>
                  ) : (
                    <form action={registerForEventAction} className="space-y-3">
                      <input type="hidden" name="slug" value={event.slug} />
                      <SubmitButton
                        type="submit"
                        size="lg"
                        className="marketing-primary-button h-12 w-full text-base font-bold"
                        pendingLabel="در حال ادامه..."
                      >
                        {viewer ? "ثبت‌نام در رویداد" : "ورود و ثبت‌نام"}
                      </SubmitButton>
                      {!viewer ? (
                        <p className="text-center text-xs text-muted-foreground">
                          برای ثبت‌نام با پیامک احراز هویت می‌شوید؛ بعد همان
                          پروفایل برای رویداد استفاده می‌شود.
                        </p>
                      ) : null}
                    </form>
                  )}
                </div>

                {/* Attendees */}
                {registeredCount > 0 ? (
                  <div className="flex items-center gap-4">
                    <div className="flex -space-x-2">
                      {recentAttendees.slice(0, 5).map((person) => (
                        <Avatar
                          key={person.userId}
                          className="ring-2 ring-background"
                        >
                          {person.avatarUrl ? (
                            <AvatarImage
                              src={person.avatarUrl}
                              alt={person.fullName ?? "شرکت‌کننده"}
                            />
                          ) : null}
                          <AvatarFallback>
                            {initials(person.fullName)}
                          </AvatarFallback>
                        </Avatar>
                      ))}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {toPersianDigits(registeredCount)} نفر ثبت‌نام کرده‌اند
                    </p>
                  </div>
                ) : null}
              </div>
            </div>
          </section>
        </div>

        {/* About */}
        <section className="marketing-shell grid gap-6 py-12 lg:grid-cols-[1.6fr_1fr] lg:gap-10 lg:py-16">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="h-px flex-1 bg-black/8" />
              <Badge className="rounded-full bg-primary/10 text-primary">
                درباره رویداد
              </Badge>
              <div className="h-px flex-1 bg-black/8" />
            </div>
            <div className="marketing-card p-6 sm:p-8">
              <p className="text-base leading-9 whitespace-pre-line text-foreground/90 text-pretty sm:text-lg">
                {event.description}
              </p>
            </div>
          </div>

          <aside className="space-y-4">
            <div className="marketing-card p-5 sm:p-6">
              <p className="text-xs font-semibold text-muted-foreground uppercase">
                میزبانی
              </p>
              <div className="mt-3 flex items-center gap-3">
                <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <TicketIcon className="size-5" />
                </div>
                <div>
                  <p className="font-bold">تیم کیوآر</p>
                  <p className="text-sm text-muted-foreground">
                    کارت دیجیتال برای رویدادها و شبکه‌سازی
                  </p>
                </div>
              </div>
            </div>

            <div className="marketing-card p-5 sm:p-6">
              <p className="text-xs font-semibold text-muted-foreground uppercase">
                چرا کیوآر برای رویداد
              </p>
              <ul className="mt-3 space-y-3 text-sm leading-7 text-muted-foreground">
                <li className="flex items-start gap-2">
                  <CheckCircle2Icon className="mt-0.5 size-4 shrink-0 text-primary" />
                  ثبت‌نام با همان شماره موبایل و هویت دیجیتال شما
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2Icon className="mt-0.5 size-4 shrink-0 text-primary" />
                  QR آماده برای اسکن و شبکه‌سازی حضوری
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2Icon className="mt-0.5 size-4 shrink-0 text-primary" />
                  ادامه ارتباط بعد از رویداد از طریق پروفایل عمومی
                </li>
              </ul>
            </div>

            <Link
              href={`/events/${event.slug}` as `/events/${string}`}
              className={cn(
                buttonVariants({ variant: "outline", size: "lg" }),
                "marketing-secondary-button h-12 w-full text-base font-bold",
              )}
            >
              <ShareIcon className="size-4" />
              کپی لینک این صفحه
            </Link>
          </aside>
        </section>
      </main>

      <SiteFooter />
    </>
  );
}
