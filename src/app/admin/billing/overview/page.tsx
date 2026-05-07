import Link from "next/link";
import type { Route } from "next";
import { sql } from "drizzle-orm";
import {
  AlertTriangleIcon,
  BanknoteIcon,
  ClockIcon,
  TrendingUpIcon,
  UsersIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { getDb } from "@/db";
import { requireAdmin } from "@/lib/auth/session";
import {
  formatPersianDateTime,
  formatPersianNumber,
  toPersianDigits,
} from "@/lib/persian";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

type FailedRow = {
  payment_id: string;
  invoice_id: string;
  invoice_number: string | null;
  amount_toman: string | number;
  created_at: Date;
  page_id: string;
  slug: string;
};

export default async function AdminBillingOverviewPage() {
  await requireAdmin();
  const db = getDb();

  const [activeRows, expiringRows, mrrRows, failedRows] = await Promise.all([
    db.execute(sql`
      SELECT count(*)::int AS total
      FROM "page_subscriptions" s
      JOIN "plans" p ON p."id" = s."plan_id"
      WHERE s."status" IN ('active','trialing','pending_renewal','grace')
        AND p."key" <> 'free'
    `) as unknown as Promise<Array<{ total: number }>>,
    db.execute(sql`
      SELECT count(*)::int AS total
      FROM "page_subscriptions" s
      JOIN "plans" p ON p."id" = s."plan_id"
      WHERE s."status" IN ('active','pending_renewal','grace')
        AND p."key" <> 'free'
        AND s."current_period_end" BETWEEN now() AND now() + interval '7 days'
    `) as unknown as Promise<Array<{ total: number }>>,
    db.execute(sql`
      SELECT
        COALESCE(
          SUM(
            CASE s."billing_cycle"
              WHEN 'annual' THEN
                COALESCE(l."locked_annual_toman", p."price_annual_toman", 0) / 12
              ELSE
                COALESCE(l."locked_monthly_toman", p."price_monthly_toman", 0)
            END
          ),
          0
        )::bigint AS mrr_toman
      FROM "page_subscriptions" s
      JOIN "plans" p ON p."id" = s."plan_id"
      LEFT JOIN "subscription_price_locks" l
        ON l."page_id" = s."page_id" AND l."plan_id" = s."plan_id"
      WHERE s."status" IN ('active','pending_renewal')
        AND p."key" <> 'free'
    `) as unknown as Promise<Array<{ mrr_toman: string | number }>>,
    db.execute(sql`
      SELECT
        pay."id"             AS payment_id,
        pay."invoice_id"     AS invoice_id,
        i."number"           AS invoice_number,
        pay."amount_toman"   AS amount_toman,
        pay."created_at"     AS created_at,
        i."page_id"          AS page_id,
        pr."slug"            AS slug
      FROM "payments" pay
      JOIN "invoices" i  ON i."id" = pay."invoice_id"
      JOIN "profiles" pr ON pr."id" = i."page_id"
      WHERE pay."status" = 'failed'
      ORDER BY pay."created_at" DESC
      LIMIT 10
    `) as unknown as Promise<FailedRow[]>,
  ]);

  const activeCount = activeRows[0]?.total ?? 0;
  const expiringCount = expiringRows[0]?.total ?? 0;
  const mrrToman = Number(mrrRows[0]?.mrr_toman ?? 0);
  const failed = failedRows;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">نمای کلی صورتحساب</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          خلاصه‌ای از وضعیت اشتراک‌ها و درآمد ماهانه.
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          icon={<UsersIcon className="size-5" />}
          label="اشتراک‌های فعال"
          value={toPersianDigits(activeCount)}
          hint="شامل آزمایشی و مهلت پرداخت"
        />
        <Stat
          icon={<ClockIcon className="size-5" />}
          label="انقضا تا ۷ روز آینده"
          value={toPersianDigits(expiringCount)}
          hint="نیاز به تمدید"
          tone={expiringCount > 0 ? "warning" : "default"}
        />
        <Stat
          icon={<TrendingUpIcon className="size-5" />}
          label="درآمد ماهانه (MRR)"
          value={formatPersianNumber(mrrToman)}
          unit="تومان"
          hint="با احتساب قفل قیمت"
        />
        <Stat
          icon={<BanknoteIcon className="size-5" />}
          label="پرداخت‌های ناموفق اخیر"
          value={toPersianDigits(failed.length)}
          hint="۱۰ مورد آخر"
          tone={failed.length > 0 ? "danger" : "default"}
        />
      </div>

      <section className="rounded-3xl border border-border bg-card p-4 sm:p-5">
        <header className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <AlertTriangleIcon className="size-4 text-rose-600" />
            پرداخت‌های ناموفق اخیر
          </h2>
          <Link
            href={"/admin/billing/invoices" as Route}
            className="text-xs text-primary hover:underline"
          >
            همه فاکتورها
          </Link>
        </header>

        {failed.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
            موردی ثبت نشده است.
          </p>
        ) : (
          <>
            {/* Mobile: cards */}
            <ul className="grid gap-2 lg:hidden">
              {failed.map((r) => (
                <li
                  key={r.payment_id}
                  className="rounded-2xl border border-border bg-background p-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <Link
                        href={`/admin/billing/pages/${r.page_id}` as Route}
                        className="font-mono text-sm text-primary hover:underline"
                        dir="ltr"
                      >
                        {r.slug}
                      </Link>
                      {r.invoice_number ? (
                        <p
                          className="mt-1 font-mono text-[11px] text-muted-foreground"
                          dir="ltr"
                        >
                          {r.invoice_number}
                        </p>
                      ) : null}
                    </div>
                    <Badge
                      variant="outline"
                      className="rounded-full text-[10px]"
                    >
                      {formatPersianDateTime(r.created_at)}
                    </Badge>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">مبلغ</span>
                    <span className="font-semibold">
                      {formatPersianNumber(Number(r.amount_toman))} تومان
                    </span>
                  </div>
                </li>
              ))}
            </ul>

            {/* Desktop: table */}
            <div className="hidden overflow-hidden rounded-2xl border border-border lg:block">
              <table className="w-full table-auto text-sm">
                <thead className="bg-muted/40 text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-start">زمان</th>
                    <th className="px-3 py-2 text-start">صفحه</th>
                    <th className="px-3 py-2 text-start">شماره فاکتور</th>
                    <th className="px-3 py-2 text-start">مبلغ</th>
                  </tr>
                </thead>
                <tbody>
                  {failed.map((r) => (
                    <tr
                      key={r.payment_id}
                      className="border-t border-border align-top"
                    >
                      <td className="px-3 py-2 text-xs" dir="ltr">
                        {formatPersianDateTime(r.created_at)}
                      </td>
                      <td className="px-3 py-2 text-xs" dir="ltr">
                        <Link
                          href={`/admin/billing/pages/${r.page_id}` as Route}
                          className="font-mono text-primary hover:underline"
                        >
                          {r.slug}
                        </Link>
                      </td>
                      <td
                        className="px-3 py-2 font-mono text-xs"
                        dir="ltr"
                      >
                        {r.invoice_number ?? "—"}
                      </td>
                      <td className="px-3 py-2 text-xs">
                        {formatPersianNumber(Number(r.amount_toman))} تومان
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
  unit,
  hint,
  tone = "default",
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  unit?: string;
  hint?: string;
  tone?: "default" | "warning" | "danger";
}) {
  return (
    <div
      className={cn(
        "rounded-3xl border bg-card p-4 shadow-sm",
        tone === "warning"
          ? "border-amber-300/60"
          : tone === "danger"
            ? "border-rose-300/60"
            : "border-border",
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span
          className={cn(
            "rounded-full bg-muted/60 p-1.5 text-muted-foreground",
            tone === "warning" ? "bg-amber-500/12 text-amber-700" : null,
            tone === "danger" ? "bg-rose-500/12 text-rose-700" : null,
          )}
        >
          {icon}
        </span>
      </div>
      <div className="mt-3 flex items-baseline gap-1.5">
        <span className="text-2xl font-bold">{value}</span>
        {unit ? (
          <span className="text-xs text-muted-foreground">{unit}</span>
        ) : null}
      </div>
      {hint ? (
        <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}
