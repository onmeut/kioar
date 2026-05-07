/**
 * Phase 12 — `/dashboard/pages/[pageId]/billing/cancel`.
 *
 * Confirmation screen for cancelling the page's paid subscription.
 * Spells out end-of-period semantics in Persian, requires an explicit
 * checkbox before enabling the cancel button, and surfaces "reactivate"
 * if the user lands here already-cancelled.
 */
import Link from "next/link";
import type { Route } from "next";
import { eq } from "drizzle-orm";
import { ChevronRightIcon, ShieldAlertIcon } from "lucide-react";
import { notFound, redirect } from "next/navigation";

import { CancelConfirmActions } from "@/components/billing/cancel-confirm-actions";
import { Button } from "@/components/ui/button";
import { getDb } from "@/db";
import { pageSubscriptions } from "@/db/schema";
import { requireUser } from "@/lib/auth/session";
import { getOwnedPageById } from "@/lib/pages";
import { formatPersianDate } from "@/lib/persian";

export const metadata = {
  title: "لغو اشتراک",
};

type Params = Promise<{ pageId: string }>;

export default async function BillingCancelRoute({
  params,
}: {
  params: Params;
}) {
  const { pageId } = await params;
  const viewer = await requireUser();
  const page = await getOwnedPageById(pageId, viewer.user.id);
  if (!page) notFound();

  const db = getDb();
  const sub = await db.query.pageSubscriptions.findFirst({
    where: eq(pageSubscriptions.pageId, pageId),
    with: { plan: true },
  });
  if (!sub) notFound();

  // Free plan has nothing to cancel — bounce back.
  if (sub.plan.key === "free") {
    redirect(`/dashboard/pages/${pageId}/billing` as Route);
  }

  const periodEnd = sub.trialEndsAt ?? sub.currentPeriodEnd;
  const periodEndLabel = periodEnd ? formatPersianDate(periodEnd) : null;
  const alreadyCancelled = sub.cancelAtPeriodEnd;
  const backHref = `/dashboard/pages/${pageId}/billing` as Route;

  return (
    <div className="mx-auto w-full max-w-xl space-y-6 px-4 py-6 sm:py-10">
      <div>
        <Button
          variant="ghost"
          size="sm"
          render={
            <Link
              href={backHref}
              className="-ms-2 h-9 gap-1 rounded-full px-3 text-xs text-zinc-500"
            />
          }
        >
          <ChevronRightIcon className="size-4" />
          بازگشت به صورت‌حساب
        </Button>
      </div>

      <header className="flex flex-col items-center gap-3 text-center">
        <span className="flex size-14 items-center justify-center rounded-full bg-amber-100 text-amber-700">
          <ShieldAlertIcon className="size-6" />
        </span>
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold leading-tight text-zinc-900 sm:text-3xl">
            {alreadyCancelled
              ? `اشتراک ${sub.plan.nameFa} در حال لغو است`
              : `لغو اشتراک ${sub.plan.nameFa}`}
          </h1>
          <p className="px-2 text-xs leading-7 text-zinc-600 sm:text-sm">
            {alreadyCancelled
              ? "می‌توانید اشتراک را پیش از پایان دوره دوباره فعال کنید."
              : "پیش از تأیید، آنچه را که با لغو از دست می‌دهید مرور کنید."}
          </p>
        </div>
      </header>

      <section className="rounded-3xl bg-white p-5 ring-1 ring-zinc-200 sm:p-6">
        <ul className="space-y-3 rounded-2xl bg-zinc-50 p-4 text-[13px] leading-7 text-zinc-700">
          <li>
            <span className="font-bold text-zinc-900">تا پایان دوره:</span>{" "}
            همه‌ی امکانات پلن فعلی همچنان روی این صفحه فعال هستند.
          </li>
          <li>
            <span className="font-bold text-zinc-900">در پایان دوره:</span> صفحه
            به پلن رایگان منتقل می‌شود و امکانات پولی به‌صورت قفل‌شده نمایش داده
            می‌شوند (بدون حذف اطلاعات).
          </li>
          <li>
            <span className="font-bold text-zinc-900">قابل بازگشت:</span> تا پیش
            از پایان دوره می‌توانید لغو را خنثی کنید و اشتراک شما به همان شکل
            ادامه می‌یابد.
          </li>
          {periodEndLabel ? (
            <li>
              <span className="font-bold text-zinc-900">تاریخ اعمال لغو:</span>{" "}
              <span dir="ltr" className="font-bold">
                {periodEndLabel}
              </span>
            </li>
          ) : null}
        </ul>

        <div className="mt-5">
          <CancelConfirmActions
            pageId={pageId}
            alreadyCancelled={alreadyCancelled}
            postCancelHref={backHref}
          />
        </div>
      </section>
    </div>
  );
}
