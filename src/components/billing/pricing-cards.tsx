"use client";

/**
 * Phase 12 — registry-driven pricing cards.
 *
 * Renders 1 card per active plan from the registry. Monthly/Annual cycle
 * toggle is local. The CTA is rendered internally based on simple,
 * serializable href props so this component can be embedded in a Server
 * Component (Next 16 disallows passing functions across the RSC boundary
 * unless they are server actions).
 *
 * Prices come exclusively from the `plans` registry passed in by the
 * server. NEVER hardcode tomans here.
 */

import Link from "next/link";
import { useState } from "react";
import type { Route } from "next";
import { CheckIcon, SparklesIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatPersianNumber, toPersianDigits } from "@/lib/persian";
import { cn } from "@/lib/utils";

export type PricingCardsPlan = {
  id: string;
  key: "free" | "pro" | "business";
  nameFa: string;
  descriptionFa: string | null;
  priceMonthlyToman: number;
  priceAnnualToman: number;
  trialDays: number;
  /** A short bullet list of marquee features for this plan. */
  highlights: string[];
};

type Cycle = "monthly" | "annual";

type Props = {
  plans: PricingCardsPlan[];
  /** Default cycle. */
  defaultCycle?: Cycle;
  /** Visually highlight this plan key as recommended. */
  highlightPlanKey?: "pro" | "business";
  /** Where the Free plan CTA should land. */
  ctaFreeHref: Route;
  /** Where the paid (Pro/Business) plan CTAs should land. */
  ctaPaidHref: Route;
  /** Whether the viewer is signed in — controls CTA copy. */
  isAuthenticated: boolean;
};

function formatToman(value: number) {
  return toPersianDigits(formatPersianNumber(value));
}

/**
 * Average integer-toman price per month for an annual plan, used for the
 * "معادل X تومان در ماه" line. Uses banker's rounding.
 */
function annualPerMonth(annualToman: number): number {
  return Math.round(annualToman / 12);
}

function annualSavingsPercent(monthly: number, annual: number): number | null {
  if (monthly <= 0 || annual <= 0) return null;
  const fullPriceForYear = monthly * 12;
  if (annual >= fullPriceForYear) return null;
  return Math.round(((fullPriceForYear - annual) / fullPriceForYear) * 100);
}

export function PricingCards({
  plans,
  defaultCycle = "monthly",
  highlightPlanKey = "pro",
  ctaFreeHref,
  ctaPaidHref,
  isAuthenticated,
}: Props) {
  const [cycle, setCycle] = useState<Cycle>(defaultCycle);

  const sorted = [...plans].sort((a, b) => {
    const order: Record<PricingCardsPlan["key"], number> = {
      free: 0,
      pro: 1,
      business: 2,
    };
    return order[a.key] - order[b.key];
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-center">
        <Tabs value={cycle} onValueChange={(v) => setCycle(v as Cycle)}>
          <TabsList className="grid grid-cols-2">
            <TabsTrigger value="monthly">ماهانه</TabsTrigger>
            <TabsTrigger value="annual">
              سالانه
              {(() => {
                const pro = sorted.find((p) => p.key === "pro");
                if (!pro) return null;
                const pct = annualSavingsPercent(
                  pro.priceMonthlyToman,
                  pro.priceAnnualToman,
                );
                if (!pct) return null;
                return (
                  <Badge
                    variant="outline"
                    className="ms-2 border-emerald-200 bg-emerald-50 text-[10px] font-bold text-emerald-700"
                  >
                    -{toPersianDigits(pct)}٪
                  </Badge>
                );
              })()}
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {sorted.map((plan) => {
          const price =
            cycle === "annual" ? plan.priceAnnualToman : plan.priceMonthlyToman;
          const isHighlighted = plan.key === highlightPlanKey;
          const isFree = plan.key === "free";
          const perMonth =
            cycle === "annual" && plan.priceAnnualToman > 0
              ? annualPerMonth(plan.priceAnnualToman)
              : null;
          return (
            <Card
              key={plan.id}
              className={cn(
                "relative flex flex-col bg-white",
                isHighlighted &&
                  "border-foreground/80 shadow-lg ring-2 ring-foreground/10",
              )}
            >
              {isHighlighted ? (
                <div className="absolute -top-3 start-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full bg-foreground px-3 py-1 text-[11px] font-bold text-background shadow-sm rtl:translate-x-1/2">
                  <SparklesIcon className="size-3" />
                  پیشنهاد ویژه
                </div>
              ) : null}
              <CardHeader className="space-y-2 pb-3">
                <CardTitle className="text-lg font-bold tracking-tight">
                  {plan.nameFa}
                </CardTitle>
                {plan.descriptionFa ? (
                  <p className="text-xs leading-6 text-zinc-500">
                    {plan.descriptionFa}
                  </p>
                ) : null}
              </CardHeader>
              <CardContent className="flex flex-1 flex-col gap-4 pt-0">
                <div className="space-y-1">
                  {isFree ? (
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-extrabold tracking-tight">
                        رایگان
                      </span>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-3xl font-extrabold tracking-tight">
                          {formatToman(price)}
                        </span>
                        <span className="text-xs font-medium text-zinc-500">
                          تومان / {cycle === "annual" ? "سال" : "ماه"}
                        </span>
                      </div>
                      {perMonth ? (
                        <p className="text-[11px] text-zinc-500">
                          معادل {formatToman(perMonth)} تومان در ماه
                        </p>
                      ) : null}
                      {plan.trialDays > 0 ? (
                        <p className="text-[11px] font-medium text-emerald-700">
                          {toPersianDigits(plan.trialDays)} روز آزمایش رایگان
                        </p>
                      ) : null}
                    </>
                  )}
                </div>

                <ul className="space-y-2 text-[13px] leading-6 text-zinc-700">
                  {plan.highlights.map((h) => (
                    <li key={h} className="flex items-start gap-2">
                      <CheckIcon className="mt-1 size-3.5 shrink-0 text-emerald-600" />
                      <span>{h}</span>
                    </li>
                  ))}
                </ul>

                <div className="mt-auto pt-2">
                  <Button
                    className="h-11 w-full"
                    variant={plan.key === "pro" ? "default" : "outline"}
                    render={<Link href={isFree ? ctaFreeHref : ctaPaidHref} />}
                  >
                    {isFree
                      ? isAuthenticated
                        ? "رفتن به داشبورد"
                        : "شروع رایگان"
                      : isAuthenticated
                        ? "ارتقا و پرداخت"
                        : `شروع ${plan.trialDays > 0 ? "آزمایش رایگان" : "اشتراک"}`}
                    <span className="sr-only">
                      {" "}— چرخه: {cycle === "annual" ? "سالانه" : "ماهانه"}
                    </span>
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
