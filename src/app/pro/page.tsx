import {
  BarChart3Icon,
  CalendarCheckIcon,
  CheckIcon,
  HeadphonesIcon,
  LinkIcon,
  SparklesIcon,
  type LucideIcon,
} from "lucide-react";
import type { Metadata } from "next";

import { signOutAction } from "@/app/dashboard/actions";
import { BrandMark } from "@/components/shared/brand-mark";
import { Button } from "@/components/ui/button";
import { requireCompletedProfile } from "@/lib/auth/session";

import { PlanSelector } from "./plan-selector";

export const metadata: Metadata = {
  title: "ارتقا به کیوآر Pro",
  description:
    "تمام امکانات حرفه‌ای کیوآر را با اشتراک Pro فعال کنید — لینک‌های نامحدود، رزرو، رویداد، AI و آمار کامل.",
};

type FeatureGroup = {
  title: string;
  icon: LucideIcon;
  items: string[];
};

const FEATURE_GROUPS: FeatureGroup[] = [
  {
    title: "صفحه و لینک‌ها",
    icon: LinkIcon,
    items: [
      "لینک‌های نامحدود روی نمایه عمومی",
      "قالب‌ها و تم‌های اختصاصی Pro",
      "حذف برندینگ کیوآر از کارت و صفحه",
      "اتصال دامنه اختصاصی شخصی",
    ],
  },
  {
    title: "هوش مصنوعی",
    icon: SparklesIcon,
    items: [
      "نگارش و بهینه‌سازی بیو و عنوان لینک‌ها با AI",
      "پیشنهاد هوشمند محتوای رویداد و فرم رزرو",
    ],
  },
  {
    title: "رزرو و رویداد",
    icon: CalendarCheckIcon,
    items: [
      "رزرو نامحدود با اتصال به Google Calendar و Zoom",
      "برگزاری رویدادهای پولی با درگاه پرداخت داخلی",
      "یادآور خودکار پیامکی و ایمیلی برای مهمان‌ها",
    ],
  },
  {
    title: "آمار و بازاریابی",
    icon: BarChart3Icon,
    items: [
      "آمار کامل بازدید، کلیک و منبع ورود",
      "خروجی CSV و گزارش هفتگی تفکیکی",
      "پشتیبانی از UTM و پیکسل ردیابی",
    ],
  },
  {
    title: "پشتیبانی و سخت‌افزار",
    icon: HeadphonesIcon,
    items: [
      "پشتیبانی اولویت‌دار با پاسخ‌گویی ۲۴/۷",
      "یک کارت فیزیکی NFC رایگان در سال",
    ],
  },
];

export default async function ProPage() {
  await requireCompletedProfile();

  return (
    <div dir="rtl" className="min-h-dvh bg-background text-foreground">
      <header className="sticky top-0 z-20 border-b border-border bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
          <BrandMark variant="wordmark" href="/dashboard" />
          <form action={signOutAction}>
            <Button
              type="submit"
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-foreground"
            >
              خروج از حساب
            </Button>
          </form>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 pb-20 pt-10 sm:px-6 sm:pt-16 lg:pt-20">
        <div className="grid items-start gap-10 lg:grid-cols-[1.05fr_1fr] lg:gap-16">
          <section className="space-y-8">
            <div className="space-y-4">
              <span
                aria-hidden
                className="inline-flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary"
              >
                <SparklesIcon className="size-5" />
              </span>
              <div className="space-y-2">
                <p className="text-sm font-semibold text-primary">کیوآر Pro</p>
                <h1 className="font-heading text-3xl font-extrabold tracking-tight sm:text-4xl">
                  اشتراک حرفه‌ای کیوآر را فعال کنید
                </h1>
                <p className="max-w-md text-sm leading-7 text-muted-foreground sm:text-[15px]">
                  همه ابزارهایی که برای ساخت یک نمایه حرفه‌ای، مدیریت رزرو و رشد
                  کسب‌وکار شخصی نیاز دارید — در یک اشتراک ساده.
                </p>
              </div>
            </div>

            <ul className="space-y-7">
              {FEATURE_GROUPS.map((group) => {
                const Icon = group.icon;
                return (
                  <li key={group.title} className="space-y-3">
                    <div className="flex items-center gap-2.5">
                      <span
                        aria-hidden
                        className="flex size-7 items-center justify-center rounded-full bg-primary/10 text-primary"
                      >
                        <Icon className="size-4" />
                      </span>
                      <h2 className="text-[15px] font-bold">{group.title}</h2>
                    </div>
                    <ul className="space-y-2.5 ps-9">
                      {group.items.map((item) => (
                        <li
                          key={item}
                          className="flex items-start gap-2 text-[13.5px] leading-7 text-muted-foreground"
                        >
                          <CheckIcon
                            className="mt-1 size-3.5 shrink-0 text-foreground/70"
                            aria-hidden
                          />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </li>
                );
              })}
            </ul>
          </section>

          <aside className="lg:sticky lg:top-24">
            <PlanSelector />
          </aside>
        </div>
      </main>
    </div>
  );
}
