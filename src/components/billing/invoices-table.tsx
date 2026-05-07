"use client";

/**
 * Phase 12 — invoices list with mobile cards / desktop table.
 *
 * Each row shows the invoice number, plan + cycle, total, status badge,
 * and a primary action:
 *
 *   - status=unpaid  → "پرداخت" → POST /api/billing/invoices/[id]/pay,
 *                      hard-redirect to Zarinpal.
 *   - status=paid    → no CTA, show paidAt.
 *   - status=expired/canceled → no CTA.
 *
 * Display the invoice number as LTR + Persian digits — `KIOAR-1404-000001`
 * is a stable identifier the user reads to support, so we keep ASCII for
 * the prefix and convert only the digits.
 */

import { useState, useTransition } from "react";
import { Loader2Icon } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  formatPersianDate,
  formatPersianNumber,
  toPersianDigits,
} from "@/lib/persian";

export type InvoiceRow = {
  id: string;
  number: string;
  planNameFa: string;
  billingCycle: "monthly" | "annual";
  totalToman: number;
  status: "unpaid" | "paid" | "expired" | "canceled";
  dueAt: string;
  paidAt: string | null;
  createdAt: string;
};

type Props = {
  invoices: InvoiceRow[];
};

const STATUS_BADGE: Record<
  InvoiceRow["status"],
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
  // KIOAR-1404-000001 → keep prefix ASCII, persianize only digits
  return invoiceNumber.replace(/[0-9]+/g, (m) => toPersianDigits(m));
}

export function InvoicesTable({ invoices }: Props) {
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const pay = (invoiceId: string) => {
    setPendingId(invoiceId);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/billing/invoices/${invoiceId}/pay`, {
          method: "POST",
        });
        const data = (await res.json().catch(() => null)) as
          | { ok: true; redirectUrl: string }
          | { error: string; message?: string }
          | null;
        if (!res.ok || !data || (data as { ok?: boolean }).ok !== true) {
          const msg =
            (data && "message" in data && data.message) ||
            (data && "error" in data && data.error) ||
            "خطای ناشناخته";
          toast.error(`عملیات انجام نشد: ${msg}`);
          setPendingId(null);
          return;
        }
        if ("redirectUrl" in data) {
          window.location.href = data.redirectUrl;
        }
      } catch (err) {
        toast.error(`ارتباط با سرور برقرار نشد: ${(err as Error).message}`);
        setPendingId(null);
      }
    });
  };

  if (invoices.length === 0) {
    return (
      <div className="rounded-3xl bg-white p-10 text-center text-sm text-zinc-500 ring-1 ring-zinc-200">
        هنوز فاکتوری برای این صفحه ثبت نشده است.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Mobile cards */}
      <div className="space-y-3 lg:hidden">
        {invoices.map((inv) => {
          const badge = STATUS_BADGE[inv.status];
          const isLoading = pendingId === inv.id && isPending;
          return (
            <div
              key={inv.id}
              className="space-y-3 rounded-2xl bg-white p-4 ring-1 ring-zinc-200"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-0.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                    شماره فاکتور
                  </p>
                  <p
                    dir="ltr"
                    className="text-sm font-semibold tracking-tight text-zinc-900"
                  >
                    {persianizeNumber(inv.number)}
                  </p>
                </div>
                <Badge variant="outline" className={badge.className}>
                  {badge.label}
                </Badge>
              </div>
              <div className="grid grid-cols-2 gap-3 text-[12px]">
                <div>
                  <p className="text-zinc-500">پلن</p>
                  <p className="font-medium text-zinc-800">
                    {inv.planNameFa} ·{" "}
                    {inv.billingCycle === "annual" ? "سالانه" : "ماهانه"}
                  </p>
                </div>
                <div>
                  <p className="text-zinc-500">مبلغ</p>
                  <p className="font-bold text-zinc-900">
                    {formatToman(inv.totalToman)} تومان
                  </p>
                </div>
                <div>
                  <p className="text-zinc-500">تاریخ صدور</p>
                  <p dir="ltr" className="text-zinc-700">
                    {formatPersianDate(new Date(inv.createdAt))}
                  </p>
                </div>
                <div>
                  <p className="text-zinc-500">
                    {inv.status === "paid" ? "تاریخ پرداخت" : "مهلت پرداخت"}
                  </p>
                  <p dir="ltr" className="text-zinc-700">
                    {formatPersianDate(
                      new Date(
                        inv.status === "paid" && inv.paidAt
                          ? inv.paidAt
                          : inv.dueAt,
                      ),
                    )}
                  </p>
                </div>
              </div>
              {inv.status === "unpaid" ? (
                <Button
                  type="button"
                  className="h-12 w-full text-sm font-bold"
                  disabled={isPending}
                  onClick={() => pay(inv.id)}
                >
                  {isLoading ? (
                    <Loader2Icon className="size-4 animate-spin" />
                  ) : (
                    "پرداخت فاکتور"
                  )}
                </Button>
              ) : null}
            </div>
          );
        })}
      </div>

      {/* Desktop table — sticky header so the column labels stay
          visible while scrolling a long invoice history. Plain HTML
          table so vertical sticky works inside the rounded container. */}
      <div className="hidden rounded-3xl bg-white ring-1 ring-zinc-200 lg:block">
        <table className="w-full border-separate border-spacing-0 text-right text-[13px]">
          <thead className="sticky top-0 z-10">
            <tr>
              <th
                scope="col"
                className="rounded-ts-3xl border-b border-zinc-200 bg-white/95 px-5 py-3 text-start text-[12px] font-bold text-zinc-900 backdrop-blur-sm"
              >
                شماره
              </th>
              <th
                scope="col"
                className="border-b border-zinc-200 bg-white/95 px-5 py-3 text-start text-[12px] font-bold text-zinc-900 backdrop-blur-sm"
              >
                پلن
              </th>
              <th
                scope="col"
                className="border-b border-zinc-200 bg-white/95 px-5 py-3 text-start text-[12px] font-bold text-zinc-900 backdrop-blur-sm"
              >
                مبلغ
              </th>
              <th
                scope="col"
                className="border-b border-zinc-200 bg-white/95 px-5 py-3 text-start text-[12px] font-bold text-zinc-900 backdrop-blur-sm"
              >
                وضعیت
              </th>
              <th
                scope="col"
                className="border-b border-zinc-200 bg-white/95 px-5 py-3 text-start text-[12px] font-bold text-zinc-900 backdrop-blur-sm"
              >
                تاریخ
              </th>
              <th
                scope="col"
                className="rounded-te-3xl border-b border-zinc-200 bg-white/95 px-5 py-3 text-end text-[12px] font-bold text-zinc-900 backdrop-blur-sm"
              >
                عملیات
              </th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((inv, i) => {
              const badge = STATUS_BADGE[inv.status];
              const isLoading = pendingId === inv.id && isPending;
              const isLast = i === invoices.length - 1;
              return (
                <tr key={inv.id}>
                  <td
                    dir="ltr"
                    className={
                      "px-5 py-4 font-mono text-xs text-zinc-700 " +
                      (isLast ? "rounded-bs-3xl" : "border-b border-zinc-100")
                    }
                  >
                    {persianizeNumber(inv.number)}
                  </td>
                  <td
                    className={
                      "px-5 py-4 " + (isLast ? "" : "border-b border-zinc-100")
                    }
                  >
                    <div className="space-y-0.5">
                      <p className="text-sm font-medium text-zinc-800">
                        {inv.planNameFa}
                      </p>
                      <p className="text-[11px] text-zinc-500">
                        {inv.billingCycle === "annual" ? "سالانه" : "ماهانه"}
                      </p>
                    </div>
                  </td>
                  <td
                    className={
                      "px-5 py-4 text-sm font-bold text-zinc-900 " +
                      (isLast ? "" : "border-b border-zinc-100")
                    }
                  >
                    {formatToman(inv.totalToman)} تومان
                  </td>
                  <td
                    className={
                      "px-5 py-4 " + (isLast ? "" : "border-b border-zinc-100")
                    }
                  >
                    <Badge variant="outline" className={badge.className}>
                      {badge.label}
                    </Badge>
                  </td>
                  <td
                    dir="ltr"
                    className={
                      "px-5 py-4 text-xs text-zinc-600 " +
                      (isLast ? "" : "border-b border-zinc-100")
                    }
                  >
                    {formatPersianDate(
                      new Date(
                        inv.status === "paid" && inv.paidAt
                          ? inv.paidAt
                          : inv.createdAt,
                      ),
                    )}
                  </td>
                  <td
                    className={
                      "px-5 py-4 text-end " +
                      (isLast ? "rounded-be-3xl" : "border-b border-zinc-100")
                    }
                  >
                    {inv.status === "unpaid" ? (
                      <Button
                        type="button"
                        size="sm"
                        className="h-9 rounded-full font-bold"
                        disabled={isPending}
                        onClick={() => pay(inv.id)}
                      >
                        {isLoading ? (
                          <Loader2Icon className="size-4 animate-spin" />
                        ) : (
                          "پرداخت"
                        )}
                      </Button>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
