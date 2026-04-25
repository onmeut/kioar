import { signOutAction } from "@/app/dashboard/actions";
import { ImpersonationBar } from "@/components/admin/impersonation-bar";
import {
  SidebarNav,
  type SidebarNavItem,
} from "@/components/navigation/sidebar-nav";
import { SidebarUserDropdown } from "@/components/navigation/sidebar-user-dropdown";
import { BrandMark } from "@/components/shared/brand-mark";
import { DashboardPageTitle } from "@/components/shared/dashboard-page-title";
import { MobileBottomNav } from "@/components/shared/mobile-bottom-nav";
import { ProPromoBar } from "@/components/shared/pro-promo-bar";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar";
import { requireCompletedProfile } from "@/lib/auth/session";

const dashboardNavItems: SidebarNavItem[] = [
  { href: "/dashboard", label: "داشبورد", icon: "home", match: "exact" },
  { href: "/dashboard/links", label: "لینک‌ها", icon: "links" },
  { href: "/dashboard/bookings", label: "رزروها", icon: "bookings" },
  { href: "/dashboard/events", label: "رویدادها", icon: "events" },
  { href: "/dashboard/requests/new", label: "درخواست کارت", icon: "requests" },
];

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const viewer = await requireCompletedProfile();

  return (
    <div
      className="promo-layout flex h-dvh flex-col bg-zinc-950"
      style={{ "--promo-bar-height": "2.5rem" } as React.CSSProperties}
    >
      <ProPromoBar />
      <div className="flex min-h-0 flex-1 rounded-t-3xl [contain:paint] bg-background">
        <SidebarProvider defaultOpen className="!min-h-0 h-full">
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
                  <SidebarNav items={dashboardNavItems} />
                </SidebarGroupContent>
              </SidebarGroup>
            </SidebarContent>

            <SidebarFooter className="border-t border-sidebar-border p-3">
              <SidebarUserDropdown
                fullName={viewer.profile.fullName}
                avatarUrl={viewer.profile.avatarUrl}
                slug={viewer.profile.slug}
                signOut={signOutAction}
              />
            </SidebarFooter>
          </Sidebar>

          <SidebarInset className="flex h-full flex-col overflow-hidden">
            <ImpersonationBar />
            <header className="shrink-0 z-20 border-b bg-background/84 backdrop-blur-sm">
              <div className="flex h-14 items-center justify-between gap-3 px-4 sm:h-16 sm:px-6">
                <DashboardPageTitle />
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
