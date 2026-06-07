import type { Route } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PencilIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { requireCompletedProfile } from "@/lib/auth/session";
import { pageHasFeature } from "@/lib/entitlements";
import { EVENT_STATUS_LABELS } from "@/lib/events/labels";
import { getHostEvent } from "@/lib/events/queries";
import { formatShamsiDateTimeInZone } from "@/lib/date/timezone";
import { resolveCurrentPageForOwner } from "@/lib/pages";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

// NOTE: Full registrant management (approvals, receipts, attendance, CSV,
// stats, QR check-in launch) lands in Increment 8. This is the post-save
// landing page with the essentials so the create/edit flow is complete.
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
  const { event } = data;

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
          href={`/events/${event.id}/edit` as Route}
          className={cn(buttonVariants({ variant: "outline" }), "h-11 shrink-0")}
        >
          <PencilIcon className="size-4" />
          ویرایش
        </Link>
      </div>

      <div className="rounded-4xl border border-dashed border-border/70 bg-muted/20 p-6 text-center text-sm text-muted-foreground">
        مدیریت کامل شرکت‌کنندگان (تأیید، رسید، حضور و غیاب، خروجی و ورود با
        QR) به‌زودی در همین صفحه اضافه می‌شود.
      </div>

      {event.status === "published" ? (
        <Link
          href={`/${page.slug}/e/${event.slug}` as Route}
          className={cn(buttonVariants({ variant: "outline" }), "h-11 w-full")}
        >
          مشاهده صفحهٔ عمومی رویداد
        </Link>
      ) : null}
    </div>
  );
}
