"use client";

/**
 * Interactive earnings calculator for the affiliate landing page.
 *
 * One number input: estimated paid yearly conversions per month.
 * Renders monthly + annual commission, with a small breakdown showing
 * the per-conversion math. All numbers in IRR Toman, formatted with
 * Persian digits and thousands separators.
 *
 * The calculator is intentionally optimistic but not dishonest — it
 * shows the exact arithmetic (yearly_price × commission_pct × volume)
 * with no hidden multipliers.
 */
import { useMemo, useState } from "react";

import { CoinsIcon, TrendingUpIcon } from "lucide-react";

import { formatPersianNumber, toPersianDigits } from "@/lib/persian";

const PRESETS = [1, 5, 15, 50] as const;

export function EarningsCalculator({
  yearlyToman,
  commissionPct,
}: {
  yearlyToman: number;
  commissionPct: number;
}) {
  const [perMonth, setPerMonth] = useState<number>(5);

  const perConversionToman = useMemo(
    () => Math.round((yearlyToman * commissionPct) / 100),
    [yearlyToman, commissionPct],
  );
  const monthlyToman = perConversionToman * perMonth;
  const annualToman = monthlyToman * 12;

  return (
    <div className="rounded-3xl border border-hairline bg-paper p-6 shadow-[0_24px_60px_-30px_rgba(15,23,42,0.18)] sm:p-8">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="flex size-9 items-center justify-center rounded-2xl bg-violet-100 text-violet-700">
            <TrendingUpIcon className="size-4" />
          </span>
          <p className="text-[13px] font-bold text-ink">
            ماشین‌حساب درآمد ماهانه
          </p>
        </div>
        <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-700 ring-1 ring-emerald-200">
          {toPersianDigits(commissionPct)}٪ پورسانت
        </span>
      </div>

      <div className="mt-7">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-[12px] font-medium text-ink-soft">
            فروش سالانه‌ی ماهانه (تخمینی)
          </span>
          <span className="font-mono text-[24px] font-bold text-ink" dir="ltr">
            {toPersianDigits(perMonth)}
          </span>
        </div>
        <input
          type="range"
          value={perMonth}
          onChange={(e) => setPerMonth(Number(e.target.value))}
          min={1}
          max={100}
          step={1}
          dir="ltr"
          className="mt-3 h-2 w-full cursor-pointer appearance-none rounded-full bg-violet-500 [&::-moz-range-thumb]:size-5 [&::-moz-range-thumb]:cursor-grab [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:shadow-[0_2px_8px_rgba(15,23,42,0.25)] [&::-webkit-slider-thumb]:size-5 [&::-webkit-slider-thumb]:cursor-grab [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-[0_2px_8px_rgba(15,23,42,0.25)]"
          aria-label="تعداد فروش سالانه در ماه"
        />
        <div className="mt-3 flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPerMonth(p)}
              className={`rounded-full px-3 py-1 text-[11px] font-bold transition ${
                perMonth === p
                  ? "bg-ink text-paper"
                  : "bg-paper-soft text-ink-soft ring-1 ring-hairline hover:text-ink"
              }`}
            >
              {toPersianDigits(p)} نفر
            </button>
          ))}
        </div>
      </div>

      <div className="mt-7 grid gap-3 sm:grid-cols-2">
        <Result label="درآمد ماهانه" toman={monthlyToman} highlight />
        <Result label="درآمد سالانه" toman={annualToman} />
      </div>

      <div className="mt-6 rounded-2xl bg-paper-soft px-4 py-3 text-[11px] leading-6 text-ink-soft">
        <div className="flex items-center gap-2">
          <CoinsIcon className="size-3.5 shrink-0 text-violet-600" />
          <p>
            هر فروش سالانه:{" "}
            <span className="font-mono font-bold text-ink" dir="ltr">
              {formatPersianNumber(yearlyToman)}
            </span>{" "}
            تومان × {toPersianDigits(commissionPct)}٪ ={" "}
            <span className="font-mono font-bold text-ink" dir="ltr">
              {formatPersianNumber(perConversionToman)}
            </span>{" "}
            تومان سهم تو
          </p>
        </div>
      </div>
    </div>
  );
}

function Result({
  label,
  toman,
  highlight,
}: {
  label: string;
  toman: number;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl px-4 py-4 ${
        highlight
          ? "bg-violet-600 text-white"
          : "border border-hairline bg-paper-soft text-ink"
      }`}
    >
      <p
        className={`text-[11px] font-medium uppercase tracking-wider ${
          highlight ? "text-white/80" : "text-ink-soft"
        }`}
      >
        {label}
      </p>
      <p
        className="mt-1 font-mono text-[22px] font-bold leading-tight"
        dir="ltr"
      >
        {formatPersianNumber(toman)}
      </p>
      <p
        className={`text-[11px] ${
          highlight ? "text-white/80" : "text-ink-soft"
        }`}
      >
        تومان
      </p>
    </div>
  );
}
