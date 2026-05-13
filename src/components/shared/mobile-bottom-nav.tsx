"use client";

import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  BarChart3Icon,
  CalendarClockIcon,
  CreditCardIcon,
  FormInputIcon,
  GlobeIcon,
  LayoutGridIcon,
  MenuIcon,
  PlusSquareIcon,
  SparklesIcon,
  UsersIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";

type NavItem = {
  href: Route;
  label: string;
  icon: LucideIcon;
  match?: "exact" | "prefix";
  /** Upgrade tab — violet accent treatment */
  accent?: boolean;
};

function getDashboardItems(isProUser: boolean): NavItem[] {
  const base: NavItem[] = [
    { href: "/me" as Route, label: "لینک من", icon: GlobeIcon },
    {
      href: "/bookings" as Route,
      label: "هماهنگی‌ها",
      icon: CalendarClockIcon,
    },
    {
      href: "/insights" as Route,
      label: "آمار",
      icon: BarChart3Icon,
      match: "exact",
    },
  ];

  if (!isProUser) {
    return [
      ...base,
      {
        href: "/pro" as Route,
        label: "ارتقا",
        icon: SparklesIcon,
        accent: true,
      },
    ];
  }

  return [
    ...base,
    {
      href: "/forms" as Route,
      label: "فرم‌ها",
      icon: FormInputIcon,
    },
  ];
}

const adminItems: NavItem[] = [
  { href: "/admin", label: "نما", icon: LayoutGridIcon, match: "exact" },
  { href: "/admin/users", label: "کاربران", icon: UsersIcon },
  { href: "/admin/events/new", label: "رویداد", icon: PlusSquareIcon },
  { href: "/admin/requests", label: "درخواست", icon: CreditCardIcon },
];

export function MobileBottomNav({
  variant = "dashboard",
  isProUser = false,
}: {
  variant?: "dashboard" | "admin";
  isProUser?: boolean;
}) {
  const pathname = usePathname();
  const items = variant === "admin" ? adminItems : getDashboardItems(isProUser);

  const moreActive = pathname === "/more" || pathname.startsWith("/more/");

  return (
    <nav
      dir="rtl"
      aria-label="ناوبری موبایل"
      className={cn(
        "pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-3 md:hidden",
        "pb-[max(0.75rem,env(safe-area-inset-bottom))]",
      )}
    >
      <div className="pointer-events-auto w-full max-w-md">
        <div className="grid grid-cols-5 items-stretch gap-2 rounded-[28px] border border-black/8 bg-background/92 px-1.5 py-1.5 shadow-nav backdrop-blur-xl">
          {items.map((item) => {
            const Icon = item.icon;
            const active =
              item.match === "exact"
                ? pathname === item.href
                : pathname === item.href ||
                  pathname.startsWith(`${item.href}/`);

            if (item.accent) {
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-label={item.label}
                  aria-current={active ? "page" : undefined}
                  className="tap-target relative flex flex-col items-center justify-center gap-0.5 rounded-2xl bg-violet-50 px-1 py-1.5 text-[10.5px] font-semibold text-violet-600 ring-1 ring-violet-200 transition-colors hover:bg-violet-100"
                >
                  <Icon className="size-5" aria-hidden />
                  <span className="truncate">{item.label}</span>
                </Link>
              );
            }

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-label={item.label}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "tap-target relative flex flex-col items-center justify-center gap-0.5 rounded-2xl px-1 py-1.5 text-[10.5px] font-semibold transition-colors",
                  active
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="size-5" aria-hidden />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}

          {/* "More" — opens the dedicated /more menu page (PWA-standard
              pattern, replaces the previous sidebar Sheet on mobile). */}
          <Link
            href={"/more" as Route}
            aria-label="بیشتر"
            aria-current={moreActive ? "page" : undefined}
            className={cn(
              "tap-target relative flex flex-col items-center justify-center gap-0.5 rounded-2xl px-1 py-1.5 text-[10.5px] font-semibold transition-colors",
              moreActive
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <MenuIcon className="size-5" aria-hidden />
            <span className="truncate">بیشتر</span>
          </Link>
        </div>
      </div>
    </nav>
  );
}
