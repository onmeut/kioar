/**
 * Account hub.
 *
 * This is the canonical surface for everything that's about the *user*
 * rather than a specific page's content. The `/dashboard/*` namespace is
 * reserved for stats — nothing billing-related lives there anymore.
 *
 * What this page shows, top to bottom:
 *
 *   1. Identity card — phone (read-only, source of truth), legal name
 *      form (used on invoices).
 *   2. Pages list — every page this user owns, with its current plan,
 *      subscription status, and a quick link to manage billing.
 *   3. Recent invoices — last 5 invoices across all the user's pages
 *      with unpaid invoices pinned to the top and a one-tap "pay again"
 *      action. Full list lives at `/account/billing/[pageId]/invoices`.
 *   4. Sign out.
 */
import Link from "next/link";
import type { Route } from "next";
import { desc, eq } from "drizzle-orm";
import {
  ChevronLeftIcon,
  LogOutIcon,
  ReceiptIcon,
  UserIcon,
} from "lucide-react";

import { AccountForm } from "@/components/app/account-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { signOutAction } from "@/app/(app)/insights/actions";
import { getDb } from "@/db";
import { invoices } from "@/db/schema";
import { requireUser } from "@/lib/auth/session";
import { listOwnedPagesWithPlan } from "@/lib/pages";
import { formatPhoneDisplay } from "@/lib/phone";
import {
  formatShamsiDate,
  formatPersianNumber,
  toPersianDigits,
} from "@/lib/date/persian";

export const metadata = {
  title: "حساب کاربری",
};

const PLAN_LABEL: Record<"free" | "pro" | "business", string> = {
  free: "رایگان",
  pro: "حرفه‌ای",
  business: "تجاری",
};

const PLAN_BADGE_CLASS: Record<"free" | "pro" | "business", string> = {
  free: "border-zinc-200 bg-zinc-50 text-zinc-600",
  pro: "border-violet-200 bg-violet-50 text-violet-700",
  business: "border-amber-200 bg-amber-50 text-amber-800",
};

const INVOICE_STATUS_BADGE: Record<
  "unpaid" | "paid" | "expired" | "canceled",
  { label: string; className: string }
> = {
  unpaid: {
    label: "در انتظار پرداخت",
    className: "border-amber-200 bg-amber-50 text-amber-800",
  },
  paid: {
    label: "پرداخت شده",
    className: "border-emerald-200 bg-emerald-50 text-emerald-800",
  },
  expired: {
    label: "منقضی شده",
    className: "border-zinc-200 bg-zinc-50 text-zinc-600",
  },
  canceled: {
    label: "لغو شده",
    className: "border-zinc-200 bg-zinc-50 text-zinc-600",
  },
};

function formatToman(value: number) {
  return toPersianDigits(formatPersianNumber(value));
}

function persianizeNumber(invoiceNumber: string) {
  return invoiceNumber.replace(/[0-9]+/g, (m) => toPersianDigits(m));
}

export default async function AccountPage() {
  const viewer = await requireUser();
  const { user } = viewer;

  const db = getDb();
  const [pages, recentInvoices] = await Promise.all([
    listOwnedPagesWithPlan(user.id),
    db.query.invoices.findMany({
      where: eq(invoices.userId, user.id),
      orderBy: [desc(invoices.createdAt)],
      limit: 20,
      with: { plan: true, page: true },
    }),
  ]);

  // Pin unpaid to the top, then newest-first for everything else, then
  // cap to 5. Live bills should never be pushed below resolved ones in
  // the preview list.
  const orderedInvoices = [...recentInvoices].sort((a, b) => {
    if (a.status === "unpaid" && b.status !== "unpaid") return -1;
    if (b.status === "unpaid" && a.status !== "unpaid") return 1;
    return b.createdAt.getTime() - a.createdAt.getTime();
  });
  const previewInvoices = orderedInvoices.slice(0, 5);
  const hasMoreInvoices = orderedInvoices.length > previewInvoices.length;

  return (
    <div className="mx-auto w-full max-w-2xl space-y-8 px-4 py-6 sm:px-6 sm:py-10">
      <header className="flex items-center gap-3">
        <UserIcon className="size-6 text-muted-foreground" />
        <h1 className="text-xl font-bold">حساب کاربری</h1>
      </header>

      {/* ----- Identity ----- */}
      <section className="space-y-6 rounded-3xl bg-white p-5 ring-1 ring-zinc-200 sm:p-6">
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">شماره موبایل ثبت‌شده</span>
          <div
            dir="ltr"
            className="flex h-11 items-center rounded-xl bg-muted px-4 font-mono text-base font-semibold text-foreground select-all"
          >
            {toPersianDigits(formatPhoneDisplay(user.phone))}
          </div>
          <p className="text-xs text-muted-foreground">
            شماره موبایل قابل تغییر نیست.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <div>
            <h2 className="text-sm font-semibold">نام حقوقی</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              برای فاکتور و امور حقوقی استفاده می‌شه. روی صفحه‌ات نمایش داده
              نمی‌شه.
            </p>
          </div>
          <AccountForm
            initialFirstName={user.firstName ?? ""}
            initialLastName={user.lastName ?? ""}
          />
        </div>
      </section>

      {/* ----- Pages & plans ----- */}
      <section className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-semibold">صفحه‌های شما</h2>
          <span className="text-xs text-muted-foreground">
            {toPersianDigits(pages.length)} صفحه
          </span>
        </div>
        <div className="flex flex-col gap-2.5">
          {pages.map((page) => {
            const planKey = page.planKey;
            const display =
              page.fullName?.trim() || page.title?.trim() || `/${page.slug}`;
            return (
              <div
                key={page.id}
                className="flex items-center gap-3 rounded-2xl bg-white p-4 ring-1 ring-zinc-200"
              >
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="truncate text-sm font-semibold text-zinc-900">
                    {display}
                  </span>
                  <span
                    dir="ltr"
                    className="truncate font-mono text-xs text-zinc-500"
                  >
                    /{page.slug}
                  </span>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <Badge
                      variant="outline"
                      className={PLAN_BADGE_CLASS[planKey]}
                    >
                      {PLAN_LABEL[planKey]}
                    </Badge>
                    {page.isOnTrial ? (
                      <Badge
                        variant="outline"
                        className="border-sky-200 bg-sky-50 text-sky-700"
                      >
                        آزمایشی
                      </Badge>
                    ) : null}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  render={
                    <Link
                      href={`/account/billing/${page.id}` as Route}
                      className="h-9 shrink-0 gap-1 rounded-full px-3 text-xs font-semibold"
                    />
                  }
                >
                  مدیریت اشتراک
                  <ChevronLeftIcon className="size-3.5" />
                </Button>
              </div>
            );
          })}
        </div>
      </section>

      {/* ----- Recent invoices ----- */}
      <section className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-semibold">فاکتورهای اخیر</h2>
          {hasMoreInvoices && pages[0] ? (
            <Link
              href={`/account/billing/${pages[0].id}/invoices` as Route}
              className="text-xs font-semibold text-violet-600 hover:underline"
            >
              مشاهده همه
            </Link>
          ) : null}
        </div>
        {previewInvoices.length === 0 ? (
          <div className="flex items-center gap-3 rounded-2xl bg-white p-4 text-sm text-muted-foreground ring-1 ring-zinc-200">
            <ReceiptIcon className="size-5 text-zinc-400" />
            هنوز فاکتوری ندارید.
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {previewInvoices.map((invoice) => {
              const badge = INVOICE_STATUS_BADGE[invoice.status];
              const pageDisplay =
                invoice.page?.fullName?.trim() ||
                invoice.page?.title?.trim() ||
                (invoice.page ? `/${invoice.page.slug}` : "");
              return (
                <Link
                  key={invoice.id}
                  href={`/account/billing/invoices/${invoice.id}` as Route}
                  className="flex flex-col gap-2 rounded-2xl bg-white p-4 ring-1 ring-zinc-200 transition-colors hover:bg-zinc-50"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 flex-col gap-1">
                      <span
                        dir="ltr"
                        className="truncate font-mono text-xs font-semibold text-zinc-900"
                      >
                        {persianizeNumber(invoice.number)}
                      </span>
                      <span className="truncate text-xs text-zinc-500">
                        {pageDisplay} · {invoice.plan.nameFa}
                      </span>
                    </div>
                    <Badge variant="outline" className={badge.className}>
                      {badge.label}
                    </Badge>
                  </div>
                  <div className="flex items-baseline justify-between gap-3 text-xs text-zinc-500">
                    <span dir="ltr">
                      {formatShamsiDate(new Date(invoice.createdAt))}
                    </span>
                    <span className="font-semibold text-zinc-900">
                      {formatToman(invoice.totalToman)}
                      <span className="ms-1 text-[10px] font-medium text-zinc-500">
                        تومان
                      </span>
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      <form action={signOutAction} className="pt-2">
        <Button
          type="submit"
          variant="outline"
          className="h-12 w-full rounded-full text-sm font-bold"
        >
          <LogOutIcon className="size-4" aria-hidden />
          خروج از حساب
        </Button>
      </form>
    </div>
  );
}
