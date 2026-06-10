import { redirect } from "next/navigation";
import { CalendarPlusIcon } from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { MyEventsAttending } from "@/components/events/my-events-attending";
import { MyEventsTabs } from "@/components/events/my-events-tabs";
import { MyEventsHostingPanel } from "@/components/events/my-events-hosting-panel";
import { requireCompletedProfile } from "@/lib/auth/session";
import { getDashboardRegistrations } from "@/lib/data";
import { pageHasFeature } from "@/lib/entitlements";
import { listHostEvents, getHostEvent } from "@/lib/events/queries";
import { toEventFormInitial } from "@/lib/events/event-mapper";
import { formatShamsiDateTimeInZone } from "@/lib/date/timezone";
import { toPersianDigits } from "@/lib/date/persian";
import { resolveCurrentPageForOwner } from "@/lib/pages";
import { userShortUrl } from "@/lib/site";
import { saveEventBlockAction } from "@/app/(app)/me/event-actions";

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

  // Pre-load full form data for every hosted event so the edit modal can open
  // without a round-trip. We do this server-side to keep secrets (discount
  // codes, private URLs) out of client bundles.
  const eventFormInitials: Record<
    string,
    ReturnType<typeof toEventFormInitial>
  > = {};
  if (canHost && hostEvents.length > 0) {
    const fullData = await Promise.all(
      hostEvents.map((ev) => getHostEvent(ev.id, page.id)),
    );
    for (const data of fullData) {
      if (data) eventFormInitials[data.event.id] = toEventFormInitial(data);
    }
  }

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

  const timezone = page.timezone ?? "Asia/Tehran";

  const hosting = canHost ? (
    <MyEventsHostingPanel
      pageId={page.id}
      events={hostEvents.map((ev) => ({
        id: ev.id,
        slug: ev.slug,
        title: ev.title,
        status: ev.status,
        startsAtLabel: formatShamsiDateTimeInZone(ev.startsAt, timezone),
        registrantCount: ev.registrantCount,
        capacity: ev.capacity,
      }))}
      eventFormInitials={eventFormInitials}
      saveAction={saveEventBlockAction}
    />
  ) : (
    <EmptyState
      icon={CalendarPlusIcon}
      title="میزبانی رویداد ویژهٔ پلن Business است"
      description="با ارتقا به Business می‌توانید رویداد بسازید و ثبت‌نام‌ها را مدیریت کنید."
      cta={{ href: "/pricing", label: "مشاهدهٔ پلن‌ها" }}
    />
  );

  return (
    <div className="section-shell space-y-6 py-6">
      <MyEventsTabs
        attending={attending}
        hosting={hosting}
        defaultTab={tab === "hosting" ? "hosting" : "attending"}
      />
    </div>
  );
}
