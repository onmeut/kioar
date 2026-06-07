import type { Route } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarPlusIcon, UsersIcon } from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { MyEventsAttending } from "@/components/events/my-events-attending";
import { MyEventsTabs } from "@/components/events/my-events-tabs";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { requireCompletedProfile } from "@/lib/auth/session";
import { getDashboardRegistrations } from "@/lib/data";
import { pageHasFeature } from "@/lib/entitlements";
import { EVENT_STATUS_LABELS } from "@/lib/events/labels";
import { listHostEvents } from "@/lib/events/queries";
import { formatShamsiDateTimeInZone } from "@/lib/date/timezone";
import { toPersianDigits } from "@/lib/date/persian";
import { resolveCurrentPageForOwner } from "@/lib/pages";
import { userShortUrl } from "@/lib/site";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

/**
 * Dual-purpose /my-events: an "attending" tab (any user — events they've
 * registered for, with show-my-QR + add-to-calendar) and a "hosting" tab
 * (Business-gated — events they run). Attending never requires the entitlement;
 * only hosting does.
 */
export default async function MyEventsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  const viewer = await requireCompletedProfile();
  const page = await resolveCurrentPageForOwner(viewer.user.id);
  if (!page) redirect("/me");

  const canHost = await pageHasFeature(page.id, "business_events");

  const [registrations, hostEvents] = await Promise.all([
    getDashboardRegistrations(viewer.user.id),
    canHost ? listHostEvents(page.id) : Promise.resolve([]),
  ]);

  const nowMs = new Date().getTime();
  const attendingItems = registrations.map((r) => {
    const endRef = r.endsAt ?? r.startsAt;
    return {
      registrationId: r.registrationId,
      eventId: r.eventId,
      title: r.title,
      eventSlug: r.slug,
      pageSlug: r.pageSlug,
      description: r.description,
      locationType: r.locationType,
      locationAddress: r.locationAddress,
      startsAt: r.startsAt.toISOString(),
      endsAt: r.endsAt?.toISOString() ?? null,
      timezone: r.timezone,
      status: r.registrationStatus,
      isPast: endRef.getTime() < nowMs,
    };
  });

  const attending = (
    <MyEventsAttending
      items={attendingItems}
      qrUrl={userShortUrl(viewer.user.id)}
    />
  );

  const hosting = canHost ? (
    <HostingPanel
      events={hostEvents}
      timezone={page.timezone ?? "Asia/Tehran"}
    />
  ) : (
    <EmptyState
      icon={CalendarPlusIcon}
      title="میزبانی رویداد ویژهٔ پلن Business است"
      description="با ارتقا به Business می‌توانید رویداد بسازید و ثبت‌نام‌ها را مدیریت کنید."
      cta={{ href: "/pricing" as Route, label: "مشاهدهٔ پلن‌ها" }}
    />
  );

  return (
    <div className="section-shell space-y-6 py-6">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">رویدادهای من</h1>
          <p className="text-sm text-muted-foreground">
            رویدادهایی که در آن‌ها شرکت می‌کنید یا میزبانی‌شان می‌کنید.
          </p>
        </div>
        {canHost ? (
          <Link
            href={"/my-events/new" as Route}
            className={cn(buttonVariants(), "h-11 shrink-0")}
          >
            <CalendarPlusIcon className="size-4" />
            رویداد جدید
          </Link>
        ) : null}
      </header>

      <MyEventsTabs
        attending={attending}
        hosting={hosting}
        defaultTab={tab === "hosting" ? "hosting" : "attending"}
      />
    </div>
  );
}

function HostingPanel({
  events,
  timezone,
}: {
  events: Awaited<ReturnType<typeof listHostEvents>>;
  timezone: string;
}) {
  if (events.length === 0) {
    return (
      <EmptyState
        icon={CalendarPlusIcon}
        title="هنوز رویدادی نساخته‌اید"
        description="اولین رویداد جامعه‌ات را بساز و ثبت‌نام‌ها را جمع کن."
        cta={{ href: "/my-events/new" as Route, label: "ساخت رویداد" }}
      />
    );
  }

  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {events.map((ev) => (
        <li key={ev.id}>
          <Link
            href={`/my-events/${ev.id}/manage` as Route}
            className="group flex h-full flex-col gap-3 rounded-4xl border border-border bg-card p-4 transition-colors hover:bg-muted/40"
          >
            <div className="flex items-start justify-between gap-2">
              <h3 className="min-w-0 flex-1 truncate font-bold">{ev.title}</h3>
              <Badge
                className={cn(
                  "rounded-full",
                  ev.status === "published"
                    ? "bg-emerald-500/12 text-emerald-700"
                    : ev.status === "cancelled"
                      ? "bg-rose-500/12 text-rose-700"
                      : "bg-muted text-foreground",
                )}
              >
                {EVENT_STATUS_LABELS[ev.status]}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              {formatShamsiDateTimeInZone(ev.startsAt, timezone)}
            </p>
            <div className="mt-auto flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <UsersIcon className="size-3.5" />
                {toPersianDigits(ev.registrantCount)} ثبت‌نام
              </span>
              {ev.capacity ? (
                <span>ظرفیت {toPersianDigits(ev.capacity)} نفر</span>
              ) : (
                <span>ظرفیت نامحدود</span>
              )}
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
