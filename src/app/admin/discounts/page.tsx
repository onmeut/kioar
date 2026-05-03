import { desc, sql } from "drizzle-orm";
import Link from "next/link";
import type { Route } from "next";

import { CreateDiscountDialog } from "@/components/admin/create-discount-dialog";
import { Badge } from "@/components/ui/badge";
import { getDb } from "@/db";
import { discountCodes, discountRedemptions } from "@/db/schema";
import { requireAdmin } from "@/lib/auth/session";
import {
  formatPersianDateTime,
  formatPersianNumber,
  toPersianDigits,
} from "@/lib/persian";
import { cn } from "@/lib/utils";

import { ToggleDiscountButton } from "./toggle-button";

export const dynamic = "force-dynamic";

const TYPE_LABELS: Record<"percent" | "fixed_amount" | "free_months", string> =
  {
    percent: "درصدی",
    fixed_amount: "مبلغ ثابت",
    free_months: "ماه رایگان",
  };

function formatAmount(
  type: "percent" | "fixed_amount" | "free_months",
  amount: number,
) {
  if (type === "percent") return `${toPersianDigits(amount)}٪`;
  if (type === "free_months") return `${toPersianDigits(amount)} ماه`;
  return `${toPersianDigits(formatPersianNumber(amount))} تومان`;
}

export default async function AdminDiscountsPage() {
  await requireAdmin();
  const db = getDb();

  const [codes, kpis, totalRedemptions] = await Promise.all([
    db
      .select()
      .from(discountCodes)
      .orderBy(desc(discountCodes.createdAt))
      .limit(100),
    db
      .select({
        total: sql<number>`count(*)::int`,
        active: sql<number>`count(*) filter (where ${discountCodes.isActive} = true)::int`,
        sumRedemptions: sql<number>`coalesce(sum(${discountCodes.redemptionsCount}), 0)::int`,
      })
      .from(discountCodes),
    db.select({ count: sql<number>`count(*)::int` }).from(discountRedemptions),
  ]);

  const k = kpis[0] ?? { total: 0, active: 0, sumRedemptions: 0 };
  const redemptionsCount = totalRedemptions[0]?.count ?? k.sumRedemptions;

  return (
    <div className="section-shell space-y-6 py-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold text-foreground">
            برنامه‌های تخفیف
          </h1>
          <p className="text-sm text-muted-foreground">
            ایجاد و مدیریت کدهای تخفیف برای پلن‌های اشتراکی.
          </p>
        </div>
        <CreateDiscountDialog />
      </header>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="مجموع برنامه‌ها" value={toPersianDigits(k.total)} />
        <Stat label="کدهای فعال" value={toPersianDigits(k.active)} />
        <Stat
          label="تعداد کل کدها"
          value={toPersianDigits(k.total)}
          tone="muted"
        />
        <Stat
          label="مجموع استفاده‌ها"
          value={toPersianDigits(redemptionsCount)}
          tone="success"
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-foreground">کدهای موجود</h2>

        {codes.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
            هنوز کدی ثبت نشده است.
          </div>
        ) : (
          <>
            {/* Mobile cards */}
            <ul className="space-y-3 lg:hidden">
              {codes.map((c) => (
                <li
                  key={c.id}
                  className="rounded-3xl border border-border bg-card p-4 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-foreground">
                        {c.nameFa}
                      </p>
                      <p
                        className="mt-1 font-mono text-xs text-muted-foreground"
                        dir="ltr"
                      >
                        {c.code}
                      </p>
                    </div>
                    <Badge
                      className={cn(
                        c.isActive
                          ? "bg-emerald-500/12 text-emerald-700"
                          : "bg-muted text-muted-foreground",
                      )}
                    >
                      {c.isActive ? "فعال" : "غیرفعال"}
                    </Badge>
                  </div>
                  <dl className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                    <Detail label="نوع" value={TYPE_LABELS[c.discountType]} />
                    <Detail
                      label="مقدار"
                      value={formatAmount(c.discountType, c.amount)}
                    />
                    <Detail
                      label="استفاده‌شده"
                      value={`${toPersianDigits(c.redemptionsCount)}${
                        c.maxRedemptions !== null
                          ? ` / ${toPersianDigits(c.maxRedemptions)}`
                          : ""
                      }`}
                    />
                    <Detail
                      label="چرخه‌ها"
                      value={toPersianDigits(c.recurringCycles)}
                    />
                  </dl>
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <p className="text-[11px] text-muted-foreground">
                      {c.endsAt
                        ? `تا ${formatPersianDateTime(c.endsAt)}`
                        : "بدون انقضا"}
                    </p>
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/admin/discounts/${c.id}` as Route}
                        className="text-xs font-semibold text-primary hover:underline"
                      >
                        کدها و استفاده‌ها
                      </Link>
                      <ToggleDiscountButton id={c.id} isActive={c.isActive} />
                    </div>
                  </div>
                </li>
              ))}
            </ul>

            {/* Desktop table */}
            <div className="hidden overflow-hidden rounded-3xl border border-border bg-card shadow-sm lg:block">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs text-muted-foreground">
                  <tr>
                    <th className="p-3 text-start">کد / نام</th>
                    <th className="p-3 text-start">نوع</th>
                    <th className="p-3 text-start">مقدار</th>
                    <th className="p-3 text-start">استفاده</th>
                    <th className="p-3 text-start">انقضا</th>
                    <th className="p-3 text-start">وضعیت</th>
                    <th className="p-3 text-start"></th>
                  </tr>
                </thead>
                <tbody>
                  {codes.map((c) => (
                    <tr key={c.id} className="border-t border-border align-top">
                      <td className="p-3">
                        <p className="font-medium text-foreground">
                          {c.nameFa}
                        </p>
                        <p
                          className="mt-1 font-mono text-xs text-muted-foreground"
                          dir="ltr"
                        >
                          {c.code}
                        </p>
                      </td>
                      <td className="p-3">{TYPE_LABELS[c.discountType]}</td>
                      <td className="p-3">
                        {formatAmount(c.discountType, c.amount)}
                      </td>
                      <td className="p-3">
                        {toPersianDigits(c.redemptionsCount)}
                        {c.maxRedemptions !== null
                          ? ` / ${toPersianDigits(c.maxRedemptions)}`
                          : ""}
                      </td>
                      <td className="p-3 text-xs text-muted-foreground">
                        {c.endsAt ? formatPersianDateTime(c.endsAt) : "—"}
                      </td>
                      <td className="p-3">
                        <Badge
                          className={cn(
                            c.isActive
                              ? "bg-emerald-500/12 text-emerald-700"
                              : "bg-muted text-muted-foreground",
                          )}
                        >
                          {c.isActive ? "فعال" : "غیرفعال"}
                        </Badge>
                      </td>
                      <td className="p-3 text-end">
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            href={`/admin/discounts/${c.id}` as Route}
                            className="text-xs font-semibold text-primary hover:underline"
                          >
                            کدها و استفاده‌ها
                          </Link>
                          <ToggleDiscountButton
                            id={c.id}
                            isActive={c.isActive}
                          />
                        </div>
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
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "muted" | "success";
}) {
  return (
    <div className="rounded-3xl border border-border bg-card p-4 shadow-sm">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mt-1 text-2xl font-semibold",
          tone === "success" && "text-emerald-700",
          tone === "muted" && "text-muted-foreground",
        )}
      >
        {value}
      </p>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] text-muted-foreground">{label}</dt>
      <dd className="font-medium text-foreground">{value}</dd>
    </div>
  );
}
