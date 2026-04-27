"use client";

import { CheckIcon } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { formatPersianNumber, toPersianDigits } from "@/lib/persian";
import { cn } from "@/lib/utils";

type PlanId = "monthly" | "yearly";

type Plan = {
  id: PlanId;
  title: string;
  trial: string;
  price: number;
  originalPrice?: number;
  perPeriodLabel: string;
  weeklyEquivalent: number;
  badge?: string;
};

const PLANS: Plan[] = [
  {
    id: "monthly",
    title: "ماهانه",
    trial: "۷ روز رایگان، سپس ۱۴۹٬۰۰۰ تومان در ماه",
    price: 149_000,
    perPeriodLabel: "/ ماه",
    weeklyEquivalent: 34_500,
  },
  {
    id: "yearly",
    title: "سالانه",
    trial: "۷ روز رایگان، سپس ۸۹۹٬۰۰۰ تومان در سال (۷۴٬۹۰۰ تومان در ماه)",
    price: 899_000,
    originalPrice: 1_788_000,
    perPeriodLabel: "/ سال",
    weeklyEquivalent: 17_290,
    badge: "۵۰٪ تخفیف",
  },
];

function formatToman(value: number) {
  return toPersianDigits(formatPersianNumber(value));
}

export function PlanSelector() {
  const [selected, setSelected] = useState<PlanId>("monthly");
  const active = PLANS.find((p) => p.id === selected)!;

  return (
    <div className="flex flex-col gap-4">
      <div
        role="radiogroup"
        aria-label="انتخاب پلن"
        className="flex flex-col gap-3"
      >
        {PLANS.map((plan) => {
          const isSelected = plan.id === selected;
          return (
            <button
              key={plan.id}
              type="button"
              role="radio"
              aria-checked={isSelected}
              onClick={() => setSelected(plan.id)}
              className={cn(
                "group relative w-full rounded-3xl border bg-card p-5 text-start transition-all sm:p-6",
                "focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/30",
                isSelected
                  ? "border-foreground ring-2 ring-foreground shadow-md"
                  : "border-border hover:border-foreground/40 hover:bg-accent/40",
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <h3 className="text-xl font-bold tracking-tight sm:text-2xl">
                    {plan.title}
                  </h3>
                  <p className="text-xs text-muted-foreground sm:text-[13px]">
                    {plan.trial}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {plan.badge ? (
                    <Badge
                      variant="secondary"
                      className="bg-primary/15 text-primary border-0"
                    >
                      {plan.badge}
                    </Badge>
                  ) : null}
                  <span
                    aria-hidden
                    className={cn(
                      "flex size-5 items-center justify-center rounded-full border transition-colors",
                      isSelected
                        ? "border-foreground bg-foreground text-background"
                        : "border-border bg-background",
                    )}
                  >
                    {isSelected ? <CheckIcon className="size-3" /> : null}
                  </span>
                </div>
              </div>

              <div className="mt-4 flex items-end justify-between gap-3">
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-extrabold leading-none tracking-tight sm:text-4xl">
                    {formatToman(plan.price)}
                  </span>
                  {plan.originalPrice ? (
                    <span className="text-sm font-medium text-muted-foreground line-through">
                      {formatToman(plan.originalPrice)}
                    </span>
                  ) : null}
                  <span className="text-sm text-muted-foreground">
                    {plan.perPeriodLabel}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground text-end leading-tight">
                  معادل {formatToman(plan.weeklyEquivalent)}
                  <br />
                  تومان در هفته
                </p>
              </div>
            </button>
          );
        })}
      </div>

      <Separator className="my-2" />

      <div className="flex items-center justify-between gap-3 px-1">
        <span className="text-sm font-semibold">قابل پرداخت امروز</span>
        <span className="text-lg font-extrabold tracking-tight">
          {formatToman(active.price)}{" "}
          <span className="text-xs font-medium text-muted-foreground">
            تومان
          </span>
        </span>
      </div>

      <Button
        type="button"
        size="lg"
        className="h-12 w-full rounded-full text-base font-bold"
      >
        ادامه و پرداخت
      </Button>

      <p className="text-center text-[11px] text-muted-foreground">
        ۷ روز اول رایگان است. پیش از پایان دوره می‌توانید لغو کنید.
      </p>
    </div>
  );
}
