import type { Route } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarPlusIcon, UsersIcon } from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { requireCompletedProfile } from "@/lib/auth/session";
import { pageHasFeature } from "@/lib/entitlements";
import { EVENT_STATUS_LABELS } from "@/lib/events/labels";
import { listHostEvents } from "@/lib/events/queries";
import { formatShamsiDateTimeInZone } from "@/lib/date/timezone";
import { toPersianDigits } from "@/lib/date/persian";
import { resolveCurrentPageForOwner } from "@/lib/pages";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function HostEventsPage() {
  const viewer = await requireCompletedProfile();
  const page = await resolveCurrentPageForOwner(viewer.user.id);
  if (!page) redirect("/me");

  const granted = await pageHasFeature(page.id, "business_events");
  if (!granted) redirect("/me");

  const events = await listHostEvents(page.id);

  return (
    <div className="section-shell space-y-6 py-6">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">رویدادهای من</h1>
          <p className="text-sm text-muted-foreground">
            رویدادهایی که میزبانی می‌کنید را اینجا مدیریت کنید.
          </p>
        </div>
        <Link
          href={"/my-events/new" as Route}
          className={cn(buttonVariants(), "h-11 shrink-0")}
        >
          <CalendarPlusIcon className="size-4" />
          رویداد جدید
        </Link>
      </header>

      {events.length === 0 ? (
        <EmptyState
          icon={CalendarPlusIcon}
          title="هنوز رویدادی نساخته‌اید"
          description="اولین رویداد جامعه‌ات را بساز و ثبت‌نام‌ها را جمع کن."
          cta={{ href: "/my-events/new" as Route, label: "ساخت رویداد" }}
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {events.map((ev) => (
            <li key={ev.id}>
              <Link
                href={`/my-events/${ev.id}/manage` as Route}
                className="group flex h-full flex-col gap-3 rounded-4xl border border-border bg-card p-4 transition-colors hover:bg-muted/40"
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="min-w-0 flex-1 truncate font-bold">
                    {ev.title}
                  </h3>
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
                  {formatShamsiDateTimeInZone(ev.startsAt, page.timezone ?? "Asia/Tehran")}
                </p>
                <div className="mt-auto flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <UsersIcon className="size-3.5" />
                    {toPersianDigits(ev.registrantCount)} ثبت‌نام
                  </span>
                  {ev.capacity ? (
                    <span>
                      ظرفیت {toPersianDigits(ev.capacity)} نفر
                    </span>
                  ) : (
                    <span>ظرفیت نامحدود</span>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
