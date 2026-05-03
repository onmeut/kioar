import type { Route } from "next";
import Link from "next/link";
import { sql } from "drizzle-orm";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ExternalLinkIcon,
  SearchIcon,
} from "lucide-react";

import {
  RowActionsMenu,
  type RowAction,
} from "@/components/admin/row-actions-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getDb } from "@/db";
import { requireAdmin } from "@/lib/auth/session";
import {
  formatPersianDate,
  formatPersianNumber,
  toPersianDigits,
} from "@/lib/persian";
import { formatPhoneDisplay } from "@/lib/phone";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

type FilterKey =
  | "all"
  | "free"
  | "pro"
  | "business"
  | "trialing"
  | "grace"
  | "expired"
  | "cancel_at_period_end";

const FILTERS: { value: FilterKey; label: string }[] = [
  { value: "all", label: "همه" },
  { value: "free", label: "Free" },
  { value: "pro", label: "Pro" },
  { value: "business", label: "Business" },
  { value: "trialing", label: "در دوره آزمایشی" },
  { value: "grace", label: "در دوره مهلت" },
  { value: "expired", label: "منقضی" },
  { value: "cancel_at_period_end", label: "لغو شده" },
];

const PLAN_BADGE_CLASS: Record<"free" | "pro" | "business", string> = {
  free: "bg-muted text-muted-foreground",
  pro: "bg-emerald-500/12 text-emerald-700",
  business: "bg-violet-500/12 text-violet-700",
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

type Row = {
  page_id: string;
  slug: string;
  full_name: string | null;
  title: string | null;
  avatar_url: string | null;
  created_at: Date;
  user_id: string;
  user_phone: string;
  owner_full_name: string | null;
  plan_key: "free" | "pro" | "business" | null;
  plan_name_fa: string | null;
  status: string | null;
  current_period_end: Date | null;
  cancel_at_period_end: boolean | null;
  trial_ends_at: Date | null;
  block_count: number;
  view_count: number;
};

type Stats = {
  total: number;
  newLast7d: number;
  activeAny: number;
  paid: number;
  trialing: number;
  newLast30d: number;
  trend: { date: string; value: number }[];
};

function getInitials(name: string | null, fallback: string) {
  if (!name) return fallback.slice(-2);
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return fallback.slice(-2);
  if (parts.length === 1) return parts[0].slice(0, 2);
  return (parts[0][0] + parts[parts.length - 1][0]).slice(0, 2);
}

function buildPageActions(r: Row): RowAction[] {
  return [
    {
      key: "edit",
      label: "ویرایش اشتراک",
      icon: "edit",
      href: `/admin/billing/pages/${r.page_id}`,
    },
    {
      key: "owner",
      label: "مدیریت کاربر",
      icon: "user",
      href: `/admin/users/${r.user_id}`,
    },
    {
      key: "invoices",
      label: "فاکتورها",
      icon: "invoice",
      href: `/admin/billing/invoices?userId=${r.user_id}`,
    },
    {
      key: "view",
      label: "مشاهده صفحه عمومی",
      icon: "external",
      href: `/${r.slug}`,
      external: true,
      separatorBefore: true,
    },
  ];
}

async function loadStats(): Promise<Stats> {
  const db = getDb();
  const rows = (await db.execute(sql`
    WITH base AS (
      SELECT
        p."id"          AS page_id,
        p."created_at"  AS created_at,
        pl."key"::text  AS plan_key,
        s."status"::text AS status
      FROM "profiles" p
      LEFT JOIN "page_subscriptions" s ON s."page_id" = p."id"
      LEFT JOIN "plans" pl ON pl."id" = s."plan_id"
    )
    SELECT
      (SELECT count(*)::int FROM base) AS total,
      (SELECT count(*)::int FROM base WHERE created_at > now() - INTERVAL '7 days') AS new_7,
      (SELECT count(*)::int FROM base WHERE created_at > now() - INTERVAL '30 days') AS new_30,
      (SELECT count(*)::int FROM base) AS active_any,
      (SELECT count(*)::int FROM base WHERE plan_key IN ('pro','business')) AS paid,
      (SELECT count(*)::int FROM base WHERE status = 'trialing') AS trialing
  `)) as unknown as Array<{
    total: number;
    new_7: number;
    new_30: number;
    active_any: number;
    paid: number;
    trialing: number;
  }>;

  const trendRows = (await db.execute(sql`
    SELECT to_char(date_trunc('day', "created_at"), 'YYYY-MM-DD') AS day,
           count(*)::int AS value
    FROM "profiles"
    WHERE "created_at" > now() - INTERVAL '14 days'
    GROUP BY 1
  `)) as unknown as Array<{ day: string; value: number }>;

  const byDay = new Map(trendRows.map((r) => [r.day, Number(r.value)]));
  const dayMs = 24 * 60 * 60 * 1000;
  const now = new Date();
  const trend: { date: string; value: number }[] = [];
  for (let i = 13; i >= 0; i -= 1) {
    const d = new Date(now.getTime() - i * dayMs);
    const key = d.toISOString().slice(0, 10);
    trend.push({ date: key, value: byDay.get(key) ?? 0 });
  }

  const r = rows[0];
  return {
    total: Number(r?.total ?? 0),
    newLast7d: Number(r?.new_7 ?? 0),
    newLast30d: Number(r?.new_30 ?? 0),
    activeAny: Number(r?.active_any ?? 0),
    paid: Number(r?.paid ?? 0),
    trialing: Number(r?.trialing ?? 0),
    trend,
  };
}

function StatTile({
  label,
  value,
  accent = "default",
}: {
  label: string;
  value: string | number;
  accent?: "default" | "positive" | "warn" | "destructive";
}) {
  return (
    <div className="rounded-4xl bg-card p-4 border border-border">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mt-2 text-2xl font-bold leading-none",
          accent === "positive" && "text-emerald-600",
          accent === "warn" && "text-amber-600",
          accent === "destructive" && "text-rose-600",
        )}
      >
        {toPersianDigits(value)}
      </p>
    </div>
  );
}

function CreationSparkline({
  data,
}: {
  data: { date: string; value: number }[];
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="flex h-12 items-end gap-1">
      {data.map((d) => (
        <div
          key={d.date}
          className="flex-1 rounded-t-sm bg-primary/30"
          style={{ height: `${(d.value / max) * 100}%`, minHeight: 2 }}
          title={`${d.date}: ${d.value}`}
        />
      ))}
    </div>
  );
}

export default async function AdminPagesDirectory({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; filter?: string; page?: string }>;
}) {
  await requireAdmin();
  const params = await searchParams;
  const query = (params.q ?? "").trim();
  const rawFilter = params.filter ?? "all";
  const filter: FilterKey = (FILTERS.map((f) => f.value) as string[]).includes(
    rawFilter,
  )
    ? (rawFilter as FilterKey)
    : "all";
  const pageNum = Math.max(1, Number(params.page) || 1);
  const offset = (pageNum - 1) * PAGE_SIZE;

  const db = getDb();
  const qLike = query ? `%${query.toLowerCase()}%` : null;

  const searchSql = qLike
    ? sql`AND (
        LOWER(p."slug") LIKE ${qLike}
        OR LOWER(COALESCE(p."full_name", '')) LIKE ${qLike}
        OR LOWER(COALESCE(p."title", '')) LIKE ${qLike}
        OR u."phone" LIKE ${`%${query}%`}
      )`
    : sql``;

  let filterSql = sql``;
  if (filter === "free") filterSql = sql`AND pl."key" = 'free'`;
  else if (filter === "pro") filterSql = sql`AND pl."key" = 'pro'`;
  else if (filter === "business") filterSql = sql`AND pl."key" = 'business'`;
  else if (filter === "trialing") filterSql = sql`AND s."status" = 'trialing'`;
  else if (filter === "grace") filterSql = sql`AND s."status" = 'grace'`;
  else if (filter === "expired")
    filterSql = sql`AND s."status" IN ('expired','canceled')`;
  else if (filter === "cancel_at_period_end")
    filterSql = sql`AND s."cancel_at_period_end" = TRUE`;

  const [stats, rows, countRows] = await Promise.all([
    loadStats(),
    db.execute(sql`
      SELECT
        p."id"                  AS page_id,
        p."slug"                AS slug,
        p."full_name"           AS full_name,
        p."title"               AS title,
        p."avatar_url"          AS avatar_url,
        p."created_at"          AS created_at,
        u."id"                  AS user_id,
        u."phone"               AS user_phone,
        (SELECT op."full_name" FROM "profiles" op
         WHERE op."user_id" = u."id"
         ORDER BY op."created_at" ASC LIMIT 1) AS owner_full_name,
        pl."key"::text          AS plan_key,
        pl."name_fa"            AS plan_name_fa,
        s."status"::text        AS status,
        s."current_period_end"  AS current_period_end,
        s."cancel_at_period_end" AS cancel_at_period_end,
        s."trial_ends_at"       AS trial_ends_at,
        COALESCE((
          SELECT count(*)::int FROM "profile_links" pl2
          WHERE pl2."profile_id" = p."id"
        ), 0) AS block_count,
        COALESCE((
          SELECT sum("views")::int FROM "profile_stats_by_day" psd
          WHERE psd."profile_id" = p."id"
        ), 0) AS view_count
      FROM "profiles" p
      JOIN "users" u ON u."id" = p."user_id"
      LEFT JOIN "page_subscriptions" s ON s."page_id" = p."id"
      LEFT JOIN "plans" pl ON pl."id" = s."plan_id"
      WHERE 1=1
      ${searchSql}
      ${filterSql}
      ORDER BY p."created_at" DESC
      LIMIT ${PAGE_SIZE} OFFSET ${offset}
    `) as unknown as Promise<Row[]>,
    db.execute(sql`
      SELECT count(*)::int AS total
      FROM "profiles" p
      JOIN "users" u ON u."id" = p."user_id"
      LEFT JOIN "page_subscriptions" s ON s."page_id" = p."id"
      LEFT JOIN "plans" pl ON pl."id" = s."plan_id"
      WHERE 1=1
      ${searchSql}
      ${filterSql}
    `) as unknown as Promise<Array<{ total: number }>>,
  ]);

  const total = Number(countRows[0]?.total ?? 0);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const buildHref = (
    overrides: Record<string, string | number | undefined>,
  ) => {
    const usp = new URLSearchParams();
    if (query) usp.set("q", query);
    if (filter !== "all") usp.set("filter", filter);
    if (pageNum !== 1) usp.set("page", String(pageNum));
    for (const [k, v] of Object.entries(overrides)) {
      if (v === undefined || v === null || v === "") usp.delete(k);
      else usp.set(k, String(v));
    }
    const qs = usp.toString();
    return (qs ? `/admin/pages?${qs}` : "/admin/pages") as Route;
  };

  return (
    <div className="section-shell space-y-6 py-6">
      <section className="space-y-3">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <StatTile label="کل صفحه‌ها" value={stats.total} />
          <StatTile
            label="جدید (۷ روز)"
            value={stats.newLast7d}
            accent="positive"
          />
          <StatTile label="فعال" value={stats.activeAny} />
          <StatTile label="پلن پرداختی" value={stats.paid} accent="positive" />
          <StatTile
            label="در دوره آزمایشی"
            value={stats.trialing}
            accent="warn"
          />
        </div>

        <div className="rounded-4xl bg-card p-4 border border-border">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-bold">صفحه‌های جدید ۱۴ روز اخیر</h2>
            <span className="text-xs text-muted-foreground">
              مجموع: {toPersianDigits(stats.newLast30d)} در ۳۰ روز
            </span>
          </div>
          <CreationSparkline data={stats.trend} />
        </div>
      </section>

      <section className="space-y-3">
        <form
          action="/admin/pages"
          className="flex flex-col gap-2 sm:flex-row sm:items-center"
          dir="rtl"
        >
          <div className="relative flex-1">
            <SearchIcon className="pointer-events-none absolute top-1/2 inset-s-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              name="q"
              defaultValue={query}
              placeholder="جستجو بر اساس شناسه، عنوان، نام مالک یا شماره تلفن"
              type="search"
              inputMode="search"
              enterKeyHint="search"
              autoComplete="off"
              className="ps-10"
            />
          </div>
          {filter !== "all" ? (
            <input type="hidden" name="filter" value={filter} />
          ) : null}
          <button
            type="submit"
            className={cn(
              buttonVariants({ size: "default" }),
              "h-11 sm:w-auto",
            )}
          >
            جستجو
          </button>
        </form>

        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <Link
              key={f.value}
              href={buildHref({
                filter: f.value === "all" ? undefined : f.value,
                page: undefined,
              })}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
                filter === f.value
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border/70 bg-background hover:border-foreground/30",
              )}
            >
              {f.label}
            </Link>
          ))}
        </div>
      </section>

      <section>
        {rows.length === 0 ? (
          <div className="rounded-4xl border border-dashed border-border/70 bg-background/60 px-6 py-10 text-center text-sm text-muted-foreground">
            موردی با این فیلتر پیدا نشد.
          </div>
        ) : (
          <>
            {/* Mobile cards */}
            <ul className="grid gap-3 lg:hidden">
              {rows.map((r) => (
                <li
                  key={r.page_id}
                  className="rounded-4xl bg-card p-4 border border-border"
                >
                  <div className="flex items-start gap-3">
                    <Avatar className="size-11 shrink-0">
                      {r.avatar_url ? (
                        <AvatarImage src={r.avatar_url} alt="" />
                      ) : null}
                      <AvatarFallback className="text-xs font-bold">
                        {getInitials(r.full_name, r.slug)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <Link
                            href={`/admin/billing/pages/${r.page_id}` as Route}
                            className="truncate font-bold hover:underline"
                          >
                            {r.full_name || r.title || `/${r.slug}`}
                          </Link>
                          <Link
                            href={`/${r.slug}` as Route}
                            target="_blank"
                            className="inline-flex items-center gap-1 truncate font-mono text-xs text-primary"
                            dir="ltr"
                          >
                            /{r.slug}
                            <ExternalLinkIcon className="size-3" />
                          </Link>
                        </div>
                        <div className="flex flex-wrap justify-end gap-1">
                          <Badge
                            className={cn(
                              "rounded-full",
                              PLAN_BADGE_CLASS[r.plan_key ?? "free"],
                            )}
                          >
                            {r.plan_name_fa ?? "Free"}
                          </Badge>
                          {r.status ? (
                            <Badge
                              className={cn(
                                "rounded-full",
                                STATUS_LABELS[r.status]?.className ??
                                  "bg-muted",
                              )}
                            >
                              {STATUS_LABELS[r.status]?.label ?? r.status}
                            </Badge>
                          ) : null}
                        </div>
                      </div>

                      <div className="mt-2 text-xs text-muted-foreground">
                        مالک:{" "}
                        <Link
                          href={`/admin/users/${r.user_id}` as Route}
                          className="text-foreground hover:underline"
                        >
                          {r.owner_full_name ?? "—"}
                        </Link>{" "}
                        ·{" "}
                        <span dir="ltr">
                          {formatPhoneDisplay(r.user_phone)}
                        </span>
                      </div>

                      <dl className="mt-3 grid grid-cols-3 gap-2 text-xs">
                        <Mini label="بلوک" value={r.block_count} />
                        <Mini label="بازدید" value={r.view_count} />
                        <Mini
                          label="پایان دوره"
                          text={
                            r.current_period_end
                              ? formatPersianDate(r.current_period_end)
                              : "—"
                          }
                        />
                      </dl>

                      <div className="mt-3 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                        <span>
                          ساخته‌شده: {formatPersianDate(r.created_at)}
                        </span>
                        <RowActionsMenu actions={buildPageActions(r)} />
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>

            {/* Desktop table */}
            <div className="hidden overflow-x-auto rounded-4xl border border-border lg:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>صفحه</TableHead>
                    <TableHead>مالک</TableHead>
                    <TableHead>پلن</TableHead>
                    <TableHead>وضعیت</TableHead>
                    <TableHead>پایان دوره</TableHead>
                    <TableHead className="text-center">بلوک‌ها</TableHead>
                    <TableHead className="text-center">بازدید</TableHead>
                    <TableHead>ساخته شده</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.page_id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="size-9">
                            {r.avatar_url ? (
                              <AvatarImage src={r.avatar_url} alt="" />
                            ) : null}
                            <AvatarFallback className="text-xs font-bold">
                              {getInitials(r.full_name, r.slug)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <Link
                              href={
                                `/admin/billing/pages/${r.page_id}` as Route
                              }
                              className="truncate font-semibold hover:underline"
                            >
                              {r.full_name || r.title || `/${r.slug}`}
                            </Link>
                            <Link
                              href={`/${r.slug}` as Route}
                              target="_blank"
                              className="inline-flex items-center gap-1 truncate font-mono text-xs text-primary"
                              dir="ltr"
                            >
                              /{r.slug}
                              <ExternalLinkIcon className="size-3" />
                            </Link>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Link
                          href={`/admin/users/${r.user_id}` as Route}
                          className="text-sm font-semibold text-foreground hover:underline"
                        >
                          {r.owner_full_name ?? "—"}
                        </Link>
                        <p className="text-xs text-muted-foreground" dir="ltr">
                          {formatPhoneDisplay(r.user_phone)}
                        </p>
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={cn(
                            "rounded-full",
                            PLAN_BADGE_CLASS[r.plan_key ?? "free"],
                          )}
                        >
                          {r.plan_name_fa ?? "Free"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap items-center gap-1">
                          {r.status ? (
                            <Badge
                              className={cn(
                                "rounded-full",
                                STATUS_LABELS[r.status]?.className ??
                                  "bg-muted",
                              )}
                            >
                              {STATUS_LABELS[r.status]?.label ?? r.status}
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              —
                            </span>
                          )}
                          {r.cancel_at_period_end ? (
                            <Badge className="rounded-full bg-muted text-[10px]">
                              لغو در پایان
                            </Badge>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {r.current_period_end
                          ? formatPersianDate(r.current_period_end)
                          : "—"}
                      </TableCell>
                      <TableCell className="text-center">
                        {toPersianDigits(r.block_count)}
                      </TableCell>
                      <TableCell className="text-center">
                        {toPersianDigits(formatPersianNumber(r.view_count))}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatPersianDate(r.created_at)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-2">
                          <RowActionsMenu actions={buildPageActions(r)} />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}

        {totalPages > 1 ? (
          <div className="mt-4 flex items-center justify-between gap-3">
            <span className="text-xs text-muted-foreground">
              صفحه {toPersianDigits(pageNum)} از {toPersianDigits(totalPages)}
              {" · "}
              {toPersianDigits(total)} صفحه
            </span>
            <div className="flex items-center gap-2">
              <Link
                aria-disabled={pageNum <= 1}
                href={buildHref({ page: Math.max(1, pageNum - 1) })}
                className={cn(
                  buttonVariants({
                    size: "sm",
                    variant: "outline",
                    className: "h-9 rounded-full",
                  }),
                  pageNum <= 1 && "pointer-events-none opacity-50",
                )}
              >
                <ChevronRightIcon className="size-4" />
                قبلی
              </Link>
              <Link
                aria-disabled={pageNum >= totalPages}
                href={buildHref({ page: Math.min(totalPages, pageNum + 1) })}
                className={cn(
                  buttonVariants({
                    size: "sm",
                    variant: "outline",
                    className: "h-9 rounded-full",
                  }),
                  pageNum >= totalPages && "pointer-events-none opacity-50",
                )}
              >
                بعدی
                <ChevronLeftIcon className="size-4" />
              </Link>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}

function Mini({
  label,
  value,
  text,
}: {
  label: string;
  value?: number;
  text?: string;
}) {
  return (
    <div className="rounded-2xl bg-muted/50 px-2 py-1.5 text-center">
      <p className="text-xs font-bold">{text ?? toPersianDigits(value ?? 0)}</p>
      <p className="text-[10px] text-muted-foreground">{label}</p>
    </div>
  );
}
