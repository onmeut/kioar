import Link from "next/link";
import type { Route } from "next";
import { notFound } from "next/navigation";
import { sql } from "drizzle-orm";
import { ArrowUpLeftIcon } from "lucide-react";

import { DiscountProgramForm } from "@/components/admin/discount-program-form";
import { Badge } from "@/components/ui/badge";
import { getDb } from "@/db";
import { discountCodes } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth/session";
import {
  formatPersianDateTime,
  formatPersianNumber,
  toPersianDigits,
} from "@/lib/persian";
import { formatPhoneDisplay } from "@/lib/phone";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const TYPE_LABELS: Record<"percent" | "fixed_amount" | "free_months", string> =
  {
    percent: "درصدی",
    fixed_amount: "مبلغ ثابت",
    free_months: "ماه رایگان",
  };

type RedemptionRow = {
  id: string;
  invoice_id: string;
  invoice_number: string;
  invoice_status: "unpaid" | "paid" | "expired" | "canceled";
  applied_amount_toman: number;
  recurring_cycles_remaining: number;
  created_at: Date;
  page_id: string;
  page_slug: string;
  page_full_name: string | null;
  user_phone: string;
};

export default async function AdminDiscountDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const db = getDb();

  const [code] = await db
    .select()
    .from(discountCodes)
    .where(eq(discountCodes.id, id));
  if (!code) notFound();

  const redemptions = (await db.execute(sql`
    SELECT
      r."id"                   AS id,
      r."invoice_id"           AS invoice_id,
      i."number"               AS invoice_number,
      i."status"::text         AS invoice_status,
      r."applied_amount_toman" AS applied_amount_toman,
      r."recurring_cycles_remaining" AS recurring_cycles_remaining,
      r."created_at"           AS created_at,
      p."id"                   AS page_id,
      p."slug"                 AS page_slug,
      p."full_name"            AS page_full_name,
      u."phone"                AS user_phone
    FROM "discount_redemptions" r
    JOIN "invoices" i ON i."id" = r."invoice_id"
    JOIN "profiles" p ON p."id" = r."page_id"
    JOIN "users" u ON u."id" = r."user_id"
    WHERE r."discount_code_id" = ${id}::uuid
    ORDER BY r."created_at" DESC
    LIMIT 200
  `)) as unknown as RedemptionRow[];

  const totalApplied = redemptions.reduce(
    (sum, r) => sum + r.applied_amount_toman,
    0,
  );

  return (
    <div className="section-shell space-y-6 py-6">
      <div>
        <Link
          href={"/admin/discounts" as Route}
          className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground"
        >
          <ArrowUpLeftIcon className="size-3" />
          بازگشت به لیست برنامه‌ها
        </Link>
      </div>

      <header className="rounded-3xl border border-border bg-card p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold">{code.nameFa}</h1>
            <p
              className="mt-1 font-mono text-sm text-muted-foreground"
              dir="ltr"
            >
              {code.code}
            </p>
            {code.descriptionFa ? (
              <p className="mt-2 max-w-prose text-xs text-muted-foreground">
                {code.descriptionFa}
              </p>
            ) : null}
          </div>
          <Badge
            className={cn(
              code.isActive
                ? "bg-emerald-500/12 text-emerald-700"
                : "bg-muted text-muted-foreground",
            )}
          >
            {code.isActive ? "فعال" : "غیرفعال"}
          </Badge>
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="نوع" value={TYPE_LABELS[code.discountType]} />
        <Stat
          label="مقدار"
          value={
            code.discountType === "percent"
              ? `${toPersianDigits(code.amount)}٪`
              : code.discountType === "free_months"
                ? `${toPersianDigits(code.amount)} ماه`
                : `${toPersianDigits(formatPersianNumber(code.amount))} تومان`
          }
        />
        <Stat
          label="استفاده‌ها"
          value={
            code.maxRedemptions === null
              ? toPersianDigits(code.redemptionsCount)
              : `${toPersianDigits(code.redemptionsCount)} / ${toPersianDigits(code.maxRedemptions)}`
          }
        />
        <Stat
          label="مجموع تخفیف اعمال‌شده"
          value={`${toPersianDigits(formatPersianNumber(totalApplied))} ت`}
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold">ویرایش برنامه</h2>
        <DiscountProgramForm
          existing={{
            id: code.id,
            code: code.code,
            nameFa: code.nameFa,
            descriptionFa: code.descriptionFa,
            discountType: code.discountType,
            amount: code.amount,
            startsAt: code.startsAt
              ? new Date(code.startsAt).toISOString()
              : null,
            endsAt: code.endsAt ? new Date(code.endsAt).toISOString() : null,
            maxRedemptions: code.maxRedemptions,
            maxPerUser: code.maxPerUser,
            appliesToPlanKeys: code.appliesToPlanKeys,
            appliesToBillingCycles: code.appliesToBillingCycles,
            recurringCycles: code.recurringCycles,
            isActive: code.isActive,
            firstTimeOnly: code.firstTimeOnly,
          }}
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold">تاریخچه استفاده</h2>
        {redemptions.length === 0 ? (
          <p className="rounded-3xl border border-dashed border-border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
            هنوز کسی از این کد استفاده نکرده است.
          </p>
        ) : (
          <ul className="space-y-2">
            {redemptions.map((r) => (
              <li
                key={r.id}
                className="rounded-2xl border border-border bg-card p-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <Link
                      href={`/admin/billing/pages/${r.page_id}` as Route}
                      className="text-sm font-medium hover:underline"
                    >
                      {r.page_full_name ?? `/${r.page_slug}`}
                    </Link>
                    <p className="text-[11px] text-muted-foreground" dir="ltr">
                      {formatPhoneDisplay(r.user_phone)}
                    </p>
                    <p
                      className="font-mono text-[11px] text-muted-foreground"
                      dir="ltr"
                    >
                      {r.invoice_number}
                    </p>
                  </div>
                  <div className="text-end">
                    <p className="text-sm font-semibold">
                      −{" "}
                      {toPersianDigits(
                        formatPersianNumber(r.applied_amount_toman),
                      )}{" "}
                      ت
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {formatPersianDateTime(r.created_at)}
                    </p>
                    {r.recurring_cycles_remaining > 0 ? (
                      <p className="text-[11px] text-muted-foreground">
                        {toPersianDigits(r.recurring_cycles_remaining)} چرخه
                        باقی‌مانده
                      </p>
                    ) : null}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-3">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="mt-1 text-base font-semibold">{value}</p>
    </div>
  );
}
