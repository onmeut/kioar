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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
        const res = await fetch(
          `/api/billing/invoices/${invoiceId}/pay`,
          { method: "POST" },
        );
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
      <div className="rounded-2xl border bg-white p-8 text-center text-sm text-zinc-500">
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
              className="space-y-3 rounded-2xl border bg-white p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-0.5">
                  <p className="text-[11px] text-zinc-500">شماره فاکتور</p>
                  <p
                    dir="ltr"
                    className="text-sm font-semibold tracking-tight text-zinc-800"
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
                  <p className="font-medium">
                    {inv.planNameFa} ·{" "}
                    {inv.billingCycle === "annual" ? "سالانه" : "ماهانه"}
                  </p>
                </div>
                <div>
                  <p className="text-zinc-500">مبلغ</p>
                  <p className="font-semibold">
                    {formatToman(inv.totalToman)} تومان
                  </p>
                </div>
                <div>
                  <p className="text-zinc-500">تاریخ صدور</p>
                  <p dir="ltr">{formatPersianDate(new Date(inv.createdAt))}</p>
                </div>
                <div>
                  <p className="text-zinc-500">
                    {inv.status === "paid" ? "تاریخ پرداخت" : "مهلت پرداخت"}
                  </p>
                  <p dir="ltr">
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
                  className="h-11 w-full"
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

      {/* Desktop table */}
      <div className="hidden overflow-hidden rounded-2xl border bg-white lg:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-start">شماره</TableHead>
              <TableHead className="text-start">پلن</TableHead>
              <TableHead className="text-start">مبلغ</TableHead>
              <TableHead className="text-start">وضعیت</TableHead>
              <TableHead className="text-start">تاریخ</TableHead>
              <TableHead className="text-end">عملیات</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoices.map((inv) => {
              const badge = STATUS_BADGE[inv.status];
              const isLoading = pendingId === inv.id && isPending;
              return (
                <TableRow key={inv.id}>
                  <TableCell
                    dir="ltr"
                    className="font-mono text-xs text-zinc-700"
                  >
                    {persianizeNumber(inv.number)}
                  </TableCell>
                  <TableCell>
                    <div className="space-y-0.5">
                      <p className="text-sm font-medium">{inv.planNameFa}</p>
                      <p className="text-[11px] text-zinc-500">
                        {inv.billingCycle === "annual" ? "سالانه" : "ماهانه"}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm font-semibold">
                    {formatToman(inv.totalToman)} تومان
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={badge.className}>
                      {badge.label}
                    </Badge>
                  </TableCell>
                  <TableCell dir="ltr" className="text-xs text-zinc-600">
                    {formatPersianDate(
                      new Date(
                        inv.status === "paid" && inv.paidAt
                          ? inv.paidAt
                          : inv.createdAt,
                      ),
                    )}
                  </TableCell>
                  <TableCell className="text-end">
                    {inv.status === "unpaid" ? (
                      <Button
                        type="button"
                        size="sm"
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
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
