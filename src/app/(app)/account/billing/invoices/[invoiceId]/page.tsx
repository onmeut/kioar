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
 * Surfaces:
 *   - Status banner reflecting `?status=cancelled|failed|unknown|retry|paid|already`
 *     (only meaningful on the callback hop; on plain visits we skip it).
 *   - Invoice header (number + status + amount + dates).
 *   - Plan + cycle + page identity.
 *   - "Pay again" CTA for `unpaid` invoices (same `POST /api/billing/invoices/[id]/pay`
 *     endpoint the invoices list uses).
 *   - Receipt link (Zarinpal RefID) on `paid`.
 */
import Link from "next/link";
import type { Route } from "next";
import { and, desc, eq } from "drizzle-orm";
import { ChevronRightIcon } from "lucide-react";
import { notFound } from "next/navigation";

import { InvoiceDetailActions } from "@/components/billing/invoice-detail-actions";
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

const CALLBACK_STATUS_BANNER: Record<
  string,
  { tone: "amber" | "red" | "emerald"; text: string }
> = {
  cancelled: { tone: "amber", text: "پرداخت توسط شما لغو شد. می‌توانید دوباره تلاش کنید." },
  failed: { tone: "red", text: "پرداخت ناموفق بود. می‌توانید دوباره تلاش کنید." },
  unknown: { tone: "red", text: "وضعیت پرداخت مشخص نشد. اگر مبلغ کسر شده، با پشتیبانی تماس بگیرید." },
  retry: { tone: "amber", text: "ارتباط با درگاه برقرار نشد. کمی بعد دوباره تلاش کنید." },
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
    where: and(
      eq(invoices.id, invoiceId),
      eq(invoices.userId, viewer.user.id),
    ),
    with: { plan: true, page: true },
  });
  if (!invoice) notFound();

  // Latest payment row (for refId display on `paid`).
  const latestPayment = await db.query.payments.findFirst({
    where: eq(payments.invoiceId, invoice.id),
    orderBy: [desc(payments.createdAt)],
  });

  const badge = STATUS_BADGE[invoice.status];
  const banner = status ? CALLBACK_STATUS_BANNER[status] ?? null : null;
  const pageId = invoice.pageId;
  const pageName =
    invoice.page?.fullName?.trim() ||
    invoice.page?.title?.trim() ||
    (invoice.page ? `/${invoice.page.slug}` : "");

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 px-4 py-6 sm:py-10">
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

      <header className="flex flex-col items-center gap-2 text-center">
        <p className="text-[10px] font-semibold uppercase text-zinc-400">
          فاکتور
        </p>
        <h1
          dir="ltr"
          className="font-mono text-2xl font-bold text-zinc-900 sm:text-3xl"
        >
          {persianizeNumber(invoice.number)}
        </h1>
        <Badge variant="outline" className={badge.className}>
          {badge.label}
        </Badge>
      </header>

      {banner ? (
        <div
          className={
            "rounded-2xl border p-4 text-sm " +
            (banner.tone === "red"
              ? "border-red-200 bg-red-50 text-red-800"
              : banner.tone === "emerald"
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-amber-200 bg-amber-50 text-amber-900")
          }
        >
          {banner.text}
        </div>
      ) : null}

      <section className="rounded-3xl bg-white p-5 ring-1 ring-zinc-200 sm:p-6">
        <dl className="grid grid-cols-1 gap-y-4 sm:grid-cols-2 sm:gap-x-6">
          <div>
            <dt className="text-[10px] uppercase text-zinc-400">صفحه</dt>
            <dd className="mt-1 text-sm font-semibold text-zinc-900">
              {pageName}
            </dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase text-zinc-400">پلن</dt>
            <dd className="mt-1 text-sm font-semibold text-zinc-900">
              {invoice.plan.nameFa}{" "}
              <span className="text-xs font-medium text-zinc-500">
                ({invoice.billingCycle === "annual" ? "سالانه" : "ماهانه"})
              </span>
            </dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase text-zinc-400">مبلغ کل</dt>
            <dd className="mt-1 text-base font-bold text-zinc-900">
              {formatToman(invoice.totalToman)}{" "}
              <span className="text-xs font-medium text-zinc-500">تومان</span>
            </dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase text-zinc-400">
              تاریخ صدور
            </dt>
            <dd
              dir="ltr"
              className="mt-1 text-sm font-semibold text-zinc-900"
            >
              {formatShamsiDate(new Date(invoice.createdAt))}
            </dd>
          </div>
          {invoice.discountAmountToman > 0 ? (
            <div>
              <dt className="text-[10px] uppercase text-zinc-400">تخفیف</dt>
              <dd className="mt-1 text-sm font-semibold text-emerald-700">
                −{formatToman(invoice.discountAmountToman)}{" "}
                <span className="text-xs font-medium">تومان</span>
              </dd>
            </div>
          ) : null}
          {invoice.vatToman > 0 ? (
            <div>
              <dt className="text-[10px] uppercase text-zinc-400">
                مالیات بر ارزش افزوده
              </dt>
              <dd className="mt-1 text-sm font-semibold text-zinc-900">
                {formatToman(invoice.vatToman)}{" "}
                <span className="text-xs font-medium text-zinc-500">
                  تومان
                </span>
              </dd>
            </div>
          ) : null}
          {invoice.paidAt ? (
            <div>
              <dt className="text-[10px] uppercase text-zinc-400">
                تاریخ پرداخت
              </dt>
              <dd
                dir="ltr"
                className="mt-1 text-sm font-semibold text-zinc-900"
              >
                {formatShamsiDate(new Date(invoice.paidAt))}
              </dd>
            </div>
          ) : (
            <div>
              <dt className="text-[10px] uppercase text-zinc-400">
                مهلت پرداخت
              </dt>
              <dd
                dir="ltr"
                className="mt-1 text-sm font-semibold text-zinc-900"
              >
                {formatShamsiDate(new Date(invoice.dueAt))}
              </dd>
            </div>
          )}
          {latestPayment?.refId ? (
            <div className="sm:col-span-2">
              <dt className="text-[10px] uppercase text-zinc-400">
                کد رهگیری زرین‌پال
              </dt>
              <dd
                dir="ltr"
                className="mt-1 font-mono text-sm font-semibold text-zinc-900 select-all"
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
