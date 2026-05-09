import type { Route } from "next";
import Link from "next/link";
import {
  BellIcon,
  CalendarClockIcon,
  CalendarDaysIcon,
  ChevronLeftIcon,
  CreditCardIcon,
  FileTextIcon,
  FormInputIcon,
  GiftIcon,
  HandshakeIcon,
  HelpCircleIcon,
  type LucideIcon,
  LogOutIcon,
  ReceiptIcon,
  UserIcon,
} from "lucide-react";

import { signOutAction } from "@/app/(app)/dashboard/actions";
import { Button } from "@/components/ui/button";
import { requireCompletedProfile } from "@/lib/auth/session";
import { getAffiliateStateForUser } from "@/lib/affiliate";
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

  const [badgeCounts, referralAvailableMonths, affiliateState] =
    await Promise.all([
      getSidebarBadgeCounts(currentPageId, viewer.user.id).catch(() => ({
        bookings: 0,
        forms: 0,
        notifications: 0,
      })),
      getReferralAvailableMonths(viewer.user.id).catch(() => 0),
      getAffiliateStateForUser(viewer.user.id).catch(() => ({ kind: "none" as const })),
    ]);

  // ── ابزارها ──────────────────────────────────────────────────────
  // Routes that appear in the main bottom-nav (لینک من, آمار) are
  // intentionally omitted here — the tab bar already surfaces them.
  // We only surface secondary destinations the user can't reach
  // without coming here.
  const toolsRows: MoreRow[] = [
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

  // ── حساب و اشتراک ────────────────────────────────────────────────
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

  // Plan-aware billing:
  //   free (no trial) → ارتقا به پرو
  //   free on trial   → مدیریت اشتراک آزمایشی  → billing hub
  //   pro             → مدیریت اشتراک           → billing hub
  //   business        → no row (reached via admin/settings)
  if (currentPage?.planKey === "free" && !currentPage.isOnTrial) {
    accountRows.push({
      href: "/pro" as Route,
      label: "ارتقا به پرو",
      icon: ReceiptIcon,
      description: "حذف برندینگ، آمار پیشرفته و بلاک‌های ویژه",
    });
  } else if (
    currentPage?.planKey === "free" &&
    currentPage.isOnTrial
  ) {
    accountRows.push({
      href: `/dashboard/pages/${currentPageId}/billing` as Route,
      label: "مدیریت اشتراک آزمایشی",
      icon: ReceiptIcon,
    });
  } else if (currentPage?.planKey === "pro") {
    accountRows.push({
      href: `/dashboard/pages/${currentPageId}/billing` as Route,
      label: "مدیریت اشتراک",
      icon: ReceiptIcon,
    });
    // فاکتورها is only meaningful once the user has an active subscription
    accountRows.push({
      href: `/dashboard/pages/${currentPageId}/billing/invoices` as Route,
      label: "فاکتورها",
      icon: FileTextIcon,
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

  // ── کسب درآمد ────────────────────────────────────────────────────
  // Affiliate link: approved → dashboard; applied/pending → apply page;
  // none / rejected → apply page (shows fresh application form).
  const affiliateRows: MoreRow[] = [
    {
      href: (affiliateState.kind === "approved"
        ? "/affiliate/dashboard"
        : "/affiliate/apply") as Route,
      label: "همکاری در فروش",
      icon: HandshakeIcon,
      description:
        affiliateState.kind === "approved"
          ? "پنل درآمد و کمیسیون شما"
          : affiliateState.kind === "pending"
            ? "درخواست شما در حال بررسی است"
            : "پورسانت از هر فروش موفق",
    },
  ];

  // ── پشتیبانی ─────────────────────────────────────────────────────
  const supportRows: MoreRow[] = [
    {
      href: "/help" as Route,
      label: "راهنما و پشتیبانی",
      icon: HelpCircleIcon,
    },
  ];

  return (
    <div className="md:hidden">
      <div className="section-shell space-y-5 py-6">
        <MoreSection title="ابزارها" rows={toolsRows} />
        <MoreSection title="حساب و اشتراک" rows={accountRows} />
        <MoreSection title="کسب درآمد" rows={affiliateRows} />
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
      <h2 className="px-1 text-xs font-bold uppercaser text-muted-foreground">
        {title}
      </h2>
      <ul className="overflow-hidden rounded-2xl border border-border bg-card">
        {rows.map((row) => {
          const Icon = row.icon;
          return (
            <li
              key={row.href}
              className={cn("border-b border-border/70 last:border-b-0")}
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
