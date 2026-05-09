/**
 * `/affiliate/dashboard/*` — partner portal shell.
 *
 * Distinct from the main user dashboard (`(app)/...`). Single horizontal
 * top nav, no sidebar — affiliates have a small, focused surface
 * (overview / earnings / payouts / resources / settings). All routes
 * under here require the visitor to be approved as an affiliate; if
 * they aren't we redirect to /affiliate/apply (or to /affiliate if their
 * application is still pending — that page surfaces the pending banner).
 */
import type { Metadata } from "next";
import type { Route } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { signOutAction } from "@/app/(app)/dashboard/actions";
import { BrandMark } from "@/components/shared/brand-mark";
import { AffiliateNavTabs } from "@/app/affiliate/dashboard/nav-tabs";
import { AffiliateStatusBadge } from "@/app/affiliate/dashboard/status-badge";
import { Button } from "@/components/ui/button";
import { getAffiliateStateForUser } from "@/lib/affiliate";
import { getCurrentViewer } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "پنل همکاری در فروش — کی‌یو‌آر",
};

export const dynamic = "force-dynamic";

export default async function AffiliateDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const viewer = await getCurrentViewer();
  if (!viewer?.user) {
    redirect("/auth?next=%2Faffiliate%2Fdashboard");
  }
  const state = await getAffiliateStateForUser(viewer.user.id);

  if (state.kind === "none" || state.kind === "rejected") {
    redirect("/affiliate/apply");
  }
  if (state.kind === "pending" || state.kind === "needs_info") {
    return (
      <div className="min-h-dvh bg-paper text-ink">
        <header className="border-b border-hairline bg-paper">
          <div className="marketing-shell flex h-16 items-center justify-between gap-4">
            <BrandMark variant="wordmark" href={"/affiliate" as Route} />
            <form action={signOutAction}>
              <button
                type="submit"
                className="text-[13px] font-medium text-ink-soft hover:text-ink"
              >
                خروج
              </button>
            </form>
          </div>
        </header>
        <main className="marketing-shell py-16">
          <div className="mx-auto max-w-2xl rounded-3xl border border-hairline bg-paper-soft p-8 text-center">
            <h1 className="text-[24px] font-semibold">
              {state.kind === "pending"
                ? "درخواستت در حال بررسیه"
                : "به اطلاعات بیشتر نیاز داریم"}
            </h1>
            <p className="mt-3 text-[14px] leading-7 text-ink-soft">
              {state.kind === "pending"
                ? "بعد از تأیید، پنل همکاری در فروش برات فعال می‌شه."
                : state.adminNote ||
                  "تیم ما برات پیامک می‌فرسته و ازت اطلاعات بیشتری می‌خواد."}
            </p>
            <div className="mt-6 flex justify-center gap-3">
              <Button
                variant="outline"
                size="lg"
                className="h-11 rounded-full px-6 text-[14px] font-bold"
                render={<Link href="/dashboard" />}
              >
                داشبورد اصلی
              </Button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // Approved — render full shell.
  return (
    <div className="min-h-dvh bg-paper text-ink">
      <header className="sticky top-0 z-40 border-b border-hairline bg-paper/85 backdrop-blur-md">
        <div className="marketing-shell flex h-16 items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <BrandMark variant="wordmark" href={"/affiliate" as Route} />
            <span className="hidden h-5 w-px bg-hairline sm:block" />
            <span className="hidden text-[12px] font-bold uppercaser text-violet-700 sm:block">
              همکاری در فروش
            </span>
          </div>
          <div className="flex items-center gap-3">
            <AffiliateStatusBadge status={state.affiliateStatus} />
            <Link
              href="/dashboard"
              className="text-[12px] font-medium text-ink-soft hover:text-ink"
            >
              داشبورد اصلی
            </Link>
            <form action={signOutAction}>
              <button
                type="submit"
                className="text-[12px] font-medium text-ink-soft hover:text-ink"
              >
                خروج
              </button>
            </form>
          </div>
        </div>
        <div className="border-t border-hairline">
          <div className="marketing-shell">
            <AffiliateNavTabs />
          </div>
        </div>
      </header>

      <main className="marketing-shell py-8 sm:py-10">{children}</main>
    </div>
  );
}
