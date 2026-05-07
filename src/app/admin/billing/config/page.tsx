/**
 * Phase 2 — read-only Billing Configuration page.
 *
 * Surfaces the values that govern dunning math today, sourced from
 * `app_settings` (with code-side fallbacks if a key is missing).
 * Phase 3 wires the runtime billing modules to these same reads;
 * Phase 13 makes this page read-write.
 */

import {
  getAllSettings,
  APP_SETTING_DEFINITIONS,
} from "@/lib/app-settings";
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
  if (n === 0) return "خاموش";
  const pct = n * 100;
  const fixed = pct.toFixed(2).replace(/\.?0+$/, "");
  return `${toPersianDigits(fixed)}٪`;
}

export default async function AdminBillingConfigPage() {
  await requireAdmin();
  const settings = await getAllSettings();

  const rows: Row[] = [
    {
      label: "دوره‌ی مهلت پس از پایان دوره",
      value: `${formatPersianNumber(settings["billing.grace_period_days"])} روز`,
      source: "app_settings → billing.grace_period_days",
      hint:
        APP_SETTING_DEFINITIONS["billing.grace_period_days"].descriptionFa,
    },
    {
      label: "یادآور پیش از تجدید پرداخت",
      value: `${settings["billing.reminder_offsets_days"]
        .map((d) => formatPersianNumber(d))
        .join("، ")} روز`,
      source: "app_settings → billing.reminder_offsets_days",
      hint:
        APP_SETTING_DEFINITIONS["billing.reminder_offsets_days"].descriptionFa,
    },
    {
      label: "یادآور پیش از پایان آزمایشی",
      value: `${formatPersianNumber(settings["billing.trial_reminder_offset_days"])} روز`,
      source: "app_settings → billing.trial_reminder_offset_days",
      hint:
        APP_SETTING_DEFINITIONS["billing.trial_reminder_offset_days"]
          .descriptionFa,
    },
    {
      label: "نرخ مالیات بر ارزش افزوده",
      value: formatPercent(settings["billing.vat_rate"]),
      source: "app_settings → billing.vat_rate",
      hint: APP_SETTING_DEFINITIONS["billing.vat_rate"].descriptionFa,
    },
    {
      label: "سیاست پیش‌فرض گرند‌فادرینگ",
      value:
        settings["billing.grandfathering_default_policy"] === "always_current"
          ? "همه به قیمت جدید"
          : "قفل قیمت قدیم برای فعلی‌ها",
      source: "app_settings → billing.grandfathering_default_policy",
      hint: APP_SETTING_DEFINITIONS["billing.grandfathering_default_policy"]
        .descriptionFa,
    },
  ];

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">تنظیمات صورت‌حساب</h1>
        <p className="text-sm text-muted-foreground">
          مقادیر زیر از جدول <code dir="ltr">app_settings</code> خوانده
          می‌شوند. اگر کلیدی موجود نباشد، مقدار پیش‌فرض ثبت‌شده در کد
          استفاده می‌شود. در فاز ۱۳ این صفحه قابل ویرایش خواهد شد.
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
