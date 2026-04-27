import type { Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import {
  ArrowRightIcon,
  CalendarDaysIcon,
  CalendarPlusIcon,
  ClockIcon,
  MapPinIcon,
  NavigationIcon,
  TicketIcon,
} from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { getDb } from "@/db";
import { eventRegistrations } from "@/db/schema";
import { requireCompletedProfile } from "@/lib/auth/session";
import { getEventBySlug } from "@/lib/data";
import {
  formatPersianDate,
  formatPersianTime,
  toPersianDigits,
} from "@/lib/persian";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

function formatICSDate(date: Date) {
  // yyyymmddThhmmssZ
  return date
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
}

function buildIcsDataUrl(event: {
  title: string;
  description: string;
  location: string;
  slug: string;
  startsAt: Date;
  endsAt: Date | null;
}) {
  const endDate =
    event.endsAt ?? new Date(event.startsAt.getTime() + 2 * 60 * 60 * 1000);
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Kioar//Event//FA",
    "BEGIN:VEVENT",
    `UID:${event.slug}@kioar`,
    `DTSTAMP:${formatICSDate(new Date())}`,
    `DTSTART:${formatICSDate(event.startsAt)}`,
    `DTEND:${formatICSDate(endDate)}`,
    `SUMMARY:${event.title.replace(/\n/g, " ")}`,
    `DESCRIPTION:${event.description.replace(/\n/g, " ")}`,
    `LOCATION:${event.location.replace(/\n/g, " ")}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  const ics = lines.join("\r\n");
  return `data:text/calendar;charset=utf-8,${encodeURIComponent(ics)}`;
}

export default async function DashboardEventDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const viewer = await requireCompletedProfile();
  const event = await getEventBySlug(slug);

  if (!event) {
    notFound();
  }

  const db = getDb();
  const registration = await db.query.eventRegistrations.findFirst({
    where: and(
      eq(eventRegistrations.eventId, event.id),
      eq(eventRegistrations.userId, viewer.user.id),
    ),
  });

  if (!registration || registration.status !== "registered") {
    notFound();
  }

  const icsUrl = buildIcsDataUrl(event);
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    event.location,
  )}`;

  const durationMs = event.endsAt
    ? event.endsAt.getTime() - event.startsAt.getTime()
    : 0;
  const durationHours = durationMs
    ? Math.round(durationMs / (1000 * 60 * 60))
    : null;

  const now = Date.now();
  const hasStarted = event.startsAt.getTime() <= now;
  const isPast = event.endsAt
    ? event.endsAt.getTime() < now
    : event.startsAt.getTime() + 4 * 60 * 60 * 1000 < now;

  return (
    <div className="section-shell space-y-8 py-6">
      <Link
        href={"/dashboard/events" as Route}
        className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground"
      >
        <ArrowRightIcon className="size-3.5" />
        بازگشت به لیست رویدادها
      </Link>

      {/* Timing hero — the visual main */}
      <section className="relative overflow-hidden rounded-4xl border border-primary/20 bg-linear-to-b from-primary/10 via-primary/5 to-transparent p-6 sm:p-8">
        <div className="flex flex-col gap-3">
          <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-primary/12 px-3 py-1 text-xs font-semibold text-primary">
            <TicketIcon className="size-3.5" />
            {isPast
              ? "رویداد گذشته"
              : hasStarted
                ? "در حال برگزاری"
                : "ثبت‌نام شما تأیید شده"}
          </span>
          <h1 className="text-2xl font-bold sm:text-3xl">{event.title}</h1>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="flex items-start gap-3 rounded-3xl bg-background/70 p-4 border border-border">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <CalendarDaysIcon className="size-5" />
            </span>
            <div className="min-w-0 space-y-0.5">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase">
                تاریخ برگزاری
              </p>
              <p className="text-lg font-bold leading-tight">
                {formatPersianDate(event.startsAt)}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-3xl bg-background/70 p-4 border border-border">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <ClockIcon className="size-5" />
            </span>
            <div className="min-w-0 space-y-0.5">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase">
                ساعت
              </p>
              <p className="text-lg font-bold leading-tight">
                {formatPersianTime(event.startsAt)}
                {event.endsAt ? (
                  <>
                    {" "}
                    <span className="text-muted-foreground">تا</span>{" "}
                    {formatPersianTime(event.endsAt)}
                  </>
                ) : null}
              </p>
              {durationHours ? (
                <p className="text-xs text-muted-foreground">
                  {toPersianDigits(durationHours)} ساعت
                </p>
              ) : null}
            </div>
          </div>
        </div>

        {!isPast ? (
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <a
              href={icsUrl}
              download={`${event.slug}.ics`}
              className={cn(
                buttonVariants({ size: "lg" }),
                "h-12 flex-1 rounded-full font-bold",
              )}
            >
              <CalendarPlusIcon className="size-4" />
              افزودن به تقویم
            </a>
            <a
              href={mapsUrl}
              target="_blank"
              rel="noreferrer noopener"
              className={cn(
                buttonVariants({ variant: "outline", size: "lg" }),
                "h-12 flex-1 rounded-full font-bold",
              )}
            >
              <NavigationIcon className="size-4" />
              مسیریابی
            </a>
          </div>
        ) : null}
      </section>

      {/* Location block */}
      <section className="space-y-3">
        <h2 className="text-sm font-bold text-muted-foreground">محل برگزاری</h2>
        <div className="flex items-start gap-3 rounded-4xl bg-card p-4 border border-border">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-muted text-foreground">
            <MapPinIcon className="size-4" />
          </span>
          <div className="min-w-0 flex-1 space-y-1">
            <p className="font-semibold">{event.location}</p>
            <a
              href={mapsUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
            >
              باز کردن در نقشه
              <NavigationIcon className="size-3" />
            </a>
          </div>
        </div>
      </section>

      {/* Description */}
      <section className="space-y-3">
        <h2 className="text-sm font-bold text-muted-foreground">
          درباره رویداد
        </h2>
        <div className="rounded-4xl bg-card p-5 border border-border">
          <p className="text-sm leading-8 whitespace-pre-line text-foreground/90">
            {event.description}
          </p>
        </div>
      </section>

      <section>
        <Link
          href={`/events/${event.slug}` as Route}
          className={cn(
            buttonVariants({ variant: "outline", size: "sm" }),
            "rounded-full",
          )}
        >
          مشاهده صفحه عمومی رویداد
        </Link>
      </section>
    </div>
  );
}
