/**
 * Single-invoice detail page.
 *
 * Two roles:
 *
 *   1. Post-gateway landing surface — Zarinpal's callback redirects
 *      here on cancel / failure / unknown / retry so the user lands on
 *      *their* unpaid bill, not the stats dashboard, and can immediately
 *      try the payment again.
 *
 *   2. Linked from the per-page invoice list and the `/account` hub
 *      ("recent invoices" section).
 *
 * Design mirrors the `/pro` page: page-identity card with avatar at top,
 * status badge as the primary visual signal, invoice number demoted to a
 * secondary field. Unpaid/cancelled states use red so they read as
 * "action required" rather than neutral amber/zinc.
 */
import Link from "next/link";
import type { Route } from "next";
import { and, desc, eq } from "drizzle-orm";
import { ChevronRightIcon } from "lucide-react";
import { notFound } from "next/navigation";

import { InvoiceDetailActions } from "@/components/billing/invoice-detail-actions";
import { KioarAvatar } from "@/components/shared/kioar-avatar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getDb } from "@/db";
import { invoices, payments } from "@/db/schema";
import { requireUser } from "@/lib/auth/session";
import {
  formatShamsiDate,
  formatPersianNumber,
  toPersianDigits,
} from "@/lib/date/persian";

export const metadata = {
  title: "فاکتور",
};

const STATUS_BADGE: Record<
  "unpaid" | "paid" | "expired" | "canceled",
  { label: string; badgeClass: string; headingClass: string }
> = {
  unpaid: {
    label: "در انتظار پرداخت",
    badgeClass: "border-red-200 bg-red-50 text-red-700",
    headingClass: "text-red-700",
  },
  paid: {
    label: "پرداخت شده",
    badgeClass: "border-emerald-200 bg-emerald-50 text-emerald-700",
    headingClass: "text-emerald-700",
  },
  expired: {
    label: "منقضی شده",
    badgeClass: "border-zinc-200 bg-zinc-100 text-zinc-500",
    headingClass: "text-zinc-500",
  },
  canceled: {
    label: "لغو شده",
    badgeClass: "border-zinc-200 bg-zinc-100 text-zinc-500",
    headingClass: "text-zinc-500",
  },
};

const CALLBACK_STATUS_BANNER: Record<
  string,
  { tone: "red" | "emerald"; text: string }
> = {
  cancelled: {
    tone: "red",
    text: "پرداخت توسط شما لغو شد. می‌توانید دوباره تلاش کنید.",
  },
  failed: {
    tone: "red",
    text: "پرداخت ناموفق بود. می‌توانید دوباره تلاش کنید.",
  },
  unknown: {
    tone: "red",
    text: "وضعیت پرداخت مشخص نشد. اگر مبلغ کسر شده، با پشتیبانی تماس بگیرید.",
  },
  retry: {
    tone: "red",
    text: "ارتباط با درگاه برقرار نشد. کمی بعد دوباره تلاش کنید.",
  },
  already: { tone: "emerald", text: "این فاکتور قبلاً پرداخت شده است." },
};

function formatToman(value: number) {
  return toPersianDigits(formatPersianNumber(value));
}

function persianizeNumber(invoiceNumber: string) {
  return invoiceNumber.replace(/[0-9]+/g, (m) => toPersianDigits(m));
}

type Params = Promise<{ invoiceId: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function InvoiceDetailRoute({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const { invoiceId } = await params;
  const sp = await searchParams;
  const status = typeof sp.status === "string" ? sp.status : null;

  const viewer = await requireUser();
  const db = getDb();

  const invoice = await db.query.invoices.findFirst({
    where: and(eq(invoices.id, invoiceId), eq(invoices.userId, viewer.user.id)),
    with: { plan: true, page: true },
  });
  if (!invoice) notFound();

  // Latest payment row (for refId display on `paid`).
  const latestPayment = await db.query.payments.findFirst({
    where: eq(payments.invoiceId, invoice.id),
    orderBy: [desc(payments.createdAt)],
  });

  const badge = STATUS_BADGE[invoice.status];
  const banner = status ? (CALLBACK_STATUS_BANNER[status] ?? null) : null;
  const pageId = invoice.pageId;
  const pageName =
    invoice.page?.fullName?.trim() ||
    invoice.page?.title?.trim() ||
    (invoice.page ? `/${invoice.page.slug}` : "");

  return (
    <div className="mx-auto w-full max-w-2xl space-y-5 px-4 py-6 sm:py-10">
      {/* Back link */}
      <div>
        <Button
          variant="ghost"
          size="sm"
          render={
            <Link
              href={`/account/billing/${pageId}/invoices` as Route}
              className="-ms-2 h-9 gap-1 rounded-full px-3 text-xs text-zinc-500"
            />
          }
        >
          <ChevronRightIcon className="size-4" />
          فاکتورهای این صفحه
        </Button>
      </div>

      {/* Callback banner — shown only on gateway-return hops */}
      {banner ? (
        <div
          className={
            "rounded-2xl border p-4 text-sm font-medium " +
            (banner.tone === "emerald"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-red-200 bg-red-50 text-red-700")
          }
        >
          {banner.text}
        </div>
      ) : null}

      {/* Page identity card — mirrors the /pro page treatment */}
      {invoice.page ? (
        <section className="rounded-3xl bg-white p-5 ring-1 ring-zinc-200">
          <div className="flex items-center gap-4">
            <Avatar className="size-14 shrink-0 rounded-2xl ring-2 ring-background [&_svg]:size-full!">
              {invoice.page.avatarUrl ? (
                <AvatarImage src={invoice.page.avatarUrl} alt={pageName} />
              ) : (
                <AvatarFallback className="bg-transparent p-0">
                  <KioarAvatar seed={invoice.page.avatarSeed} size={56} />
                </AvatarFallback>
              )}
            </Avatar>
            <div className="flex min-w-0 flex-col gap-0.5">
              <p className="truncate text-base font-bold text-zinc-900 sm:text-lg">
                {pageName}
              </p>
              <p className="text-sm text-zinc-500">
                {invoice.plan.nameFa} <span className="text-zinc-400">·</span>{" "}
                {invoice.billingCycle === "annual" ? "سالانه" : "ماهانه"}
              </p>
            </div>
          </div>
        </section>
      ) : null}

      {/* Invoice status + amount — the hero block */}
      <section className="rounded-3xl bg-white p-5 ring-1 ring-zinc-200 sm:p-6">
        {/* Status badge as primary signal, invoice number secondary */}
        <div className="mb-5 flex flex-col items-start gap-3 border-b border-zinc-100 pb-5 sm:flex-row sm:items-center sm:justify-between">
          <Badge
            variant="outline"
            className={"h-7 px-3 text-sm font-bold " + badge.badgeClass}
          >
            {badge.label}
          </Badge>
          <span
            dir="ltr"
            className="font-mono text-xs font-medium text-zinc-400 select-all"
          >
            {persianizeNumber(invoice.number)}
          </span>
        </div>

        <dl className="grid grid-cols-2 gap-x-6 gap-y-5">
          {/* Amount — spans full width, most prominent number */}
          <div className="col-span-2">
            <dt className="text-[11px] font-medium text-zinc-400">مبلغ کل</dt>
            <dd className={"mt-1 text-3xl font-bold " + badge.headingClass}>
              {formatToman(invoice.totalToman)}{" "}
              <span className="text-base font-medium text-zinc-400">تومان</span>
            </dd>
          </div>

          <div>
            <dt className="text-[11px] font-medium text-zinc-400">
              تاریخ صدور
            </dt>
            <dd dir="ltr" className="mt-1 text-sm font-semibold text-zinc-800">
              {formatShamsiDate(new Date(invoice.createdAt))}
            </dd>
          </div>

          {invoice.paidAt ? (
            <div>
              <dt className="text-[11px] font-medium text-zinc-400">
                تاریخ پرداخت
              </dt>
              <dd
                dir="ltr"
                className="mt-1 text-sm font-semibold text-emerald-700"
              >
                {formatShamsiDate(new Date(invoice.paidAt))}
              </dd>
            </div>
          ) : (
            <div>
              <dt className="text-[11px] font-medium text-zinc-400">
                مهلت پرداخت
              </dt>
              <dd
                dir="ltr"
                className="mt-1 text-sm font-semibold text-zinc-800"
              >
                {formatShamsiDate(new Date(invoice.dueAt))}
              </dd>
            </div>
          )}

          {invoice.discountAmountToman > 0 ? (
            <div>
              <dt className="text-[11px] font-medium text-zinc-400">تخفیف</dt>
              <dd className="mt-1 text-sm font-semibold text-emerald-700">
                −{formatToman(invoice.discountAmountToman)}{" "}
                <span className="text-xs font-medium text-zinc-400">تومان</span>
              </dd>
            </div>
          ) : null}

          {invoice.vatToman > 0 ? (
            <div>
              <dt className="text-[11px] font-medium text-zinc-400">
                مالیات بر ارزش افزوده
              </dt>
              <dd className="mt-1 text-sm font-semibold text-zinc-800">
                {formatToman(invoice.vatToman)}{" "}
                <span className="text-xs font-medium text-zinc-400">تومان</span>
              </dd>
            </div>
          ) : null}

          {latestPayment?.refId ? (
            <div className="col-span-2 border-t border-zinc-100 pt-4">
              <dt className="text-[11px] font-medium text-zinc-400">
                کد رهگیری زرین‌پال
              </dt>
              <dd
                dir="ltr"
                className="mt-1 font-mono text-sm font-semibold text-zinc-800 select-all"
              >
                {latestPayment.refId}
              </dd>
            </div>
          ) : null}
        </dl>
      </section>

      {invoice.status === "unpaid" ? (
        <InvoiceDetailActions invoiceId={invoice.id} />
      ) : null}
    </div>
  );
}
