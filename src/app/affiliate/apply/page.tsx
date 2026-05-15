/**
 * `/affiliate/apply` — gated affiliate application intake.
 *
 * Behaviour matrix (see `getAffiliateStateForUser`):
 *   - signed out                      → redirect to /auth?next=/affiliate/apply
 *   - has approved code               → redirect to /affiliate/portal
 *   - has open application (pending / needs_info)
 *                                     → redirect to /affiliate/portal?already=pending
 *   - rejected before, or never applied
 *                                     → render the form
 *
 * Form is intentionally short. Sheba/banking is collected at first
 * payout time, NOT here — friction-down per spec.
 */
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";

import { ApplyForm } from "@/app/affiliate/apply/apply-form";
import { getApplyDefaults } from "@/app/affiliate/apply/actions";
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

  const [affiliateState, defaults] = await Promise.all([
    getAffiliateStateForUser(viewer.user.id),
    getApplyDefaults(viewer.user.id),
  ]);

  if (affiliateState.kind === "approved") redirect("/affiliate/portal");
  if (
    affiliateState.kind === "pending" ||
    affiliateState.kind === "needs_info"
  ) {
    redirect("/affiliate/portal?already=pending");
  }

  return (
    <div
      dir="rtl"
      className="relative min-h-dvh bg-muted font-sans pt-[env(safe-area-inset-top)]"
    >
      {/* Floating pill navbar */}
      <div className="sticky top-4 z-30 mx-auto w-full max-w-6xl px-5">
        <header className="flex h-16 w-full items-center justify-between rounded-full bg-card pl-2 pr-5 ring-1 ring-border">
          <Link
            href="/"
            aria-label="کیوآر"
            className="flex items-center gap-2 transition-opacity hover:opacity-80"
          >
            <Image
              src="/brand/logo.svg"
              alt=""
              width={20}
              height={24}
              className="h-6 w-auto"
              priority
            />
            <span className="hidden text-lg font-bold sm:inline">کیوآر</span>
          </Link>
          <Link
            href="/affiliate"
            className="flex h-11 items-center justify-center rounded-full bg-accent px-5 text-sm font-bold text-accent-foreground transition-colors hover:bg-accent/80"
          >
            درباره همکاری در فروش
          </Link>
        </header>
      </div>

      <main className="mx-auto w-full max-w-6xl px-5 py-10 sm:py-16">
        <div className="flex flex-col items-center gap-8">
          <div className="text-center">
            <h1 className="text-[clamp(28px,4vw,42px)] font-bold leading-[1.15]">
              فرم همکاری در فروش
            </h1>
          </div>

          {/* Form card */}
          <div className="flex w-full max-w-110 flex-col gap-4">
            {affiliateState.kind === "rejected" ? (
              <div className="rounded-3xl bg-amber-50 p-4 text-[13px] leading-7 text-amber-900 ring-1 ring-amber-200">
                درخواست قبلیت رد شده بود. می‌تونی دوباره درخواست بدی.
                {affiliateState.adminNote ? (
                  <span className="mt-2 block">
                    <span className="font-bold">یادداشت تیم:</span>{" "}
                    {affiliateState.adminNote}
                  </span>
                ) : null}
              </div>
            ) : null}

            <div className="rounded-3xl bg-card p-6 sm:p-8">
              <p className="mb-6 text-[13px] font-bold text-foreground">
                اطلاعات درخواست
              </p>
              <ApplyForm
                defaultFullName={defaults.fullName}
                userPhone={viewer.user.phone}
              />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
