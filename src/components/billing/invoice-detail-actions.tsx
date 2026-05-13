"use client";

/**
 * "Pay again" CTA for the invoice detail page. Mirrors the inline action
 * in `<InvoicesTable>` but rendered as a full-width primary button.
 */

import { useState, useTransition } from "react";
import { Loader2Icon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

type Props = {
  invoiceId: string;
};

export function InvoiceDetailActions({ invoiceId }: Props) {
  const [isPending, startTransition] = useTransition();
  const [working, setWorking] = useState(false);

  const pay = () => {
    setWorking(true);
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
          setWorking(false);
          return;
        }
        const redirectUrl = (data as { redirectUrl: string }).redirectUrl;
        window.location.href = redirectUrl;
      } catch (err) {
        toast.error(`ارتباط با سرور برقرار نشد: ${(err as Error).message}`);
        setWorking(false);
      }
    });
  };

  const isBusy = isPending || working;

  return (
    <Button
      type="button"
      onClick={pay}
      disabled={isBusy}
      className="h-12 w-full text-sm font-bold"
    >
      {isBusy ? (
        <Loader2Icon className="size-4 animate-spin" aria-hidden />
      ) : null}
      پرداخت فاکتور
    </Button>
  );
}
