"use client";

/**
 * `/trial` claim screen.
 *
 * Three modes from a single render:
 *   1. One eligible plan        → plan card + 3-row timeline + CTA.
 *   2. Two eligible plans       → tab between them.
 *   3. Mixed eligibility        → ineligible plans show an "already used"
 *      hint so the user understands why the CTA is gone.
 *
 * Trial length is `option.trialDays` from the registry — never hardcoded.
 * Reminder day = `trialDays - 2` (matches cron spacing without coupling).
 */
import { useMemo, useState, useTransition } from "react";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import {
  ArrowLeftIcon,
  BellRingIcon,
  CalendarClockIcon,
  CheckIcon,
  RocketIcon,
  SparklesIcon,
} from "lucide-react";
import { toast } from "sonner";

import { BrandMark } from "@/components/shared/brand-mark";
import { Button } from "@/components/ui/button";
import { formatPersianNumber, toPersianDigits } from "@/lib/persian";
import { cn } from "@/lib/utils";

export type TrialClaimOption = {
  id: string;
  key: "pro" | "business";
  nameFa: string;
  descriptionFa: string | null;
  trialDays: number;
  priceMonthlyToman: number;
  priceAnnualToman: number;
  eligible: boolean;
  ineligibleReason:
    | null
    | "already_used"
    | "page_on_paid_plan"
    | "page_in_trial"
    | "page_not_active";
};

type Props = {
  pageId: string;
  pageDisplayName: string;
  shareHost: string;
  options: TrialClaimOption[];
  /** Where "رد کردن" sends the user (Free path). */
  skipHref: string;
  /** Where to land after a successful trial start. */
  successHref: string;
};

function formatToman(value: number) {
  return toPersianDigits(formatPersianNumber(value));
}

const REASON_LABELS: Record<
  Exclude<TrialClaimOption["ineligibleReason"], null>,
  string
> = {
  already_used: "آزمایش این پلن قبلاً برای این صفحه فعال شده است.",
  page_in_trial: "این صفحه در حال حاضر در دوره‌ی آزمایشی دیگری است.",
  page_on_paid_plan: "این صفحه پلن پولی فعال دارد.",
  page_not_active: "وضعیت اشتراک این صفحه اجازه‌ی شروع آزمایش نمی‌دهد.",
};

const PLAN_LABEL_FA: Record<"pro" | "business", string> = {
  pro: "پلن حرفه‌ای",
  business: "پلن کسب‌وکار",
};

export function TrialClaimScreen({
  pageId,
  pageDisplayName,
  options,
  skipHref,
  successHref,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [pendingKey, setPendingKey] = useState<string | null>(null);

  const initialKey = useMemo(() => {
    return options.find((o) => o.eligible)?.key ?? options[0]?.key ?? "pro";
  }, [options]);
  const [activeKey, setActiveKey] = useState<"pro" | "business">(initialKey);

  const active = options.find((o) => o.key === activeKey) ?? options[0];

  const handleStart = (option: TrialClaimOption) => {
    if (!option.eligible || isPending) return;
    setPendingKey(option.key);
    startTransition(async () => {
      try {
        const res = await fetch("/api/billing/trial/start", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ pageId, planKey: option.key }),
        });
        const data = (await res.json().catch(() => null)) as
          | { ok: true; redirectUrl: string }
          | { ok: false; error: string }
          | null;

        if (!res.ok || !data || !("ok" in data) || !data.ok) {
          const error =
            (data && "error" in data && data.error) || "خطای ناشناخته";
          toast.error(`شروع آزمایش انجام نشد: ${error}`);
          setPendingKey(null);
          return;
        }

        toast.success("آزمایش رایگان فعال شد.");
        router.push(successHref as Route);
        router.refresh();
      } catch (error) {
        toast.error(`ارتباط با سرور برقرار نشد: ${(error as Error).message}`);
        setPendingKey(null);
      }
    });
  };

  if (!active) {
    return (
      <div className="flex flex-col items-center gap-6 rounded-3xl bg-white p-8 text-center text-sm text-zinc-600 ring-1 ring-zinc-200">
        پلن قابل آزمایشی برای این صفحه وجود ندارد.
        <Button
          render={<a href={skipHref} />}
          variant="outline"
          className="h-11"
        >
          بازگشت به داشبورد
        </Button>
      </div>
    );
  }

  const trialDays = active.trialDays;
  const reminderDay = Math.max(1, trialDays - 2);

  const timeline = [
    {
      icon: <SparklesIcon className="size-5" />,
      day: "امروز",
      title: "همه‌ی امکانات فعال می‌شود",
      hint: "بدون نیاز به کارت بانکی — همین حالا شروع کن.",
    },
    {
      icon: <BellRingIcon className="size-5" />,
      day: `روز ${toPersianDigits(reminderDay)}`,
      title: "پیامک یادآوری برایت می‌فرستیم",
      hint: "تا با خیال راحت تصمیم بگیری.",
    },
    {
      icon: <CalendarClockIcon className="size-5" />,
      day: `روز ${toPersianDigits(trialDays)}`,
      title: "پایان دوره‌ی آزمایش",
      hint: "اگر ادامه ندادی، صفحه‌ات روی پلن رایگان می‌ماند.",
    },
  ];

  return (
    <div className="space-y-7">
      {/* Header */}
      <div className="flex flex-col items-center gap-5 text-center">
        <BrandMark variant="mark" className="size-12" />
        <div className="flex flex-col gap-3">
          <h1 className="text-3xl font-bold leading-tight text-zinc-900 sm:text-4xl">
            تست {toPersianDigits(trialDays)} روزه رایگان
          </h1>
          <p className="px-2 text-sm leading-7 text-zinc-600 sm:text-[15px]">
            همه‌ی امکانات {PLAN_LABEL_FA[active.key]} برای صفحه‌ی{" "}
            <span className="font-semibold text-zinc-900">
              {pageDisplayName}
            </span>{" "}
            فعال می‌شود.
          </p>
        </div>
      </div>

      {/* Plan picker */}
      {options.length > 1 ? (
        <div
          role="radiogroup"
          aria-label="انتخاب پلن آزمایشی"
          className="grid grid-cols-2 gap-3"
        >
          {options.map((opt) => {
            const isActive = opt.key === activeKey;
            const monthly = opt.priceMonthlyToman
              ? `${formatToman(opt.priceMonthlyToman)} تومان / ماه`
              : null;
            return (
              <button
                key={opt.key}
                type="button"
                role="radio"
                aria-checked={isActive}
                onClick={() => setActiveKey(opt.key)}
                disabled={!opt.eligible}
                className={cn(
                  "relative flex flex-col items-start gap-1 rounded-2xl bg-white p-4 text-start ring-1 transition-all",
                  isActive
                    ? "ring-2 ring-zinc-900 shadow-sm"
                    : "ring-zinc-200 hover:ring-zinc-300",
                  !opt.eligible && "opacity-50",
                )}
              >
                <span className="text-base font-bold text-zinc-900 sm:text-lg">
                  {PLAN_LABEL_FA[opt.key]}
                </span>
                {monthly ? (
                  <span className="text-xs text-zinc-500">{monthly}</span>
                ) : null}
                {!opt.eligible ? (
                  <span className="text-[10px] text-zinc-400">استفاده‌شده</span>
                ) : null}
                {isActive ? (
                  <span className="absolute inset-e-3 top-3 inline-flex size-5 items-center justify-center rounded-full bg-zinc-900 text-white">
                    <CheckIcon className="size-3" strokeWidth={3} />
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      ) : null}

      {/* Timeline */}
      <ol className="relative grid gap-5 rounded-3xl bg-white p-6 ring-1 ring-zinc-200">
        <span
          aria-hidden
          className="absolute top-[3.75rem] bottom-[3.75rem] inset-s-[2.4rem] w-px bg-zinc-200"
        />
        {timeline.map((step, i) => (
          <li key={i} className="relative flex items-start gap-4">
            <span
              aria-hidden
              className={cn(
                "relative z-10 grid size-11 shrink-0 place-items-center rounded-full ring-1",
                i === 0
                  ? "bg-zinc-900 text-white ring-zinc-900"
                  : "bg-zinc-50 text-zinc-700 ring-zinc-200",
              )}
            >
              {step.icon}
            </span>
            <div className="flex flex-col gap-0.5 pt-0.5">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                {step.day}
              </p>
              <p className="text-[15px] font-bold text-zinc-900">
                {step.title}
              </p>
              <p className="text-xs leading-6 text-zinc-500">{step.hint}</p>
            </div>
          </li>
        ))}
      </ol>

      {/* CTA */}
      {active.eligible ? (
        <div className="space-y-3">
          <Button
            type="button"
            className="h-13 w-full text-[15px] font-bold"
            disabled={isPending}
            onClick={() => handleStart(active)}
          >
            {pendingKey === active.key ? (
              "در حال فعال‌سازی..."
            ) : (
              <>
                <RocketIcon className="size-4" />
                شروع آزمایش رایگان {toPersianDigits(trialDays)} روزه
              </>
            )}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-11 w-full text-sm"
            render={<a href="/pro" />}
          >
            مشاهده و مقایسه پلن‌ها
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="h-11 w-full text-sm text-zinc-500"
            disabled={isPending}
            render={<a href={skipHref} />}
          >
            رد کردن و ادامه با پلن رایگان
            <ArrowLeftIcon className="size-4" />
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="rounded-2xl bg-amber-50 p-3 text-xs text-amber-800 ring-1 ring-amber-200">
            {active.ineligibleReason
              ? REASON_LABELS[active.ineligibleReason]
              : "این پلن فعلاً برای آزمایش در دسترس نیست."}
          </div>
          <Button
            type="button"
            variant="outline"
            className="h-12 w-full text-base"
            render={<a href={`/dashboard/pages/${pageId}/billing`}>{""}</a>}
          >
            مشاهده‌ی گزینه‌های ارتقا
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="h-11 w-full text-sm text-zinc-500"
            render={<a href={skipHref} />}
          >
            بازگشت
            <ArrowLeftIcon className="size-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
