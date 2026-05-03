"use client";

import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS: { href: string; label: string }[] = [
  { href: "/admin/affiliates", label: "نمای کلی" },
  { href: "/admin/affiliates/applications", label: "درخواست‌ها" },
  { href: "/admin/affiliates/list", label: "همکاران" },
  { href: "/admin/affiliates/payouts", label: "تسویه‌ها" },
  { href: "/admin/affiliates/ledger", label: "دفترچه پورسانت" },
  { href: "/admin/affiliates/settings", label: "تنظیمات" },
];

export function AdminAffiliatesNav() {
  const pathname = usePathname() || "";
  return (
    <div className="-mx-4 flex gap-1 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
      {TABS.map((t) => {
        const active =
          t.href === "/admin/affiliates"
            ? pathname === "/admin/affiliates"
            : pathname.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href as Route}
            className={`shrink-0 rounded-full px-4 py-2 text-[13px] font-bold transition ${
              active
                ? "bg-foreground text-background"
                : "bg-muted text-foreground hover:bg-muted/70"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
