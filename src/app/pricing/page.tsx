/**
 * Phase 12 — public `/pricing` page.
 *
 * Reads pricing exclusively from the `plans` registry (admin-editable)
 * via `loadPricingPlans()`. Renders:
 *
 *   - `<PricingCards>` with monthly/annual toggle.
 *   - `<PlanComparisonTable>` for the full feature × plan matrix.
 *
 * The CTA links land in two different places depending on session state
 * (authenticated → straight to billing for the current page; otherwise →
 * sign in then onboarding). This route is publicly readable.
 */
import type { Metadata, Route } from "next";
import Link from "next/link";

import { PricingCards } from "@/components/billing/pricing-cards";
import { PlanComparisonTable } from "@/components/billing/plan-comparison-table";
import { Button } from "@/components/ui/button";
import { BrandMark } from "@/components/shared/brand-mark";
import { getCurrentViewer } from "@/lib/auth/session";
import { listPagesForOwner } from "@/lib/pages";
import { loadPricingPlans } from "@/lib/pricing-registry";

export const metadata: Metadata = {
  title: "قیمت‌گذاری — کی‌یو‌آر",
  description:
    "قیمت پلن‌های رایگان، حرفه‌ای و کسب‌وکار کی‌یو‌آر. همه‌ی امکانات روی هر پلن، با چرخه‌ی پرداخت ماهانه یا سالانه.",
};

export const dynamic = "force-dynamic";

export default async function PricingRoute() {
  const [plans, viewer] = await Promise.all([
    loadPricingPlans(),
    getCurrentViewer(),
  ]);

  // Decide where the CTA on each card should link to. Authenticated users
  // get bounced to `/pro` (which resolves the page being upgraded from
  // the page-switcher cookie — clean URL, no page id leak). Everyone else
  // lands in onboarding so we always have a Free page seeded first.
  let ctaTargetForPaid: Route = "/auth";
  if (viewer) {
    const ownedPages = await listPagesForOwner(viewer.user.id);
    const firstPage = ownedPages[0];
    if (firstPage) {
      ctaTargetForPaid = "/pro" as Route;
    } else {
      ctaTargetForPaid = "/onboarding" as Route;
    }
  }

  const ctaTargetForFree: Route = viewer ? ("/me" as Route) : "/auth";

  return (
    <div dir="rtl" className="min-h-dvh bg-muted text-foreground">
      <header className="sticky top-0 z-20 border-b border-zinc-200 bg-white/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
          <BrandMark variant="wordmark" href="/" />
          <Button
            variant="outline"
            size="sm"
            render={<Link href={(viewer ? "/me" : "/auth") as Route} />}
          >
            {viewer ? "داشبورد" : "ورود"}
          </Button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 pb-20 pt-10 sm:px-6 sm:pt-16">
        <section className="mx-auto max-w-2xl space-y-3 text-center">
          <p className="text-xs font-semibold uppercase text-emerald-700">
            قیمت‌گذاری شفاف
          </p>
          <h1 className="font-heading text-3xl font-extrabold sm:text-4xl">
            پلنی که با شما رشد می‌کند
          </h1>
          <p className="text-sm leading-7 text-zinc-600 sm:text-[15px]">
            با پلن رایگان شروع کنید. هر زمان به امکانات بیشتر نیاز داشتید، ارتقا
            دهید — بدون قفل ‌شدن اطلاعات قبلی.
          </p>
        </section>

        <section className="mt-10">
          <PricingCards
            plans={plans}
            ctaFreeHref={ctaTargetForFree}
            ctaPaidHref={ctaTargetForPaid}
            isAuthenticated={Boolean(viewer)}
          />
        </section>

        <section className="mt-14 space-y-4">
          <div className="text-center">
            <h2 className="text-xl font-bold sm:text-2xl">
              مقایسه‌ی کامل امکانات
            </h2>
            <p className="mt-1 text-xs text-zinc-500">
              تک‌تک امکانات روی هر پلن — شفاف، بدون ستاره‌ی پاورقی.
            </p>
          </div>
          <PlanComparisonTable
            plans={plans.map((p) => ({
              id: p.id,
              key: p.key,
              nameFa: p.nameFa,
            }))}
          />
        </section>

        <p className="mt-10 text-center text-[11px] text-zinc-500">
          همه‌ی قیمت‌ها به تومان و بدون مالیات بر ارزش افزوده‌ی محتمل نمایش داده
          شده‌اند. مالیات در صورت اعمال در فاکتور افزوده می‌شود.
        </p>
      </main>
    </div>
  );
}
