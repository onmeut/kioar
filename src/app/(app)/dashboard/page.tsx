import type { Route } from "next";
import Link from "next/link";
import {
  ArrowUpLeftIcon,
  CalendarDaysIcon,
  EyeIcon,
  ExternalLinkIcon,
  MousePointerClickIcon,
  TrendingUpIcon,
  UserPlusIcon,
  type LucideIcon,
} from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { requireCompletedProfile } from "@/lib/auth/session";
import {
  getDashboardRegistrations,
  getProfileStats,
  getProfileWithLinksByUserId,
} from "@/lib/data";
import { formatPersianDateTime } from "@/lib/persian";
import { toPersianDigits } from "@/lib/persian";
import { cn } from "@/lib/utils";

type Stat = {
  label: string;
  value: string;
  delta?: string;
  tone?: "up" | "down" | "neutral";
  icon: LucideIcon;
};

function StatCard({ stat }: { stat: Stat }) {
  const Icon = stat.icon;
  return (
    <div className="rounded-4xl bg-card p-5 border border-border">
      <div className="flex items-center justify-between">
        <span className="flex size-9 items-center justify-center rounded-2xl bg-muted text-foreground">
          <Icon className="size-4" />
        </span>
        {stat.delta ? (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 text-[11px] font-bold",
              stat.tone === "up"
                ? "text-emerald-600"
                : stat.tone === "down"
                  ? "text-rose-600"
                  : "text-muted-foreground",
            )}
          >
            <TrendingUpIcon
              className={cn("size-3", stat.tone === "down" && "rotate-180")}
            />
            {stat.delta}
          </span>
        ) : null}
      </div>
      <div className="mt-3 space-y-0.5">
        <span className="block text-3xl font-bold leading-none">
          {stat.value}
        </span>
        <p className="text-xs text-muted-foreground">{stat.label}</p>
      </div>
    </div>
  );
}

function WeekChart({
  weeklyViews,
}: {
  weeklyViews: { day: string; total: number }[];
}) {
  // Build a 7-day array (today going backwards), in jalali order د س چ پ ج ش ی
  const dayLabels = ["د", "س", "چ", "پ", "ج", "ش", "ی"];
  const now = new Date();
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now);
    d.setDate(d.getDate() - (6 - i));
    const key = d.toISOString().slice(0, 10);
    const found = weeklyViews.find((v) => v.day === key);
    return { label: dayLabels[i % 7], value: found?.total ?? 0 };
  });
  const max = Math.max(1, ...days.map((d) => d.value));
  return (
    <div className="mt-4 grid grid-cols-7 gap-2" aria-hidden>
      {days.map((d, i) => (
        <div key={i} className="flex flex-col items-center gap-1.5">
          <div className="flex h-28 w-full items-end">
            <div
              className="w-full rounded-t-lg bg-primary/30"
              style={{ height: `${(d.value / max) * 100}%`, minHeight: 4 }}
            />
          </div>
          <span className="text-[10px] text-muted-foreground">{d.label}</span>
        </div>
      ))}
    </div>
  );
}

export default async function DashboardPage() {
  const viewer = await requireCompletedProfile();
  const [profile, registrations] = await Promise.all([
    getProfileWithLinksByUserId(viewer.user.id),
    getDashboardRegistrations(viewer.user.id),
  ]);

  if (!profile) return null;

  const profileStats = await getProfileStats(profile.id);
  const activeLinks = profile.links.filter((l) => l.isActive).length;

  const stats: Stat[] = [
    {
      label: "بازدید (۷ روز)",
      value: toPersianDigits(profileStats.views7d),
      icon: EyeIcon,
    },
    {
      label: "کلیک روی بلاک‌ها",
      value: toPersianDigits(profileStats.totalLinkClicks),
      icon: MousePointerClickIcon,
    },
    {
      label: "بلاک‌های فعال",
      value: toPersianDigits(activeLinks),
      icon: UserPlusIcon,
    },
  ];

  const upcoming = registrations.slice(0, 3);

  return (
    <div className="section-shell space-y-8 py-6">
      <section className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {stats.map((stat) => (
            <StatCard key={stat.label} stat={stat} />
          ))}
        </div>

        <div className="rounded-4xl bg-card p-5 border border-border">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-bold">فعالیت ۷ روز اخیر</h2>
            <Link
              href="/me"
              className="text-xs font-semibold text-primary hover:underline"
            >
              مدیریت صفحه
              <ArrowUpLeftIcon className="ms-1 inline size-3" />
            </Link>
          </div>
          <WeekChart weeklyViews={profileStats.weeklyViews} />
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-muted-foreground">
            رویدادهای ثبت‌نام‌شده
          </h2>
          {registrations.length > 3 ? (
            <Link
              href="/my-events"
              className="text-xs font-semibold text-primary hover:underline"
            >
              همه رویدادها
            </Link>
          ) : null}
        </div>
        {upcoming.length ? (
          <ul className="space-y-2">
            {upcoming.map((event) => (
              <li
                key={event.registrationId}
                className="flex items-start justify-between gap-3 rounded-4xl bg-card p-4 border border-border"
              >
                <div className="min-w-0 space-y-1">
                  <h3 className="truncate font-bold">{event.title}</h3>
                  <p className="text-xs text-muted-foreground">
                    {formatPersianDateTime(event.startsAt)}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {event.location}
                  </p>
                </div>
                <Link
                  href={`/my-events/${event.slug}` as Route}
                  aria-label="مشاهده"
                  className={cn(
                    buttonVariants({
                      variant: "ghost",
                      size: "icon-sm",
                      className: "rounded-full",
                    }),
                  )}
                >
                  <ExternalLinkIcon className="size-4" />
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            icon={CalendarDaysIcon}
            title="هنوز در رویدادی ثبت‌نام نکرده‌اید"
            description="هر زمان خواستید می‌توانید از صفحه رویدادها ثبت‌نام کنید."
            cta={{ href: "/events", label: "مشاهده رویدادها" }}
          />
        )}
      </section>
    </div>
  );
}
