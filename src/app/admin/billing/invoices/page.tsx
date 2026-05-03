import Link from "next/link";
import type { Route } from "next";
import { sql } from "drizzle-orm";
import { ChevronLeftIcon, SearchIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { getDb } from "@/db";
import { requireAdmin } from "@/lib/auth/session";
import {
  formatPersianDateTime,
  formatPersianNumber,
  toPersianDigits,
} from "@/lib/persian";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

type StatusKey = "all" | "unpaid" | "paid" | "expired" | "canceled";

const STATUS_FILTERS: { key: StatusKey; label: string }[] = [
  { key: "all", label: "همه" },
  { key: "unpaid", label: "پرداخت‌نشده" },
  { key: "paid", label: "پرداخت‌شده" },
  { key: "expired", label: "منقضی" },
  { key: "canceled", label: "لغو شده" },
];

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  paid: {
    label: "پرداخت‌شده",
    className: "bg-emerald-500/12 text-emerald-700",
  },
  unpaid: { label: "پرداخت‌نشده", className: "bg-amber-500/12 text-amber-700" },
  expired: { label: "منقضی", className: "bg-muted text-muted-foreground" },
  canceled: { label: "لغو شده", className: "bg-muted text-muted-foreground" },
};

const PAGE_SIZE = 30;

type InvoiceRow = {
  id: string;
  number: string;
  status: "unpaid" | "paid" | "expired" | "canceled";
  total_toman: number;
  due_at: Date;
  paid_at: Date | null;
  created_at: Date;
  page_id: string;
  page_slug: string;
  page_full_name: string | null;
  user_phone: string;
  plan_name_fa: string;
  billing_cycle: "monthly" | "annual";
};

type Search = {
  q?: string;
  status?: StatusKey;
  page?: string;
  userId?: string;
};

export default async function AdminInvoicesPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  await requireAdmin();
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const status = (sp.status ?? "all") as StatusKey;
  const userId = (sp.userId ?? "").trim();
  const pageNum = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);
  const offset = (pageNum - 1) * PAGE_SIZE;

  const db = getDb();
  const qLike = `%${q.toLowerCase()}%`;
  const hasQuery = q.length > 0;

  // status filter SQL piece
  const statusClause =
    status === "all" ? sql`TRUE` : sql`i."status"::text = ${status}`;

  const userClause = userId ? sql`AND p."user_id" = ${userId}` : sql``;

  // Lookup the filtered user's display info so the chip can show name/phone.
  const filteredUser = userId
    ? ((
        (await db.execute(sql`
        SELECT u."phone" AS phone,
          (SELECT p."full_name" FROM "profiles" p WHERE p."user_id" = u."id" ORDER BY p."created_at" ASC LIMIT 1) AS full_name
        FROM "users" u
        WHERE u."id" = ${userId}
        LIMIT 1
      `)) as unknown as Array<{ phone: string; full_name: string | null }>
      )[0] ?? null)
    : null;

  const queryClause = hasQuery
    ? sql`(
        lower(i."number") LIKE ${qLike} OR
        EXISTS (
          SELECT 1 FROM "payments" pay
          WHERE pay."invoice_id" = i."id"
            AND (lower(coalesce(pay."ref_id", '')) LIKE ${qLike}
              OR lower(pay."authority") LIKE ${qLike})
        ) OR
        lower(p."slug") LIKE ${qLike} OR
        lower(coalesce(p."full_name", '')) LIKE ${qLike} OR
        lower(u."phone") LIKE ${qLike}
      )`
    : sql`TRUE`;

  const rows = (await db.execute(sql`
    SELECT
      i."id"                  AS id,
      i."number"              AS number,
      i."status"::text        AS status,
      i."total_toman"         AS total_toman,
      i."due_at"              AS due_at,
      i."paid_at"             AS paid_at,
      i."created_at"          AS created_at,
      i."billing_cycle"::text AS billing_cycle,
      p."id"                  AS page_id,
      p."slug"                AS page_slug,
      p."full_name"           AS page_full_name,
      u."phone"               AS user_phone,
      pl."name_fa"            AS plan_name_fa
    FROM "invoices" i
    JOIN "profiles" p ON p."id" = i."page_id"
    JOIN "users" u ON u."id" = p."user_id"
    JOIN "plans" pl ON pl."id" = i."plan_id"
    WHERE ${statusClause} AND ${queryClause} ${userClause}
    ORDER BY i."created_at" DESC
    LIMIT ${PAGE_SIZE} OFFSET ${offset}
  `)) as unknown as InvoiceRow[];

  const countRows = (await db.execute(sql`
    SELECT count(*)::int AS total
    FROM "invoices" i
    JOIN "profiles" p ON p."id" = i."page_id"
    JOIN "users" u ON u."id" = p."user_id"
    WHERE ${statusClause} AND ${queryClause} ${userClause}
  `)) as unknown as { total: number }[];
  const total = countRows[0]?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const buildHref = (overrides: Partial<Search>): Route => {
    const next = new URLSearchParams();
    const merged = { q, status, page: String(pageNum), userId, ...overrides };
    if (merged.q) next.set("q", merged.q);
    if (merged.status && merged.status !== "all")
      next.set("status", merged.status);
    if (merged.page && merged.page !== "1") next.set("page", merged.page);
    if (merged.userId) next.set("userId", merged.userId);
    const s = next.toString();
    return (
      s ? `/admin/billing/invoices?${s}` : "/admin/billing/invoices"
    ) as Route;
  };

  return (
    <div className="section-shell space-y-5 py-6">
      <header className="space-y-2">
        <h1 className="text-xl font-semibold">فاکتورها</h1>
        <p className="text-xs text-muted-foreground">
          جست‌وجو با شماره فاکتور، شناسه پرداخت زرین‌پال (RefID/Authority)، نام
          صفحه یا شماره موبایل کاربر.
        </p>
      </header>

      <form
        action="/admin/billing/invoices"
        method="GET"
        className="rounded-3xl border border-border bg-card p-4 shadow-sm"
      >
        <input type="hidden" name="status" value={status} />
        {userId ? <input type="hidden" name="userId" value={userId} /> : null}
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute inset-e-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            name="q"
            defaultValue={q}
            placeholder="KIOAR-1404-… یا 0xA3F… یا 0912…"
            inputMode="search"
            enterKeyHint="search"
            autoComplete="off"
            className="pe-9"
            dir="ltr"
          />
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {STATUS_FILTERS.map((f) => (
            <Link
              key={f.key}
              href={buildHref({ status: f.key, page: "1" })}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-semibold",
                status === f.key
                  ? "bg-foreground text-background"
                  : "bg-muted text-muted-foreground",
              )}
            >
              {f.label}
            </Link>
          ))}
        </div>
      </form>

      {userId && filteredUser ? (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-primary/30 bg-primary/5 px-3 py-2 text-xs">
          <span className="truncate">
            فیلترشده برای کاربر:{" "}
            <span className="font-semibold">
              {filteredUser.full_name ?? "—"}
            </span>{" "}
            <span className="text-muted-foreground" dir="ltr">
              {filteredUser.phone}
            </span>
          </span>
          <Link
            href={buildHref({ userId: "", page: "1" })}
            className="font-semibold text-primary hover:underline"
          >
            حذف فیلتر
          </Link>
        </div>
      ) : null}

      <p className="text-xs text-muted-foreground">
        مجموع{" "}
        <span className="font-semibold text-foreground">
          {toPersianDigits(formatPersianNumber(total))}
        </span>{" "}
        فاکتور.
      </p>

      {/* Mobile cards */}
      <ul className="space-y-2 lg:hidden">
        {rows.map((r) => {
          const statusMeta = STATUS_LABELS[r.status] ?? {
            label: r.status,
            className: "bg-muted",
          };
          return (
            <li key={r.id}>
              <Link
                href={`/admin/billing/pages/${r.page_id}` as Route}
                className="block rounded-2xl border border-border bg-card p-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <p className="font-mono text-xs text-foreground" dir="ltr">
                      {r.number}
                    </p>
                    <p className="truncate text-sm font-medium">
                      {r.page_full_name ?? `/${r.page_slug}`}
                    </p>
                    <p className="text-[11px] text-muted-foreground" dir="ltr">
                      {r.user_phone}
                    </p>
                  </div>
                  <div className="text-end">
                    <Badge className={statusMeta.className}>
                      {statusMeta.label}
                    </Badge>
                    <p className="mt-1 text-sm font-semibold">
                      {toPersianDigits(formatPersianNumber(r.total_toman))} ت
                    </p>
                  </div>
                </div>
                <p className="mt-2 text-[11px] text-muted-foreground">
                  {r.plan_name_fa} ·{" "}
                  {r.billing_cycle === "annual" ? "سالانه" : "ماهانه"} ·{" "}
                  {formatPersianDateTime(r.created_at)}
                </p>
              </Link>
            </li>
          );
        })}
      </ul>

      {/* Desktop table */}
      <div className="hidden overflow-hidden rounded-3xl border border-border bg-card lg:block">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-start">فاکتور</th>
              <th className="px-4 py-3 text-start">صفحه</th>
              <th className="px-4 py-3 text-start">پلن</th>
              <th className="px-4 py-3 text-start">مبلغ</th>
              <th className="px-4 py-3 text-start">وضعیت</th>
              <th className="px-4 py-3 text-start">صدور</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const statusMeta = STATUS_LABELS[r.status] ?? {
                label: r.status,
                className: "bg-muted",
              };
              return (
                <tr key={r.id} className="border-t border-border">
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/billing/pages/${r.page_id}` as Route}
                      className="font-mono text-xs text-primary hover:underline"
                      dir="ltr"
                    >
                      {r.number}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium">{r.page_full_name ?? "—"}</p>
                    <p className="text-[11px] text-muted-foreground" dir="ltr">
                      /{r.page_slug} · {r.user_phone}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    {r.plan_name_fa}
                    <span className="ms-1 text-[11px] text-muted-foreground">
                      ({r.billing_cycle === "annual" ? "سالانه" : "ماهانه"})
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {toPersianDigits(formatPersianNumber(r.total_toman))} تومان
                  </td>
                  <td className="px-4 py-3">
                    <Badge className={statusMeta.className}>
                      {statusMeta.label}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {formatPersianDateTime(r.created_at)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {rows.length === 0 ? (
          <p className="p-8 text-center text-sm text-muted-foreground">
            هیچ فاکتوری با این فیلتر پیدا نشد.
          </p>
        ) : null}
      </div>

      {pageCount > 1 ? (
        <nav className="flex items-center justify-between text-xs">
          <Link
            href={buildHref({ page: String(Math.max(1, pageNum - 1)) })}
            className={cn(
              "inline-flex items-center gap-1 rounded-full border border-border px-3 py-1.5",
              pageNum === 1 && "pointer-events-none opacity-40",
            )}
          >
            <ChevronLeftIcon className="size-3 rotate-180" />
            قبلی
          </Link>
          <span className="text-muted-foreground">
            صفحه {toPersianDigits(pageNum)} از {toPersianDigits(pageCount)}
          </span>
          <Link
            href={buildHref({
              page: String(Math.min(pageCount, pageNum + 1)),
            })}
            className={cn(
              "inline-flex items-center gap-1 rounded-full border border-border px-3 py-1.5",
              pageNum === pageCount && "pointer-events-none opacity-40",
            )}
          >
            بعدی
            <ChevronLeftIcon className="size-3" />
          </Link>
        </nav>
      ) : null}
    </div>
  );
}
