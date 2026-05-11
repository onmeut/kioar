import type { Route } from "next";
import Link from "next/link";
import { sql } from "drizzle-orm";
import {
  ArrowUpRightIcon,
  BadgePercentIcon,
  CalendarDaysIcon,
  CreditCardIcon,
  ExternalLinkIcon,
  LayoutGridIcon,
  MessageSquareIcon,
  ShieldCheckIcon,
  TrendingUpIcon,
  UsersIcon,
} from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { getDb } from "@/db";
import { requireAdmin } from "@/lib/auth/session";
import { getAdminUserStats } from "@/lib/data";
import {
  formatPersianDate,
  formatPersianDateTime,
  formatPersianNumber,
  toPersianDigits,
} from "@/lib/persian";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const PLAN_LABEL: Record<string, string> = {
  free: "رایگان",
  pro: "حرفه‌ای",
  business: "کسب‌وکار",
};

const PLAN_TONE: Record<string, string> = {
  free: "bg-muted text-muted-foreground",
  pro: "bg-emerald-500/12 text-emerald-700",
  business: "bg-violet-500/12 text-violet-700",
};

type SubStatusRow = { status: string; count: number };
type PlanDistRow = {
  plan_key: string;
  plan_name_fa: string;
  active_count: number;
  trialing_count: number;
  monthly_revenue_toman: number;
};
type RecentInvoiceRow = {
  id: string;
  number: string;
  status: string;
  total_toman: number;
  created_at: Date;
};
type RecentSignupRow = {
  id: string;
  full_name: string | null;
  phone: string;
  slug: string | null;
  avatar_url: string | null;
  created_at: Date;
};
type CardRequestRow = { status: string; count: number };

export default async function AdminPage() {
  await requireAdmin();
  const db = getDb();

  const [
    userStats,
    subStatusRows,
    planRows,
    paymentRow,
    recentInvoices,
    recentSignups,
    pageTotalRow,
    cardRequestRows,
    activeDiscountsRow,
    queuedSmsRow,
  ] = await Promise.all([
    getAdminUserStats(),
    db.execute(sql`
      SELECT s."status"::text AS status, COUNT(*)::int AS count
      FROM "page_subscriptions" s
      JOIN "plans" p ON p."id" = s."plan_id"
      WHERE p."key" <> 'free'
      GROUP BY s."status"
    `) as unknown as Promise<SubStatusRow[]>,
    db.execute(sql`
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
      GROUP BY p."key", p."name_fa", p."display_order"
      ORDER BY p."display_order" ASC
    `) as unknown as Promise<PlanDistRow[]>,
    db.execute(sql`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE "status" = 'verified')::int AS verified
      FROM "payments"
      WHERE "created_at" > now() - INTERVAL '30 days'
    `) as unknown as Promise<Array<{ total: number; verified: number }>>,
    db.execute(sql`
      SELECT
        i."id"           AS id,
        i."number"       AS number,
        i."status"::text AS status,
        i."total_toman"  AS total_toman,
        i."created_at"   AS created_at
      FROM "invoices" i
      ORDER BY i."created_at" DESC
      LIMIT 6
    `) as unknown as Promise<RecentInvoiceRow[]>,
    db.execute(sql`
      SELECT
        u."id"           AS id,
        u."phone"        AS phone,
        u."created_at"   AS created_at,
        p."full_name"    AS full_name,
        p."slug"         AS slug,
        p."avatar_url"   AS avatar_url
      FROM "users" u
      LEFT JOIN LATERAL (
        SELECT "full_name", "slug", "avatar_url"
        FROM "profiles"
        WHERE "user_id" = u."id"
        ORDER BY "created_at" ASC
        LIMIT 1
      ) p ON true
      ORDER BY u."created_at" DESC
      LIMIT 6
    `) as unknown as Promise<RecentSignupRow[]>,
    db.execute(
      sql`SELECT COUNT(*)::int AS total FROM "profiles"`,
    ) as unknown as Promise<Array<{ total: number }>>,
    db.execute(sql`
      SELECT "status"::text AS status, COUNT(*)::int AS count
      FROM "card_requests"
      GROUP BY "status"
    `) as unknown as Promise<CardRequestRow[]>,
    db.execute(sql`
      SELECT COUNT(*)::int AS active
      FROM "discount_codes"
      WHERE "is_active" = true
    `) as unknown as Promise<Array<{ active: number }>>,
    db.execute(sql`
      SELECT COUNT(*)::int AS queued
      FROM "sms_queue"
      WHERE "status" IN ('queued','sending','failed')
    `) as unknown as Promise<Array<{ queued: number }>>,
  ]);

  const subStatus = (k: string) =>
    subStatusRows.find((r) => r.status === k)?.count ?? 0;
  const activeSubs = subStatus("active") + subStatus("pending_renewal");
  const trialingSubs = subStatus("trialing");
  const graceSubs = subStatus("grace");
  const expiredSubs = subStatus("expired");
  const canceledSubs = subStatus("canceled");

  const mrrToman = planRows.reduce(
    (acc, r) => acc + Number(r.monthly_revenue_toman ?? 0),
    0,
  );
  const arrToman = mrrToman * 12;

  const paymentTotal = paymentRow[0]?.total ?? 0;
  const paymentVerified = paymentRow[0]?.verified ?? 0;
  const successRate =
    paymentTotal === 0
      ? null
      : Math.round((paymentVerified / paymentTotal) * 100);

  const totalPages = pageTotalRow[0]?.total ?? 0;
  const cardRequestNew =
    cardRequestRows.find((r) => r.status === "new")?.count ?? 0;
  const activeDiscounts = activeDiscountsRow[0]?.active ?? 0;
  const queuedSms = queuedSmsRow[0]?.queued ?? 0;

  return (
    <div className="section-shell space-y-8 py-6">
      {/* Quick actions */}
      <section className="flex flex-wrap gap-2">
        <Link
          href="/admin/users"
          className={cn(
            buttonVariants({ size: "lg", className: "h-11 rounded-full" }),
          )}
        >
          <UsersIcon className="size-4" />
          مدیریت کاربران
        </Link>
        <Link
          href={"/admin/pages" as Route}
          className={cn(
            buttonVariants({
              variant: "outline",
              size: "lg",
              className: "h-11 rounded-full",
            }),
          )}
        >
          <LayoutGridIcon className="size-4" />
          صفحه‌ها
        </Link>
        <Link
          href={"/admin/billing" as Route}
          className={cn(
            buttonVariants({
              variant: "outline",
              size: "lg",
              className: "h-11 rounded-full",
            }),
          )}
        >
          <CreditCardIcon className="size-4" />
          صورت‌حساب‌ها
        </Link>
        <Link
          href={"/admin/discounts" as Route}
          className={cn(
            buttonVariants({
              variant: "outline",
              size: "lg",
              className: "h-11 rounded-full",
            }),
          )}
        >
          <BadgePercentIcon className="size-4" />
          تخفیف‌ها
        </Link>
      </section>

      {/* Header */}
      <header className="space-y-1">
        <h1 className="text-2xl font-bold">نمای کلی</h1>
        <p className="text-sm text-muted-foreground">
          خلاصه‌ای از وضعیت پلتفرم، اشتراک‌ها، درآمد و فعالیت‌های اخیر.
        </p>
      </header>

      {/* Top KPIs */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <KpiTile
          label="کل کاربران"
          value={toPersianDigits(userStats.total)}
          delta={
            userStats.newLast7d > 0
              ? `+${toPersianDigits(userStats.newLast7d)} (۷ روز)`
              : undefined
          }
          icon={<UsersIcon className="size-4" />}
        />
        <KpiTile
          label="کل صفحه‌ها"
          value={toPersianDigits(totalPages)}
          icon={<LayoutGridIcon className="size-4" />}
        />
        <KpiTile
          label="اشتراک فعال"
          value={toPersianDigits(activeSubs)}
          icon={<ShieldCheckIcon className="size-4" />}
          tone="emerald"
        />
        <KpiTile
          label="در دوره آزمایشی"
          value={toPersianDigits(trialingSubs)}
          icon={<CalendarDaysIcon className="size-4" />}
          tone="amber"
        />
        <KpiTile
          label="درآمد ماهانه (MRR)"
          value={`${toPersianDigits(formatPersianNumber(mrrToman))}`}
          suffix="تومان"
          icon={<TrendingUpIcon className="size-4" />}
          tone="emerald"
        />
        <KpiTile
          label="نرخ موفقیت پرداخت"
          value={
            successRate === null ? "—" : `${toPersianDigits(successRate)}٪`
          }
          delta="۳۰ روز"
          icon={<CreditCardIcon className="size-4" />}
          tone={successRate !== null && successRate < 80 ? "rose" : "default"}
        />
      </section>

      {/* Secondary stats row */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MiniStat
          label="درآمد سالانه (ARR)"
          value={`${toPersianDigits(formatPersianNumber(arrToman))} تومان`}
        />
        <MiniStat
          label="فعال (۷ روز اخیر)"
          value={toPersianDigits(userStats.activeLast7d)}
        />
        <MiniStat
          label="درخواست کارت جدید"
          value={toPersianDigits(cardRequestNew)}
          href={"/admin/requests" as Route}
        />
        <MiniStat
          label="کدهای تخفیف فعال"
          value={toPersianDigits(activeDiscounts)}
          href={"/admin/discounts" as Route}
        />
      </section>

      {/* Plan distribution + Subscription status */}
      <section className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-3 lg:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold">توزیع پلن‌ها</h2>
            <Link
              href={"/admin/plans" as Route}
              className="text-xs font-semibold text-primary"
            >
              مدیریت پلن‌ها
            </Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {planRows.map((p) => (
              <div
                key={p.plan_key}
                className="rounded-3xl border border-border bg-card p-4"
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold">
                    {PLAN_LABEL[p.plan_key] ?? p.plan_name_fa}
                  </p>
                  <Badge
                    className={cn(
                      "rounded-full text-[10px]",
                      PLAN_TONE[p.plan_key] ?? "bg-muted",
                    )}
                  >
                    {p.plan_key}
                  </Badge>
                </div>
                <p className="mt-3 text-2xl font-bold">
                  {toPersianDigits(p.active_count)}
                </p>
                <p className="text-[11px] text-muted-foreground">صفحه فعال</p>
                <div className="mt-3 grid grid-cols-2 gap-2 border-t border-border pt-3 text-xs">
                  <div>
                    <p className="text-[11px] text-muted-foreground">آزمایشی</p>
                    <p className="font-semibold">
                      {toPersianDigits(p.trialing_count)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] text-muted-foreground">
                      درآمد ماهانه
                    </p>
                    <p className="font-semibold">
                      {toPersianDigits(
                        formatPersianNumber(Number(p.monthly_revenue_toman)),
                      )}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <h2 className="text-base font-semibold">وضعیت اشتراک‌ها</h2>
          <div className="space-y-2 rounded-3xl border border-border bg-card p-4">
            <SubStatusBar label="فعال" value={activeSubs} tone="emerald" />
            <SubStatusBar label="آزمایشی" value={trialingSubs} tone="amber" />
            <SubStatusBar label="مهلت پرداخت" value={graceSubs} tone="rose" />
            <SubStatusBar label="منقضی" value={expiredSubs} tone="muted" />
            <SubStatusBar label="لغو شده" value={canceledSubs} tone="muted" />
          </div>
          <Link
            href={"/admin/billing" as Route}
            className="inline-flex items-center gap-1 text-xs font-semibold text-primary"
          >
            جزئیات صورت‌حساب
            <ArrowUpRightIcon className="size-3" />
          </Link>
        </div>
      </section>

      {/* Signup trend */}
      <section className="rounded-3xl border border-border bg-card p-5">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold">
              روند ثبت‌نام ۱۴ روز اخیر
            </h2>
            <p className="text-xs text-muted-foreground">
              مجموع ۳۰ روز: {toPersianDigits(userStats.newLast30d)} کاربر جدید
            </p>
          </div>
          <Link
            href="/admin/users"
            className="text-xs font-semibold text-primary"
          >
            همه کاربران
          </Link>
        </div>
        <SignupBars data={userStats.signupTrend} />
      </section>

      {/* Two-column lower */}
      <section className="grid gap-6 lg:grid-cols-2">
        {/* Recent signups */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold">آخرین ثبت‌نام‌ها</h2>
            <Link
              href="/admin/users"
              className="text-xs font-semibold text-primary"
            >
              مشاهده همه
            </Link>
          </div>
          {recentSignups.length === 0 ? (
            <Empty>هنوز کاربری ثبت‌نام نکرده است.</Empty>
          ) : (
            <ul className="divide-y divide-border rounded-3xl border border-border bg-card">
              {recentSignups.map((u) => (
                <li key={u.id} className="flex items-center gap-3 p-3">
                  <Avatar className="size-9 shrink-0">
                    {u.avatar_url ? (
                      <AvatarImage src={u.avatar_url} alt="" />
                    ) : null}
                    <AvatarFallback className="text-xs font-bold">
                      {(u.full_name ?? u.phone).slice(-2)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">
                      {u.full_name ?? "بدون نام"}
                    </p>
                    {u.slug ? (
                      <Link
                        href={`/${u.slug}` as Route}
                        target="_blank"
                        className="inline-flex items-center gap-1 truncate text-xs text-primary"
                        dir="ltr"
                      >
                        /{u.slug}
                        <ExternalLinkIcon className="size-3" />
                      </Link>
                    ) : (
                      <p className="truncate text-xs text-muted-foreground">
                        پروفایل ناقص
                      </p>
                    )}
                  </div>
                  <span className="text-[11px] text-muted-foreground">
                    {formatPersianDate(u.created_at)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Recent invoices */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold">آخرین فاکتورها</h2>
            <Link
              href={"/admin/billing/invoices" as Route}
              className="inline-flex items-center gap-1 text-xs font-semibold text-primary"
            >
              همه فاکتورها <ArrowUpRightIcon className="size-3" />
            </Link>
          </div>
          {recentInvoices.length === 0 ? (
            <Empty>هنوز فاکتوری صادر نشده است.</Empty>
          ) : (
            <ul className="divide-y divide-border rounded-3xl border border-border bg-card">
              {recentInvoices.map((i) => (
                <li
                  key={i.id}
                  className="flex items-center justify-between gap-3 p-3"
                >
                  <div className="min-w-0">
                    <p className="font-mono text-xs text-foreground" dir="ltr">
                      {i.number}
                    </p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {formatPersianDateTime(i.created_at)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
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
        </div>
      </section>

      {/* Operational footer */}
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <OpsCard
          icon={<MessageSquareIcon className="size-4" />}
          label="پیامک‌های در صف یا ناموفق"
          value={toPersianDigits(queuedSms)}
          href={"/admin/sms" as Route}
          tone={queuedSms > 0 ? "warn" : "default"}
        />
        <OpsCard
          icon={<CreditCardIcon className="size-4" />}
          label="درخواست کارت در انتظار"
          value={toPersianDigits(cardRequestNew)}
          href={"/admin/requests" as Route}
          tone={cardRequestNew > 0 ? "warn" : "default"}
        />
        <OpsCard
          icon={<ShieldCheckIcon className="size-4" />}
          label="کاربران مسدود"
          value={toPersianDigits(userStats.banned)}
          href={"/admin/users?filter=banned" as Route}
          tone={userStats.banned > 0 ? "rose" : "default"}
        />
      </section>
    </div>
  );
}

function KpiTile({
  label,
  value,
  delta,
  suffix,
  icon,
  tone = "default",
}: {
  label: string;
  value: string;
  delta?: string;
  suffix?: string;
  icon?: React.ReactNode;
  tone?: "default" | "emerald" | "amber" | "rose";
}) {
  return (
    <div className="rounded-3xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {icon ? (
          <span
            className={cn(
              "inline-flex size-6 items-center justify-center rounded-full",
              tone === "emerald" && "bg-emerald-500/12 text-emerald-700",
              tone === "amber" && "bg-amber-500/12 text-amber-700",
              tone === "rose" && "bg-rose-500/12 text-rose-700",
              tone === "default" && "bg-muted text-foreground/70",
            )}
          >
            {icon}
          </span>
        ) : null}
        <span>{label}</span>
      </div>
      <p
        className={cn(
          "mt-3 text-2xl font-bold leading-none",
          tone === "emerald" && "text-emerald-700",
          tone === "rose" && "text-rose-700",
        )}
      >
        {value}
        {suffix ? (
          <span className="ms-1 text-xs font-medium text-muted-foreground">
            {suffix}
          </span>
        ) : null}
      </p>
      {delta ? (
        <p className="mt-1 text-[11px] text-muted-foreground">{delta}</p>
      ) : null}
    </div>
  );
}

function MiniStat({
  label,
  value,
  href,
}: {
  label: string;
  value: string;
  href?: Route;
}) {
  const inner = (
    <div className="rounded-3xl border border-border bg-card p-4 transition-colors hover:bg-accent">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

function SubStatusBar({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "emerald" | "amber" | "rose" | "muted";
}) {
  return (
    <div className="flex items-center gap-3">
      <span
        className={cn(
          "size-2 shrink-0 rounded-full",
          tone === "emerald" && "bg-emerald-500",
          tone === "amber" && "bg-amber-500",
          tone === "rose" && "bg-rose-500",
          tone === "muted" && "bg-muted-foreground/40",
        )}
      />
      <span className="flex-1 text-sm">{label}</span>
      <span className="text-sm font-semibold">{toPersianDigits(value)}</span>
    </div>
  );
}

function SignupBars({ data }: { data: { date: string; value: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="flex h-24 items-end gap-1.5">
      {data.map((d) => (
        <div
          key={d.date}
          className="group relative flex-1"
          title={`${d.date}: ${d.value}`}
        >
          <div
            className="rounded-t-md bg-primary/70 transition-colors group-hover:bg-primary"
            style={{
              height: `${(d.value / max) * 100}%`,
              minHeight: 3,
            }}
          />
        </div>
      ))}
    </div>
  );
}

function OpsCard({
  icon,
  label,
  value,
  href,
  tone = "default",
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  href: Route;
  tone?: "default" | "warn" | "rose";
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center justify-between gap-3 rounded-3xl border bg-card p-4 transition-colors hover:bg-accent",
        tone === "warn" && "border-amber-500/30 bg-amber-500/5",
        tone === "rose" && "border-rose-500/30 bg-rose-500/5",
        tone === "default" && "border-border",
      )}
    >
      <div className="flex items-center gap-3">
        <span
          className={cn(
            "inline-flex size-9 items-center justify-center rounded-full",
            tone === "warn" && "bg-amber-500/15 text-amber-700",
            tone === "rose" && "bg-rose-500/15 text-rose-700",
            tone === "default" && "bg-muted text-foreground/70",
          )}
        >
          {icon}
        </span>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-base font-bold">{value}</p>
        </div>
      </div>
      <ArrowUpRightIcon className="size-4 text-muted-foreground" />
    </Link>
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
  return <Badge className={cn("rounded-full", m.className)}>{m.label}</Badge>;
}
