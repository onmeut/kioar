/**
 * `/affiliate/apply/thanks` — confirmation page after submitting an
 * affiliate application. SMS confirmation has already fired in the
 * server action; this is a friendly handoff explaining what happens
 * next.
 */
import type { Metadata } from "next";
import Link from "next/link";

import { ClockIcon, MailCheckIcon, MessageCircleIcon } from "lucide-react";

import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "درخواستت رسید — کی‌یو‌آر",
};

export default function AffiliateApplyThanksPage() {
  return (
    <div className="min-h-dvh bg-paper text-ink">
      <SiteHeader />
      <main className="marketing-shell py-16 sm:py-24">
        <div className="mx-auto max-w-xl text-center">
          <div className="mx-auto flex size-16 items-center justify-center rounded-3xl bg-emerald-100 text-emerald-700">
            <MailCheckIcon className="size-7" />
          </div>
          <h1 className="mt-6 text-[clamp(28px,5vw,40px)] font-semibold leading-[1.1]">
            درخواستت رسید 👋
          </h1>
          <p className="mt-4 text-[14px] leading-8 text-ink-soft sm:text-[15px]">
            یه پیامک تأیید برات فرستادیم. تیم ما درخواستت رو دستی بررسی می‌کنه و
            معمولاً همون روز جواب می‌گیری. اگه به اطلاعات بیشتری نیاز داشتیم،
            باهات تماس می‌گیریم.
          </p>

          <div className="mx-auto mt-10 grid max-w-sm gap-3 text-start">
            <Step
              icon={ClockIcon}
              title="بررسی درخواست"
              body="چند ساعت تا یک روز کاری طول می‌کشه."
            />
            <Step
              icon={MailCheckIcon}
              title="نتیجه از طریق پیامک"
              body="چه تأیید بشه، چه رد، توضیح می‌گیری."
            />
            <Step
              icon={MessageCircleIcon}
              title="بعد از تأیید"
              body="پنل همکاری در فروش برات فعال می‌شه و لینک اختصاصیت آماده‌ست."
            />
          </div>

          <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Button
              variant="outline"
              size="lg"
              className="h-11 rounded-full px-6 text-[14px] font-bold"
              render={<Link href="/me" />}
            >
              بازگشت به داشبورد
            </Button>
            <Button
              size="lg"
              className="h-11 rounded-full px-6 text-[14px] font-bold"
              render={<Link href="/affiliate" />}
            >
              صفحه‌ی برنامه
            </Button>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

function Step({
  icon: Icon,
  title,
  body,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-hairline bg-paper-soft p-4">
      <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-white text-violet-700 ring-1 ring-hairline">
        <Icon className="size-4" />
      </div>
      <div className="min-w-0">
        <p className="text-[13px] font-bold text-ink">{title}</p>
        <p className="text-[12px] leading-6 text-ink-soft">{body}</p>
      </div>
    </div>
  );
}
