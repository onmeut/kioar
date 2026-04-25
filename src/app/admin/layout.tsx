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
import { requireAdmin } from "@/lib/auth/session";

const adminNavItems: SidebarNavItem[] = [
  { href: "/admin", label: "نمای کلی", icon: "admin", match: "exact" },
  { href: "/admin/users", label: "کاربران", icon: "users" },
  {
    href: "/admin/events/new",
    label: "رویداد جدید",
    icon: "create",
    match: "exact",
  },
  {
    href: "/admin/requests",
    label: "درخواست‌های کارت",
    icon: "requests",
    match: "exact",
  },
  { href: "/dashboard", label: "داشبورد کاربر", icon: "home", match: "exact" },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const viewer = await requireAdmin();

  return (
    <SidebarProvider defaultOpen>
      <Sidebar
        dir="rtl"
        side="right"
        variant="sidebar"
        className="border-e border-sidebar-border border-s-0!"
      >
        <SidebarHeader className="h-16 justify-center px-4">
          <BrandMark variant="mark" href="/admin" />
        </SidebarHeader>

        <SidebarContent className="px-2">
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarNav items={adminNavItems} />
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

      <SidebarInset>
        <ImpersonationBar />
        <header className="sticky top-0 z-20 border-b bg-background/84 backdrop-blur-sm">
          <div className="flex h-14 items-center justify-between gap-3 px-4 sm:h-16 sm:px-6">
            <DashboardPageTitle />
          </div>
        </header>

        <main className="flex-1 pb-nav md:pb-0">{children}</main>
        <MobileBottomNav variant="admin" />
      </SidebarInset>
    </SidebarProvider>
  );
}
