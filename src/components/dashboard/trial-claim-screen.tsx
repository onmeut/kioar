"use client";

/**
 * Phase 8 — trial claim screen (client island).
 *
 * The screen mirrors the Linktree "Claim a free 7-day Pro trial" flow but
 * stays Persian / RTL / light. A single render handles three modes:
 *
 *   1. One eligible plan        → show plan card + 3-row timeline + CTA.
 *   2. Two eligible plans       → tab between them.
 *   3. Mixed eligibility        → render ineligible plans with an
 *      "already used" badge so the user understands why the CTA is gone.
 *
 * Trial length is `option.trialDays` from the registry — never hardcoded.
 * Timeline reminder day = `trialDays - 2` (matches cron's
 * `trial_ending_in_3d`-style spacing without coupling to it).
 *
 * All money / numerals are rendered with `formatPersianNumber` +
 * `toPersianDigits` so the screen is consistent with the rest of the app.
 */
import { useMemo, useState, useTransition } from "react";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import {
  ArrowLeftIcon,
  BellIcon,
  CalendarClockIcon,
  CheckIcon,
  RocketIcon,
  SparklesIcon,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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

  // Default selection = first eligible plan, otherwise first option.
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
        // Always honour the caller's `successHref` (e.g. `/page` — the
        // user's own page editor) instead of the API's default billing
        // URL. The API still returns redirectUrl for backwards compat.
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
      <div className="rounded-2xl border bg-white p-6 text-center text-sm text-zinc-600">
        پلن قابل آزمایشی برای این صفحه وجود ندارد.
        <div className="mt-4">
          <Button
            render={<a href={skipHref} />}
            variant="outline"
            className="h-11"
          >
            بازگشت به داشبورد
          </Button>
        </div>
      </div>
    );
  }

  const trialDays = active.trialDays;
  const reminderDay = Math.max(1, trialDays - 2);

  const timeline = [
    {
      icon: <SparklesIcon className="size-4" />,
      day: "امروز",
      title: `همه‌ی امکانات ${active.nameFa} باز می‌شود`,
    },
    {
      icon: <BellIcon className="size-4" />,
      day: `روز ${toPersianDigits(reminderDay)}`,
      title: "پیامک یادآوری دریافت می‌کنید",
    },
    {
      icon: <CalendarClockIcon className="size-4" />,
      day: `روز ${toPersianDigits(trialDays)}`,
      title: "پایان دوره‌ی آزمایش",
    },
  ];

  return (
    <div className="space-y-6">
      <header className="space-y-2 text-zinc-900">
        <Badge
          variant="outline"
          className="border-emerald-200 bg-emerald-50 text-emerald-700"
        >
          آزمایش رایگان {toPersianDigits(trialDays)} روزه
        </Badge>
        <h1 className="text-2xl font-bold leading-tight sm:text-3xl">
          {active.nameFa} را{" "}
          <span className="text-primary">رایگان امتحان کنید</span>
        </h1>
        <p className="text-sm text-zinc-600">
          همه‌ی امکانات پلن {active.nameFa} برای صفحه‌ی{" "}
          <span className="font-semibold text-zinc-900">{pageDisplayName}</span>{" "}
          فعال می‌شود.
        </p>
      </header>

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
                  "relative flex flex-col items-start gap-1 rounded-2xl border p-3 text-start transition-colors",
                  isActive
                    ? "border-primary bg-primary/5 ring-2 ring-primary/40"
                    : "border-zinc-200 bg-white hover:border-zinc-300",
                  !opt.eligible && "opacity-60",
                )}
              >
                <span className="text-sm font-bold text-zinc-900">
                  {opt.nameFa}
                </span>
                {monthly ? (
                  <span className="text-[11px] text-zinc-500">{monthly}</span>
                ) : null}
                {!opt.eligible ? (
                  <span className="text-[10px] text-zinc-400">
                    استفاده‌شده
                  </span>
                ) : null}
                {isActive ? (
                  <span className="absolute inset-e-2 top-2 inline-flex size-4 items-center justify-center rounded-full bg-primary text-white">
                    <CheckIcon className="size-3" strokeWidth={3} />
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      ) : null}

      <Card className="border-zinc-200 bg-white shadow-sm">
        <CardContent className="space-y-4 pt-5">
          <ol className="relative space-y-5 ps-6">
            <span
              aria-hidden
              className="absolute inset-s-2 top-2 bottom-2 w-px bg-zinc-200"
            />
            {timeline.map((step, i) => (
              <li key={i} className="relative">
                <span
                  aria-hidden
                  className="absolute -inset-s-6 top-0.5 flex size-4 items-center justify-center rounded-full bg-white ring-2 ring-zinc-200 text-zinc-500"
                >
                  {step.icon}
                </span>
                <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                  {step.day}
                </p>
                <p className="mt-0.5 text-sm font-semibold text-zinc-900">
                  {step.title}
                </p>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>

      {active.eligible ? (
        <div className="space-y-3">
          <Button
            type="button"
            className="h-12 w-full text-base"
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
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
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
