"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const TABS: { href: string; label: string }[] = [
  { href: "/affiliate/dashboard", label: "نمای کلی" },
  { href: "/affiliate/dashboard/earnings", label: "درآمد" },
  { href: "/affiliate/dashboard/payouts", label: "تسویه" },
  { href: "/affiliate/dashboard/resources", label: "منابع و کیت برند" },
  { href: "/affiliate/dashboard/settings", label: "تنظیمات" },
];

export function AffiliateNavTabs() {
  const pathname = usePathname();

  return (
    <nav
      className="flex items-center gap-1 overflow-x-auto py-2 no-scrollbar"
      aria-label="پنل همکاری در فروش"
    >
      {TABS.map((t) => {
        const active =
          t.href === "/affiliate/dashboard"
            ? pathname === t.href
            : pathname?.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href as never}
            className={cn(
              "shrink-0 rounded-full px-3.5 py-1.5 text-[13px] font-medium transition tap-target",
              active
                ? "bg-ink text-paper"
                : "text-ink-soft hover:bg-paper-soft hover:text-ink",
            )}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
