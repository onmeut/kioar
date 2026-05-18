"use client";

/**
 * Phase 9 — billing actions card (client island).
 *
 * Renders two things on `/account/billing/{id}`:
 *
 *   1. **Plan picker** — one card per active plan in the registry
 *      (Free + Pro + Business), laid out as 3 columns on desktop. Each
 *      card shows the price for the currently-selected billing cycle
 *      and a button whose label depends on the disposition vs the
 *      user's current plan:
 *         - "پلن فعلی"            (same plan, same cycle, no pending)
 *         - "ارتقا و پرداخت"       (upgrade ⇒ Zarinpal redirect)
 *         - "اعمال در پایان دوره"  (downgrade ⇒ scheduled)
 *         - "خرید"                 (free → paid full checkout)
 *
 *   2. **Pending plan-change banner** — surfaces
 *      `pendingPlanChangePlanId` so the user always sees what's
 *      scheduled.
 *
 * All money + days render via `formatPersianNumber` + `toPersianDigits`.
 * Prices come from server props (sourced from the registry); never
 * hardcoded.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2Icon } from "lucide-react";
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

  // Keep options in whatever order the server provided; visual order is
  // controlled by CSS `order` per breakpoint (mobile: business→pro→free,
  // desktop: free→pro→business).
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
    path: "/api/billing/change-plan",
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
        : null;

    // Skip the confirm for upgrade-to-paid: the next thing the user
    // sees is the Zarinpal gateway, which is its own confirmation
    // surface. Confirm is kept for downgrades and switch-to-Free
    // because those are scheduled changes the user can't easily
    // reverse without contacting support.
    if (confirmMsg && !window.confirm(confirmMsg)) return;

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

  const periodEndDate = state.trialEndsAt ?? state.currentPeriodEnd;
  const periodEndLabel = periodEndDate
    ? formatPersianDate(new Date(periodEndDate))
    : null;

  return (
    <section className="rounded-3xl bg-white p-5 ring-1 ring-zinc-200 sm:p-6">
      <div className="space-y-5">
        <div className="space-y-3">
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

        {state.pendingPlanChangePlanId && periodEndLabel ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
            {state.pendingPlanChangeNameFa ? (
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

        {/* Code entry intentionally rendered AFTER plan cards — it's a
            secondary action, not the first thing the user should see.
            Hidden when there's no buyable upgrade target (paid user
            already on top tier or all options are equal/downgrades).
            Attribution codes are first-purchase-only and discount
            stacking on proration isn't supported. */}
        <div className="grid gap-4 md:grid-cols-3">
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
                ? "پلن فعلی"
                : isFreeTarget
                  ? "تغییر به رایگان"
                  : isDowngrade
                    ? "تنزل به این پلن"
                    : onTrial && isCurrent
                      ? "خرید پلن"
                      : state.currentPlanKey === "free"
                        ? "خرید"
                        : "ارتقا و پرداخت";

            // Mobile: business(1)→pro(2)→free(3); Desktop: free(1)→pro(2)→business(3)
            const mobileOrder = { business: 1, pro: 2, free: 3 }[option.key];

            return (
              <div
                key={option.id}
                style={{ order: mobileOrder }}
                className={cn(
                  "flex flex-col rounded-2xl bg-white p-5 ring-1 transition-all",
                  `plan-order-${option.key}`,
                  isExactCurrent
                    ? option.key === "business"
                      ? "shadow-sm ring-2 ring-purple-500"
                      : option.key === "pro"
                        ? "shadow-sm ring-2 ring-emerald-500"
                        : "shadow-sm ring-2 ring-zinc-400"
                    : "ring-zinc-200 hover:ring-zinc-300",
                )}
              >
                {/* Plan name + current badge */}
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                    <h3 className="text-2xl font-bold text-zinc-900">
                      {option.nameFa}
                    </h3>
                    {isCurrent ? (
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[11px] font-bold",
                          option.key === "pro"
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                            : option.key === "business"
                              ? "border-purple-200 bg-purple-50 text-purple-700"
                              : "border-zinc-200 bg-zinc-50 text-zinc-600",
                        )}
                      >
                        {onTrial ? "پلن فعلی · آزمایشی" : "پلن فعلی"}
                      </Badge>
                    ) : null}
                  </div>
                  {option.descriptionFa ? (
                    <p className="text-[13px] leading-5 text-zinc-500">
                      {option.descriptionFa}
                    </p>
                  ) : null}
                </div>

                {/* Divider */}
                <div className="my-5 border-t border-zinc-100" />

                {/* Price — hero element */}
                <div className="flex-1 space-y-0.5">
                  {option.key === "free" ? null : (
                    <>
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-[32px] font-extrabold leading-none text-zinc-900">
                          {formatToman(targetPrice)}
                        </span>
                        <span className="text-sm font-medium text-zinc-500">
                          تومان
                        </span>
                      </div>
                      <p className="pt-1 text-[13px] text-zinc-400">
                        {cycle === "annual" ? "سالانه" : "ماهانه"}
                      </p>
                    </>
                  )}
                </div>

                {/* CTA */}
                <div className="pt-6">
                  <Button
                    type="button"
                    variant={isUpgrade ? "default" : "outline"}
                    className={cn(
                      "h-11 w-full text-sm font-bold",
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
              </div>
            );
          })}
        </div>

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
      </div>
    </section>
  );
}
