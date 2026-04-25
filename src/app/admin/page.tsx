import type { Route } from "next";
import Link from "next/link";
import {
  CalendarDaysIcon,
  CreditCardIcon,
  MapPinIcon,
  PlusIcon,
  UsersIcon,
} from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { requireAdmin } from "@/lib/auth/session";
import { getAdminEventsWithCounts, getAdminUserStats } from "@/lib/data";
import {
  formatPersianDate,
  formatPersianTime,
  toPersianDigits,
} from "@/lib/persian";
import { cn } from "@/lib/utils";

const STATUS_STYLES: Record<
  "draft" | "published" | "closed",
  { label: string; className: string }
> = {
  draft: {
    label: "پیش‌نویس",
    className: "bg-muted text-foreground",
  },
  published: {
    label: "منتشرشده",
    className: "bg-emerald-500/12 text-emerald-700",
  },
  closed: {
    label: "بسته‌شده",
    className: "bg-destructive/10 text-destructive",
  },
};

export default async function AdminPage() {
  await requireAdmin();
  const [events, userStats] = await Promise.all([
    getAdminEventsWithCounts(),
    getAdminUserStats(),
  ]);

  const published = events.filter(
    (event) => event.status === "published",
  ).length;
  const totalRegistrations = events.reduce(
    (sum, event) => sum + event.registeredCount,
    0,
  );

  return (
    <div className="section-shell space-y-8 py-6">
      <section className="flex flex-wrap gap-2">
        <Link
          href="/admin/users"
          className={cn(
            buttonVariants({ size: "lg", className: "h-11 rounded-full" }),
          )}
        >
          <UsersIcon className="size-4" />
          مدیریت کاربران
        </Link>
        <Link
          href="/admin/events/new"
          className={cn(
            buttonVariants({
              variant: "outline",
              size: "lg",
              className: "h-11 rounded-full",
            }),
          )}
        >
          <PlusIcon className="size-4" />
          رویداد جدید
        </Link>
        <Link
          href="/admin/requests"
          className={cn(
            buttonVariants({
              variant: "outline",
              size: "lg",
              className: "h-11 rounded-full",
            }),
          )}
        >
          <CreditCardIcon className="size-4" />
          درخواست‌ها
        </Link>
      </section>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <OverviewStat label="کل کاربران" value={userStats.total} />
        <OverviewStat
          label="جدید (۷ روز)"
          value={userStats.newLast7d}
          accent="positive"
        />
        <OverviewStat label="فعال (۷ روز)" value={userStats.activeLast7d} />
        <OverviewStat
          label="مسدود"
          value={userStats.banned}
          accent="destructive"
        />
      </section>

      <section className="grid grid-cols-1 gap-6 sm:grid-cols-3">
        <div className="space-y-1.5">
          <p className="text-xs text-muted-foreground">همه رویدادها</p>
          <p className="text-3xl font-bold">{toPersianDigits(events.length)}</p>
        </div>
        <div className="space-y-1.5">
          <p className="text-xs text-muted-foreground">منتشرشده</p>
          <p className="text-3xl font-bold">{toPersianDigits(published)}</p>
        </div>
        <div className="space-y-1.5">
          <p className="text-xs text-muted-foreground">مجموع ثبت‌نام‌ها</p>
          <p className="text-3xl font-bold">
            {toPersianDigits(totalRegistrations)}
          </p>
        </div>
      </section>

      {events.length ? (
        <section className="space-y-3">
          <h2 className="text-sm font-bold text-muted-foreground">
            لیست رویدادها
          </h2>
          <ul className="grid gap-4 lg:grid-cols-2">
            {events.map((event) => {
              const status = STATUS_STYLES[event.status];
              return (
                <li
                  key={event.id}
                  className="group relative overflow-hidden rounded-4xl bg-card p-5 border border-border"
                >
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge className={cn("rounded-full", status.className)}>
                        {status.label}
                      </Badge>
                      <Badge className="rounded-full bg-primary/10 text-primary">
                        <UsersIcon className="size-3.5" />
                        {toPersianDigits(event.registeredCount)} ثبت‌نام
                      </Badge>
                    </div>
                    <h3 className="truncate text-xl font-bold">
                      {event.title}
                    </h3>
                    <p className="line-clamp-2 text-sm leading-7 text-muted-foreground">
                      {event.description}
                    </p>
                    <div className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
                      <span className="inline-flex items-center gap-1.5">
                        <CalendarDaysIcon className="size-4 text-primary" />
                        {formatPersianDate(event.startsAt)} ·{" "}
                        {formatPersianTime(event.startsAt)}
                      </span>
                      <span className="inline-flex min-w-0 items-center gap-1.5">
                        <MapPinIcon className="size-4 text-primary" />
                        <span className="truncate">{event.location}</span>
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Link
                        href={`/admin/events/${event.id}` as Route}
                        className={cn(
                          buttonVariants({
                            size: "default",
                            className: "h-10 rounded-full",
                          }),
                        )}
                      >
                        مدیریت رویداد
                      </Link>
                      <Link
                        href={
                          `/admin/events/${event.id}?tab=participants` as Route
                        }
                        className={cn(
                          buttonVariants({
                            variant: "outline",
                            size: "default",
                            className: "h-10 rounded-full",
                          }),
                        )}
                      >
                        <UsersIcon className="size-4" />
                        شرکت‌کنندگان
                      </Link>
                      {event.status === "published" ? (
                        <Link
                          href={`/events/${event.slug}` as Route}
                          target="_blank"
                          className={cn(
                            buttonVariants({
                              variant: "outline",
                              size: "default",
                              className: "h-10 rounded-full",
                            }),
                          )}
                        >
                          صفحه عمومی
                        </Link>
                      ) : null}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ) : (
        <EmptyState
          icon={CalendarDaysIcon}
          title="هنوز رویدادی ساخته نشده است"
          description="از همین‌جا اولین رویداد را ایجاد کنید و سپس در صفحه عمومی منتشرش کنید."
          cta={{ href: "/admin/events/new", label: "ایجاد رویداد" }}
        />
      )}
    </div>
  );
}

function OverviewStat({
  label,
  value,
  accent = "default",
}: {
  label: string;
  value: number | string;
  accent?: "default" | "positive" | "destructive";
}) {
  return (
    <div className="rounded-4xl bg-card p-4 border border-border">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mt-2 text-2xl font-bold leading-none",
          accent === "positive" && "text-emerald-600",
          accent === "destructive" && "text-rose-600",
        )}
      >
        {typeof value === "number" ? toPersianDigits(value) : value}
      </p>
    </div>
  );
}
