/**
 * Phase 0 — read-only Billing Configuration page.
 *
 * Surfaces the values that govern dunning math today, sourced from
 * code constants and env. Phase 2 will move these into `app_settings`
 * and switch this page to read-write; until then this is a transparency
 * surface for admins so nobody has to grep the codebase to know what
 * the grace window is.
 */

import {
  GRACE_PERIOD_DAYS,
  PERIOD_REMINDER_OFFSETS_DAYS,
  TRIAL_REMINDER_OFFSET_DAYS,
} from "@/lib/billing-state";
import { getVatRate } from "@/lib/billing-pricing";
import { requireAdmin } from "@/lib/auth/session";
import { formatPersianNumber, toPersianDigits } from "@/lib/persian";

export const dynamic = "force-dynamic";

type Row = {
  label: string;
  value: string;
  source: string;
  hint?: string;
};

function formatPercent(n: number): string {
  // n is fraction (0.09 → "۹٪"). Two-decimal max, trim trailing zeros.
  const pct = n * 100;
  const fixed = pct.toFixed(2).replace(/\.?0+$/, "");
  return `${toPersianDigits(fixed)}٪`;
}

export default async function AdminBillingConfigPage() {
  await requireAdmin();

  const vatRate = (() => {
    try {
      return getVatRate();
    } catch (err) {
      return Number.NaN;
    }
  })();

  const rows: Row[] = [
    {
      label: "دوره‌ی مهلت پس از پایان دوره",
      value: `${formatPersianNumber(GRACE_PERIOD_DAYS)} روز`,
      source: "src/lib/billing-state.ts → GRACE_PERIOD_DAYS",
      hint: "از پایان دوره تا انقضا و تنزل به پلن رایگان.",
    },
    {
      label: "یادآور پیش از تجدید پرداخت",
      value: `${PERIOD_REMINDER_OFFSETS_DAYS.map((d) =>
        formatPersianNumber(d),
      ).join("، ")} روز`,
      source: "src/lib/billing-state.ts → PERIOD_REMINDER_OFFSETS_DAYS",
      hint: "روزهای باقی‌مانده تا پایان دوره که پیامک یادآوری می‌رود.",
    },
    {
      label: "یادآور پیش از پایان آزمایشی",
      value: `${formatPersianNumber(TRIAL_REMINDER_OFFSET_DAYS)} روز`,
      source: "src/lib/billing-state.ts → TRIAL_REMINDER_OFFSET_DAYS",
    },
    {
      label: "نرخ مالیات بر ارزش افزوده",
      value: Number.isNaN(vatRate)
        ? "نامعتبر"
        : vatRate === 0
          ? "خاموش"
          : formatPercent(vatRate),
      source: "ENV → BILLING_VAT_RATE",
      hint: "روی مبلغ پس از تخفیف اعمال می‌شود (گرد به‌عدد بانکداری).",
    },
  ];

  return (
    <div className="section-shell space-y-6 py-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">تنظیمات صورت‌حساب</h1>
        <p className="text-sm text-muted-foreground">
          این صفحه فعلاً فقط برای مشاهده است. در فاز ۲ این مقادیر به جدول{" "}
          <code dir="ltr">app_settings</code> منتقل می‌شوند و قابل ویرایش
          خواهند بود.
        </p>
      </header>

      <section className="overflow-hidden rounded-2xl border border-border bg-card">
        <ul className="divide-y divide-border">
          {rows.map((row) => (
            <li
              key={row.label}
              className="flex flex-col gap-1 px-4 py-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6 sm:px-6"
            >
              <div className="space-y-1">
                <p className="text-sm font-medium">{row.label}</p>
                {row.hint ? (
                  <p className="text-xs text-muted-foreground">{row.hint}</p>
                ) : null}
                <p
                  className="text-[11px] text-muted-foreground/80 font-mono"
                  dir="ltr"
                >
                  {row.source}
                </p>
              </div>
              <div className="text-base font-semibold tabular-nums sm:text-end">
                {row.value}
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
