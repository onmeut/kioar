/**
 * Phase 12 — `/dashboard/pages/[pageId]/billing/discount`.
 *
 * Standalone screen for redeeming a discount code against this page.
 * Wraps the existing Phase 11 `<DiscountCodeInput>` client island.
 */
import Link from "next/link";
import type { Route } from "next";
import { ChevronRightIcon } from "lucide-react";
import { notFound } from "next/navigation";

import {
  DiscountCodeInput,
  type DiscountCodeInputPlan,
} from "@/components/dashboard/discount-code-input";
import { Button } from "@/components/ui/button";
import { getDb } from "@/db";
import { requireUser } from "@/lib/auth/session";
import { getOwnedPageById } from "@/lib/pages";

export const metadata = {
  title: "کد تخفیف",
};

type Params = Promise<{ pageId: string }>;

export default async function BillingDiscountRoute({
  params,
}: {
  params: Params;
}) {
  const { pageId } = await params;
  const viewer = await requireUser();
  const page = await getOwnedPageById(pageId, viewer.user.id);
  if (!page) notFound();

  const db = getDb();
  const allPlans = await db.query.plans.findMany({
    orderBy: (p, { asc }) => [asc(p.displayOrder)],
  });

  const paidPlans: DiscountCodeInputPlan[] = allPlans
    .filter((p) => p.isActive && p.key !== "free")
    .map((p) => ({
      id: p.id,
      key: p.key as "pro" | "business",
      nameFa: p.nameFa,
      priceMonthlyToman: p.priceMonthlyToman,
      priceAnnualToman: p.priceAnnualToman,
    }));

  return (
    <div className="mx-auto w-full max-w-xl space-y-6 px-4 py-6 sm:py-10">
      <div>
        <Button
          variant="ghost"
          size="sm"
          render={
            <Link
              href={`/dashboard/pages/${pageId}/billing` as Route}
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
          کد تخفیف
        </h1>
        <p className="px-2 text-xs leading-7 text-zinc-600 sm:text-sm">
          اگر کد تخفیف معتبری دارید، آن را اعمال کنید و فاکتور این صفحه را
          پرداخت کنید.
        </p>
      </header>

      {paidPlans.length === 0 ? (
        <div className="rounded-3xl bg-white p-10 text-center text-sm text-zinc-500 ring-1 ring-zinc-200">
          در حال حاضر پلن قابل خریدی فعال نیست.
        </div>
      ) : (
        <div className="rounded-3xl bg-white p-5 ring-1 ring-zinc-200 sm:p-6">
          <DiscountCodeInput pageId={pageId} plans={paidPlans} />
        </div>
      )}
    </div>
  );
}
