import type { Route } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PencilIcon, ScanLineIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { EventHostActions } from "@/components/events/event-host-actions";
import { RegistrantTable } from "@/components/events/registrant-table";
import { requireCompletedProfile } from "@/lib/auth/session";
import { pageHasFeature } from "@/lib/entitlements";
import { EVENT_STATUS_LABELS } from "@/lib/events/labels";
import {
  getEventStats,
  getHostEvent,
  listEventRegistrants,
} from "@/lib/events/queries";
import { toPersianDigits } from "@/lib/date/persian";
import { formatShamsiDateTimeInZone } from "@/lib/date/timezone";
import { resolveCurrentPageForOwner } from "@/lib/pages";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function ManageEventPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const viewer = await requireCompletedProfile();
  const page = await resolveCurrentPageForOwner(viewer.user.id);
  if (!page) redirect("/me");
  if (!(await pageHasFeature(page.id, "business_events"))) redirect("/me");

  const data = await getHostEvent(eventId, page.id);
  if (!data) notFound();
  const { event, questions } = data;

  const [registrants, stats] = await Promise.all([
    listEventRegistrants(eventId, page.id),
    getEventStats(eventId, page.id),
  ]);

  // Serialize Dates to ISO for the client table.
  const rows = (registrants ?? []).map((r) => ({
    registrationId: r.registrationId,
    userId: r.userId,
    name: r.name,
    phone: r.phone,
    status: r.status,
    answers: r.answers,
    receiptKey: r.receiptKey,
    discountCode: r.discountCode,
    expectedToman: r.expectedToman,
    registeredAt: r.registeredAt.toISOString(),
    decidedAt: r.decidedAt?.toISOString() ?? null,
    checkedInAt: r.checkedInAt?.toISOString() ?? null,
  }));

  return (
    <div className="section-shell space-y-6 py-6">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="mb-1 flex items-center gap-2">
            <h1 className="truncate text-xl font-bold">{event.title}</h1>
            <Badge
              className={cn(
                "rounded-full",
                event.status === "published"
                  ? "bg-emerald-500/12 text-emerald-700"
                  : event.status === "cancelled"
                    ? "bg-rose-500/12 text-rose-700"
                    : "bg-muted text-foreground",
              )}
            >
              {EVENT_STATUS_LABELS[event.status]}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {formatShamsiDateTimeInZone(event.startsAt, event.timezone)}
          </p>
        </div>
        <Link
          href={`/my-events/${event.id}/edit` as Route}
          className={cn(buttonVariants({ variant: "outline" }), "h-11 shrink-0")}
        >
          <PencilIcon className="size-4" />
          ویرایش
        </Link>
      </div>

      {/* Stats */}
      {stats ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="ثبت‌نام" value={stats.total} />
          <Stat label="تأیید شده" value={stats.approved} />
          <Stat label="حاضر" value={stats.checkedIn} />
          <Stat
            label="ظرفیت باقی"
            value={
              stats.spotsRemaining == null ? "نامحدود" : stats.spotsRemaining
            }
          />
        </div>
      ) : null}

      {/* Check-in launcher */}
      {event.status === "published" ? (
        <Link
          href={`/my-events/${event.id}/checkin` as Route}
          className={cn(buttonVariants(), "h-12 w-full")}
        >
          <ScanLineIcon className="size-5" />
          حالت ورود با QR
        </Link>
      ) : null}

      <RegistrantTable
        eventId={event.id}
        timezone={event.timezone}
        registrants={rows}
        questions={questions.map((q) => ({ id: q.id, label: q.label }))}
      />

      {event.status === "published" ? (
        <Link
          href={`/${page.slug}/e/${event.slug}` as Route}
          className={cn(buttonVariants({ variant: "outline" }), "h-11 w-full")}
        >
          مشاهده صفحهٔ عمومی رویداد
        </Link>
      ) : null}

      <div className="border-t border-border/60 pt-4">
        <EventHostActions
          eventId={event.id}
          status={event.status}
          registrantCount={stats?.total ?? 0}
        />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-3xl border border-border p-4 text-center">
      <p className="text-2xl font-bold">
        {typeof value === "number" ? toPersianDigits(value) : value}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
