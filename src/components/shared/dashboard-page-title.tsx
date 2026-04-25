"use client";

import { usePathname } from "next/navigation";

const TITLE_MAP: Array<{ match: RegExp; title: string }> = [
  // Dashboard
  { match: /^\/dashboard\/links(\/|$)/, title: "لینک‌ها" },
  { match: /^\/dashboard\/requests(\/|$)/, title: "درخواست کارت" },
  { match: /^\/dashboard\/events\/[^/]+/, title: "رویداد من" },
  { match: /^\/dashboard\/events\/?$/, title: "رویدادهای من" },
  { match: /^\/dashboard\/?$/, title: "داشبورد" },
  // Admin
  { match: /^\/admin\/users\/[^/]+/, title: "جزئیات کاربر" },
  { match: /^\/admin\/users\/?$/, title: "کاربران" },
  { match: /^\/admin\/events\/new/, title: "رویداد جدید" },
  { match: /^\/admin\/events\//, title: "ویرایش رویداد" },
  { match: /^\/admin\/requests(\/|$)/, title: "درخواست‌های کارت" },
  { match: /^\/admin\/?$/, title: "نمای کلی" },
  // Public-in-shell
  { match: /^\/events\/[^/]+/, title: "رویداد" },
  { match: /^\/events\/?$/, title: "رویدادها" },
];

export function DashboardPageTitle({ fallback }: { fallback?: string }) {
  const pathname = usePathname() || "";
  const match = TITLE_MAP.find((entry) => entry.match.test(pathname));
  const title = match?.title ?? fallback ?? "";

  return <h1 className="truncate text-lg font-bold sm:text-xl">{title}</h1>;
}
