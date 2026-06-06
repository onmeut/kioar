import type { Route } from "next";
import Link from "next/link";
import {
  BanIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ExternalLinkIcon,
  LayoutGridIcon,
  SearchIcon,
  ShieldCheckIcon,
  UserIcon,
  UserPlusIcon,
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
import { requireAdmin } from "@/lib/auth/session";
import {
  getAdminUserStats,
  listAdminUsers,
  type AdminUserFilter,
  type AdminUserListItem,
  type AdminUserPagePlan,
} from "@/lib/data";
import {
  formatPersianDate,
  formatPersianDateTime,
  toPersianDigits,
} from "@/lib/persian";
import { formatPhoneDisplay } from "@/lib/phone";
import { cn } from "@/lib/utils";

const FILTERS: { value: AdminUserFilter; label: string }[] = [
  { value: "all", label: "همه" },
  { value: "active", label: "فعال" },
  { value: "banned", label: "مسدود" },
  { value: "incomplete", label: "پروفایل ناقص" },
  { value: "admins", label: "ادمین‌ها" },
  { value: "paid", label: "دارای پلن پرداختی" },
  { value: "free_only", label: "فقط Free" },
  { value: "trialing", label: "در دوره آزمایشی" },
  { value: "at_risk", label: "نیازمند رسیدگی" },
];

const PLAN_BADGE_CLASS: Record<AdminUserPagePlan["planKey"], string> = {
  free: "bg-muted text-muted-foreground",
  pro: "bg-emerald-500/12 text-emerald-700",
  business: "bg-violet-500/12 text-violet-700",
};

const STATUS_LABEL_FA: Record<AdminUserPagePlan["status"], string> = {
  active: "فعال",
  trialing: "آزمایشی",
  pending_renewal: "در انتظار تمدید",
  grace: "مهلت پرداخت",
  expired: "منقضی",
  canceled: "لغو شده",
};

function buildUserActions(user: AdminUserListItem): RowAction[] {
  const actions: RowAction[] = [
    {
      key: "edit",
      label: "مدیریت کاربر",
      icon: "edit",
      href: `/admin/users/${user.id}`,
    },
    {
      key: "invoices",
      label: "فاکتورها",
      icon: "invoice",
      href: `/admin/billing/invoices?userId=${user.id}`,
    },
  ];
  if (user.pagePlans.length > 0) {
    actions.push({
      key: "first-page",
      label: "مدیریت اشتراک صفحه",
      icon: "page",
      href: `/admin/billing/pages/${user.pagePlans[0].pageId}`,
    });
  }
  if (user.slug) {
    actions.push({
      key: "view-public",
      label: "مشاهده صفحه عمومی",
      icon: "external",
      href: `/${user.slug}`,
      external: true,
      separatorBefore: true,
    });
  }
  return actions;
}

function getInitials(name: string | null, fallback: string) {
  if (!name) return fallback.slice(-2);
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return fallback.slice(-2);
  if (parts.length === 1) return parts[0].slice(0, 2);
  return (parts[0][0] + parts[parts.length - 1][0]).slice(0, 2);
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

function SignupSparkline({
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

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    filter?: string;
    page?: string;
    deleted?: string;
  }>;
}) {
  await requireAdmin();
  const params = await searchParams;

  const query = (params.q ?? "").trim();
  const rawFilter = params.filter ?? "all";
  const filter: AdminUserFilter = (
    FILTERS.map((f) => f.value) as string[]
  ).includes(rawFilter)
    ? (rawFilter as AdminUserFilter)
    : "all";
  const page = Math.max(1, Number(params.page) || 1);

  const [stats, result] = await Promise.all([
    getAdminUserStats(),
    listAdminUsers({ query, filter, page }),
  ]);

  const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize));

  const buildHref = (
    overrides: Record<string, string | number | undefined>,
  ) => {
    const usp = new URLSearchParams();
    if (query) usp.set("q", query);
    if (filter !== "all") usp.set("filter", filter);
    if (page !== 1) usp.set("page", String(page));
    for (const [k, v] of Object.entries(overrides)) {
      if (v === undefined || v === null || v === "") usp.delete(k);
      else usp.set(k, String(v));
    }
    const qs = usp.toString();
    return (qs ? `/admin/users?${qs}` : "/admin/users") as Route;
  };

  return (
    <div className="section-shell space-y-6 py-6">
      {params.deleted === "1" ? (
        <div className="rounded-3xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-700">
          کاربر حذف شد.
        </div>
      ) : null}

      <section className="space-y-3">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <StatTile label="کل کاربران" value={stats.total} />
          <StatTile
            label="جدید (۷ روز)"
            value={stats.newLast7d}
            accent="positive"
          />
          <StatTile label="فعال (۷ روز)" value={stats.activeLast7d} />
          <StatTile
            label="پروفایل ناقص"
            value={stats.incompleteProfile}
            accent="warn"
          />
          <StatTile label="مسدود" value={stats.banned} accent="destructive" />
        </div>

        <div className="rounded-4xl bg-card p-4 border border-border">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-bold">ثبت‌نام ۱۴ روز اخیر</h2>
            <span className="text-xs text-muted-foreground">
              مجموع: {toPersianDigits(stats.newLast30d)} در ۳۰ روز
            </span>
          </div>
          <SignupSparkline data={stats.signupTrend} />
        </div>
      </section>

      <section className="space-y-3">
        <form
          action="/admin/users"
          className="flex flex-col gap-2 sm:flex-row sm:items-center"
          dir="rtl"
        >
          <div className="relative flex-1">
            <SearchIcon className="pointer-events-none absolute top-1/2 inset-s-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              name="q"
              defaultValue={query}
              placeholder="جستجو بر اساس نام، شناسه، شماره یا ایمیل"
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
        {result.items.length === 0 ? (
          <div className="rounded-4xl border border-dashed border-border/70 bg-background/60 px-6 py-10 text-center text-sm text-muted-foreground">
            موردی با این فیلتر پیدا نشد.
          </div>
        ) : (
          <>
            {/* Mobile card list */}
            <ul className="grid gap-3 lg:hidden">
              {result.items.map((user) => {
                const displayName = user.fullName || user.phone;
                return (
                  <li
                    key={user.id}
                    className="rounded-4xl bg-card p-4 border border-border"
                  >
                    <div className="flex items-start gap-3">
                      <Avatar className="size-11 shrink-0">
                        {user.avatarUrl ? (
                          <AvatarImage src={user.avatarUrl} alt="" />
                        ) : null}
                        <AvatarFallback className="text-xs font-bold">
                          {getInitials(user.fullName, user.phone)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <Link
                              href={`/admin/users/${user.id}` as Route}
                              className="truncate font-bold hover:underline"
                            >
                              {displayName}
                            </Link>
                            <p
                              className="truncate text-xs text-muted-foreground"
                              dir="ltr"
                            >
                              {formatPhoneDisplay(user.phone)}
                            </p>
                          </div>
                          <UserBadges user={user} />
                        </div>
                        {user.slug ? (
                          <Link
                            href={`/${user.slug}` as Route}
                            target="_blank"
                            className="mt-1 inline-flex max-w-full items-center gap-1 truncate text-xs font-semibold text-primary"
                            dir="ltr"
                          >
                            /{user.slug}
                            <ExternalLinkIcon className="size-3 shrink-0" />
                          </Link>
                        ) : null}

                        <dl className="mt-3 grid grid-cols-3 gap-2 text-xs">
                          <Stat label="صفحه" value={user.pageCount} />
                          <Stat label="لینک" value={user.linkCount} />
                          <Stat label="رویداد" value={user.eventCount} />
                        </dl>

                        {user.pagePlans.length > 0 ? (
                          <div className="mt-3">
                            <PlanSummary pages={user.pagePlans} />
                          </div>
                        ) : null}

                        <div className="mt-3 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                          <span>
                            عضویت: {formatPersianDate(user.createdAt)}
                          </span>
                          <RowActionsMenu actions={buildUserActions(user)} />
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>

            {/* Desktop table */}
            <div className="hidden overflow-x-auto rounded-4xl border border-border lg:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>کاربر</TableHead>
                    <TableHead>شناسه عمومی</TableHead>
                    <TableHead>وضعیت</TableHead>
                    <TableHead>صفحه‌ها</TableHead>
                    <TableHead className="text-center">لینک</TableHead>
                    <TableHead className="text-center">رویداد</TableHead>
                    <TableHead>آخرین ورود</TableHead>
                    <TableHead>عضویت</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {result.items.map((user) => {
                    const displayName = user.fullName || user.phone;
                    return (
                      <TableRow key={user.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="size-9">
                              {user.avatarUrl ? (
                                <AvatarImage src={user.avatarUrl} alt="" />
                              ) : null}
                              <AvatarFallback className="text-xs font-bold">
                                {getInitials(user.fullName, user.phone)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <Link
                                href={`/admin/users/${user.id}` as Route}
                                className="truncate font-semibold hover:underline"
                              >
                                {displayName}
                              </Link>
                              <p
                                className="truncate text-xs text-muted-foreground"
                                dir="ltr"
                              >
                                {formatPhoneDisplay(user.phone)}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {user.slug ? (
                            <Link
                              href={`/${user.slug}` as Route}
                              target="_blank"
                              className="inline-flex items-center gap-1 text-sm font-semibold text-primary"
                              dir="ltr"
                            >
                              /{user.slug}
                              <ExternalLinkIcon className="size-3" />
                            </Link>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              بدون پروفایل
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <UserBadges user={user} />
                        </TableCell>
                        <TableCell className="min-w-50">
                          <PageCellDesktop pages={user.pagePlans} />
                        </TableCell>
                        <TableCell className="text-center">
                          {toPersianDigits(user.linkCount)}
                        </TableCell>
                        <TableCell className="text-center">
                          {toPersianDigits(user.eventCount)}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {user.lastLoginAt
                            ? formatPersianDateTime(user.lastLoginAt)
                            : "—"}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {formatPersianDate(user.createdAt)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-2">
                            <RowActionsMenu actions={buildUserActions(user)} />
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </>
        )}

        {totalPages > 1 ? (
          <div className="mt-4 flex items-center justify-between gap-3">
            <span className="text-xs text-muted-foreground">
              صفحه {toPersianDigits(result.page)} از{" "}
              {toPersianDigits(totalPages)}
              {" · "}
              {toPersianDigits(result.total)} کاربر
            </span>
            <div className="flex items-center gap-2">
              <Link
                aria-disabled={page <= 1}
                href={buildHref({ page: Math.max(1, page - 1) })}
                className={cn(
                  buttonVariants({
                    size: "sm",
                    variant: "outline",
                    className: "h-9 rounded-full",
                  }),
                  page <= 1 && "pointer-events-none opacity-50",
                )}
              >
                <ChevronRightIcon className="size-4" />
                قبلی
              </Link>
              <Link
                aria-disabled={page >= totalPages}
                href={buildHref({ page: Math.min(totalPages, page + 1) })}
                className={cn(
                  buttonVariants({
                    size: "sm",
                    variant: "outline",
                    className: "h-9 rounded-full",
                  }),
                  page >= totalPages && "pointer-events-none opacity-50",
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

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl bg-muted/50 px-2 py-1.5 text-center">
      <p className="text-xs font-bold">{toPersianDigits(value)}</p>
      <p className="text-[10px] text-muted-foreground">{label}</p>
    </div>
  );
}

function UserBadges({
  user,
}: {
  user: {
    role: "user" | "admin";
    bannedAt: Date | null;
    isComplete: boolean;
  };
}) {
  const items: React.ReactNode[] = [];
  if (user.bannedAt) {
    items.push(
      <Badge
        key="banned"
        className="gap-1 rounded-full bg-rose-500/15 text-rose-700"
      >
        <BanIcon className="size-3" />
        مسدود
      </Badge>,
    );
  }
  if (user.role === "admin") {
    items.push(
      <Badge
        key="admin"
        className="gap-1 rounded-full bg-primary/15 text-primary"
      >
        <ShieldCheckIcon className="size-3" />
        ادمین
      </Badge>,
    );
  }
  if (!user.isComplete && !user.bannedAt) {
    items.push(
      <Badge
        key="incomplete"
        className="gap-1 rounded-full bg-amber-500/15 text-amber-700"
      >
        <UserPlusIcon className="size-3" />
        ناقص
      </Badge>,
    );
  }
  if (items.length === 0) {
    items.push(
      <Badge key="ok" className="gap-1 rounded-full bg-muted">
        <UserIcon className="size-3" />
        فعال
      </Badge>,
    );
  }
  return <div className="flex flex-wrap gap-1">{items}</div>;
}

function summarizePlans(pages: AdminUserPagePlan[]) {
  const counts: Record<AdminUserPagePlan["planKey"], number> = {
    free: 0,
    pro: 0,
    business: 0,
  };
  let trialing = 0;
  let atRisk = 0;
  let cancelAtEnd = 0;
  for (const p of pages) {
    counts[p.planKey] += 1;
    if (p.status === "trialing") trialing += 1;
    if (p.status === "grace" || p.status === "expired") atRisk += 1;
    if (p.cancelAtPeriodEnd) cancelAtEnd += 1;
  }
  return { counts, trialing, atRisk, cancelAtEnd };
}

function PlanSummary({ pages }: { pages: AdminUserPagePlan[] }) {
  if (pages.length === 0) return null;
  const { counts, trialing, atRisk } = summarizePlans(pages);
  const planChips: React.ReactNode[] = [];
  if (counts.business > 0) {
    planChips.push(
      <Badge
        key="business"
        className={cn("rounded-full", PLAN_BADGE_CLASS.business)}
      >
        {toPersianDigits(counts.business)} Business
      </Badge>,
    );
  }
  if (counts.pro > 0) {
    planChips.push(
      <Badge key="pro" className={cn("rounded-full", PLAN_BADGE_CLASS.pro)}>
        {toPersianDigits(counts.pro)} Pro
      </Badge>,
    );
  }
  if (counts.free > 0) {
    planChips.push(
      <Badge key="free" className={cn("rounded-full", PLAN_BADGE_CLASS.free)}>
        {toPersianDigits(counts.free)} Free
      </Badge>,
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-1">
      {planChips}
      {trialing > 0 ? (
        <Badge className="rounded-full bg-amber-500/15 text-amber-700">
          {toPersianDigits(trialing)} آزمایشی
        </Badge>
      ) : null}
      {atRisk > 0 ? (
        <Badge className="rounded-full bg-rose-500/15 text-rose-700">
          {toPersianDigits(atRisk)} نیازمند رسیدگی
        </Badge>
      ) : null}
    </div>
  );
}

function PageCellDesktop({ pages }: { pages: AdminUserPagePlan[] }) {
  if (pages.length === 0) {
    return <span className="text-xs text-muted-foreground">بدون صفحه</span>;
  }
  return (
    <details className="group">
      <summary className="flex cursor-pointer list-none items-center gap-2">
        <Badge className="gap-1 rounded-full bg-muted">
          <LayoutGridIcon className="size-3" />
          {toPersianDigits(pages.length)}
        </Badge>
        <PlanSummary pages={pages} />
      </summary>
      <ul className="mt-2 grid gap-1.5">
        {pages.map((p) => (
          <li
            key={p.pageId}
            className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-muted/40 p-2 text-xs"
          >
            <div className="flex min-w-0 items-center gap-2">
              <span className="font-mono text-foreground" dir="ltr">
                /{p.slug}
              </span>
              <Badge
                className={cn(
                  "rounded-full text-[10px]",
                  PLAN_BADGE_CLASS[p.planKey],
                )}
              >
                {p.planNameFa}
              </Badge>
              <Badge className="rounded-full bg-background text-[10px] text-muted-foreground">
                {STATUS_LABEL_FA[p.status]}
              </Badge>
              {p.cancelAtPeriodEnd ? (
                <Badge className="rounded-full bg-muted text-[10px]">
                  لغو در پایان
                </Badge>
              ) : null}
            </div>
            <div className="flex items-center gap-2">
              {p.currentPeriodEnd ? (
                <span className="text-[11px] text-muted-foreground">
                  {formatPersianDate(p.currentPeriodEnd)}
                </span>
              ) : null}
              <Link
                href={`/admin/billing/pages/${p.pageId}` as Route}
                className="inline-flex items-center gap-1 rounded-full bg-foreground px-2 py-0.5 text-[10px] font-semibold text-background"
              >
                مدیریت
                <ExternalLinkIcon className="size-3" />
              </Link>
            </div>
          </li>
        ))}
      </ul>
    </details>
  );
}
