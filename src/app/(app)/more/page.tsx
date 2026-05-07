import type { Route } from "next";
import Link from "next/link";
import {
  BarChart3Icon,
  BellIcon,
  CalendarClockIcon,
  CalendarDaysIcon,
  ChevronLeftIcon,
  CreditCardIcon,
  FormInputIcon,
  GiftIcon,
  GlobeIcon,
  HelpCircleIcon,
  type LucideIcon,
  LogOutIcon,
  ReceiptIcon,
  UserIcon,
} from "lucide-react";

import { signOutAction } from "@/app/(app)/dashboard/actions";
import { PageSwitcher } from "@/components/navigation/page-switcher";
import { Button } from "@/components/ui/button";
import { requireCompletedProfile } from "@/lib/auth/session";
import { listOwnedPagesWithPlan } from "@/lib/pages";
import { toPersianDigits } from "@/lib/persian";
import { getReferralAvailableMonths } from "@/lib/referrals";
import { getSidebarBadgeCounts } from "@/lib/sidebar-counts";
import { cn } from "@/lib/utils";

export const metadata = {
  title: "بیشتر",
};

type MoreRow = {
  href: Route;
  label: string;
  icon: LucideIcon;
  description?: string;
  badge?: string;
};

function formatBadge(count: number): string {
  if (count <= 0) return "";
  if (count > 9) return `+${toPersianDigits(9)}`;
  return toPersianDigits(count);
}

export default async function MorePage() {
  const viewer = await requireCompletedProfile();
  const ownedPages = await listOwnedPagesWithPlan(viewer.user.id);

  const switcherItems = ownedPages.map((p) => ({
    id: p.id,
    slug: p.slug,
    title: p.fullName?.trim() || p.title?.trim() || `/${p.slug}`,
    avatarUrl: p.avatarUrl,
    avatarSeed: p.avatarSeed,
    planKey: p.planKey,
    isOnTrial: p.isOnTrial,
    trialEndsAt: p.trialEndsAt,
  }));
  const currentPage =
    switcherItems.find((p) => p.id === viewer.profile.id) ?? switcherItems[0];
  const currentPageId = currentPage?.id ?? viewer.profile.id;

  const badgeCounts = await getSidebarBadgeCounts(
    currentPageId,
    viewer.user.id,
  ).catch(() => ({ bookings: 0, forms: 0, notifications: 0 }));

  const referralAvailableMonths = await getReferralAvailableMonths(
    viewer.user.id,
  ).catch(() => 0);

  const tools: MoreRow[] = [
    {
      href: "/me" as Route,
      label: "لینک من",
      icon: GlobeIcon,
      description: "ویرایش بلاک‌ها و تنظیمات صفحه",
    },
    {
      href: "/dashboard",
      label: "آمار",
      icon: BarChart3Icon,
      description: "بازدید، کلیک و عملکرد بلاک‌ها",
    },
    {
      href: "/bookings" as Route,
      label: "هماهنگی‌ها",
      icon: CalendarClockIcon,
      badge: formatBadge(badgeCounts.bookings),
    },
    {
      href: "/forms" as Route,
      label: "پاسخ‌های فرم",
      icon: FormInputIcon,
      badge: formatBadge(badgeCounts.forms),
    },
    {
      href: "/my-events" as Route,
      label: "رویدادها",
      icon: CalendarDaysIcon,
    },
    {
      href: "/premium" as Route,
      label: "کارت هوشمند",
      icon: CreditCardIcon,
    },
  ];

  const accountRows: MoreRow[] = [
    {
      href: "/dashboard/account" as Route,
      label: "حساب کاربری",
      icon: UserIcon,
    },
    {
      href: "/dashboard/notifications" as Route,
      label: "اعلان‌ها",
      icon: BellIcon,
      badge: formatBadge(badgeCounts.notifications),
    },
  ];

  // Plan-aware billing row: free → upgrade page; pro → page-scoped
  // billing; business → no row (matches sidebar upgrade-card logic).
  if (currentPage?.planKey === "free") {
    accountRows.push({
      href: "/pro" as Route,
      label: "ارتقا به پرو",
      icon: ReceiptIcon,
      description: "حذف برندینگ، آمار پیشرفته و بلاک‌های ویژه",
    });
  } else if (currentPage?.planKey === "pro") {
    accountRows.push({
      href: `/dashboard/pages/${currentPageId}/billing` as Route,
      label: "مدیریت اشتراک",
      icon: ReceiptIcon,
    });
  }

  accountRows.push({
    href: "/dashboard/referral" as Route,
    label: "دعوت دوستان",
    icon: GiftIcon,
    badge:
      referralAvailableMonths > 0
        ? `${toPersianDigits(referralAvailableMonths)} ماه`
        : "۱ ماه رایگان",
    description:
      referralAvailableMonths > 0
        ? "اعتبار رایگان آماده‌ی استفاده دارید"
        : undefined,
  });

  const supportRows: MoreRow[] = [
    {
      href: "/help" as Route,
      label: "راهنما و پشتیبانی",
      icon: HelpCircleIcon,
    },
  ];

  return (
    <div className="md:hidden">
      <div className="section-shell space-y-6 py-6">
        <header className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-bold">بیشتر</h1>
          <PageSwitcher
            pages={switcherItems}
            currentPageId={currentPageId}
            signOut={signOutAction}
            variant="compact"
          />
        </header>

        <MoreSection title="ابزارها" rows={tools} />
        <MoreSection title="حساب" rows={accountRows} />
        <MoreSection title="پشتیبانی" rows={supportRows} />

        <form action={signOutAction}>
          <Button
            type="submit"
            variant="outline"
            className="h-12 w-full rounded-full text-sm font-bold"
          >
            <LogOutIcon className="size-4" aria-hidden />
            خروج از حساب
          </Button>
        </form>
      </div>
    </div>
  );
}

function MoreSection({ title, rows }: { title: string; rows: MoreRow[] }) {
  return (
    <section className="space-y-2">
      <h2 className="px-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">
        {title}
      </h2>
      <ul className="overflow-hidden rounded-2xl border border-border bg-card">
        {rows.map((row, i) => {
          const Icon = row.icon;
          return (
            <li
              key={row.href}
              className={cn(
                "border-b border-border/70 last:border-b-0",
              )}
            >
              <Link
                href={row.href}
                className="tap-target flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-muted/60"
              >
                <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-foreground">
                  <Icon className="size-4.5" aria-hidden />
                </span>
                <span className="flex min-w-0 flex-1 flex-col leading-tight">
                  <span className="truncate text-sm font-semibold text-foreground">
                    {row.label}
                  </span>
                  {row.description ? (
                    <span className="truncate text-xs text-muted-foreground">
                      {row.description}
                    </span>
                  ) : null}
                </span>
                {row.badge ? (
                  <span className="inline-flex shrink-0 items-center rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-bold text-primary">
                    {row.badge}
                  </span>
                ) : null}
                <ChevronLeftIcon
                  className="size-4 shrink-0 text-muted-foreground"
                  aria-hidden
                />
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
