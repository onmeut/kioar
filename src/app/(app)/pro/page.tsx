/**
 * `/pro` — the canonical "ارتقا پلن" surface.
 *
 * Every "ارتقا" CTA in the product (block locks, spotlight modal, promo
 * bar, billing hub, /pricing) routes here. Unlike the previous version,
 * this route renders the full plan-picker inline and does NOT redirect
 * to a per-page URL containing the page id — the URL stays clean (`/pro`)
 * and the route resolves the page being upgraded from the page-switcher
 * cookie (or the user's first page as a stable fallback).
 *
 * The page being upgraded is identified visually in a "صفحه‌ی در حال
 * ارتقا" card under the title so the owner always knows which of their
 * pages this checkout flow will affect — switching pages from the
 * sidebar updates the cookie and re-renders this same URL with the new
 * context, no per-page route required.
 */
import Link from "next/link";
import type { Route } from "next";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";

import {
  BillingActionsCard,
  type BillingActionsState,
  type BillingPlanOption,
} from "@/components/dashboard/billing-actions-card";
import { PlanComparisonTable } from "@/components/billing/plan-comparison-table";
import { BrandMark } from "@/components/shared/brand-mark";
import { KioarAvatar } from "@/components/shared/kioar-avatar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getDb } from "@/db";
import { pageSubscriptions } from "@/db/schema";
import { requireCompletedProfile } from "@/lib/auth/session";
import { resolveCurrentPageForOwner } from "@/lib/pages";

export const metadata = {
  title: "ارتقا پلن",
};

const PLAN_BADGE: Record<
  "free" | "pro" | "business",
  { label: string; className: string }
> = {
  free: {
    label: "رایگان",
    className: "border-zinc-200 bg-zinc-50 text-zinc-600",
  },
  pro: {
    label: "حرفه‌ای",
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
  },
  business: {
    label: "کسب‌وکار",
    className: "border-purple-200 bg-purple-50 text-purple-700",
  },
};

export default async function ProRoute() {
  const viewer = await requireCompletedProfile();
  const page = await resolveCurrentPageForOwner(viewer.user.id);
  if (!page) {
    // No pages yet — bounce through onboarding so we always have a
    // subscription row to work with.
    redirect("/onboarding");
  }

  const db = getDb();
  const [sub, allPlans] = await Promise.all([
    db.query.pageSubscriptions.findFirst({
      where: eq(pageSubscriptions.pageId, page.id),
      with: { plan: true, pendingPlanChange: true },
    }),
    db.query.plans.findMany({
      orderBy: (p, { asc }) => [asc(p.displayOrder)],
    }),
  ]);
  if (!sub) {
    // Subscription should always exist for an owned page; if it doesn't,
    // send the owner back to dashboard rather than crashing.
    redirect("/dashboard");
  }

  const activePlans = allPlans.filter((p) => p.isActive);

  // ── Effective subscription state ─────────────────────────────────────────
  // The billing cron may not have run yet (especially in dev/staging), so the
  // DB can still show status="trialing" even though trial_ends_at is in the
  // past. We must NOT trust raw DB status for UI decisions — compute the
  // effective state the same way `listOwnedPagesWithPlan` does.
  const now = new Date();
  const isActivelyTrialing =
    sub.status === "trialing" &&
    sub.trialEndsAt != null &&
    sub.trialEndsAt > now;
  const isEffectivelyFree =
    sub.status === "expired" ||
    sub.status === "canceled" ||
    (sub.status === "trialing" && !isActivelyTrialing);

  const effectivePlanKey: "free" | "pro" | "business" = isEffectivelyFree
    ? "free"
    : (sub.plan.key as "free" | "pro" | "business");
  // Use "expired" so BillingActionsCard treats the user as a free/upgrade
  // candidate rather than still-trialing. For all other statuses keep as-is.
  const effectiveStatus =
    isEffectivelyFree && sub.status === "trialing"
      ? ("expired" as const)
      : sub.status;
  // When effectively free, point currentPlanId at the free plan row so the
  // Free card highlights as "پلن فعلی" in the picker.
  const effectivePlan = isEffectivelyFree
    ? (allPlans.find((p) => p.key === "free") ?? sub.plan)
    : sub.plan;

  const planOptions: BillingPlanOption[] = activePlans.map((p) => ({
    id: p.id,
    key: p.key as "free" | "pro" | "business",
    nameFa: p.nameFa,
    descriptionFa: p.descriptionFa,
    priceMonthlyToman: p.priceMonthlyToman,
    priceAnnualToman: p.priceAnnualToman,
  }));

  const billingState: BillingActionsState = {
    pageId: page.id,
    currentPlanKey: effectivePlanKey,
    currentPlanId: effectivePlan.id,
    currentBillingCycle: sub.billingCycle,
    status: effectiveStatus,
    pendingPlanChangePlanId: sub.pendingPlanChangePlanId,
    pendingPlanChangeNameFa: sub.pendingPlanChange?.nameFa ?? null,
    // Only pass trialEndsAt while the trial is still live so the card
    // doesn't surface a stale past date in the "پایان دوره" banner.
    trialEndsAt:
      isActivelyTrialing && sub.trialEndsAt
        ? sub.trialEndsAt.toISOString()
        : null,
    currentPeriodEnd: sub.currentPeriodEnd
      ? sub.currentPeriodEnd.toISOString()
      : null,
    options: planOptions,
  };

  const displayName =
    page.fullName?.trim() || page.title?.trim() || `/${page.slug}`;
  const planBadge = PLAN_BADGE[effectivePlanKey];

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 px-4 py-6 sm:py-10">
      {/* Header — matches the trial-claim screen aesthetic. */}
      <header className="flex flex-col items-center gap-5 text-center">
        <BrandMark variant="mark" className="size-12" />
        <div className="flex flex-col gap-3">
          <h1 className="text-3xl font-bold leading-tight text-zinc-900 sm:text-4xl">
            پلن‌ها و اشتراک
          </h1>
          <p className="px-2 text-sm leading-7 text-zinc-600 sm:text-[15px]">
            پلن این صفحه را تغییر دهید یا چرخه‌ی صورت‌حساب را عوض کنید.
          </p>
        </div>
      </header>

      {/* Page identity card — shows which page this checkout affects. */}
      <section className="rounded-3xl bg-white p-5 ring-1 ring-zinc-200">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <Avatar className="size-14 shrink-0 rounded-2xl ring-2 ring-background [&_svg]:size-full!">
              {page.avatarUrl ? (
                <AvatarImage src={page.avatarUrl} alt={displayName} />
              ) : (
                <AvatarFallback className="bg-transparent p-0">
                  <KioarAvatar seed={page.avatarSeed} size={56} />
                </AvatarFallback>
              )}
            </Avatar>
            <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
              <p className="truncate text-xl font-bold text-zinc-900 sm:text-2xl">
                {displayName}
              </p>
              <Badge
                variant="outline"
                className={
                  "h-6 px-2 text-[11px] font-bold " + planBadge.className
                }
              >
                {isActivelyTrialing ? `پلن فعلی · آزمایشی` : planBadge.label}
              </Badge>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-10 shrink-0 self-start rounded-full sm:self-auto"
            render={
              <Link href={`/dashboard/pages/${page.id}/billing` as Route} />
            }
          >
            صورت‌حساب صفحه
          </Button>
        </div>
      </section>

      <BillingActionsCard state={billingState} />

      <section className="space-y-3 pt-6 sm:pt-10">
        <div className="flex flex-col items-center gap-2 pb-2 text-center sm:gap-3 sm:pb-4">
          <h2 className="text-xl font-bold text-zinc-900 sm:text-2xl">
            مقایسه‌ی امکانات پلن‌ها
          </h2>
          <p className="text-xs leading-6 text-zinc-500 sm:text-sm">
            همه‌ی امکانات از تنظیمات پلن خوانده می‌شود.
          </p>
        </div>
        <PlanComparisonTable
          plans={activePlans.map((p) => ({
            id: p.id,
            key: p.key as "free" | "pro" | "business",
            nameFa: p.nameFa,
          }))}
        />
      </section>
    </div>
  );
}
