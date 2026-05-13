import { signOutAction } from "@/app/(app)/dashboard/actions";
import type { Route } from "next";
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

// Admin shell reads session/impersonation cookies on every request and
// renders per-admin data. Force the whole `/admin/*` subtree dynamic so
// Next never attempts to statically render a child segment.
export const dynamic = "force-dynamic";

const adminNavItems: SidebarNavItem[] = [
  { href: "/admin", label: "نمای کلی", icon: "admin", match: "exact" },
  { href: "/admin/users", label: "کاربران", icon: "users" },
  {
    href: "/admin/pages" as Route,
    label: "صفحه‌ها",
    icon: "page",
    match: "prefix",
  },
  {
    href: "/admin/billing/pages" as Route,
    label: "اشتراک‌ها",
    icon: "billing",
    match: "prefix",
  },
  {
    href: "/admin/billing/invoices" as Route,
    label: "فاکتورها",
    icon: "billing",
    match: "prefix",
  },
  {
    href: "/admin/billing/config" as Route,
    label: "تنظیمات صورت‌حساب",
    icon: "billing",
    match: "exact",
  },
  {
    href: "/admin/plans" as Route,
    label: "پلن‌ها و قابلیت‌ها",
    icon: "plans",
    match: "prefix",
  },
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
  { href: "/admin/sms", label: "پیامک‌ها", icon: "sms", match: "prefix" },
  {
    href: "/admin/discounts",
    label: "تخفیف‌ها",
    icon: "discounts",
    match: "prefix",
  },
  {
    href: "/admin/affiliates" as Route,
    label: "همکاری در فروش",
    icon: "affiliate",
    match: "prefix",
  },
  {
    href: "/admin/categories" as Route,
    label: "دسته‌بندی‌ها",
    icon: "page",
    match: "prefix",
  },
  {
    href: "/admin/audit" as Route,
    label: "گزارش فعالیت",
    icon: "notifications",
    match: "prefix",
  },
];

export default async function AdminLayout({
  children,
  modal,
}: {
  children: React.ReactNode;
  modal: React.ReactNode;
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
        <header className="sticky top-0 z-20 border-b bg-background/84 backdrop-blur-sm pt-[env(safe-area-inset-top)]">
          <div className="flex h-14 items-center justify-between gap-3 px-4 sm:h-16 sm:px-6">
            <DashboardPageTitle />
          </div>
        </header>

        <main className="flex-1 pb-nav md:pb-0">{children}</main>
        {modal}
        <MobileBottomNav variant="admin" />
      </SidebarInset>
    </SidebarProvider>
  );
}
