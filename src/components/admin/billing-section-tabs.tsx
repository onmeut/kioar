"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const TABS = [
  { href: "/admin/billing/pages", label: "اشتراک‌ها" },
  { href: "/admin/billing/invoices", label: "فاکتورها" },
] as const;

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
