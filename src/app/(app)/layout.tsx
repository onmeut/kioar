import type { Route } from "next";
import { signOutAction } from "@/app/(app)/dashboard/actions";
import { ImpersonationBar } from "@/components/admin/impersonation-bar";
import { MeHeaderActions } from "@/components/dashboard/me-header-actions";
import { CommandPaletteTrigger } from "@/components/navigation/command-palette-trigger";
import { MobileHeaderContent } from "@/components/navigation/mobile-header-content";
import { PageSwitcher } from "@/components/navigation/page-switcher";
import {
  SidebarIconRow,
  SidebarNav,
  SidebarReferralCTA,
  type SidebarIconRowItem,
  type SidebarNavItem,
} from "@/components/navigation/sidebar-nav";
import { SidebarUpgradeCard } from "@/components/navigation/sidebar-upgrade-card";
import { DashboardPageTitle } from "@/components/shared/dashboard-page-title";
import { MobileBottomNav } from "@/components/shared/mobile-bottom-nav";
import { ProPromoBar } from "@/components/shared/pro-promo-bar";
import { InstallPrompt } from "@/components/app/install-prompt";
import { PullToRefresh } from "@/components/app/pull-to-refresh";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar";
import { requireCompletedProfile } from "@/lib/auth/session";
import { pageHasFeature } from "@/lib/entitlements";
import { listOwnedPagesWithPlan } from "@/lib/pages";
import { profileShareUrl } from "@/lib/profile-domains";
import { getReferralAvailableMonths } from "@/lib/referrals";
import { getSidebarBadgeCounts } from "@/lib/sidebar-counts";

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
    trialEndsAt: p.trialEndsAt,
  }));

  // The current page (= the one the page-switcher cookie resolved to,
  // surfaced as `viewer.profile`) drives both the page-scoped nav links
  // (analytics) and the upgrade-card / manage-subscription card.
  const currentPage =
    switcherItems.find((p) => p.id === viewer.profile.id) ?? switcherItems[0];
  const currentPageId = currentPage?.id ?? viewer.profile.id;

  // Promo bar visibility: show for free plan pages (post-trial upgrade
  // CTA) and during an active trial (countdown). Paid pages get a flush
  // full-bleed surface with no bar.
  const showPromoBar = Boolean(
    currentPage && (currentPage.planKey === "free" || currentPage.isOnTrial),
  );

  // Single round-trip — see `lib/sidebar-counts.ts`. Failure here must
  // not break navigation; we degrade to all-zero badges (rendered as
  // "no badge") rather than crashing the layout.
  const badgeCounts = await getSidebarBadgeCounts(
    currentPageId,
    viewer.user.id,
  ).catch(() => ({ bookings: 0, forms: 0, notifications: 0 }));

  // Unredeemed referral credit count surfaced in the sidebar CTA pill
  // so users notice they have something to apply. Defaults to 0 on any
  // failure — the CTA still renders with its standard teaser pill.
  const referralAvailableMonths = await getReferralAvailableMonths(
    viewer.user.id,
  ).catch(() => 0);

  // Pre-resolve the three feature flags the command palette needs for
  // the current page. Doing this server-side keeps the palette purely
  // client-rendered (no waterfall on open) and lets us call
  // `pageHasFeature` once per render. Any failure degrades to "locked",
  // which surfaces the upgrade route — the same outcome a Free user
  // would see, so it's safe.
  const [contactFormFeature, bookingsFeature, csvExportFeature] =
    await Promise.all([
      pageHasFeature(currentPageId, "business_contact_form").catch(() => false),
      pageHasFeature(currentPageId, "business_bookings").catch(() => false),
      pageHasFeature(currentPageId, "analytics_csv_export").catch(() => false),
    ]);

  // Public URL of the current page — used by "view public", "copy link"
  // commands. Domain comes from the profile row (each page can pick its
  // own kioar.* host); falls back to the default in profile-domains.
  const publicUrl = profileShareUrl(viewer.profile.slug, viewer.profile.domain);

  const isAdmin = viewer.user.role === "admin";

  // Page-scoped nav.
  //
  // Order is intentional: داشبورد is account-wide and sits alone in
  // its own group at the top (visually separated by the next group's
  // padding). لینک من is then promoted as the *primary* row — it's
  // the app's centerpiece, treated visually as a tier above its peers.
  // Everything else is conventional supporting nav.
  //
  // پلن و صورت‌حساب is intentionally absent — billing access lives in
  // the plan-aware card slot at the footer (Free → upgrade card, Pro →
  // "مدیریت اشتراک" card, Business → no card).
  const isProUser = currentPage?.planKey !== "free";

  const myPageNavItem: SidebarNavItem = {
    href: "/me" as Route,
    label: "لینک من",
    icon: "page",
  };

  const statsNavItem: SidebarNavItem = {
    href: "/dashboard",
    label: "آمار",
    icon: "analytics",
    match: "exact",
  };

  const toolsNavItems: SidebarNavItem[] = [
    {
      href: "/bookings",
      label: "هماهنگی‌ها",
      icon: "bookings",
      badgeCount: badgeCounts.bookings,
    },
    {
      href: "/forms" as Route,
      label: "پاسخ‌های فرم",
      icon: "forms",
      badgeCount: badgeCounts.forms,
    },
    { href: "/my-events", label: "رویدادها", icon: "events" },
    { href: "/premium" as Route, label: "کارت هوشمند", icon: "requests" },
  ];

  // Bottom-of-sidebar utility row. Notifications, profile, help — icon
  // only with hover tooltips. The notifications icon shows a red
  // presence dot (no count) when there's anything unread.
  const iconRowItems: SidebarIconRowItem[] = [
    { href: "/" as Route, label: "صفحهٔ اصلی", icon: "home" },
    {
      href: "/dashboard/notifications" as Route,
      label: "اعلان‌ها",
      icon: "notifications",
      showDot: badgeCounts.notifications > 0,
    },
    {
      href: "/dashboard/account" as Route,
      label: "حساب کاربری",
      icon: "user",
    },
    { href: "/help" as Route, label: "راهنما و پشتیبانی", icon: "help" },
  ];

  return (
    <div
      className={
        showPromoBar
          ? "promo-layout flex h-dvh flex-col bg-zinc-950"
          : "flex h-dvh flex-col bg-background"
      }
      style={
        showPromoBar
          ? ({ "--promo-bar-height": "3rem" } as React.CSSProperties)
          : undefined
      }
    >
      {showPromoBar ? (
        <ProPromoBar
          isOnTrial={currentPage!.isOnTrial}
          trialEndsAt={currentPage!.trialEndsAt}
          planKey={currentPage!.planKey as "free" | "pro" | "business"}
        />
      ) : null}
      <div
        className={
          showPromoBar
            ? "flex min-h-0 flex-1 rounded-t-3xl overflow-hidden bg-background isolate"
            : "flex min-h-0 flex-1 bg-background isolate"
        }
      >
        <SidebarProvider defaultOpen className="min-h-0! h-full">
          <Sidebar
            dir="rtl"
            side="right"
            variant="sidebar"
            className="border-e border-sidebar-border border-s-0!"
          >
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

              {/* لینک من + آمار + ابزارها */}
              <SidebarGroup>
                <SidebarGroupContent>
                  <SidebarNav
                    items={[myPageNavItem, statsNavItem, ...toolsNavItems]}
                  />
                </SidebarGroupContent>
              </SidebarGroup>
            </SidebarContent>

            <SidebarFooter className="gap-2">
              {currentPage ? (
                <SidebarUpgradeCard
                  pageId={currentPage.id}
                  planKey={currentPage.planKey}
                />
              ) : null}
              <SidebarReferralCTA
                href={"/dashboard/referral" as Route}
                availableMonths={referralAvailableMonths}
              />
              <SidebarIconRow items={iconRowItems} />
            </SidebarFooter>
          </Sidebar>

          <SidebarInset className="flex h-full flex-col overflow-hidden">
            <ImpersonationBar />
            <header className="shrink-0 z-20 border-b bg-background/84 backdrop-blur-sm pt-[env(safe-area-inset-top)]">
              {/* Mobile: single client component that switches layout
                  by route. On /more it renders the page title + plan
                  pill + switcher. Everywhere else the switcher is
                  centred and /me gets gear + share actions. */}
              <div className="md:hidden">
                <MobileHeaderContent
                  pages={switcherItems}
                  currentPageId={viewer.profile.id}
                  signOut={signOutAction}
                  publicUrl={publicUrl}
                  slug={viewer.profile.slug}
                  displayName={
                    viewer.profile.fullName || viewer.profile.title || "کارت"
                  }
                  host={`${viewer.profile.domain}/${viewer.profile.slug}`}
                  planKey={currentPage?.planKey ?? "free"}
                  isOnTrial={currentPage?.isOnTrial ?? false}
                  trialEndsAt={currentPage?.trialEndsAt ?? null}
                  billingHref={
                    currentPage?.planKey === "pro"
                      ? (`/dashboard/pages/${currentPageId}/billing` as Route)
                      : "/pro"
                  }
                />
              </div>

              {/* Desktop: 3-column grid that perfectly centres the
                  ⌘K palette pill regardless of title/actions widths. */}
              <div className="hidden h-14 items-center gap-3 px-3 sm:h-16 sm:px-6 md:grid md:grid-cols-[1fr_minmax(0,360px)_1fr]">
                <div className="min-w-0">
                  <DashboardPageTitle />
                </div>
                <div className="flex justify-center">
                  <CommandPaletteTrigger
                    pages={switcherItems}
                    currentPageId={currentPageId}
                    publicUrl={publicUrl}
                    features={{
                      contactForm: contactFormFeature,
                      bookings: bookingsFeature,
                      csvExport: csvExportFeature,
                    }}
                  />
                </div>
                <div className="flex justify-end">
                  <MeHeaderActions
                    publicUrl={publicUrl}
                    slug={viewer.profile.slug}
                    displayName={
                      viewer.profile.fullName || viewer.profile.title || "کارت"
                    }
                    host={`${viewer.profile.domain}/${viewer.profile.slug}`}
                  />
                </div>
              </div>
            </header>

            <main className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden pb-nav md:pb-0 [-webkit-overflow-scrolling:touch] overscroll-contain">
              <PullToRefresh>{children}</PullToRefresh>
            </main>
            <MobileBottomNav variant="dashboard" isProUser={isProUser} />
          </SidebarInset>
        </SidebarProvider>
      </div>
      <InstallPrompt />
    </div>
  );
}
