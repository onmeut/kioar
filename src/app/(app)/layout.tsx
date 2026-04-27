import type { Route } from "next";
import { signOutAction } from "@/app/(app)/dashboard/actions";
import { ImpersonationBar } from "@/components/admin/impersonation-bar";
import { PageSwitcher } from "@/components/navigation/page-switcher";
import {
  SidebarNav,
  type SidebarNavItem,
} from "@/components/navigation/sidebar-nav";
import { SidebarUpgradeCard } from "@/components/navigation/sidebar-upgrade-card";
import { BrandMark } from "@/components/shared/brand-mark";
import { DashboardPageTitle } from "@/components/shared/dashboard-page-title";
import { MobileBottomNav } from "@/components/shared/mobile-bottom-nav";
import { PageSettingsHeaderButton } from "@/components/shared/page-settings-header-button";
import { ProPromoBar } from "@/components/shared/pro-promo-bar";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar";
import { requireCompletedProfile } from "@/lib/auth/session";
import { listOwnedPagesWithPlan } from "@/lib/pages";

const accountNavItems: SidebarNavItem[] = [
  {
    href: "/dashboard/notifications" as Route,
    label: "اعلان‌ها",
    icon: "notifications",
  },
  {
    href: "/dashboard/profile" as Route,
    label: "پروفایل کاربری",
    icon: "user",
  },
];

/**
 * Tertiary footer-style entries shown beneath the upgrade CTA card.
 * Rendered with `tone: "muted"` so they read as secondary affordances
 * rather than primary navigation.
 */
const supportNavItems: SidebarNavItem[] = [
  {
    href: "/help" as Route,
    label: "راهنما و پشتیبانی",
    icon: "help",
    tone: "muted",
  },
  {
    href: "/dashboard/referral" as Route,
    label: "دعوت دوستان",
    icon: "referral",
    tone: "muted",
  },
];

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
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
  }));

  // The current page (= the one the page-switcher cookie resolved to,
  // surfaced as `viewer.profile`) drives both the page-scoped nav links
  // (analytics, billing) and the upgrade-CTA copy.
  const currentPage =
    switcherItems.find((p) => p.id === viewer.profile.id) ?? switcherItems[0];
  const currentPageId = currentPage?.id ?? viewer.profile.id;

  // Page-scoped nav, built per-render because the deep-link routes
  // bake in the current `pageId`. Order: داشبورد → آمار (high-frequency)
  // → صفحه‌ی من → رزروها → ارسال‌های فرم → رویدادها → درخواست کارت →
  // پلن و صورت‌حساب (last; important but not high-frequency).
  const pageNavItems: SidebarNavItem[] = [
    { href: "/dashboard", label: "داشبورد", icon: "home", match: "exact" },
    {
      href: `/dashboard/pages/${currentPageId}/analytics` as Route,
      label: "آمار",
      icon: "analytics",
    },
    { href: "/page", label: "صفحه‌ی من", icon: "page" },
    { href: "/bookings", label: "رزروها", icon: "bookings" },
    { href: "/forms" as Route, label: "ارسال‌های فرم", icon: "forms" },
    { href: "/my-events", label: "رویدادها", icon: "events" },
    { href: "/requests/new", label: "درخواست کارت", icon: "requests" },
    {
      href: `/dashboard/pages/${currentPageId}/billing` as Route,
      label: "پلن و صورت‌حساب",
      icon: "receipt",
    },
  ];

  return (
    <div
      className="promo-layout flex h-dvh flex-col bg-zinc-950"
      style={{ "--promo-bar-height": "2.5rem" } as React.CSSProperties}
    >
      <ProPromoBar />
      <div className="flex min-h-0 flex-1 rounded-t-3xl contain-[paint] bg-background">
        <SidebarProvider defaultOpen className="min-h-0! h-full">
          <Sidebar
            dir="rtl"
            side="right"
            variant="sidebar"
            className="border-e border-sidebar-border border-s-0!"
          >
            <SidebarHeader className="h-16 justify-center px-4">
              <BrandMark variant="mark" href="/dashboard" />
            </SidebarHeader>

            <SidebarContent className="px-2">
              <SidebarGroup>
                <SidebarGroupContent>
                  <PageSwitcher
                    pages={switcherItems}
                    currentPageId={viewer.profile.id}
                    signOut={signOutAction}
                  />
                </SidebarGroupContent>
              </SidebarGroup>
              <SidebarGroup>
                <SidebarGroupContent>
                  <SidebarNav items={pageNavItems} />
                </SidebarGroupContent>
              </SidebarGroup>
              <SidebarGroup>
                <SidebarGroupLabel>حساب کاربری</SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarNav items={accountNavItems} />
                </SidebarGroupContent>
              </SidebarGroup>
            </SidebarContent>

            <SidebarFooter className="border-t border-sidebar-border p-3">
              {currentPage ? (
                <SidebarUpgradeCard
                  pageId={currentPage.id}
                  planKey={currentPage.planKey}
                />
              ) : null}
              <div className="mt-2 border-t border-sidebar-border/60 pt-1">
                <SidebarNav items={supportNavItems} />
              </div>
            </SidebarFooter>
          </Sidebar>

          <SidebarInset className="flex h-full flex-col overflow-hidden">
            <ImpersonationBar />
            <header className="shrink-0 z-20 border-b bg-background/84 backdrop-blur-sm">
              <div className="flex h-14 items-center justify-between gap-3 px-4 sm:h-16 sm:px-6">
                <DashboardPageTitle />
                <PageSettingsHeaderButton />
              </div>
            </header>

            <main className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden pb-nav md:pb-0">
              {children}
            </main>
            <MobileBottomNav variant="dashboard" />
          </SidebarInset>
        </SidebarProvider>
      </div>
    </div>
  );
}
