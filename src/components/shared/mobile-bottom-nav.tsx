"use client";

import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  CalendarClockIcon,
  CalendarDaysIcon,
  CreditCardIcon,
  GaugeIcon,
  LayoutGridIcon,
  Link2Icon,
  PlusSquareIcon,
  ShieldCheckIcon,
  UsersIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";

type NavItem = {
  href: Route;
  label: string;
  icon: LucideIcon;
  match?: "exact" | "prefix";
  primary?: boolean;
};

const dashboardItems: NavItem[] = [
  { href: "/dashboard", label: "داشبورد", icon: GaugeIcon, match: "exact" },
  { href: "/dashboard/bookings", label: "رزروها", icon: CalendarClockIcon },
  {
    href: "/dashboard/links",
    label: "لینک‌ها",
    icon: Link2Icon,
    primary: true,
  },
  { href: "/dashboard/events", label: "رویدادها", icon: CalendarDaysIcon },
  {
    href: "/dashboard/requests/new",
    label: "کارت",
    icon: CreditCardIcon,
  },
];

const adminItems: NavItem[] = [
  { href: "/admin", label: "نما", icon: LayoutGridIcon, match: "exact" },
  { href: "/admin/users", label: "کاربران", icon: UsersIcon },
  {
    href: "/admin/events/new",
    label: "رویداد",
    icon: PlusSquareIcon,
    primary: true,
  },
  { href: "/admin/requests", label: "درخواست", icon: CreditCardIcon },
  { href: "/dashboard", label: "داشبورد", icon: ShieldCheckIcon },
];

export function MobileBottomNav({
  variant = "dashboard",
}: {
  variant?: "dashboard" | "admin";
}) {
  const pathname = usePathname();
  const items = variant === "admin" ? adminItems : dashboardItems;

  return (
    <nav
      dir="rtl"
      aria-label="ناوبری موبایل"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-3 pb-[max(0.5rem,env(safe-area-inset-bottom))] md:hidden"
    >
      <div className="pointer-events-auto w-full max-w-md">
        <div
          className={cn(
            "grid grid-cols-5 items-stretch gap-0.5 rounded-[28px] border border-black/8 bg-background/92 px-1.5 py-1.5 shadow-[0_14px_36px_-18px_rgba(15,23,42,0.35)] backdrop-blur-xl",
          )}
        >
          {items.map((item) => {
            const Icon = item.icon;
            const active =
              item.match === "exact"
                ? pathname === item.href
                : pathname === item.href ||
                  pathname.startsWith(`${item.href}/`);

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-label={item.label}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "tap-target relative flex flex-col items-center justify-center gap-0 rounded-full px-1 py-1.5 text-[10.5px] font-semibold transition-colors",
                  item.primary
                    ? "-mt-5 aspect-square size-14 justify-self-center self-center bg-primary text-primary-foreground shadow-[0_16px_34px_-14px_color-mix(in_srgb,var(--primary)_60%,transparent)]"
                    : active
                      ? "bg-primary/12 text-primary"
                      : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon
                  className={cn("size-5", item.primary ? "size-6" : undefined)}
                  aria-hidden
                />
                <span className={cn(item.primary && "sr-only")}>
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
