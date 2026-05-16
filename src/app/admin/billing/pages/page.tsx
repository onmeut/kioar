import Link from "next/link";
import type { Route } from "next";
import { sql } from "drizzle-orm";
import {
  ArrowUpRightIcon,
  BanknoteIcon,
  ClockIcon,
  CreditCardIcon,
  SearchIcon,
  TrendingUpIcon,
  UsersIcon,
} from "lucide-react";

import {
  type RowAction,
} from "@/components/admin/row-actions-menu";
import { PageActionsMenu } from "@/components/admin/page-actions-menu";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { getDb } from "@/db";
import { requireAdmin } from "@/lib/auth/session";
import {
  formatPersianDate,
  formatPersianDateTime,
  formatPersianNumber,
  toPersianDigits,
} from "@/lib/persian";
import { formatPhoneDisplay } from "@/lib/phone";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 30;

const PLAN_LABELS: Record<string, string> = {
  free: "رایگان",
  pro: "حرفه‌ای",
  business: "کسب‌وکار",
};

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  active: { label: "فعال", className: "bg-emerald-500/12 text-emerald-700" },
  trialing: { label: "آزمایشی", className: "bg-amber-500/12 text-amber-700" },
  pending_renewal: {
    label: "در انتظار تمدید",
    className: "bg-blue-500/12 text-blue-700",
  },
  grace: { label: "مهلت پرداخت", className: "bg-rose-500/12 text-rose-700" },
  expired: { label: "منقضی", className: "bg-muted text-muted-foreground" },
  canceled: { label: "لغو شده", className: "bg-muted text-muted-foreground" },
};

const STATUS_FILTERS: Array<{
  key: string;
  label: string;
  match: string[] | null;
}> = [
  { key: "all", label: "همه", match: null },
  { key: "active", label: "فعال", match: ["active", "pending_renewal"] },
  { key: "trialing", label: "آزمایشی", match: ["trialing"] },
  { key: "grace", label: "مهلت پرداخت", match: ["grace"] },
  { key: "expired", label: "منقضی/لغو", match: ["expired", "canceled"] },
];

type Row = {
  page_id: string;
  slug: string;
  full_name: string | null;
  user_id: string;
  user_phone: string;
  plan_key: string;
  plan_name_fa: string;
  billing_cycle: string;
  status: string;
  current_period_end: Date;
  trial_ends_at: Date | null;
  cancel_at_period_end: boolean;
  admin_disabled_at: Date | null;
};

type Overview = {
  activeSubs: number;
  trialingSubs: number;
  graceSubs: number;
  expiredSubs: number;
  canceledSubs: number;
  mrrToman: number;
  successRate: number | null;
  plans: Array<{
    plan_key: string;
    plan_name_fa: string;
    active_count: number;
    trialing_count: number;
    monthly_revenue_toman: number;
  }>;
  topDiscounts: Array<{
    id: string;
    code: string;
    name_fa: string;
    redemptions_count: number;
  }>;
  recentInvoices: Array<{
    id: string;
    number: string;
    status: string;
    total_toman: number;
    created_at: Date;
    page_id: string;
  }>;
};

async function loadOverview(): Promise<Overview> {
  const db = getDb();

  const statusRows = (await db.execute(sql`
    SELECT s."status"::text AS status, COUNT(*)::int AS count
    FROM "page_subscriptions" s
    JOIN "plans" p ON p."id" = s."plan_id"
    WHERE p."key" <> 'free'
    GROUP BY s."status"
  `)) as unknown as Array<{ status: string; count: number }>;
  const statusOf = (k: string) =>
    statusRows.find((r) => r.status === k)?.count ?? 0;

  const plans = (await db.execute(sql`
    SELECT
      p."key"::text  AS plan_key,
      p."name_fa"    AS plan_name_fa,
      COUNT(*) FILTER (WHERE s."status" IN ('active','pending_renewal'))::int AS active_count,
      COUNT(*) FILTER (WHERE s."status" = 'trialing')::int AS trialing_count,
      COALESCE(SUM(
        CASE
          WHEN s."status" IN ('active','pending_renewal') AND s."billing_cycle" = 'monthly'
            AND (s."is_admin_override" IS NULL OR s."is_admin_override" = false)
            THEN p."price_monthly_toman"
          WHEN s."status" IN ('active','pending_renewal') AND s."billing_cycle" = 'annual'
            AND (s."is_admin_override" IS NULL OR s."is_admin_override" = false)
            THEN p."price_annual_toman" / 12
          ELSE 0
        END
      ), 0)::int AS monthly_revenue_toman
    FROM "plans" p
    LEFT JOIN "page_subscriptions" s ON s."plan_id" = p."id"
    WHERE p."key" <> 'free'
    GROUP BY p."key", p."name_fa", p."display_order"
    ORDER BY p."display_order" ASC
  `)) as unknown as Overview["plans"];

  const mrrToman = plans.reduce(
    (acc, r) => acc + Number(r.monthly_revenue_toman ?? 0),
    0,
  );

  const paymentRows = (await db.execute(sql`
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE "status" = 'verified')::int AS verified
    FROM "payments"
    WHERE "created_at" > now() - INTERVAL '30 days'
  `)) as unknown as Array<{ total: number; verified: number }>;
  const paymentTotal = paymentRows[0]?.total ?? 0;
  const paymentVerified = paymentRows[0]?.verified ?? 0;
  const successRate =
    paymentTotal === 0
      ? null
      : Math.round((paymentVerified / paymentTotal) * 100);

  const topDiscounts = (await db.execute(sql`
    SELECT
      c."id"                AS id,
      c."code"              AS code,
      c."name_fa"           AS name_fa,
      c."redemptions_count" AS redemptions_count
    FROM "discount_codes" c
    WHERE c."redemptions_count" > 0
    ORDER BY c."redemptions_count" DESC
    LIMIT 5
  `)) as unknown as Overview["topDiscounts"];

  const recentInvoices = (await db.execute(sql`
    SELECT
      i."id"           AS id,
      i."number"       AS number,
      i."status"::text AS status,
      i."total_toman"  AS total_toman,
      i."created_at"   AS created_at,
      i."page_id"      AS page_id
    FROM "invoices" i
    ORDER BY i."created_at" DESC
    LIMIT 8
  `)) as unknown as Overview["recentInvoices"];

  return {
    activeSubs: statusOf("active"),
    trialingSubs: statusOf("trialing"),
    graceSubs: statusOf("grace"),
    expiredSubs: statusOf("expired"),
    canceledSubs: statusOf("canceled"),
    mrrToman,
    successRate,
    plans,
    topDiscounts,
    recentInvoices,
  };
}

export default async function AdminSubscriptionsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    status?: string;
    ref?: string;
    page?: string;
  }>;
}) {
  await requireAdmin();
  const {
    q = "",
    status = "all",
    ref: zarinpalRef = "",
    page = "1",
  } = await searchParams;
  const db = getDb();
  const refTrim = zarinpalRef.trim();

  // Ref-ID lookup short-circuits before any other rendering work.
  if (refTrim) {
    const found = (await db.execute(sql`
      SELECT
        i."id"           AS invoice_id,
        i."number"       AS invoice_number,
        i."page_id"      AS page_id,
        p."slug"         AS slug,
        pay."ref_id"     AS ref_id,
        pay."authority"  AS authority,
        pay."status"     AS pay_status
      FROM "payments" pay
      JOIN "invoices" i ON i."id" = pay."invoice_id"
      JOIN "profiles" p ON p."id" = i."page_id"
      WHERE pay."ref_id" = ${refTrim} OR pay."authority" = ${refTrim}
      ORDER BY pay."created_at" DESC
      LIMIT 20
    `)) as unknown as Array<{
      invoice_id: string;
      invoice_number: string;
      page_id: string;
      slug: string;
      ref_id: string | null;
      authority: string;
      pay_status: string;
    }>;

    return (
      <div className="section-shell space-y-6 py-6">
        <Header />
        <SearchForm q={q} status={status} zarinpalRef={zarinpalRef} />
        <section className="space-y-3">
          <h2 className="text-base font-semibold">
            نتایج جست‌وجوی شناسه پرداخت
          </h2>
          {found.length === 0 ? (
            <p className="rounded-3xl border border-dashed border-border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
              پرداختی با این شناسه یافت نشد.
            </p>
          ) : (
            <ul className="space-y-2">
              {found.map((f) => (
                <li
                  key={`${f.invoice_id}-${f.authority}`}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-3"
                >
                  <div className="min-w-0 space-y-1">
                    <p className="font-mono text-xs text-foreground" dir="ltr">
                      {f.invoice_number}
                    </p>
                    <p
                      className="font-mono text-[11px] text-muted-foreground"
                      dir="ltr"
                    >
                      ref: {f.ref_id ?? "—"} · auth: {f.authority.slice(0, 20)}…
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className="bg-muted">{f.pay_status}</Badge>
                    <Link
                      href={`/admin/billing/pages/${f.page_id}` as Route}
                      className="inline-flex items-center gap-1 rounded-full bg-foreground px-3 py-1 text-xs font-semibold text-background"
                    >
                      اشتراک <ArrowUpRightIcon className="size-3" />
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    );
  }

  const filter =
    STATUS_FILTERS.find((f) => f.key === status) ?? STATUS_FILTERS[0];
  const statusFilterSql = filter.match
    ? sql`AND s."status" IN (${sql.raw(
        filter.match.map((s) => `'${s}'`).join(","),
      )})`
    : sql``;

  const qTrim = q.trim();
  const qLike = `%${qTrim.toLowerCase()}%`;
  const searchSql = qTrim
    ? sql`AND (
        LOWER(p."slug") LIKE ${qLike}
        OR LOWER(COALESCE(p."full_name", '')) LIKE ${qLike}
        OR p."public_phone" LIKE ${`%${qTrim}%`}
        OR u."phone" LIKE ${`%${qTrim}%`}
      )`
    : sql``;

  const pageNum = Math.max(1, Number.parseInt(page, 10) || 1);
  const offset = (pageNum - 1) * PAGE_SIZE;

  const [overview, rows, countRows] = await Promise.all([
    loadOverview(),
    db.execute(sql`
      SELECT
        p."id"                  AS page_id,
        p."slug"                AS slug,
        p."full_name"           AS full_name,
        u."id"                  AS user_id,
        u."phone"               AS user_phone,
        pl."key"::text          AS plan_key,
        pl."name_fa"            AS plan_name_fa,
        s."billing_cycle"::text AS billing_cycle,
        s."status"::text        AS status,
        s."current_period_end"  AS current_period_end,
        s."trial_ends_at"       AS trial_ends_at,
        s."cancel_at_period_end" AS cancel_at_period_end,
        p."admin_disabled_at"    AS admin_disabled_at
      FROM "page_subscriptions" s
      JOIN "profiles" p ON p."id" = s."page_id"
      JOIN "users" u    ON u."id" = p."user_id"
      JOIN "plans" pl   ON pl."id" = s."plan_id"
      WHERE 1=1
      ${statusFilterSql}
      ${searchSql}
      ORDER BY
        CASE s."status"
          WHEN 'trialing' THEN 0
          WHEN 'grace' THEN 1
          WHEN 'active' THEN 2
          WHEN 'pending_renewal' THEN 3
          WHEN 'expired' THEN 4
          WHEN 'canceled' THEN 5
          ELSE 9
        END,
        s."current_period_end" ASC
      LIMIT ${PAGE_SIZE} OFFSET ${offset}
    `) as unknown as Promise<Row[]>,
    db.execute(sql`
      SELECT COUNT(*)::int AS c
      FROM "page_subscriptions" s
      JOIN "profiles" p ON p."id" = s."page_id"
      JOIN "users" u    ON u."id" = p."user_id"
      JOIN "plans" pl   ON pl."id" = s."plan_id"
      WHERE 1=1
      ${statusFilterSql}
      ${searchSql}
    `) as unknown as Promise<Array<{ c: number }>>,
  ]);

  const total = countRows[0]?.c ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="section-shell space-y-6 py-6">
      <Header />

      {/* Overview KPIs */}
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi
          icon={<UsersIcon className="size-4" />}
          label="اشتراک‌های فعال"
          value={toPersianDigits(overview.activeSubs)}
        />
        <Kpi
          icon={<ClockIcon className="size-4" />}
          label="در دوره آزمایشی"
          value={toPersianDigits(overview.trialingSubs)}
          tone="amber"
        />
        <Kpi
          icon={<TrendingUpIcon className="size-4" />}
          label="درآمد ماهانه (تخمینی)"
          value={`${toPersianDigits(formatPersianNumber(overview.mrrToman))} تومان`}
          tone="success"
        />
        <Kpi
          icon={<CreditCardIcon className="size-4" />}
          label="نرخ موفقیت پرداخت (۳۰ روز)"
          value={
            overview.successRate === null
              ? "—"
              : `${toPersianDigits(overview.successRate)}٪`
          }
          tone={
            overview.successRate !== null && overview.successRate < 80
              ? "warning"
              : "default"
          }
        />
      </section>

      {/* Plan distribution */}
      <section className="space-y-3">
        <h2 className="text-base font-semibold">توزیع پلن‌ها</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {overview.plans.map((p) => (
            <div
              key={p.plan_key}
              className="rounded-3xl border border-border bg-card p-4 shadow-sm"
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-foreground">
                  {PLAN_LABELS[p.plan_key] ?? p.plan_name_fa}
                </p>
                <Badge className="bg-muted text-muted-foreground">
                  {toPersianDigits(p.active_count)} فعال
                </Badge>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                <div>
                  <p className="text-[11px]">آزمایشی</p>
                  <p className="text-base font-semibold text-foreground">
                    {toPersianDigits(p.trialing_count)}
                  </p>
                </div>
                <div>
                  <p className="text-[11px]">درآمد ماهانه</p>
                  <p className="text-base font-semibold text-foreground">
                    {toPersianDigits(
                      formatPersianNumber(Number(p.monthly_revenue_toman)),
                    )}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Status counts breakdown */}
      <section className="space-y-3">
        <h2 className="text-base font-semibold">وضعیت اشتراک‌ها</h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-5">
          <Mini label="فعال" value={overview.activeSubs} tone="emerald" />
          <Mini label="آزمایشی" value={overview.trialingSubs} tone="amber" />
          <Mini label="مهلت پرداخت" value={overview.graceSubs} tone="rose" />
          <Mini label="منقضی" value={overview.expiredSubs} tone="muted" />
          <Mini label="لغو شده" value={overview.canceledSubs} tone="muted" />
        </div>
      </section>

      {/* Top discount codes + recent invoices */}
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold">پراستفاده‌ترین کدها</h2>
            <Link
              href={"/admin/discounts" as Route}
              className="text-xs font-semibold text-primary"
            >
              مشاهده همه
            </Link>
          </div>
          {overview.topDiscounts.length === 0 ? (
            <Empty>هنوز کدی استفاده نشده است.</Empty>
          ) : (
            <ul className="space-y-2">
              {overview.topDiscounts.map((d) => (
                <li
                  key={d.id}
                  className="flex items-center justify-between rounded-2xl border border-border bg-card p-3"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-foreground">{d.name_fa}</p>
                    <p
                      className="mt-0.5 font-mono text-xs text-muted-foreground"
                      dir="ltr"
                    >
                      {d.code}
                    </p>
                  </div>
                  <Badge className="bg-emerald-500/12 text-emerald-700">
                    {toPersianDigits(d.redemptions_count)}× استفاده
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold">آخرین فاکتورها</h2>
            <Link
              href={"/admin/billing/invoices" as Route}
              className="inline-flex items-center gap-1 text-xs font-semibold text-primary"
            >
              همه فاکتورها <ArrowUpRightIcon className="size-3" />
            </Link>
          </div>
          {overview.recentInvoices.length === 0 ? (
            <Empty>هنوز فاکتوری صادر نشده است.</Empty>
          ) : (
            <ul className="space-y-2">
              {overview.recentInvoices.map((i) => (
                <li
                  key={i.id}
                  className="flex items-center justify-between rounded-2xl border border-border bg-card p-3"
                >
                  <Link
                    href={`/admin/billing/pages/${i.page_id}` as Route}
                    className="min-w-0 flex-1"
                  >
                    <p
                      className="font-mono text-xs text-foreground hover:underline"
                      dir="ltr"
                    >
                      {i.number}
                    </p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {formatPersianDateTime(i.created_at)}
                    </p>
                  </Link>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold">
                      {toPersianDigits(formatPersianNumber(i.total_toman))}{" "}
                      تومان
                    </span>
                    <InvoiceStatusBadge status={i.status} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <p className="text-xs text-muted-foreground">
        <BanknoteIcon className="me-1 inline size-3" />
        درآمد ماهانه از روی پلن‌های فعال محاسبه می‌شود (سالانه ÷ ۱۲). تخفیف‌ها و
        VAT اعمال نمی‌شوند.
      </p>

      {/* Subscriptions list */}
      <section className="space-y-3 border-t border-border pt-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">همه اشتراک‌ها</h2>
          <span className="text-xs text-muted-foreground">
            مجموع {toPersianDigits(formatPersianNumber(total))} اشتراک
          </span>
        </div>
        <SearchForm q={q} status={status} zarinpalRef={zarinpalRef} />

        <div className="flex flex-wrap gap-2">
          {STATUS_FILTERS.map((f) => {
            const params = new URLSearchParams();
            if (qTrim) params.set("q", qTrim);
            if (f.key !== "all") params.set("status", f.key);
            const href = `/admin/billing/pages${
              params.toString() ? `?${params.toString()}` : ""
            }`;
            const active = f.key === status;
            return (
              <Link
                key={f.key}
                href={href as Route}
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-semibold",
                  active
                    ? "bg-foreground text-background"
                    : "bg-muted text-muted-foreground hover:bg-muted/80",
                )}
              >
                {f.label}
              </Link>
            );
          })}
        </div>

        {rows.length === 0 ? (
          <p className="rounded-3xl border border-dashed border-border bg-muted/30 p-8 text-center text-sm text-muted-foreground">
            اشتراکی با این شرایط یافت نشد.
          </p>
        ) : (
          <>
            <ul className="space-y-2 lg:hidden">
              {rows.map((r) => (
                <PageRowMobile key={r.page_id} row={r} />
              ))}
            </ul>
            <div className="hidden overflow-hidden rounded-3xl border border-border bg-card shadow-sm lg:block">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs text-muted-foreground">
                  <tr>
                    <th className="p-3 text-start">صفحه</th>
                    <th className="p-3 text-start">مالک</th>
                    <th className="p-3 text-start">پلن</th>
                    <th className="p-3 text-start">دوره</th>
                    <th className="p-3 text-start">وضعیت</th>
                    <th className="p-3 text-start">پایان دوره</th>
                    <th className="p-3 text-end"></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <PageRowDesktop key={r.page_id} row={r} />
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 ? (
              <Pagination
                page={pageNum}
                totalPages={totalPages}
                q={qTrim}
                status={status}
              />
            ) : null}
          </>
        )}
      </section>
    </div>
  );
}

function Header() {
  return (
    <header className="space-y-1">
      <h1 className="text-2xl font-semibold text-foreground">اشتراک‌ها</h1>
      <p className="text-sm text-muted-foreground">
        نمای کلی اشتراک‌های پلتفرم، توزیع پلن‌ها، نرخ پرداخت و فهرست همه
        اشتراک‌ها در یک‌جا.
      </p>
    </header>
  );
}

function SearchForm({
  q,
  status,
  zarinpalRef,
}: {
  q: string;
  status: string;
  zarinpalRef: string;
}) {
  return (
    <form
      className="grid gap-3 sm:grid-cols-[2fr_1fr_auto]"
      method="GET"
      action="/admin/billing/pages"
    >
      <div className="relative">
        <SearchIcon className="pointer-events-none absolute inset-e-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          name="q"
          defaultValue={q}
          placeholder="جست‌وجو: شناسه، نام مالک، شماره تلفن"
          inputMode="search"
          enterKeyHint="search"
          className="pe-10"
        />
        {status && status !== "all" ? (
          <input type="hidden" name="status" value={status} />
        ) : null}
      </div>
      <Input
        name="ref"
        defaultValue={zarinpalRef}
        placeholder="شناسه پرداخت زرین‌پال"
        inputMode="numeric"
        dir="ltr"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
      />
      <button
        type="submit"
        className="h-11 rounded-full bg-foreground px-5 text-sm font-semibold text-background md:h-9"
      >
        جست‌وجو
      </button>
    </form>
  );
}

function StatusBadge({ status }: { status: string }) {
  const m = STATUS_LABELS[status] ?? {
    label: status,
    className: "bg-muted text-muted-foreground",
  };
  return <Badge className={m.className}>{m.label}</Badge>;
}

function buildSubActions(row: Row): RowAction[] {
  return [
    {
      key: "edit",
      label: "ویرایش اشتراک",
      icon: "edit",
      href: `/admin/billing/pages/${row.page_id}`,
    },
    {
      key: "owner",
      label: "مدیریت کاربر",
      icon: "user",
      href: `/admin/users/${row.user_id}`,
    },
    {
      key: "invoices",
      label: "فاکتورها",
      icon: "invoice",
      href: `/admin/billing/invoices?userId=${row.user_id}`,
    },
    {
      key: "view",
      label: "مشاهده صفحه عمومی",
      icon: "external",
      href: `/${row.slug}`,
      external: true,
      separatorBefore: true,
    },
  ];
}

function PageRowDesktop({ row }: { row: Row }) {
  return (
    <tr className="border-t border-border align-middle">
      <td className="p-3">
        <Link
          href={`/admin/billing/pages/${row.page_id}` as Route}
          className="font-medium text-foreground hover:underline"
        >
          {row.full_name ?? `/${row.slug}`}
        </Link>
        <p className="font-mono text-[11px] text-muted-foreground" dir="ltr">
          /{row.slug}
        </p>
      </td>
      <td className="p-3">
        <Link
          href={`/admin/users/${row.user_id}` as Route}
          className="text-foreground hover:underline"
        >
          {row.full_name ?? "—"}
        </Link>
        <p className="text-xs text-muted-foreground" dir="ltr">
          {formatPhoneDisplay(row.user_phone)}
        </p>
      </td>
      <td className="p-3">
        <span className="font-medium">{row.plan_name_fa}</span>
      </td>
      <td className="p-3 text-xs text-muted-foreground">
        {row.billing_cycle === "annual" ? "سالانه" : "ماهانه"}
        {row.trial_ends_at ? (
          <span className="ms-2 text-[10px]">
            تا {formatPersianDate(row.trial_ends_at)}
          </span>
        ) : null}
      </td>
      <td className="p-3">
        <div className="flex items-center gap-1">
          <StatusBadge status={row.status} />
          {row.cancel_at_period_end ? (
            <Badge className="bg-muted text-muted-foreground">
              لغو در پایان
            </Badge>
          ) : null}
        </div>
      </td>
      <td className="p-3 text-xs">
        {formatPersianDate(row.current_period_end)}
      </td>
      <td className="p-3 text-end">
        <PageActionsMenu
          pageId={row.page_id}
          isDisabled={!!row.admin_disabled_at}
          actions={buildSubActions(row)}
        />
      </td>
    </tr>
  );
}

function PageRowMobile({ row }: { row: Row }) {
  return (
    <li className="rounded-3xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link
            href={`/admin/billing/pages/${row.page_id}` as Route}
            className="font-medium text-foreground hover:underline"
          >
            {row.full_name ?? `/${row.slug}`}
          </Link>
          <p className="font-mono text-[11px] text-muted-foreground" dir="ltr">
            /{row.slug} · {formatPhoneDisplay(row.user_phone)}
          </p>
        </div>
        <StatusBadge status={row.status} />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <div>
          <p className="text-[11px] text-muted-foreground">پلن</p>
          <p className="font-medium">
            {row.plan_name_fa} ·{" "}
            {row.billing_cycle === "annual" ? "سالانه" : "ماهانه"}
          </p>
        </div>
        <div>
          <p className="text-[11px] text-muted-foreground">پایان دوره</p>
          <p>{formatPersianDate(row.current_period_end)}</p>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-end">
        <PageActionsMenu
          pageId={row.page_id}
          isDisabled={!!row.admin_disabled_at}
          actions={buildSubActions(row)}
        />
      </div>
    </li>
  );
}

function Pagination({
  page,
  totalPages,
  q,
  status,
}: {
  page: number;
  totalPages: number;
  q: string;
  status: string;
}) {
  function build(p: number) {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (status && status !== "all") params.set("status", status);
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    return `/admin/billing/pages${qs ? `?${qs}` : ""}`;
  }
  return (
    <nav className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
      {page > 1 ? (
        <Link
          href={build(page - 1) as Route}
          className="rounded-full bg-muted px-3 py-1"
        >
          قبلی
        </Link>
      ) : null}
      <span>
        صفحه {toPersianDigits(page)} از {toPersianDigits(totalPages)}
      </span>
      {page < totalPages ? (
        <Link
          href={build(page + 1) as Route}
          className="rounded-full bg-muted px-3 py-1"
        >
          بعدی
        </Link>
      ) : null}
    </nav>
  );
}

function Kpi({
  icon,
  label,
  value,
  tone = "default",
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone?: "default" | "success" | "amber" | "warning";
}) {
  return (
    <div className="rounded-3xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className="text-muted-foreground/80">{icon}</span>
        <span>{label}</span>
      </div>
      <p
        className={cn(
          "mt-2 text-2xl font-semibold",
          tone === "success" && "text-emerald-700",
          tone === "amber" && "text-amber-700",
          tone === "warning" && "text-rose-700",
        )}
      >
        {value}
      </p>
    </div>
  );
}

function Mini({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "emerald" | "amber" | "rose" | "muted";
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border p-3",
        tone === "emerald" && "border-emerald-200 bg-emerald-50",
        tone === "amber" && "border-amber-200 bg-amber-50",
        tone === "rose" && "border-rose-200 bg-rose-50",
        tone === "muted" && "border-border bg-muted/40",
      )}
    >
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold">{toPersianDigits(value)}</p>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-3xl border border-dashed border-border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
      {children}
    </div>
  );
}

function InvoiceStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    paid: {
      label: "پرداخت‌شده",
      className: "bg-emerald-500/12 text-emerald-700",
    },
    unpaid: {
      label: "پرداخت‌نشده",
      className: "bg-amber-500/12 text-amber-700",
    },
    expired: { label: "منقضی", className: "bg-muted text-muted-foreground" },
    canceled: {
      label: "لغو شده",
      className: "bg-muted text-muted-foreground",
    },
  };
  const m = map[status] ?? { label: status, className: "bg-muted" };
  return <Badge className={m.className}>{m.label}</Badge>;
}
