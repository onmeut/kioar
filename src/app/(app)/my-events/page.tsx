import type { Route } from "next";
import Link from "next/link";
import {
  CalendarDaysIcon,
  ClockIcon,
  MapPinIcon,
  TicketIcon,
} from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { requireCompletedProfile } from "@/lib/auth/session";
import { getDashboardRegistrations } from "@/lib/data";
import {
  formatPersianDate,
  formatPersianTime,
  toPersianDigits,
} from "@/lib/persian";

export const dynamic = "force-dynamic";

export default async function DashboardEventsPage() {
  const viewer = await requireCompletedProfile();
  const registrations = await getDashboardRegistrations(viewer.user.id);

  if (registrations.length === 0) {
    return (
      <div className="section-shell py-6">
        <EmptyState
          icon={CalendarDaysIcon}
          title="هنوز در رویدادی ثبت‌نام نکرده‌اید"
          description="رویدادهای فعال کی‌یو‌آر را مرور کنید و با همان پروفایل ثبت‌نام کنید."
          cta={{ href: "/events", label: "مشاهده رویدادها" }}
        />
      </div>
    );
  }

  const now = Date.now();
  const upcoming = registrations.filter(
    (event) =>
      (event.endsAt ?? event.startsAt).getTime() +
        (event.endsAt ? 0 : 4 * 60 * 60 * 1000) >=
      now,
  );
  const past = registrations.filter((event) => !upcoming.includes(event));

  return (
    <div className="section-shell space-y-8 py-6">
      <section className="space-y-3">
        <header className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-muted-foreground">
            رویدادهای پیشِ رو
          </h2>
          <span className="text-xs text-muted-foreground">
            {toPersianDigits(upcoming.length)} مورد
          </span>
        </header>
        {upcoming.length === 0 ? (
          <p className="rounded-4xl border border-dashed border-border/70 bg-background/50 p-4 text-center text-sm text-muted-foreground">
            رویداد آینده‌ای در لیست شما نیست.
          </p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {upcoming.map((event) => (
              <EventRow key={event.registrationId} event={event} />
            ))}
          </ul>
        )}
      </section>

      {past.length > 0 ? (
        <section className="space-y-3">
          <header>
            <h2 className="text-sm font-bold text-muted-foreground">
              رویدادهای گذشته
            </h2>
          </header>
          <ul className="grid gap-3 sm:grid-cols-2">
            {past.map((event) => (
              <EventRow key={event.registrationId} event={event} muted />
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function EventRow({
  event,
  muted = false,
}: {
  event: Awaited<ReturnType<typeof getDashboardRegistrations>>[number];
  muted?: boolean;
}) {
  return (
    <li>
      <Link
        href={`/my-events/${event.slug}` as Route}
        className="group flex h-full flex-col gap-3 rounded-4xl bg-card p-4 border border-border transition-colors hover:bg-muted/40"
      >
        <div className="flex items-center gap-2">
          <span className="flex size-9 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <TicketIcon className="size-4" />
          </span>
          <h3
            className={`flex-1 truncate text-sm font-bold ${muted ? "text-muted-foreground" : ""}`}
          >
            {event.title}
          </h3>
        </div>
        <div className="space-y-1 text-xs text-muted-foreground">
          <p className="flex items-center gap-1.5">
            <CalendarDaysIcon className="size-3.5" />
            {formatPersianDate(event.startsAt)}
          </p>
          <p className="flex items-center gap-1.5">
            <ClockIcon className="size-3.5" />
            ساعت {formatPersianTime(event.startsAt)}
          </p>
          <p className="flex items-center gap-1.5">
            <MapPinIcon className="size-3.5" />
            <span className="truncate">{event.location}</span>
          </p>
        </div>
      </Link>
    </li>
  );
}
