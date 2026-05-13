/**
 * Phase 12 — `/dashboard/pages/[pageId]/billing/invoices`.
 *
 * Lists every invoice for the page, newest first. The `<InvoicesTable>`
 * client island handles the per-row "پرداخت" button on `unpaid` rows
 * (re-initiates Zarinpal via `POST /api/billing/invoices/[id]/pay`).
 */
import Link from "next/link";
import type { Route } from "next";
import { desc, eq } from "drizzle-orm";
import { ChevronRightIcon } from "lucide-react";
import { notFound } from "next/navigation";

import {
  InvoicesTable,
  type InvoiceRow,
} from "@/components/billing/invoices-table";
import { Button } from "@/components/ui/button";
import { getDb } from "@/db";
import { invoices } from "@/db/schema";
import { requireUser } from "@/lib/auth/session";
import { getOwnedPageById } from "@/lib/pages";

export const metadata = {
  title: "فاکتورها",
};

type Params = Promise<{ pageId: string }>;

export default async function BillingInvoicesRoute({
  params,
}: {
  params: Params;
}) {
  const { pageId } = await params;
  const viewer = await requireUser();
  const page = await getOwnedPageById(pageId, viewer.user.id);
  if (!page) notFound();

  const db = getDb();
  const rows = await db.query.invoices.findMany({
    where: eq(invoices.pageId, pageId),
    orderBy: [desc(invoices.createdAt)],
    with: { plan: true },
  });

  const invoiceRows: InvoiceRow[] = rows.map((r) => ({
    id: r.id,
    number: r.number,
    planNameFa: r.plan.nameFa,
    billingCycle: r.billingCycle,
    totalToman: r.totalToman,
    status: r.status,
    dueAt: r.dueAt.toISOString(),
    paidAt: r.paidAt ? r.paidAt.toISOString() : null,
    createdAt: r.createdAt.toISOString(),
  }));

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-6 sm:py-10">
      <div>
        <Button
          variant="ghost"
          size="sm"
          render={
            <Link
              href={`/account/billing/${pageId}` as Route}
              className="-ms-2 h-9 gap-1 rounded-full px-3 text-xs text-zinc-500"
            />
          }
        >
          <ChevronRightIcon className="size-4" />
          بازگشت به صورت‌حساب
        </Button>
      </div>

      <header className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-2xl font-bold leading-tight text-zinc-900 sm:text-3xl">
          فاکتورها
        </h1>
        <p className="text-xs leading-6 text-zinc-500 sm:text-sm">
          سابقه‌ی صدور و پرداخت فاکتورهای مربوط به این صفحه.
        </p>
      </header>

      <InvoicesTable invoices={invoiceRows} />
    </div>
  );
}
