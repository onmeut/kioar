"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Route } from "next";

import { cn } from "@/lib/utils";

const TABS: ReadonlyArray<{ href: Route; label: string; exact?: boolean }> = [
  { href: "/admin/cards" as Route, label: "سفارش‌ها", exact: true },
  { href: "/admin/cards/inventory" as Route, label: "موجودی و دسته‌ها" },
  { href: "/admin/cards/settings" as Route, label: "تنظیمات کارت و پلن" },
  { href: "/admin/cards/offers" as Route, label: "پیشنهادها" },
];

export function CardsSectionTabs() {
  const pathname = usePathname();
  return (
    <div className="flex w-full gap-1 overflow-x-auto rounded-xl border border-border bg-muted/40 p-1 no-scrollbar md:w-fit">
      {TABS.map((tab) => {
        const isActive = tab.exact
          ? pathname === tab.href
          : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "shrink-0 rounded-lg px-4 py-1.5 text-sm font-semibold transition-colors",
              isActive
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
