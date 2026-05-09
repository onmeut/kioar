/**
 * `/affiliate/apply` — gated affiliate application intake.
 *
 * Behaviour matrix (see `getAffiliateStateForUser`):
 *   - signed out                      → redirect to /auth?next=/affiliate/apply
 *   - has approved code               → redirect to /affiliate/dashboard
 *   - has open application (pending / needs_info)
 *                                     → redirect to /affiliate/dashboard?already=pending
 *   - rejected before, or never applied
 *                                     → render the form
 *
 * Form is intentionally short. Sheba/banking is collected at first
 * payout time, NOT here — friction-down per spec.
 */
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { ApplyForm } from "@/app/affiliate/apply/apply-form";
import { getApplyDefaults } from "@/app/affiliate/apply/actions";
import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";
import { getAffiliateStateForUser } from "@/lib/affiliate";
import { getCurrentViewer } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "درخواست همکاری در فروش — کی‌یو‌آر",
  description: "فرم درخواست برنامه‌ی همکاری در فروش کی‌یو‌آر.",
};

export const dynamic = "force-dynamic";

export default async function AffiliateApplyPage() {
  const viewer = await getCurrentViewer();
  if (!viewer?.user) {
    redirect("/auth?next=%2Faffiliate%2Fapply");
  }

  const state = await getAffiliateStateForUser(viewer.user.id);
  if (state.kind === "approved") redirect("/affiliate/dashboard");
  if (state.kind === "pending" || state.kind === "needs_info") {
    redirect("/affiliate/dashboard?already=pending");
  }

  const defaults = await getApplyDefaults(viewer.user.id);

  return (
    <div className="min-h-dvh bg-paper text-ink">
      <SiteHeader />
      <main className="marketing-shell py-10 sm:py-16">
        <div className="mx-auto max-w-2xl">
          <p className="text-[11px] font-bold uppercaser text-violet-700">
            درخواست همکاری در فروش
          </p>
          <h1 className="mt-2 text-[clamp(28px,5vw,40px)] font-semibold leading-[1.1]">
            یه فرم کوتاه پر کن — تیم ما همون روز جواب می‌ده
          </h1>
          <p className="mt-3 text-[14px] leading-7 text-ink-soft">
            شماره موبایلت از قبل توی حسابت ثبته. اطلاعات بانکی بعداً موقع اولین
            تسویه ازت می‌گیریم — الان لازم نیست.
          </p>

          {state.kind === "rejected" ? (
            <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50/70 p-4 text-[13px] leading-7 text-amber-900">
              درخواست قبلیت رد شده بود. می‌تونی دوباره درخواست بدی.
              {state.adminNote ? (
                <span className="mt-2 block">
                  <span className="font-bold">یادداشت تیم:</span>{" "}
                  {state.adminNote}
                </span>
              ) : null}
            </div>
          ) : null}

          <div className="mt-8">
            <ApplyForm
              defaultFullName={defaults.fullName}
              userPhone={viewer.user.phone}
            />
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
