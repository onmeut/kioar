"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

import type { Route } from "next";

const TABS: ReadonlyArray<{ href: Route; label: string }> = [
  { href: "/admin/billing/overview" as Route, label: "نمای کلی" },
  { href: "/admin/billing/pages", label: "اشتراک‌ها" },
  { href: "/admin/billing/invoices", label: "فاکتورها" },
  { href: "/admin/billing/plans-pricing", label: "قیمت‌گذاری پلن‌ها" },
  { href: "/admin/billing/config", label: "تنظیمات" },
  ...(process.env.NODE_ENV !== "production"
    ? [{ href: "/admin/billing/test-tools" as Route, label: "ابزار آزمایشی" }]
    : []),
];

export function BillingSectionTabs() {
  const pathname = usePathname();

  return (
    <div className="flex gap-1 rounded-xl border border-border bg-muted/40 p-1 w-fit">
      {TABS.map((tab) => {
        const isActive = pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "rounded-lg px-4 py-1.5 text-sm font-semibold transition-colors",
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
