import type { Route } from "next";
import Link from "next/link";
import { ExternalLinkIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requireAdmin } from "@/lib/auth/session";
import { EVENT_STATUS_LABELS } from "@/lib/events/labels";
import { listAdminEvents } from "@/lib/events/queries";
import { formatShamsiDateTimeInZone } from "@/lib/date/timezone";
import { toPersianDigits } from "@/lib/date/persian";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 30;

type StatusKey = "all" | "draft" | "published" | "cancelled";

const STATUS_FILTERS: ReadonlyArray<{ key: StatusKey; label: string }> = [
  { key: "all", label: "همه" },
  { key: "published", label: "منتشر شده" },
  { key: "draft", label: "پیش‌نویس" },
  { key: "cancelled", label: "لغو شده" },
];

const STATUS_TONE: Record<string, string> = {
  published: "bg-emerald-500/12 text-emerald-700",
  cancelled: "bg-rose-500/12 text-rose-700",
  draft: "bg-muted text-foreground",
};

function buildHref(status: StatusKey, page: number): Route {
  const params = new URLSearchParams();
  if (status !== "all") params.set("status", status);
  if (page > 1) params.set("page", String(page));
  const qs = params.toString();
  return (qs ? `/admin/events?${qs}` : "/admin/events") as Route;
}

export default async function AdminEventsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  await requireAdmin();
  const sp = await searchParams;
  const statusRaw = sp.status;
  const status: StatusKey =
    statusRaw === "draft" ||
    statusRaw === "published" ||
    statusRaw === "cancelled"
      ? statusRaw
      : "all";
  const pageNum = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);

  const { items, hasMore } = await listAdminEvents(
    pageNum,
    PAGE_SIZE,
    status === "all" ? null : status,
  );
  const hasPrev = pageNum > 1;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">رویدادها</h1>
        <p className="text-sm text-muted-foreground">
          همهٔ رویدادهای پلتفرم.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {STATUS_FILTERS.map((f) => (
          <Link
            key={f.key}
            href={buildHref(f.key, 1)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-sm transition-colors",
              status === f.key
                ? "border-foreground bg-foreground text-background"
                : "border-border text-muted-foreground hover:bg-muted",
            )}
          >
            {f.label}
          </Link>
        ))}
      </div>

      {items.length === 0 ? (
        <p className="rounded-3xl border border-dashed border-border bg-muted/20 p-10 text-center text-sm text-muted-foreground">
          رویدادی پیدا نشد.
        </p>
      ) : (
        <>
          {/* Mobile cards */}
          <div className="space-y-3 lg:hidden">
            {items.map((ev) => (
              <div
                key={ev.id}
                className="rounded-3xl border border-border p-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="min-w-0 flex-1 truncate font-semibold">
                    {ev.title}
                  </p>
                  <Badge
                    className={cn("rounded-full", STATUS_TONE[ev.status] ?? "")}
                  >
                    {EVENT_STATUS_LABELS[ev.status]}
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {formatShamsiDateTimeInZone(ev.startsAt, ev.timezone)}
                </p>
                <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                  <span>میزبان: {ev.pageName ?? ev.pageSlug}</span>
                  <span>{toPersianDigits(ev.registrantCount)} ثبت‌نام</span>
                </div>
                <Link
                  href={`/${ev.pageSlug}/e/${ev.slug}` as Route}
                  className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-foreground hover:underline"
                >
                  <ExternalLinkIcon className="size-3.5" />
                  صفحهٔ عمومی
                </Link>
              </div>
            ))}
          </div>

          {/* Desktop table */}
          <div className="hidden lg:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>عنوان</TableHead>
                  <TableHead>میزبان</TableHead>
                  <TableHead>زمان</TableHead>
                  <TableHead>وضعیت</TableHead>
                  <TableHead>ثبت‌نام</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((ev) => (
                  <TableRow key={ev.id}>
                    <TableCell className="font-medium">{ev.title}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {ev.pageName ?? ev.pageSlug}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {toPersianDigits(
                        formatShamsiDateTimeInZone(ev.startsAt, ev.timezone),
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={cn(
                          "rounded-full",
                          STATUS_TONE[ev.status] ?? "",
                        )}
                      >
                        {EVENT_STATUS_LABELS[ev.status]}
                      </Badge>
                    </TableCell>
                    <TableCell>{toPersianDigits(ev.registrantCount)}</TableCell>
                    <TableCell>
                      <Link
                        href={`/${ev.pageSlug}/e/${ev.slug}` as Route}
                        className="inline-flex items-center gap-1.5 text-sm text-foreground hover:underline"
                      >
                        <ExternalLinkIcon className="size-4" />
                        عمومی
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {hasPrev || hasMore ? (
            <div className="flex items-center justify-between gap-3">
              {hasPrev ? (
                <Link
                  href={buildHref(status, pageNum - 1)}
                  className="inline-flex h-11 items-center rounded-2xl border border-border px-5 text-sm font-medium hover:bg-muted"
                >
                  → قبلی
                </Link>
              ) : (
                <span />
              )}
              <span className="text-xs text-muted-foreground">
                صفحهٔ {toPersianDigits(pageNum)}
              </span>
              {hasMore ? (
                <Link
                  href={buildHref(status, pageNum + 1)}
                  className="inline-flex h-11 items-center rounded-2xl bg-foreground px-5 text-sm font-semibold text-background hover:bg-foreground/85"
                >
                  بعدی ←
                </Link>
              ) : (
                <span />
              )}
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
