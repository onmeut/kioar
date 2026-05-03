"use client";

import { useActionState, useState } from "react";

import {
  adminCancelInvoiceAction,
  adminMarkInvoicePaidAction,
} from "@/app/admin/billing/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { idleState } from "@/lib/action-state";

type Props = {
  invoiceId: string;
  invoiceNumber: string;
  status: "unpaid" | "paid" | "expired" | "canceled";
};

export function InvoiceActions({ invoiceId, invoiceNumber, status }: Props) {
  const [paidOpen, setPaidOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [paidState, paidAction, paidPending] = useActionState(
    adminMarkInvoicePaidAction,
    idleState,
  );
  const [cancelState, cancelAction, cancelPending] = useActionState(
    adminCancelInvoiceAction,
    idleState,
  );

  if (status === "paid" || status === "canceled") return null;

  return (
    <div className="flex flex-wrap gap-2">
      <Dialog open={paidOpen} onOpenChange={setPaidOpen}>
        <DialogTrigger
          render={
            <Button size="sm" className="h-8 text-xs">
              ثبت پرداخت دستی
            </Button>
          }
        />
        <DialogContent className="sm:max-w-md">
          <form action={paidAction}>
            <input type="hidden" name="invoiceId" value={invoiceId} />
            <DialogHeader>
              <DialogTitle>ثبت پرداخت دستی</DialogTitle>
              <DialogDescription>
                فاکتور{" "}
                <span dir="ltr" className="font-mono">
                  {invoiceNumber}
                </span>{" "}
                پرداخت‌شده علامت می‌خورد، اشتراک به‌روزرسانی می‌شود و قابلیت‌ها
                بازسازی می‌گردند. این اقدام در گزارش ادمین ثبت می‌شود.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-4">
              <Label htmlFor={`paid-reason-${invoiceId}`}>دلیل</Label>
              <Textarea
                name="reason"
                id={`paid-reason-${invoiceId}`}
                required
                rows={3}
                placeholder="مثلاً: پرداخت کارت‌به‌کارت تاییدشده"
              />
              {paidState.status === "error" && paidState.message ? (
                <p className="text-xs text-destructive">{paidState.message}</p>
              ) : null}
            </div>
            <DialogFooter>
              <Button type="submit" disabled={paidPending}>
                {paidPending ? "در حال ثبت…" : "ثبت پرداخت"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogTrigger
          render={
            <Button size="sm" variant="outline" className="h-8 text-xs">
              لغو فاکتور
            </Button>
          }
        />
        <DialogContent className="sm:max-w-md">
          <form action={cancelAction}>
            <input type="hidden" name="invoiceId" value={invoiceId} />
            <DialogHeader>
              <DialogTitle>لغو فاکتور</DialogTitle>
              <DialogDescription>
                این فاکتور بدون اعمال هیچ تغییری روی اشتراک، لغو خواهد شد.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-4">
              <Label htmlFor={`cancel-reason-${invoiceId}`}>دلیل</Label>
              <Textarea
                name="reason"
                id={`cancel-reason-${invoiceId}`}
                required
                rows={3}
              />
              {cancelState.status === "error" && cancelState.message ? (
                <p className="text-xs text-destructive">
                  {cancelState.message}
                </p>
              ) : null}
            </div>
            <DialogFooter>
              <Button
                type="submit"
                variant="destructive"
                disabled={cancelPending}
              >
                {cancelPending ? "در حال ثبت…" : "لغو فاکتور"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
