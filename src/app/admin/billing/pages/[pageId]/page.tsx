import Link from "next/link";
import type { Route } from "next";
import { notFound } from "next/navigation";
import { sql } from "drizzle-orm";
import {
  ArrowUpLeftIcon,
  CalendarDaysIcon,
  ExternalLinkIcon,
  UserIcon,
} from "lucide-react";

import { EntitlementsManager } from "@/components/admin/entitlements-manager";
import { InvoiceActions } from "@/components/admin/invoice-actions";
import { SubscriptionActions } from "@/components/admin/subscription-actions";
import { SubscriptionAdvancedActions } from "@/components/admin/subscription-advanced-actions";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { getDb } from "@/db";
import {
  ADMIN_AUDIT_ACTION_LABELS,
  type AdminAuditAction,
  getAuditLogForPage,
} from "@/lib/admin-audit";
import { requireAdmin } from "@/lib/auth/session";
import {
  formatPersianDate,
  formatPersianDateTime,
  formatPersianNumber,
  toPersianDigits,
} from "@/lib/persian";
import { formatPhoneDisplay } from "@/lib/phone";
import { absoluteUrl } from "@/lib/site";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const SUBSCRIPTION_STATUS_LABELS: Record<
  string,
  { label: string; className: string }
> = {
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

const INVOICE_STATUS_LABELS: Record<
  string,
  { label: string; className: string }
> = {
  paid: {
    label: "پرداخت‌شده",
    className: "bg-emerald-500/12 text-emerald-700",
  },
  unpaid: { label: "پرداخت‌نشده", className: "bg-amber-500/12 text-amber-700" },
  expired: { label: "منقضی", className: "bg-muted text-muted-foreground" },
  canceled: { label: "لغو شده", className: "bg-muted text-muted-foreground" },
};

const SMS_STATUS_LABELS: Record<string, { label: string; className: string }> =
  {
    queued: { label: "در صف", className: "bg-muted" },
    sending: {
      label: "در حال ارسال",
      className: "bg-amber-500/12 text-amber-700",
    },
    sent: {
      label: "ارسال شد",
      className: "bg-emerald-500/12 text-emerald-700",
    },
    failed: {
      label: "ناموفق",
      className: "bg-destructive/10 text-destructive",
    },
  };

type PageDetail = {
  page_id: string;
  slug: string;
  full_name: string | null;
  avatar_url: string | null;
  user_id: string;
  user_phone: string;
  banned_at: Date | null;
  plan_id: string;
  plan_key: "free" | "pro" | "business";
  plan_name_fa: string;
  billing_cycle: "monthly" | "annual";
  status: string;
  current_period_start: Date;
  current_period_end: Date;
  trial_ends_at: Date | null;
  has_used_trial_pro: boolean;
  has_used_trial_business: boolean;
  cancel_at_period_end: boolean;
  pending_plan_change_plan_id: string | null;
  pending_plan_change_name_fa: string | null;
  plan_price_monthly_toman: number;
  plan_price_annual_toman: number;
  pending_discount_code_id: string | null;
  pending_discount_code: string | null;
  pending_discount_queued_at: Date | null;
};

type InvoiceRow = {
  id: string;
  number: string;
  status: "unpaid" | "paid" | "expired" | "canceled";
  total_toman: number;
  subtotal_toman: number;
  discount_amount_toman: number;
  vat_toman: number;
  due_at: Date;
  paid_at: Date | null;
  created_at: Date;
  billing_cycle: "monthly" | "annual";
};

type PaymentRow = {
  id: string;
  invoice_number: string;
  invoice_id: string;
  authority: string;
  ref_id: string | null;
  status: "initiated" | "verified" | "failed";
  amount_toman: number;
  verified_at: Date | null;
  created_at: Date;
};

type EntitlementRow = {
  feature_key: string;
  source: "subscription" | "admin_grant" | "promo";
  expires_at: Date | null;
  feature_name_fa: string | null;
  feature_category: string | null;
};

type SmsRow = {
  id: string;
  template_key: string;
  status: string;
  scheduled_for: Date;
  sent_at: Date | null;
  attempts: number;
  last_error: string | null;
  created_at: Date;
};

type FeatureRow = {
  key: string;
  name_fa: string;
  category: string;
};

type PlanRow = {
  key: "free" | "pro" | "business";
  name_fa: string;
};

export default async function AdminBillingPageDetailPage({
  params,
}: {
  params: Promise<{ pageId: string }>;
}) {
  await requireAdmin();
  const { pageId } = await params;
  const db = getDb();

  const detailRows = (await db.execute(sql`
    SELECT
      p."id"                       AS page_id,
      p."slug"                     AS slug,
      p."full_name"                AS full_name,
      p."avatar_url"               AS avatar_url,
      u."id"                       AS user_id,
      u."phone"                    AS user_phone,
      u."banned_at"                AS banned_at,
      pl."id"                      AS plan_id,
      pl."key"::text               AS plan_key,
      pl."name_fa"                 AS plan_name_fa,
      s."billing_cycle"::text      AS billing_cycle,
      s."status"::text             AS status,
      s."current_period_start"     AS current_period_start,
      s."current_period_end"       AS current_period_end,
      s."trial_ends_at"            AS trial_ends_at,
      s."has_used_trial_pro"       AS has_used_trial_pro,
      s."has_used_trial_business"  AS has_used_trial_business,
      s."cancel_at_period_end"     AS cancel_at_period_end,
      s."pending_plan_change_plan_id" AS pending_plan_change_plan_id,
      pp."name_fa"                 AS pending_plan_change_name_fa,
      pl."price_monthly_toman"     AS plan_price_monthly_toman,
      pl."price_annual_toman"      AS plan_price_annual_toman,
      s."pending_discount_code_id" AS pending_discount_code_id,
      pdc."code"                   AS pending_discount_code,
      s."pending_discount_queued_at" AS pending_discount_queued_at
    FROM "profiles" p
    JOIN "users" u ON u."id" = p."user_id"
    JOIN "page_subscriptions" s ON s."page_id" = p."id"
    JOIN "plans" pl ON pl."id" = s."plan_id"
    LEFT JOIN "plans" pp ON pp."id" = s."pending_plan_change_plan_id"
    LEFT JOIN "discount_codes" pdc ON pdc."id" = s."pending_discount_code_id"
    WHERE p."id" = ${pageId}::uuid
    LIMIT 1
  `)) as unknown as PageDetail[];

  const detail = detailRows[0];
  if (!detail) notFound();

  const [
    invoices,
    payments,
    entitlements,
    sms,
    features,
    allPlans,
    audit,
    priceLockRows,
    activeDiscountCodes,
  ] = await Promise.all([
    db.execute(sql`
        SELECT
          "id", "number", "status"::text AS status, "total_toman",
          "subtotal_toman", "discount_amount_toman", "vat_toman",
          "due_at", "paid_at", "created_at",
          "billing_cycle"::text AS billing_cycle
        FROM "invoices"
        WHERE "page_id" = ${pageId}::uuid
        ORDER BY "created_at" DESC
        LIMIT 50
      `) as unknown as Promise<InvoiceRow[]>,
    db.execute(sql`
        SELECT
          pay."id"          AS id,
          i."number"        AS invoice_number,
          pay."invoice_id"  AS invoice_id,
          pay."authority"   AS authority,
          pay."ref_id"      AS ref_id,
          pay."status"::text AS status,
          pay."amount_toman" AS amount_toman,
          pay."verified_at" AS verified_at,
          pay."created_at"  AS created_at
        FROM "payments" pay
        JOIN "invoices" i ON i."id" = pay."invoice_id"
        WHERE i."page_id" = ${pageId}::uuid
        ORDER BY pay."created_at" DESC
        LIMIT 50
      `) as unknown as Promise<PaymentRow[]>,
    db.execute(sql`
        SELECT
          e."feature_key"  AS feature_key,
          e."source"::text AS source,
          e."expires_at"   AS expires_at,
          f."name_fa"      AS feature_name_fa,
          f."category"     AS feature_category
        FROM "page_entitlements" e
        LEFT JOIN "features" f ON f."key" = e."feature_key"
        WHERE e."page_id" = ${pageId}::uuid
          AND (e."expires_at" IS NULL OR e."expires_at" > now())
        ORDER BY f."category" ASC NULLS LAST, f."display_order" ASC NULLS LAST,
                 e."feature_key" ASC
      `) as unknown as Promise<EntitlementRow[]>,
    db.execute(sql`
        SELECT
          sq."id"             AS id,
          sq."template_key"   AS template_key,
          sq."status"::text   AS status,
          sq."scheduled_for"  AS scheduled_for,
          sq."sent_at"        AS sent_at,
          sq."attempts"       AS attempts,
          sq."last_error"     AS last_error,
          sq."created_at"     AS created_at
        FROM "sms_queue" sq
        WHERE sq."user_id" = ${detail.user_id}::uuid
        ORDER BY sq."created_at" DESC
        LIMIT 30
      `) as unknown as Promise<SmsRow[]>,
    db.execute(sql`
        SELECT "key", "name_fa", "category"
        FROM "features"
        ORDER BY "category" ASC NULLS LAST, "display_order" ASC NULLS LAST,
                 "name_fa" ASC
      `) as unknown as Promise<FeatureRow[]>,
    db.execute(sql`
        SELECT "key"::text AS key, "name_fa"
        FROM "plans"
        WHERE "is_active" = true
        ORDER BY "display_order" ASC
      `) as unknown as Promise<PlanRow[]>,
    getAuditLogForPage(pageId, 30),
    db.execute(sql`
        SELECT
          "locked_monthly_toman" AS locked_monthly_toman,
          "locked_annual_toman"  AS locked_annual_toman,
          "reason"               AS reason,
          "locked_at"            AS locked_at
        FROM "subscription_price_locks"
        WHERE "page_id" = ${pageId}::uuid
        LIMIT 1
      `) as unknown as Promise<
      Array<{
        locked_monthly_toman: number;
        locked_annual_toman: number;
        reason: string | null;
        locked_at: Date;
      }>
    >,
    db.execute(sql`
        SELECT "id", "code", "name_fa"
        FROM "discount_codes"
        WHERE "is_active" = true AND "deleted_at" IS NULL
        ORDER BY "code" ASC
        LIMIT 200
      `) as unknown as Promise<
      Array<{ id: string; code: string; name_fa: string }>
    >,
  ]);

  const priceLock = priceLockRows[0]
    ? {
        lockedMonthlyToman: priceLockRows[0].locked_monthly_toman,
        lockedAnnualToman: priceLockRows[0].locked_annual_toman,
        reason: priceLockRows[0].reason,
        lockedAt: priceLockRows[0].locked_at.toISOString(),
      }
    : null;

  const publicUrl = absoluteUrl(`/${detail.slug}`);

  return (
    <div className="section-shell space-y-6 py-6">
      <div>
        <Link
          href={"/admin/billing/pages" as Route}
          className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground"
        >
          <ArrowUpLeftIcon className="size-3" />
          بازگشت به لیست صفحه‌ها
        </Link>
      </div>

      {/* Header */}
      <section className="rounded-3xl border border-border bg-card p-5 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-4">
            <Avatar className="size-14">
              {detail.avatar_url ? (
                <AvatarImage src={detail.avatar_url} alt="" />
              ) : null}
              <AvatarFallback>
                <UserIcon className="size-5" />
              </AvatarFallback>
            </Avatar>
            <div className="space-y-1">
              <h1 className="text-xl font-semibold">
                {detail.full_name ?? "—"}
              </h1>
              <p className="text-xs text-muted-foreground" dir="ltr">
                {formatPhoneDisplay(detail.user_phone)}
              </p>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <Link
                  href={publicUrl as never}
                  target="_blank"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-primary"
                  dir="ltr"
                >
                  /{detail.slug}
                  <ExternalLinkIcon className="size-3" />
                </Link>
                <Link
                  href={`/admin/users/${detail.user_id}`}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground"
                >
                  پروفایل کاربر
                </Link>
                {detail.banned_at ? (
                  <Badge className="bg-rose-500/12 text-rose-700">
                    کاربر مسدود
                  </Badge>
                ) : null}
              </div>
            </div>
          </div>
          <SubscriptionActions
            pageId={pageId}
            currentPlanKey={detail.plan_key}
            currentBillingCycle={detail.billing_cycle}
            plans={allPlans.map((p) => ({ key: p.key, nameFa: p.name_fa }))}
          />
        </div>
        <div className="mt-3 border-t border-border pt-3">
          <SubscriptionAdvancedActions
            pageId={pageId}
            planKey={detail.plan_key}
            planMonthlyToman={detail.plan_price_monthly_toman}
            planAnnualToman={detail.plan_price_annual_toman}
            priceLock={priceLock}
            discountOptions={activeDiscountCodes.map((d) => ({
              id: d.id,
              code: d.code,
              nameFa: d.name_fa,
            }))}
            pendingDiscountCode={detail.pending_discount_code}
          />
        </div>
      </section>

      {/* Subscription state card */}
      <section className="space-y-3">
        <h2 className="text-base font-semibold">وضعیت اشتراک</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat
            label="پلن فعلی"
            value={detail.plan_name_fa}
            sub={
              detail.billing_cycle === "annual"
                ? "صورت‌حساب سالانه"
                : "صورت‌حساب ماهانه"
            }
          />
          <Stat
            label="وضعیت"
            value={
              SUBSCRIPTION_STATUS_LABELS[detail.status]?.label ?? detail.status
            }
            badgeClass={SUBSCRIPTION_STATUS_LABELS[detail.status]?.className}
          />
          <Stat
            label="پایان دوره"
            value={formatPersianDate(detail.current_period_end)}
            sub={detail.cancel_at_period_end ? "لغو در پایان دوره" : undefined}
          />
          <Stat
            label="پایان آزمایشی"
            value={
              detail.trial_ends_at
                ? formatPersianDate(detail.trial_ends_at)
                : "—"
            }
            sub={
              detail.has_used_trial_pro || detail.has_used_trial_business
                ? "آزمایشی استفاده شده"
                : undefined
            }
          />
        </div>
        {detail.pending_plan_change_plan_id ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            <CalendarDaysIcon className="me-1 inline size-4" />
            تغییر پلن در انتظار:{" "}
            <strong>{detail.pending_plan_change_name_fa ?? "—"}</strong> (در
            پایان دوره فعلی اعمال می‌شود).
          </div>
        ) : null}
      </section>

      {/* Entitlements manager */}
      <EntitlementsManager
        pageId={pageId}
        rows={entitlements.map((e) => ({
          featureKey: e.feature_key,
          source: e.source,
          expiresAt: e.expires_at,
          featureNameFa: e.feature_name_fa,
          featureCategory: e.feature_category,
        }))}
        features={features.map((f) => ({
          key: f.key,
          nameFa: f.name_fa,
          category: f.category,
        }))}
      />

      {/* Invoices */}
      <section className="space-y-3">
        <h2 className="text-base font-semibold">فاکتورها</h2>
        {invoices.length === 0 ? (
          <p className="rounded-3xl border border-dashed border-border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
            فاکتوری برای این صفحه ثبت نشده است.
          </p>
        ) : (
          <ul className="space-y-2">
            {invoices.map((i) => (
              <li
                key={i.id}
                className="rounded-2xl border border-border bg-card p-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2">
                      <p
                        className="font-mono text-xs text-foreground"
                        dir="ltr"
                      >
                        {i.number}
                      </p>
                      <Badge
                        className={
                          INVOICE_STATUS_LABELS[i.status]?.className ??
                          "bg-muted"
                        }
                      >
                        {INVOICE_STATUS_LABELS[i.status]?.label ?? i.status}
                      </Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      صادر شده: {formatPersianDateTime(i.created_at)}
                      {i.paid_at
                        ? ` · پرداخت: ${formatPersianDateTime(i.paid_at)}`
                        : ` · سررسید: ${formatPersianDateTime(i.due_at)}`}
                      {" · "}
                      {i.billing_cycle === "annual" ? "سالانه" : "ماهانه"}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <p className="text-sm font-semibold">
                      {toPersianDigits(formatPersianNumber(i.total_toman))}{" "}
                      تومان
                    </p>
                    <InvoiceActions
                      invoiceId={i.id}
                      invoiceNumber={i.number}
                      status={i.status}
                    />
                  </div>
                </div>
                {i.discount_amount_toman > 0 || i.vat_toman > 0 ? (
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    خالص:{" "}
                    {toPersianDigits(formatPersianNumber(i.subtotal_toman))} —
                    تخفیف:{" "}
                    {toPersianDigits(
                      formatPersianNumber(i.discount_amount_toman),
                    )}{" "}
                    + مالیات:{" "}
                    {toPersianDigits(formatPersianNumber(i.vat_toman))}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Payments */}
      <section className="space-y-3">
        <h2 className="text-base font-semibold">تراکنش‌های زرین‌پال</h2>
        {payments.length === 0 ? (
          <p className="rounded-3xl border border-dashed border-border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
            تراکنشی برای این صفحه ثبت نشده است.
          </p>
        ) : (
          <ul className="space-y-2">
            {payments.map((p) => (
              <li
                key={p.id}
                className="rounded-2xl border border-border bg-card p-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <p className="font-mono text-xs text-foreground" dir="ltr">
                      {p.invoice_number}
                    </p>
                    <p
                      className="font-mono text-[11px] text-muted-foreground"
                      dir="ltr"
                    >
                      auth: {p.authority.slice(0, 30)}…
                    </p>
                    <p
                      className="font-mono text-[11px] text-muted-foreground"
                      dir="ltr"
                    >
                      ref: {p.ref_id ?? "—"}
                    </p>
                  </div>
                  <div className="text-end">
                    <Badge
                      className={cn(
                        p.status === "verified" &&
                          "bg-emerald-500/12 text-emerald-700",
                        p.status === "initiated" && "bg-muted",
                        p.status === "failed" &&
                          "bg-destructive/10 text-destructive",
                      )}
                    >
                      {p.status === "verified"
                        ? "تأیید شده"
                        : p.status === "initiated"
                          ? "آغاز شده"
                          : "ناموفق"}
                    </Badge>
                    <p className="mt-1 text-xs">
                      {toPersianDigits(formatPersianNumber(p.amount_toman))}{" "}
                      تومان
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {formatPersianDateTime(p.created_at)}
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* SMS history */}
      <section className="space-y-3">
        <h2 className="text-base font-semibold">پیامک‌های ارسال شده</h2>
        {sms.length === 0 ? (
          <p className="rounded-3xl border border-dashed border-border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
            پیامکی برای این کاربر ثبت نشده است.
          </p>
        ) : (
          <ul className="space-y-2">
            {sms.map((m) => {
              const meta = SMS_STATUS_LABELS[m.status] ?? {
                label: m.status,
                className: "bg-muted",
              };
              return (
                <li
                  key={m.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-3"
                >
                  <div className="min-w-0 space-y-1">
                    <p className="font-mono text-xs text-foreground" dir="ltr">
                      {m.template_key}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {m.sent_at
                        ? `ارسال: ${formatPersianDateTime(m.sent_at)}`
                        : `زمان‌بندی: ${formatPersianDateTime(m.scheduled_for)}`}
                      {" · "}تلاش‌ها: {toPersianDigits(m.attempts)}
                    </p>
                    {m.last_error ? (
                      <p className="text-[11px] text-destructive">
                        خطا: {m.last_error}
                      </p>
                    ) : null}
                  </div>
                  <Badge className={meta.className}>{meta.label}</Badge>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Audit log */}
      <section className="space-y-3">
        <h2 className="text-base font-semibold">گزارش اقدامات ادمین</h2>
        {audit.length === 0 ? (
          <p className="rounded-3xl border border-dashed border-border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
            هنوز اقدام دستی برای این صفحه ثبت نشده است.
          </p>
        ) : (
          <ul className="space-y-2">
            {audit.map((a) => (
              <li
                key={a.id}
                className="rounded-2xl border border-border bg-card p-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <p className="text-sm font-semibold text-foreground">
                      {ADMIN_AUDIT_ACTION_LABELS[
                        a.action as AdminAuditAction
                      ] ?? a.action}
                    </p>
                    {a.reason ? (
                      <p className="text-xs text-muted-foreground">
                        {a.reason}
                      </p>
                    ) : null}
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    <span dir="ltr">
                      {formatPhoneDisplay(a.actorPhone ?? "")}
                    </span>
                    <br />
                    {formatPersianDateTime(a.createdAt)}
                  </p>
                </div>
                {Object.keys(a.metadata ?? {}).length > 0 ? (
                  <pre
                    className="mt-2 overflow-x-auto rounded-xl bg-muted/40 p-2 text-[10px] text-muted-foreground"
                    dir="ltr"
                  >
                    {JSON.stringify(a.metadata, null, 2)}
                  </pre>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
  badgeClass,
}: {
  label: string;
  value: string;
  sub?: string;
  badgeClass?: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-3">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      {badgeClass ? (
        <Badge className={cn("mt-1", badgeClass)}>{value}</Badge>
      ) : (
        <p className="mt-1 text-base font-semibold text-foreground">{value}</p>
      )}
      {sub ? (
        <p className="mt-1 text-[11px] text-muted-foreground">{sub}</p>
      ) : null}
    </div>
  );
}
