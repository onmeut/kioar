import Link from "next/link";
import type { Route } from "next";
import { sql } from "drizzle-orm";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getDb } from "@/db";
import { ADMIN_AUDIT_ACTION_LABELS } from "@/lib/admin-audit";
import { requireAdmin } from "@/lib/auth/session";
import { formatPersianDateTime, toPersianDigits } from "@/lib/persian";
import { formatPhoneDisplay } from "@/lib/phone";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;
const MAX_PAGE = 200;

type SearchParams = {
  action?: string;
  actorPhone?: string;
  pageId?: string;
  slug?: string;
  from?: string;
  to?: string;
  page?: string;
};

function parseDate(value: string | undefined): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireAdmin();
  const params = await searchParams;
  const db = getDb();

  const actionFilter =
    params.action && params.action !== "all" ? params.action.trim() : null;
  const actorPhoneFilter = params.actorPhone?.trim() || null;
  const pageIdFilter = params.pageId?.trim() || null;
  const slugFilter = params.slug?.trim() || null;
  const fromDate = parseDate(params.from);
  const toDate = parseDate(params.to);
  const pageNum = Math.min(
    MAX_PAGE,
    Math.max(1, parseInt(params.page ?? "1", 10) || 1),
  );
  const offset = (pageNum - 1) * PAGE_SIZE;

  // We build a single SQL with composable WHERE clauses using sql.empty/raw.
  // All values are bound through ${...} so no injection risk.
  const conds = [sql`1 = 1`];
  if (actionFilter) {
    conds.push(sql`a."action" = ${actionFilter}`);
  }
  if (actorPhoneFilter) {
    conds.push(sql`u."phone" = ${actorPhoneFilter}`);
  }
  if (pageIdFilter) {
    conds.push(sql`a."target_page_id" = ${pageIdFilter}::uuid`);
  }
  if (slugFilter) {
    conds.push(sql`pr."slug" = ${slugFilter}`);
  }
  if (fromDate) {
    conds.push(sql`a."created_at" >= ${fromDate.toISOString()}`);
  }
  if (toDate) {
    conds.push(sql`a."created_at" < ${toDate.toISOString()}`);
  }
  const whereClause = conds.reduce((acc, c) => sql`${acc} AND ${c}`);

  const rows = (await db.execute(sql`
    SELECT
      a."id"                AS id,
      a."action"            AS action,
      a."actor_user_id"     AS actor_user_id,
      u."phone"             AS actor_phone,
      a."target_user_id"    AS target_user_id,
      a."target_page_id"    AS target_page_id,
      pr."slug"             AS target_page_slug,
      a."target_invoice_id" AS target_invoice_id,
      a."reason"            AS reason,
      a."metadata"          AS metadata,
      a."created_at"        AS created_at
    FROM "admin_audit_log" a
    LEFT JOIN "users"    u  ON u."id"  = a."actor_user_id"
    LEFT JOIN "profiles" pr ON pr."id" = a."target_page_id"
    WHERE ${whereClause}
    ORDER BY a."created_at" DESC
    LIMIT ${PAGE_SIZE}
    OFFSET ${offset}
  `)) as unknown as Array<{
    id: string;
    action: string;
    actor_user_id: string;
    actor_phone: string | null;
    target_user_id: string | null;
    target_page_id: string | null;
    target_page_slug: string | null;
    target_invoice_id: string | null;
    reason: string | null;
    metadata: Record<string, unknown> | null;
    created_at: Date;
  }>;

  const totalRows = (await db.execute(sql`
    SELECT count(*)::int AS total
    FROM "admin_audit_log" a
    LEFT JOIN "users"    u  ON u."id"  = a."actor_user_id"
    LEFT JOIN "profiles" pr ON pr."id" = a."target_page_id"
    WHERE ${whereClause}
  `)) as unknown as Array<{ total: number }>;
  const total = totalRows[0]?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const actionOptions = Object.keys(ADMIN_AUDIT_ACTION_LABELS).sort();

  return (
    <div className="section-shell space-y-6 py-6">
      <header>
        <h1 className="text-2xl font-bold">گزارش فعالیت ادمین</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          همه‌ی اقدامات ادمین قابل ردیابی است. می‌توانید بر اساس نوع اقدام،
          ادمین، صفحه یا بازه زمانی فیلتر کنید.
        </p>
      </header>

      <form
        method="GET"
        className="grid gap-3 rounded-3xl border border-border bg-card p-4 sm:grid-cols-2 lg:grid-cols-6"
      >
        <div className="space-y-1.5 lg:col-span-2">
          <Label htmlFor="action" className="text-xs">
            نوع اقدام
          </Label>
          <Select name="action" defaultValue={actionFilter ?? "all"}>
            <SelectTrigger id="action" dir="ltr">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">همه</SelectItem>
              {actionOptions.map((k) => (
                <SelectItem key={k} value={k}>
                  {ADMIN_AUDIT_ACTION_LABELS[
                    k as keyof typeof ADMIN_AUDIT_ACTION_LABELS
                  ] ?? k}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="actorPhone" className="text-xs">
            تلفن ادمین
          </Label>
          <Input
            id="actorPhone"
            name="actorPhone"
            defaultValue={actorPhoneFilter ?? ""}
            dir="ltr"
            inputMode="tel"
            autoComplete="off"
            placeholder="989121234567"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="slug" className="text-xs">
            slug صفحه هدف
          </Label>
          <Input
            id="slug"
            name="slug"
            defaultValue={slugFilter ?? ""}
            dir="ltr"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="from" className="text-xs">
            از تاریخ
          </Label>
          <Input
            id="from"
            name="from"
            type="datetime-local"
            defaultValue={params.from ?? ""}
            dir="ltr"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="to" className="text-xs">
            تا تاریخ
          </Label>
          <Input
            id="to"
            name="to"
            type="datetime-local"
            defaultValue={params.to ?? ""}
            dir="ltr"
          />
        </div>
        <div className="flex items-end gap-2 lg:col-span-6">
          <Button type="submit" className="h-11 sm:h-9">
            اعمال فیلتر
          </Button>
          <Link
            href={"/admin/audit" as Route}
            className="inline-flex h-11 items-center rounded-md border border-border px-3 text-sm sm:h-9"
          >
            پاک کردن
          </Link>
          <span className="ms-auto text-xs text-muted-foreground">
            {toPersianDigits(total)} ردیف یافت شد
          </span>
        </div>
      </form>

      {/* Mobile: card list */}
      <div className="grid gap-3 lg:hidden">
        {rows.length === 0 ? (
          <p className="rounded-3xl border border-dashed border-border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
            هیچ ردیفی یافت نشد.
          </p>
        ) : (
          rows.map((r) => (
            <article
              key={r.id}
              className="rounded-3xl border border-border bg-card p-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold">
                    {ADMIN_AUDIT_ACTION_LABELS[
                      r.action as keyof typeof ADMIN_AUDIT_ACTION_LABELS
                    ] ?? r.action}
                  </h3>
                  <p
                    className="mt-1 font-mono text-[10px] text-muted-foreground"
                    dir="ltr"
                  >
                    {r.action}
                  </p>
                </div>
                <Badge variant="outline" className="rounded-full text-[10px]">
                  {formatPersianDateTime(r.created_at)}
                </Badge>
              </div>
              <dl className="mt-3 space-y-1 text-xs">
                <div className="flex gap-2">
                  <dt className="text-muted-foreground">ادمین:</dt>
                  <dd dir="ltr" className="font-mono">
                    {r.actor_phone ? formatPhoneDisplay(r.actor_phone) : "—"}
                  </dd>
                </div>
                {r.target_page_slug ? (
                  <div className="flex gap-2">
                    <dt className="text-muted-foreground">صفحه:</dt>
                    <dd dir="ltr">
                      <Link
                        href={
                          `/admin/billing/pages/${r.target_page_id}` as Route
                        }
                        className="font-mono text-primary hover:underline"
                      >
                        {r.target_page_slug}
                      </Link>
                    </dd>
                  </div>
                ) : null}
                {r.reason ? (
                  <div className="flex gap-2">
                    <dt className="text-muted-foreground">دلیل:</dt>
                    <dd>{r.reason}</dd>
                  </div>
                ) : null}
              </dl>
              {r.metadata && Object.keys(r.metadata).length > 0 ? (
                <details className="mt-3 text-xs">
                  <summary className="cursor-pointer text-muted-foreground">
                    داده‌ها
                  </summary>
                  <pre
                    className="mt-1 overflow-x-auto rounded-md bg-muted/40 p-2 text-[10px]"
                    dir="ltr"
                  >
                    {JSON.stringify(r.metadata, null, 2)}
                  </pre>
                </details>
              ) : null}
            </article>
          ))
        )}
      </div>

      {/* Desktop: table */}
      <div className="hidden overflow-hidden rounded-3xl border border-border bg-card lg:block">
        <table className="w-full table-auto text-sm">
          <thead className="bg-muted/40 text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-start">زمان</th>
              <th className="px-3 py-2 text-start">اقدام</th>
              <th className="px-3 py-2 text-start">ادمین</th>
              <th className="px-3 py-2 text-start">صفحه</th>
              <th className="px-3 py-2 text-start">دلیل</th>
              <th className="px-3 py-2 text-start">داده‌ها</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-3 py-6 text-center text-muted-foreground"
                >
                  هیچ ردیفی یافت نشد.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="border-t border-border align-top">
                  <td className="px-3 py-2 text-xs" dir="ltr">
                    {formatPersianDateTime(r.created_at)}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    <div className="font-semibold">
                      {ADMIN_AUDIT_ACTION_LABELS[
                        r.action as keyof typeof ADMIN_AUDIT_ACTION_LABELS
                      ] ?? r.action}
                    </div>
                    <div
                      className="mt-0.5 font-mono text-[10px] text-muted-foreground"
                      dir="ltr"
                    >
                      {r.action}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-xs" dir="ltr">
                    {r.actor_phone ? formatPhoneDisplay(r.actor_phone) : "—"}
                  </td>
                  <td className="px-3 py-2 text-xs" dir="ltr">
                    {r.target_page_slug && r.target_page_id ? (
                      <Link
                        href={
                          `/admin/billing/pages/${r.target_page_id}` as Route
                        }
                        className="font-mono text-primary hover:underline"
                      >
                        {r.target_page_slug}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs">{r.reason ?? "—"}</td>
                  <td className="px-3 py-2 text-xs">
                    {r.metadata && Object.keys(r.metadata).length > 0 ? (
                      <details>
                        <summary className="cursor-pointer text-muted-foreground">
                          نمایش
                        </summary>
                        <pre
                          className="mt-1 max-w-md overflow-x-auto rounded-md bg-muted/40 p-2 text-[10px]"
                          dir="ltr"
                        >
                          {JSON.stringify(r.metadata, null, 2)}
                        </pre>
                      </details>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 ? (
        <Pagination
          currentPage={pageNum}
          totalPages={totalPages}
          params={params}
        />
      ) : null}
    </div>
  );
}

function Pagination({
  currentPage,
  totalPages,
  params,
}: {
  currentPage: number;
  totalPages: number;
  params: SearchParams;
}) {
  const buildHref = (p: number): Route => {
    const sp = new URLSearchParams();
    if (params.action && params.action !== "all")
      sp.set("action", params.action);
    if (params.actorPhone) sp.set("actorPhone", params.actorPhone);
    if (params.pageId) sp.set("pageId", params.pageId);
    if (params.slug) sp.set("slug", params.slug);
    if (params.from) sp.set("from", params.from);
    if (params.to) sp.set("to", params.to);
    sp.set("page", String(p));
    return `/admin/audit?${sp.toString()}` as Route;
  };

  return (
    <nav className="flex items-center justify-between text-xs">
      <Link
        href={buildHref(Math.max(1, currentPage - 1))}
        aria-disabled={currentPage <= 1}
        className={`inline-flex h-9 items-center rounded-md border border-border px-3 ${
          currentPage <= 1 ? "pointer-events-none opacity-50" : ""
        }`}
      >
        قبلی
      </Link>
      <span className="text-muted-foreground">
        صفحه {toPersianDigits(currentPage)} از {toPersianDigits(totalPages)}
      </span>
      <Link
        href={buildHref(Math.min(totalPages, currentPage + 1))}
        aria-disabled={currentPage >= totalPages}
        className={`inline-flex h-9 items-center rounded-md border border-border px-3 ${
          currentPage >= totalPages ? "pointer-events-none opacity-50" : ""
        }`}
      >
        بعدی
      </Link>
    </nav>
  );
}
