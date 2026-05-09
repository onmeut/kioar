"use client";

import { usePathname } from "next/navigation";

const TITLE_MAP: Array<{ match: RegExp; title: string }> = [
  // Dashboard / app
  { match: /^\/me(\/|$)/, title: "لینک من" },
  { match: /^\/more(\/|$)/, title: "بیشتر" },
  { match: /^\/bookings(\/|$)/, title: "هماهنگی‌ها" },
  { match: /^\/forms(\/|$)/, title: "پاسخ‌های فرم" },
  { match: /^\/premium(\/|$)/, title: "کارت هوشمند" },
  { match: /^\/my-events\/[^/]+/, title: "رویداد من" },
  { match: /^\/my-events\/?$/, title: "رویدادهای من" },
  { match: /^\/dashboard\/?$/, title: "داشبورد" },
  // Admin
  { match: /^\/admin\/users\/[^/]+/, title: "جزئیات کاربر" },
  { match: /^\/admin\/users\/?$/, title: "کاربران" },
  { match: /^\/admin\/pages\/?$/, title: "صفحه‌ها" },
  { match: /^\/admin\/events\/new/, title: "رویداد جدید" },
  { match: /^\/admin\/events\//, title: "ویرایش رویداد" },
  { match: /^\/admin\/requests(\/|$)/, title: "درخواست‌های کارت" },
  {
    match: /^\/admin\/affiliates\/applications(\/|$)/,
    title: "درخواست‌های همکاری",
  },
  { match: /^\/admin\/affiliates\/payouts(\/|$)/, title: "تسویه‌های همکاری" },
  { match: /^\/admin\/affiliates\/ledger(\/|$)/, title: "دفترچه پورسانت" },
  { match: /^\/admin\/affiliates\/settings(\/|$)/, title: "تنظیمات همکاری" },
  { match: /^\/admin\/affiliates\/[^/]+/, title: "جزئیات همکار" },
  { match: /^\/admin\/affiliates\/?$/, title: "همکاری در فروش" },
  { match: /^\/admin\/?$/, title: "نمای کلی" },
  // Public-in-shell
  { match: /^\/events\/[^/]+/, title: "رویداد" },
  { match: /^\/events\/?$/, title: "رویدادها" },
];

export function DashboardPageTitle({ fallback }: { fallback?: string }) {
  const pathname = usePathname() || "";
  const match = TITLE_MAP.find((entry) => entry.match.test(pathname));
  const title = match?.title ?? fallback ?? "";

  return <h1 className="truncate text-md font-bold sm:text-lg">{title}</h1>;
}
