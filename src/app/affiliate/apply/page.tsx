/**
 * `/affiliate/apply` — gated affiliate application intake.
 *
 * Behaviour matrix (see `getAffiliateStateForUser`):
 *   - signed out                      → redirect to /auth?next=/affiliate/apply
 *   - has approved code               → redirect to /affiliate/dashboard
 *   - has open application (pending / needs_info)
 *                                     → redirect to /affiliate/dashboard?already=pending
 *   - rejected before, or never applied
 *                                     → render the form
 *
 * Form is intentionally short. Sheba/banking is collected at first
 * payout time, NOT here — friction-down per spec.
 */
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";

import {
  BanknoteIcon,
  CheckCircle2Icon,
  HandshakeIcon,
  RocketIcon,
  ShieldCheckIcon,
  TrendingUpIcon,
} from "lucide-react";

import { ApplyForm } from "@/app/affiliate/apply/apply-form";
import { getApplyDefaults } from "@/app/affiliate/apply/actions";
import {
  getAffiliateSettings,
  getAffiliateStateForUser,
} from "@/lib/affiliate";
import { getCurrentViewer } from "@/lib/auth/session";
import { toPersianDigits } from "@/lib/persian";

export const metadata: Metadata = {
  title: "درخواست همکاری در فروش — کی‌یو‌آر",
  description: "فرم درخواست برنامه‌ی همکاری در فروش کی‌یو‌آر.",
};

export const dynamic = "force-dynamic";

export default async function AffiliateApplyPage() {
  const viewer = await getCurrentViewer();
  if (!viewer?.user) {
    redirect("/auth?next=%2Faffiliate%2Fapply");
  }

  const [affiliateState, settings, defaults] = await Promise.all([
    getAffiliateStateForUser(viewer.user.id),
    getAffiliateSettings(),
    getApplyDefaults(viewer.user.id),
  ]);

  if (affiliateState.kind === "approved") redirect("/affiliate/dashboard");
  if (
    affiliateState.kind === "pending" ||
    affiliateState.kind === "needs_info"
  ) {
    redirect("/affiliate/dashboard?already=pending");
  }

  const commissionPct = settings.commissionPct;

  return (
    <div
      dir="rtl"
      className="relative min-h-dvh bg-muted font-sans pt-[env(safe-area-inset-top)]"
    >
      {/* Floating pill navbar */}
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
          <Link
            href="/affiliate"
            className="flex h-11 items-center justify-center rounded-full bg-accent px-5 text-sm font-bold text-accent-foreground transition-colors hover:bg-accent/80"
          >
            درباره همکاری در فروش
          </Link>
        </header>
      </div>

      <main className="mx-auto w-full max-w-6xl px-5 py-10 sm:py-16">
        <div className="grid gap-10 lg:grid-cols-[1fr_440px] lg:items-start lg:gap-14">
          {/* Left — value props */}
          <div className="flex flex-col gap-6">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground ring-1 ring-border">
                <HandshakeIcon className="size-3.5 text-primary" />
                <span>همکاری در فروش</span>
              </div>
              <h1 className="mt-4 text-[clamp(28px,4vw,42px)] font-bold leading-[1.15]">
                یه فرم کوتاه —<br />
                تیم ما همون روز
                <br />
                <span className="text-primary">جواب می‌ده</span>
              </h1>
              <p className="mt-4 text-[15px] leading-8 text-muted-foreground">
                شماره موبایلت از قبل توی حسابته. اطلاعات بانکی بعداً موقع اولین
                تسویه ازت می‌گیریم — الان لازم نیست.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <BenefitCard
                icon={TrendingUpIcon}
                title={`${toPersianDigits(commissionPct)}٪ پورسانت نقدی`}
                body="روی هر فروش سالانه‌ی پرو که از کد تو بیاد، بدون سقف."
                tone="primary"
              />
              <BenefitCard
                icon={BanknoteIcon}
                title="واریز مستقیم به شبا"
                body="بعد از دوره‌ی نگه‌داری، مستقیم به حسابت واریز می‌شه."
                tone="emerald"
              />
              <BenefitCard
                icon={RocketIcon}
                title="۳ ماه پرو برای مخاطبت"
                body="هر کسی که با لینک تو بیاد، ۳ ماه پرو رایگان دریافت می‌کنه."
                tone="amber"
              />
              <BenefitCard
                icon={ShieldCheckIcon}
                title="گزارش زنده"
                body="داشبورد کامل با آمار کلیک، ثبت‌نام و فروش — لحظه‌به‌لحظه."
                tone="sky"
              />
            </div>

            <ul className="space-y-2.5 text-[13px] leading-7 text-muted-foreground">
              {[
                "بدون قرارداد طولانی — هر وقت خواستی خارج می‌شی",
                "فریلنسر، کریتور، آژانس — فرقی نمی‌کنه",
                "تسویه در اولین درخواست با رسیدن به حداقل مبلغ",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <CheckCircle2Icon className="mt-0.5 size-4 shrink-0 text-primary" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {/* Right — form card */}
          <div className="flex flex-col gap-4">
            {affiliateState.kind === "rejected" ? (
              <div className="rounded-3xl bg-amber-50 p-4 text-[13px] leading-7 text-amber-900 ring-1 ring-amber-200">
                درخواست قبلیت رد شده بود. می‌تونی دوباره درخواست بدی.
                {affiliateState.adminNote ? (
                  <span className="mt-2 block">
                    <span className="font-bold">یادداشت تیم:</span>{" "}
                    {affiliateState.adminNote}
                  </span>
                ) : null}
              </div>
            ) : null}

            <div className="rounded-3xl bg-card p-6 sm:p-8">
              <p className="mb-6 text-[13px] font-bold text-foreground">
                اطلاعات درخواست
              </p>
              <ApplyForm
                defaultFullName={defaults.fullName}
                userPhone={viewer.user.phone}
              />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function BenefitCard({
  icon: Icon,
  title,
  body,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
  tone: "primary" | "emerald" | "amber" | "sky";
}) {
  const chip: Record<string, string> = {
    primary: "bg-primary/10 text-primary",
    emerald: "bg-emerald-100 text-emerald-700",
    amber: "bg-amber-100 text-amber-700",
    sky: "bg-sky-100 text-sky-700",
  };
  return (
    <div className="rounded-3xl bg-card p-5">
      <span
        className={`flex size-10 items-center justify-center rounded-2xl ${chip[tone]}`}
      >
        <Icon className="size-5" />
      </span>
      <p className="mt-3 text-[14px] font-bold leading-tight">{title}</p>
      <p className="mt-1 text-[12px] leading-6 text-muted-foreground">{body}</p>
    </div>
  );
}
