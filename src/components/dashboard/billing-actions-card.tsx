"use client";

/**
 * Phase 9 — billing actions card (client island).
 *
 * Renders three things on `/dashboard/pages/{id}/billing`:
 *
 *   1. **Plan picker** — one row per active plan in the registry
 *      (Free + Pro + Business). Each row shows the price for the
 *      currently-selected billing cycle and a button whose label depends
 *      on the disposition vs the user's current plan:
 *         - "پلن فعلی"            (same plan, same cycle, no pending)
 *         - "ارتقا و پرداخت"       (upgrade ⇒ Zarinpal redirect)
 *         - "اعمال در پایان دوره"  (downgrade ⇒ scheduled)
 *         - "خرید"                 (free → paid full checkout)
 *
 *   2. **Cancel / reactivate** — only when on a paid plan.
 *
 *   3. **Pending state banner** — surfaces `cancelAtPeriodEnd` and
 *      `pendingPlanChangePlanId` so the user always sees what's
 *      scheduled and can undo it.
 *
 * All money + days render via `formatPersianNumber` + `toPersianDigits`.
 * Prices come from server props (sourced from the registry); never
 * hardcoded.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckIcon, Loader2Icon } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  CheckoutCodeField,
  type AppliedCheckoutCode,
} from "@/components/dashboard/checkout-code-field";
import {
  formatPersianDate,
  formatPersianNumber,
  toPersianDigits,
} from "@/lib/persian";
import { cn } from "@/lib/utils";

export type BillingPlanOption = {
  id: string;
  key: "free" | "pro" | "business";
  nameFa: string;
  descriptionFa: string | null;
  priceMonthlyToman: number;
  priceAnnualToman: number;
};

export type BillingActionsState = {
  pageId: string;
  currentPlanKey: "free" | "pro" | "business";
  currentPlanId: string;
  currentBillingCycle: "monthly" | "annual";
  status:
    | "active"
    | "trialing"
    | "pending_renewal"
    | "grace"
    | "expired"
    | "canceled";
  cancelAtPeriodEnd: boolean;
  pendingPlanChangePlanId: string | null;
  pendingPlanChangeNameFa: string | null;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  options: BillingPlanOption[];
};

type Props = {
  state: BillingActionsState;
};

function formatToman(value: number) {
  return toPersianDigits(formatPersianNumber(value));
}

export function BillingActionsCard({ state }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [cycle, setCycle] = useState<"monthly" | "annual">(
    state.currentBillingCycle,
  );
  const [appliedCode, setAppliedCode] = useState<AppliedCheckoutCode | null>(
    null,
  );

  const isPaid =
    state.currentPlanKey === "pro" || state.currentPlanKey === "business";
  // While trialing the user has paid nothing yet, so for the purposes of
  // the plan picker we treat them like a Free user: every paid plan is a
  // "buy" action (including their current trialing plan, which converts
  // the trial into a paid subscription).
  const onTrial = state.status === "trialing";

  // Sort the registry options Free → Pro → Business for predictable UI.
  const sortedOptions = [...state.options].sort((a, b) => {
    const order: Record<BillingPlanOption["key"], number> = {
      free: 0,
      pro: 1,
      business: 2,
    };
    return order[a.key] - order[b.key];
  });

  const currentPriceToman = (() => {
    if (onTrial) return 0;
    const current = sortedOptions.find((o) => o.id === state.currentPlanId);
    if (!current) return 0;
    return state.currentBillingCycle === "annual"
      ? current.priceAnnualToman
      : current.priceMonthlyToman;
  })();

  const post = async (
    path:
      | "/api/billing/change-plan"
      | "/api/billing/cancel"
      | "/api/billing/reactivate",
    body: Record<string, unknown>,
    actionKey: string,
    successMessage: string,
  ) => {
    setPendingAction(actionKey);
    startTransition(async () => {
      try {
        const res = await fetch(path, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = (await res.json().catch(() => null)) as Record<
          string,
          unknown
        > | null;

        if (!res.ok || !data || data.ok !== true) {
          const code = (data?.error as string | undefined) ?? "خطای ناشناخته";
          toast.error(`عملیات انجام نشد: ${code}`);
          setPendingAction(null);
          return;
        }

        if (typeof data.redirectUrl === "string") {
          // Hard nav so Zarinpal redirects work and the back-from-callback
          // page renders a fresh server snapshot.
          window.location.href = data.redirectUrl;
          return;
        }

        toast.success(successMessage);
        router.refresh();
        setPendingAction(null);
      } catch (err) {
        toast.error(`ارتباط با سرور برقرار نشد: ${(err as Error).message}`);
        setPendingAction(null);
      }
    });
  };

  const handleChange = (option: BillingPlanOption) => {
    const onTrialNow = state.status === "trialing";
    const sameAsCurrent =
      option.id === state.currentPlanId &&
      cycle === state.currentBillingCycle &&
      !onTrialNow;
    if (sameAsCurrent) return;

    const targetPriceToman =
      option.key === "free"
        ? 0
        : cycle === "annual"
          ? option.priceAnnualToman
          : option.priceMonthlyToman;

    const isDowngrade =
      isPaid &&
      !onTrialNow &&
      targetPriceToman <= currentPriceToman &&
      option.id !== state.currentPlanId;

    const confirmMsg = isDowngrade
      ? `پلن «${option.nameFa}» در پایان دوره‌ی فعلی جایگزین می‌شود. ادامه می‌دهید؟`
      : option.key === "free"
        ? "پلن صفحه به رایگان تغییر کرده و در پایان دوره اعمال می‌شود. ادامه می‌دهید؟"
        : `برای ارتقا به «${option.nameFa}» به درگاه پرداخت منتقل می‌شوید.`;

    if (!window.confirm(confirmMsg)) return;

    // Forward the typed code on upgrade. Code is only honored on the
    // fresh-checkout branch in /api/billing/change-plan; downgrades and
    // proration ignore it. Affiliate codes on monthly cycle still go
    // through (with a UI warning) per spec — user can choose.
    const codeForUpgrade =
      option.key !== "free" && !isDowngrade ? appliedCode?.raw : undefined;

    void post(
      "/api/billing/change-plan",
      {
        pageId: state.pageId,
        planKey: option.key,
        billingCycle: cycle,
        ...(codeForUpgrade ? { code: codeForUpgrade } : {}),
      },
      `change:${option.key}:${cycle}`,
      isDowngrade || option.key === "free"
        ? "تغییر در پایان دوره اعمال می‌شود."
        : "در حال انتقال به درگاه پرداخت...",
    );
  };

  const handleCancel = () => {
    if (!window.confirm("اشتراک در پایان دوره لغو می‌شود. ادامه می‌دهید؟"))
      return;
    void post(
      "/api/billing/cancel",
      { pageId: state.pageId },
      "cancel",
      "لغو در پایان دوره ثبت شد.",
    );
  };

  const handleReactivate = () => {
    void post(
      "/api/billing/reactivate",
      { pageId: state.pageId },
      "reactivate",
      "اشتراک شما دوباره فعال شد.",
    );
  };

  const periodEndDate = state.trialEndsAt ?? state.currentPeriodEnd;
  const periodEndLabel = periodEndDate
    ? formatPersianDate(new Date(periodEndDate))
    : null;

  return (
    <section className="rounded-3xl bg-white p-5 ring-1 ring-zinc-200 sm:p-6">
      <div className="space-y-5">
        <div className="space-y-3">
          <div className="flex flex-col items-center gap-1 text-center">
            <h2 className="text-lg font-bold text-zinc-900 sm:text-xl">
              مدیریت اشتراک
            </h2>
            <p className="text-xs leading-6 text-zinc-500 sm:text-sm">
              تغییر پلن، چرخه‌ی صورت‌حساب، یا لغو اشتراک این صفحه از اینجا قابل
              انجام است.
            </p>
          </div>

          <Tabs
            value={cycle}
            onValueChange={(v) => setCycle(v as "monthly" | "annual")}
          >
            <TabsList className="grid h-12 w-full grid-cols-2 rounded-full bg-zinc-100 p-1">
              <TabsTrigger
                value="monthly"
                className="rounded-full text-sm font-semibold"
              >
                ماهانه
              </TabsTrigger>
              <TabsTrigger
                value="annual"
                className="rounded-full text-sm font-semibold"
              >
                سالانه
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {(state.cancelAtPeriodEnd || state.pendingPlanChangePlanId) &&
        periodEndLabel ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
            {state.cancelAtPeriodEnd ? (
              <p>
                اشتراک شما در{" "}
                <span dir="ltr" className="font-semibold">
                  {periodEndLabel}
                </span>{" "}
                لغو خواهد شد.
              </p>
            ) : null}
            {state.pendingPlanChangePlanId && state.pendingPlanChangeNameFa ? (
              <p>
                تغییر پلن به «{state.pendingPlanChangeNameFa}» در{" "}
                <span dir="ltr" className="font-semibold">
                  {periodEndLabel}
                </span>{" "}
                اعمال خواهد شد.
              </p>
            ) : null}
          </div>
        ) : null}

        {/* Code entry: collapsed by default, expandable. The applied
            code rides along on the next "ارتقا و پرداخت" click — see
            handleChange. We hide it when the user is already on a paid
            plan with no upgrade path (the only paid options are equal
            or downgrades), since attribution codes are first-purchase
            only and discount stacking on proration isn't supported. */}
        {sortedOptions.some(
          (o) =>
            o.key !== "free" &&
            !(
              isPaid &&
              !onTrial &&
              (cycle === "annual" ? o.priceAnnualToman : o.priceMonthlyToman) <=
                currentPriceToman &&
              o.id !== state.currentPlanId
            ),
        ) ? (
          <CheckoutCodeField
            pageId={state.pageId}
            billingCycle={cycle}
            applied={appliedCode}
            onChange={setAppliedCode}
          />
        ) : null}

        <div className="space-y-3">
          {sortedOptions.map((option) => {
            const isCurrent = option.id === state.currentPlanId;
            const sameCycle = cycle === state.currentBillingCycle;
            const targetPrice =
              option.key === "free"
                ? 0
                : cycle === "annual"
                  ? option.priceAnnualToman
                  : option.priceMonthlyToman;

            // During a trial the "current" plan still shows the trial
            // badge but is buyable — never treat it as exactCurrent.
            const isExactCurrent = isCurrent && sameCycle && !onTrial;
            const isDowngrade =
              isPaid &&
              !onTrial &&
              !isExactCurrent &&
              targetPrice <= currentPriceToman &&
              option.id !== state.currentPlanId;
            const isFreeTarget = option.key === "free";
            const isUpgrade = !isExactCurrent && !isDowngrade && !isFreeTarget;

            const cycleMismatch =
              isPaid &&
              !onTrial &&
              !sameCycle &&
              option.id === state.currentPlanId;

            const actionKey = `change:${option.key}:${cycle}`;
            const isLoading = pendingAction === actionKey && isPending;

            const buttonLabel = isExactCurrent
              ? "پلن فعلی"
              : cycleMismatch
                ? "تغییر چرخه پشتیبانی نمی‌شود"
                : isFreeTarget
                  ? "تغییر به رایگان"
                  : isDowngrade
                    ? "تنزل به این پلن"
                    : onTrial && isCurrent
                      ? "خرید پلن"
                      : state.currentPlanKey === "free"
                        ? "خرید"
                        : "ارتقا و پرداخت";

            return (
              <div
                key={option.id}
                className={cn(
                  "flex flex-col gap-3 rounded-2xl bg-white p-4 ring-1 transition-all sm:flex-row sm:items-center sm:justify-between",
                  isExactCurrent
                    ? "ring-2 ring-zinc-900"
                    : "ring-zinc-200 hover:ring-zinc-300",
                )}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="text-base font-bold text-zinc-900 sm:text-lg">
                      {option.nameFa}
                    </p>
                    {isCurrent ? (
                      <Badge
                        variant="outline"
                        className={
                          onTrial
                            ? "border-blue-200 bg-blue-50 text-[11px] text-blue-700"
                            : "border-emerald-200 bg-emerald-50 text-[11px] text-emerald-700"
                        }
                      >
                        {onTrial ? (
                          "آزمایشی"
                        ) : (
                          <>
                            <CheckIcon className="me-1 size-3" /> فعلی
                          </>
                        )}
                      </Badge>
                    ) : null}
                  </div>
                  {option.descriptionFa ? (
                    <p className="text-xs leading-6 text-zinc-500 sm:text-[13px]">
                      {option.descriptionFa}
                    </p>
                  ) : null}
                  <p className="text-xs text-zinc-500">
                    {option.key === "free" ? (
                      "رایگان — برای همیشه"
                    ) : (
                      <>
                        <span className="font-semibold text-zinc-900">
                          {formatToman(targetPrice)} تومان
                        </span>{" "}
                        {cycle === "annual" ? "در سال" : "در ماه"}
                      </>
                    )}
                  </p>
                </div>
                <Button
                  type="button"
                  variant={isUpgrade ? "default" : "outline"}
                  className={cn(
                    "h-12 w-full text-sm font-bold sm:w-auto sm:min-w-32",
                    isExactCurrent && "pointer-events-none opacity-60",
                  )}
                  disabled={
                    isExactCurrent ||
                    cycleMismatch ||
                    isPending ||
                    pendingAction !== null
                  }
                  onClick={() => handleChange(option)}
                >
                  {isLoading ? (
                    <Loader2Icon className="size-4 animate-spin" />
                  ) : (
                    buttonLabel
                  )}
                </Button>
              </div>
            );
          })}
        </div>

        {isPaid &&
        (state.status === "active" ||
          state.status === "trialing" ||
          state.status === "pending_renewal") ? (
          <div className="rounded-2xl bg-zinc-50 p-3 ring-1 ring-zinc-200">
            {state.cancelAtPeriodEnd ? (
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-zinc-600">
                  لغو در پایان دوره ثبت شده است.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 sm:w-auto"
                  disabled={isPending}
                  onClick={handleReactivate}
                >
                  {pendingAction === "reactivate" && isPending ? (
                    <Loader2Icon className="size-4 animate-spin" />
                  ) : (
                    "فعال‌سازی مجدد"
                  )}
                </Button>
              </div>
            ) : (
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-zinc-600">
                  اگر دیگر مایل به ادامه‌ی اشتراک نیستید، می‌توانید آن را در
                  پایان دوره‌ی فعلی لغو کنید.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 text-red-600 hover:bg-red-50 hover:text-red-700 sm:w-auto"
                  disabled={isPending}
                  onClick={handleCancel}
                >
                  {pendingAction === "cancel" && isPending ? (
                    <Loader2Icon className="size-4 animate-spin" />
                  ) : (
                    "لغو اشتراک"
                  )}
                </Button>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </section>
  );
}
