"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckIcon, ExternalLinkIcon } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type IndustryId = "design" | "medical" | "podcast" | "restaurant";

const industries: { id: IndustryId; label: string; lines: string[] }[] = [
  {
    id: "design",
    label: "طراح و فریلنسر",
    lines: [
      "نمونه‌کار + قیمت + رزرو، در یک نشانی",
      "آمار کلیک هر شبکه‌ی اجتماعی",
      "ICS خودکار به‌روی Google Meet",
    ],
  },
  {
    id: "medical",
    label: "پزشک و کلینیک",
    lines: [
      "نوبت‌گیری آنلاین با بافر بین جلسات",
      "آدرس مطب + مسیر در گوگل‌مپ",
      "تأییدیه‌ی پیامکی برای بیمار",
    ],
  },
  {
    id: "podcast",
    label: "تولیدکننده‌ی محتوا",
    lines: [
      "اپیزود تازه همیشه بالای پروفایل",
      "آیکن خودکار اسپاتیفای، اپل پادکست، کستباکس",
      "لینک حامی مالی با شمارنده‌ی کلیک",
    ],
  },
  {
    id: "restaurant",
    label: "کافه و رستوران",
    lines: [
      "QR روی استیکر میز یا منو",
      "لینک سریع به اسنپ‌فود، تپسی‌فود، باسلام",
      "ساعت کار با وضعیت زنده",
    ],
  },
];

const logoCustomers = [
  "اِلِگانت",
  "آرامیس",
  "نوین گرافیک",
  "پالمر گروپ",
  "آبلوس استودیو",
];

export function LeadingBusinesses() {
  const [active, setActive] = useState<IndustryId>("design");
  const activeData = industries.find((i) => i.id === active)!;

  return (
    <section
      id="customers"
      aria-labelledby="leading-heading"
      className="bg-paper py-16 sm:py-24"
    >
      <div className="marketing-shell">
        {/* head */}
        <div className="grid items-end gap-6 md:grid-cols-[1.6fr_1fr]">
          <div>
            <h2
              id="leading-heading"
              className="text-[clamp(26px,4vw,42px)] leading-[1.1] font-semibold tracking-[-0.02em] text-ink"
            >
              کی‌یو‌آر، انتخاب کسب‌وکارهای پیشروی ایرانی
            </h2>
            <div className="mt-6 flex flex-wrap items-center gap-2.5">
              <Link
                href="/auth"
                className={cn(
                  buttonVariants({ size: "lg" }),
                  "h-11 rounded-full bg-ink px-6 text-[14px] font-medium text-paper hover:bg-ink/90",
                )}
              >
                رایگان امتحان کن
              </Link>
              <Link
                href="/contact"
                className={cn(
                  buttonVariants({ variant: "ghost", size: "lg" }),
                  "h-11 rounded-full border border-hairline bg-paper px-6 text-[14px] font-medium text-ink hover:bg-paper-soft",
                )}
              >
                تماس با فروش
              </Link>
            </div>
          </div>
          <p className="text-[15px] leading-[1.7] text-ink-soft">
            کی‌یو‌آر برای کسب‌وکار تو ساخته شده — رشد دنبال‌کننده، رزرو نوبت
            بیشتر، و رضایت مشتری.
          </p>
        </div>

        {/* showcase frame */}
        <div className="mt-12 rounded-3xl border border-hairline bg-paper-soft p-2 sm:p-3">
          {/* tabs centered */}
          <div className="flex flex-wrap justify-center gap-1.5 pt-3 pb-2">
            {industries.map((i) => (
              <button
                key={i.id}
                type="button"
                onClick={() => setActive(i.id)}
                className={cn(
                  "rounded-full px-4 py-1.5 text-[13px] font-medium transition-all duration-200",
                  active === i.id
                    ? "bg-paper text-ink shadow-[0_4px_12px_-4px_rgba(0,0,0,0.12)] ring-1 ring-hairline"
                    : "text-ink-soft hover:bg-paper/60 hover:text-ink",
                )}
                aria-pressed={active === i.id}
              >
                {i.label}
              </button>
            ))}
          </div>

          {/* fake product screenshot */}
          <div className="mt-3 overflow-hidden rounded-2xl border border-hairline bg-paper">
            <DashboardMock industry={activeData} />
          </div>
        </div>

        {/* trust strip with logos */}
        <div className="mt-10 flex flex-wrap items-center justify-between gap-y-4 gap-x-8 rounded-2xl bg-paper-soft px-6 py-5">
          <div>
            <p className="text-[14px] font-semibold text-ink">
              پلتفرم پیشروی کارت ویزیت دیجیتال در ایران
            </p>
            <p className="text-[12px] text-ink-soft">
              مورد اعتماد ۲۰۰هزار+ کاربر در سراسر کشور
            </p>
          </div>
          <ul className="flex flex-wrap items-center gap-x-2.5 gap-y-2">
            {logoCustomers.map((name) => (
              <li
                key={name}
                className="rounded-full border border-hairline bg-paper px-3 py-1.5 text-[12px] font-bold text-ink/70 transition-colors hover:text-ink"
              >
                {name}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

/* ─── A simple dashboard-style screenshot mock ── */
function DashboardMock({
  industry,
}: {
  industry: { id: IndustryId; label: string; lines: string[] };
}) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr]">
      {/* sidebar */}
      <div className="hidden border-l border-hairline p-5 lg:block">
        <p className="text-[11px] font-bold tracking-[0.18em] text-ink-soft uppercase">
          داشبورد
        </p>
        <ul className="mt-4 space-y-1">
          {[
            "داشبورد",
            "صفحه‌ی من",
            "هماهنگی‌ها",
            "رویدادها",
            "آمار",
            "تنظیمات",
          ].map((l, i) => (
            <li
              key={l}
              className={cn(
                "rounded-lg px-3 py-2 text-[13px] font-medium",
                i === 2
                  ? "bg-paper-soft text-ink"
                  : "text-ink-soft hover:text-ink",
              )}
            >
              {l}
            </li>
          ))}
        </ul>
      </div>

      {/* main */}
      <div className="p-6 sm:p-8">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold text-ink-soft">
              نمای {industry.label}
            </p>
            <h4 className="text-[20px] font-semibold tracking-[-0.01em] text-ink">
              نوبت‌های هفته
            </h4>
          </div>
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-semibold text-emerald-700">
            ۹ از ۱۲ پر شد
          </span>
        </div>

        {/* checklist */}
        <ul className="mt-5 grid gap-2 sm:grid-cols-2">
          {industry.lines.map((line) => (
            <li
              key={line}
              className="flex items-start gap-2 rounded-xl border border-hairline bg-paper-soft px-3 py-2.5 text-[13px] text-ink"
            >
              <span className="mt-0.5 grid size-4 shrink-0 place-items-center rounded-full bg-ink text-paper">
                <CheckIcon className="size-2.5" strokeWidth={3} />
              </span>
              {line}
            </li>
          ))}
        </ul>

        {/* fake chart row */}
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-hairline p-4">
            <p className="text-[11px] font-semibold text-ink-soft">
              بازدید این هفته
            </p>
            <p className="mt-1 text-[26px] font-semibold tracking-tight text-ink">
              ۸٬۲۱۲
            </p>
            <div className="mt-3 flex h-12 items-end gap-1">
              {[40, 60, 50, 75, 90, 65, 80].map((h, i) => (
                <span
                  key={i}
                  className={cn(
                    "flex-1 rounded-t-md",
                    i === 4 ? "bg-ink" : "bg-ink/15",
                  )}
                  style={{ height: `${h}%` }}
                />
              ))}
            </div>
          </div>
          <div className="rounded-xl border border-hairline p-4">
            <p className="text-[11px] font-semibold text-ink-soft">
              بلاک‌های پرکلیک
            </p>
            <ul className="mt-2 space-y-1.5">
              {[
                { name: "اینستاگرام", n: "۱٬۲۲۸" },
                { name: "وبسایت", n: "۸۹۲" },
                { name: "تلگرام", n: "۵۴۸" },
                { name: "Cal.com", n: "۳۲۱" },
              ].map((r) => (
                <li
                  key={r.name}
                  className="flex items-center justify-between text-[12px] text-ink"
                >
                  <span className="font-medium">{r.name}</span>
                  <span className="font-semibold text-ink-soft">{r.n}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <a
          href="#"
          className="mt-5 inline-flex items-center gap-1.5 text-[12px] font-semibold text-ink hover:opacity-70"
        >
          ورود به داشبورد دمو
          <ExternalLinkIcon className="size-3.5" />
        </a>
      </div>
    </div>
  );
}
