/**
 * `/affiliate` — public affiliate program landing page.
 *
 * Distinct from `/dashboard/referral` (user-to-user free-month invites).
 * This page recruits influencers, content sites, agencies, and creators
 * to become approved partners earning 30% cash commission on yearly
 * conversions.
 *
 * Design references: partners.dub.co/dub. Tone: confident, transparent,
 * Iranian creator-economy native. Persian-first; no English fallback
 * needed for V1 — copy is calibrated for Persian readers.
 *
 * The interactive earnings calculator pulls live yearly Pro pricing from
 * `loadPricingPlans()` so it always reflects the canonical plan registry
 * — never hardcode prices here.
 */
import type { Metadata } from "next";
import type { Route } from "next";
import Image from "next/image";
import Link from "next/link";

import {
  ArrowLeftIcon,
  BadgeCheckIcon,
  BanknoteIcon,
  CheckCircle2Icon,
  CoinsIcon,
  GiftIcon,
  HandshakeIcon,
  LinkIcon,
  PartyPopperIcon,
  RocketIcon,
  ShieldCheckIcon,
  SparklesIcon,
  TrendingUpIcon,
  UsersIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EarningsCalculator } from "@/app/affiliate/earnings-calculator";
import { FaqAccordion } from "@/components/marketing/faq-accordion";
import { getAffiliateSettings } from "@/lib/affiliate";
import { loadPricingPlans } from "@/lib/pricing-registry";
import { formatPersianNumber, toPersianDigits } from "@/lib/persian";

export const metadata: Metadata = {
  title: "همکاری در فروش کی‌یو‌آر — ۳۰٪ پورسانت روی فروش سالانه",
  description:
    "اگه مخاطب داری و کی‌یو‌آر رو معرفی کنی، روی هر فروش سالانه‌ی پرو، ۳۰٪ پورسانت نقدی می‌گیری. مخاطبت هم ۳ ماه پرو رایگان مهمونته.",
  openGraph: {
    title: "همکاری در فروش کی‌یو‌آر",
    description:
      "۳۰٪ پورسانت نقدی روی هر فروش سالانه‌ی پرو که از طرف تو میاد. واریز مستقیم به شبا.",
    images: [{ url: "/api/og/affiliate", width: 1200, height: 630 }],
  },
};

export const dynamic = "force-dynamic";

export default async function AffiliateLandingPage() {
  const [settings, plans] = await Promise.all([
    getAffiliateSettings(),
    loadPricingPlans(),
  ]);

  const proPlan = plans.find((p) => p.key === "pro");
  // Fallback only if plan registry is empty (dev). Production always
  // has a Pro plan with priceAnnualToman set.
  const yearlyToman = proPlan?.priceAnnualToman ?? 1_980_000;
  const commissionPct = settings.commissionPct;
  const minWithdrawalToman = settings.minWithdrawalToman;
  const holdingDays = settings.holdingPeriodDays;

  return (
    <div
      dir="rtl"
      className="min-h-dvh bg-muted font-sans pt-[env(safe-area-inset-top)]"
    >
      {/* Discover-style floating pill navbar */}
      <div className="sticky top-4 z-30 mx-auto w-full max-w-6xl px-5">
        <header className="flex h-16 w-full items-center justify-between rounded-full bg-card pl-2 pr-5 ring-1 ring-border">
          <Link
            href="/"
            aria-label="کیوآر"
            className="flex items-center gap-2 transition-opacity hover:opacity-80"
          >
            <Image
              src="/brand/logo.svg"
              alt=""
              width={20}
              height={24}
              className="h-6 w-auto"
              priority
            />
            <span className="hidden text-lg font-bold sm:inline">کیوآر</span>
          </Link>
          <div className="flex items-center gap-2">
            <Link
              href="/auth"
              className="hidden h-11 items-center justify-center rounded-full bg-accent px-5 text-sm font-bold text-accent-foreground transition-colors hover:bg-accent/80 sm:flex"
            >
              ورود
            </Link>
            <Link
              href="/auth"
              className="flex h-11 items-center justify-center rounded-full bg-foreground px-5 text-sm font-bold text-background transition-colors hover:bg-foreground/90"
            >
              ثبت‌نام رایگان
            </Link>
          </div>
        </header>
      </div>

      {/* Hero */}
      <section className="mx-auto w-full max-w-6xl px-5 pt-16 pb-12 sm:pt-24 sm:pb-16">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="inline-flex items-center gap-2 rounded-full bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground ring-1 ring-border">
            <HandshakeIcon className="size-3.5 text-primary" />
            <span>برنامه‌ی همکاری در فروش کی‌یو‌آر</span>
          </div>

          <h1 className="max-w-3xl text-3xl font-bold leading-tight sm:text-4xl md:text-5xl">
            مخاطبت رو به{" "}
            <span className="text-primary">درآمد ماهانه</span> تبدیل کن
          </h1>

          <p className="max-w-xl text-[15px] leading-9 text-muted-foreground sm:text-[17px]">
            روی هر فروش سالانه‌ی پلن پرو که از معرفی تو بیاد،{" "}
            {toPersianDigits(commissionPct)}٪ پورسانت نقدی می‌گیری. به شبای خودت
            واریز می‌شه. مخاطبت هم ۳ ماه پرو رایگان مهمون توئه. بدون سقف، بدون
            قرارداد طولانی.
          </p>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button
              size="lg"
              className="h-12 rounded-full px-6 text-[15px] font-bold sm:min-w-56"
              render={<Link href="/affiliate/apply" />}
            >
              <RocketIcon className="size-4" />
              همین الان درخواست بده
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="h-12 rounded-full px-6 text-[15px] font-bold sm:min-w-44"
              render={<Link href="#how-it-works" scroll />}
            >
              چطور کار می‌کنه؟
            </Button>
          </div>

          {/* Stat row */}
          <div className="mt-4 grid w-full grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat
              label="پورسانت روی فروش سالانه"
              value={`${toPersianDigits(commissionPct)}٪`}
            />
            <Stat label="هدیه به مخاطب" value={`${toPersianDigits(3)} ماه پرو`} />
            <Stat
              label="حداقل تسویه"
              value={`${formatPersianNumber(Math.round(minWithdrawalToman / 1000))} هزار تومان`}
            />
            <Stat
              label="دوره‌ی نگه‌داری"
              value={`${toPersianDigits(holdingDays)} روز`}
            />
          </div>
        </div>
      </section>

      {/* Calculator */}
      <section className="py-16 sm:py-20">
        <div className="mx-auto w-full max-w-6xl px-5">
          <div className="rounded-3xl bg-card p-6 sm:p-10">
            <div className="grid gap-10 lg:grid-cols-2 lg:items-center lg:gap-16">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1.5 text-[11px] font-bold text-emerald-700">
                  ماشین‌حساب درآمد
                </div>
                <h2 className="mt-4 text-[clamp(26px,4.5vw,40px)] font-bold leading-[1.1]">
                  ببین ماهی چقدر می‌تونی دربیاری
                </h2>
                <p className="mt-4 text-[14px] leading-8 text-muted-foreground sm:text-[15px]">
                  اسلایدر رو حرکت بده. هر فروش سالانه‌ی پلن پرو ({" "}
                  <span
                    className="font-mono font-bold text-foreground"
                    dir="ltr"
                  >
                    {formatPersianNumber(yearlyToman)}
                  </span>{" "}
                  تومان) با کد تو، {toPersianDigits(commissionPct)}٪ سهم تو
                  می‌شه. عدد ماشین‌حساب خام‌ترین حالت ممکنه — به زبان دیگه:
                  همه‌چی نقد، بدون مالیات مازاد، بدون شرط مازاد.
                </p>

                <ul className="mt-6 space-y-3 text-[13px] leading-7 text-muted-foreground">
                  <Bullet>تسویه‌ی مستقیم به شبای خودت</Bullet>
                  <Bullet>بدون سقف ماهانه — هرچقدر بیاری، هرچقدر سهم</Bullet>
                  <Bullet>گزارش زنده‌ی کلیک، ثبت‌نام و فروش</Bullet>
                </ul>
              </div>

              <EarningsCalculator
                yearlyToman={yearlyToman}
                commissionPct={commissionPct}
              />
            </div>
          </div>
        </div>
      </section>

      {/* Who it's for */}
      <section className="py-16 sm:py-24">
        <div className="mx-auto w-full max-w-6xl px-5">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-[clamp(26px,4.5vw,40px)] font-bold leading-[1.1]">
              برای کی ساخته شده؟
            </h2>
            <p className="mt-4 text-[14px] leading-8 text-muted-foreground sm:text-[15px]">
              کی‌یو‌آر یه ابزار حرفه‌ای برای فریلنسرها، کلینیک‌ها و کسب‌وکارهای
              کوچیک ایرانیه. اگه با همچین مخاطبی کار می‌کنی، این برنامه برای
              توئه.
            </p>
          </div>

          <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <AudienceCard
              title="کریتورهای اینستاگرام و یوتیوب"
              body="اگه درباره‌ی برندسازی، فریلنسری، کسب‌وکار آنلاین یا مارکتینگ تولید محتوا می‌کنی، مخاطبت دقیقاً همینه."
              tone="violet"
            />
            <AudienceCard
              title="کانال‌های تلگرام تخصصی"
              body="کانال‌های دیجیتال‌مارکتینگ، فریلنسری، استارتاپی، طراحی، آموزشی."
              tone="sky"
            />
            <AudienceCard
              title="آژانس‌های دیجیتال و طراحی"
              body="کی‌یو‌آر رو به مشتری‌هاتون پیشنهاد بدید — هم کارتون راحت‌تر می‌شه، هم درآمد دائمی."
              tone="emerald"
            />
            <AudienceCard
              title="بلاگ‌ها و سایت‌های محتوایی"
              body="ریویو بنویس، توی لیست ابزارها بذار، توی محتوا لینک بده. کلیک به فروش وصله."
              tone="amber"
            />
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="py-16 sm:py-24">
        <div className="mx-auto w-full max-w-6xl px-5">
          <div className="mx-auto max-w-3xl text-center">
            <div className="inline-flex items-center gap-2 rounded-full bg-card px-3 py-1.5 text-[11px] font-bold text-primary ring-1 ring-border">
              چطور کار می‌کنه
            </div>
            <h2 className="mt-4 text-[clamp(26px,4.5vw,40px)] font-bold leading-[1.1]">
              چهار قدم تا اولین واریزی
            </h2>
          </div>

          <div className="mt-10 grid gap-3 lg:grid-cols-4">
            <Step
              num={1}
              icon={BadgeCheckIcon}
              title="درخواست بده"
              body="فرم کوتاه پر می‌کنی — نام، کانال، تخمین مخاطب. کم‌تر از سه دقیقه."
            />
            <Step
              num={2}
              icon={ShieldCheckIcon}
              title="تأیید بشی"
              body="تیم ما درخواستت رو دستی بررسی می‌کنه. معمولاً همون روز جواب می‌گیری."
            />
            <Step
              num={3}
              icon={LinkIcon}
              title="لینک اختصاصی بگیر"
              body="یه لینک کوتاه و OG-image سفارشی به اسم تو می‌سازیم. توی هر جا بذار."
            />
            <Step
              num={4}
              icon={BanknoteIcon}
              title="تسویه به شبا"
              body="بعد از ۳۰ روز نگه‌داری، با یک کلیک درخواست تسویه می‌دی. واریز مستقیم."
            />
          </div>
        </div>
      </section>

      {/* Commission terms */}
      <section className="py-16 sm:py-24">
        <div className="mx-auto w-full max-w-6xl px-5">
          <div className="grid gap-10 lg:grid-cols-[1fr_1.4fr] lg:items-start lg:gap-14">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-amber-100 px-3 py-1.5 text-[11px] font-bold text-amber-700">
                شرایط شفاف
              </div>
              <h2 className="mt-4 text-[clamp(26px,4.5vw,40px)] font-bold leading-[1.1]">
                هیچ ستاره‌ای زیر متن نیست
              </h2>
              <p className="mt-4 text-[14px] leading-8 text-muted-foreground sm:text-[15px]">
                هر چیزی که قراره بهت بگیم رو همین‌جا گفتیم. شرایط روزِ ثبت‌نامت
                توی پرونده‌ت ذخیره می‌شه و تا وقتی تو فعالی، تغییر نمی‌کنه.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Term
                icon={CoinsIcon}
                title={`${toPersianDigits(commissionPct)}٪ پورسانت`}
                body="روی اولین پرداخت سالانه‌ی هر مخاطبی که از طرف تو میاد. مبلغ پورسانت روی مبلغ خالص پرداختی (بعد از کسر تخفیف‌ها) حساب می‌شه."
              />
              <Term
                icon={GiftIcon}
                title={`${toPersianDigits(3)} ماه پرو رایگان`}
                body="مخاطبت اگه پلن سالانه بگیره، خودکار ۳ ماه به دوره‌ش اضافه می‌شه. صفر اقدام دستی، صفر کد تخفیف."
              />
              <Term
                icon={ShieldCheckIcon}
                title={`دوره‌ی نگه‌داری ${toPersianDigits(holdingDays)} روز`}
                body="پورسانت بعد از ۳۰ روز از تاریخ پرداخت، قابل برداشت می‌شه. این پنجره برای پوشش بازپرداخت‌های احتمالی هست."
              />
              <Term
                icon={BanknoteIcon}
                title="تسویه به شبا"
                body={`از ${formatPersianNumber(Math.round(minWithdrawalToman / 1000))} هزار تومان به بالا می‌تونی درخواست تسویه بدی. واریز مستقیم بانکی به شمار شبای خودت.`}
              />
              <Term
                icon={TrendingUpIcon}
                title="بدون سقف"
                body="هرچقدر فروش بیاری، همون‌قدر پورسانت می‌گیری. فقط فروش سالانه پورسانت داره — فروش ماهانه فقط ثبت می‌شه."
              />
              <Term
                icon={SparklesIcon}
                title="ابزار آماده"
                body="کیت برند، متن‌های نمونه فارسی و انگلیسی، OG-image اختصاصی توی پنل خودت در دسترسه."
              />
            </div>
          </div>
        </div>
      </section>

      {/* Rules */}
      <section className="py-16 sm:py-20">
        <div className="mx-auto w-full max-w-6xl px-5">
          <div className="mx-auto max-w-3xl">
            <h2 className="text-[clamp(22px,3.5vw,32px)] font-bold leading-[1.15]">
              قواعد بازی
            </h2>
            <p className="mt-3 text-[14px] leading-8 text-muted-foreground sm:text-[15px]">
              برای حفظ کیفیت برند و انصاف بین همکاران، چند خط قرمز داریم. اگه
              توی این محدوده‌ها حرکت کنی، هیچ مشکلی پیش نمیاد.
            </p>
          </div>

          <div className="mx-auto mt-8 grid max-w-3xl gap-3 sm:grid-cols-2">
            <RuleRow ok>محتوای صادقانه و مرتبط با مخاطب واقعی خودت</RuleRow>
            <RuleRow ok>ریویو، آموزش، استفاده‌ی شخصی، لیست ابزار</RuleRow>
            <RuleRow ok>پست استوری، کپشن، توضیحات یوتیوب، بیو</RuleRow>
            <RuleRow ok>بلاگ، نیوزلتر، پادکست</RuleRow>
            <RuleRow>تبلیغ روی برند کی‌یو‌آر در گوگل ادز</RuleRow>
            <RuleRow>خرید با کد خودت برای دور زدن سیستم</RuleRow>
            <RuleRow>ثبت‌نام جعلی یا تشویق به خرید بدون نیاز واقعی</RuleRow>
            <RuleRow>کپی محتوای رسمی کی‌یو‌آر بدون کریدیت یا اعتبار</RuleRow>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-16 sm:py-24">
        <div className="mx-auto w-full max-w-6xl px-5">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-[clamp(26px,4.5vw,40px)] font-bold leading-[1.1]">
              سوال‌های پرتکرار
            </h2>
            <p className="mt-3 text-[14px] leading-8 text-muted-foreground sm:text-[15px]">
              اگه جواب سوالت اینجا نبود، توی فرم درخواست بنویس — معمولاً ظرف یک
              روز جواب می‌دیم.
            </p>
          </div>
          <div className="mx-auto mt-8 max-w-3xl">
            <FaqAccordion
              items={[
                {
                  q: "پورسانت کِی قابل برداشت می‌شه؟",
                  a: `هر فروشی که میاد، اول وارد وضعیت «در انتظار» می‌شه. ${toPersianDigits(holdingDays)} روز بعد از پرداخت، اگه بازپرداخت یا تخلفی نباشه، خودکار به وضعیت «قابل برداشت» می‌ره. بعد از اون می‌تونی درخواست تسویه بدی.`,
                },
                {
                  q: "اگه مخاطبم پولش رو پس بگیره چی می‌شه؟",
                  a: "اگه قبل از پایان دوره‌ی نگه‌داری بازپرداخت اتفاق بیفته، اون مبلغ از سهم تو کسر می‌شه. اگه قبلش تسویه شده باشی، توی تسویه‌ی بعدی تنظیم می‌شه. این برای انصاف هست — ما فقط روی فروش‌هایی که واقعی موندن بهت پورسانت می‌دیم.",
                },
                {
                  q: "اگه درخواستم رد شد دلیلش رو می‌گید؟",
                  a: "بله. ممکنه بگیم که دامنه‌ی مخاطبت با کی‌یو‌آر هم‌خوان نیست (مثلاً مخاطب کاملاً غیرفارسی)، یا ممکنه بخوایم اطلاعات بیشتری بدی. هیچ ردی بدون توضیح نیست.",
                },
                {
                  q: "می‌تونم روی گوگل ادز یا اینستاگرام ادز تبلیغ کنم؟",
                  a: "تبلیغ کلی پلتفرم خودت بله، ولی بدینگ روی برند «کی‌یو‌آر» یا «kioar» ممنوعه. این کار باعث می‌شه ما برای ترافیک خودمون به خودمون پول بدیم. اگه شک داشتی، قبل از شروع از پشتیبانی بپرس.",
                },
                {
                  q: "بهترین کانال‌ها برای معرفی کی‌یو‌آر کدوم‌هاست؟",
                  a: "تجربه‌ی همکارای فعلی نشون داده اینستاگرام و یوتیوب با محتوای آموزشی، کانال‌های تخصصی تلگرام، و بلاگ‌های دیجیتال‌مارکتینگ بهترین نتیجه رو می‌دن. مخاطب هدف ما فریلنسرها، کسب‌وکارهای کوچیک و کلینیک‌هاست.",
                },
                {
                  q: "تسویه چند وقت یک‌بار انجام می‌شه؟",
                  a: "تسویه دستی و هفتگی انجام می‌شه. وقتی درخواست تسویه می‌دی، ظرف ۲ تا ۵ روز کاری به شبات واریز می‌شه و کد رهگیری برات پیامک می‌آد.",
                },
                {
                  q: "آیا پورسانت روی پرداخت‌های بعدی هم ادامه داره؟",
                  a: "فعلاً نه. توی نسخه‌ی اول، پورسانت فقط روی اولین فروش سالانه‌ی هر مخاطب جدید اعمال می‌شه. روی پرداخت‌های تمدید بعدی پورسانت نمی‌گیری. این رو شفاف می‌گیم چون هیچ‌چیز از این بدتر نیست که وعده‌ی بدیم و بعداً عوضش کنیم.",
                },
                {
                  q: "اگه مخاطبم پلن ماهانه بگیره چی؟",
                  a: "اون فروش ثبت می‌شه ولی پورسانتی روش حساب نمی‌شه و مخاطبت هم اون ۳ ماه رایگان رو نمی‌گیره. سیاست ما اینه که فقط فروش‌های سالانه پاداش داشته باشن — هم برای تو پایدارتره، هم برای مخاطب ارزش‌مندتر.",
                },
              ]}
            />
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-16 sm:py-24">
        <div className="mx-auto w-full max-w-6xl px-5">
          <div className="mx-auto flex max-w-3xl flex-col items-center gap-5 rounded-3xl bg-card p-8 text-center sm:p-12">
            <span className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <PartyPopperIcon className="size-6" />
            </span>
            <h2 className="text-[clamp(24px,4vw,36px)] font-bold leading-[1.15]">
              آماده‌ای شروع کنی؟
            </h2>
            <p className="max-w-md text-[14px] leading-7 text-muted-foreground sm:text-[15px]">
              فرم درخواست کوتاهه. تیم ما معمولاً همون روز جواب می‌ده. وقتی تأیید
              بشی، لینک اختصاصیت آماده‌ست و می‌تونی شروع کنی.
            </p>
            <Button
              size="lg"
              className="h-12 rounded-full px-8 text-[15px] font-bold"
              render={<Link href="/affiliate/apply" />}
            >
              <ArrowLeftIcon className="size-4" />
              درخواست بده
            </Button>
            <p className="text-[11px] leading-6 text-muted-foreground">
              با ارسال درخواست، با{" "}
              <Link
                href={"/legal/affiliate-terms" as Route}
                className="underline underline-offset-2"
              >
                قواعد برنامه
              </Link>{" "}
              موافقت می‌کنی.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Subcomponents
// ---------------------------------------------------------------------------

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-card px-4 py-3 text-center">
      <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-[18px] font-bold leading-tight text-foreground sm:text-[20px]">
        {value}
      </p>
    </div>
  );
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2.5 text-muted-foreground">
      <CheckCircle2Icon className="mt-0.5 size-4 shrink-0 text-emerald-600" />
      <span>{children}</span>
    </li>
  );
}

function AudienceCard({
  title,
  body,
  tone,
}: {
  title: string;
  body: string;
  tone: "violet" | "emerald" | "amber" | "sky";
}) {
  const toneRing: Record<string, string> = {
    violet: "bg-violet-100 text-violet-700",
    emerald: "bg-emerald-100 text-emerald-700",
    amber: "bg-amber-100 text-amber-700",
    sky: "bg-sky-100 text-sky-700",
  };
  return (
    <div className="rounded-3xl bg-card p-5 transition hover:bg-card/80">
      <div
        className={`flex size-11 items-center justify-center rounded-2xl ${toneRing[tone]}`}
      >
        <UsersIcon className="size-5" />
      </div>
      <h3 className="mt-4 text-[16px] font-bold leading-tight">{title}</h3>
      <p className="mt-2 text-[13px] leading-7 text-muted-foreground">{body}</p>
    </div>
  );
}

function Step({
  num,
  icon: Icon,
  title,
  body,
}: {
  num: number;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-3xl bg-card p-6">
      <div className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-2xl bg-violet-100 text-violet-700">
          <Icon className="size-5" />
        </div>
        <span className="font-mono text-[28px] font-bold text-muted-foreground/40">
          {toPersianDigits(num)}
        </span>
      </div>
      <h3 className="mt-4 text-[17px] font-bold leading-tight">{title}</h3>
      <p className="mt-2 text-[13px] leading-7 text-muted-foreground">{body}</p>
    </div>
  );
}

function Term({
  icon: Icon,
  title,
  body,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-3xl bg-card p-5">
      <div className="flex size-10 items-center justify-center rounded-2xl bg-muted text-violet-700">
        <Icon className="size-5" />
      </div>
      <h3 className="mt-4 text-[15px] font-bold leading-tight">{title}</h3>
      <p className="mt-2 text-[13px] leading-7 text-muted-foreground">{body}</p>
    </div>
  );
}

function RuleRow({
  ok,
  children,
}: {
  ok?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`flex items-start gap-3 rounded-2xl px-4 py-3 ${
        ok ? "bg-emerald-50" : "bg-rose-50"
      }`}
    >
      <span
        className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
          ok ? "bg-emerald-600 text-white" : "bg-rose-600 text-white"
        }`}
      >
        {ok ? "✓" : "×"}
      </span>
      <span className="text-[13px] leading-6 text-foreground">{children}</span>
    </div>
  );
}
