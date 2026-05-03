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
import { BoringAvatar } from "@/components/shared/boring-avatar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getDb } from "@/db";
import { pageSubscriptions } from "@/db/schema";
import { requireCompletedProfile } from "@/lib/auth/session";
import { resolveCurrentPageForOwner } from "@/lib/pages";
import {
  DEFAULT_PROFILE_DOMAIN,
  profileShareHost,
} from "@/lib/profile-domains";

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
    currentPlanKey: sub.plan.key as "free" | "pro" | "business",
    currentPlanId: sub.planId,
    currentBillingCycle: sub.billingCycle,
    status: sub.status,
    cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
    pendingPlanChangePlanId: sub.pendingPlanChangePlanId,
    pendingPlanChangeNameFa: sub.pendingPlanChange?.nameFa ?? null,
    trialEndsAt: sub.trialEndsAt ? sub.trialEndsAt.toISOString() : null,
    currentPeriodEnd: sub.currentPeriodEnd
      ? sub.currentPeriodEnd.toISOString()
      : null,
    options: planOptions,
  };

  const displayName =
    page.fullName?.trim() || page.title?.trim() || `/${page.slug}`;
  const shareHost = profileShareHost(
    page.slug,
    page.domain ?? DEFAULT_PROFILE_DOMAIN,
  );
  const planBadge = PLAN_BADGE[sub.plan.key as "free" | "pro" | "business"];

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 px-4 py-6 sm:py-10">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          پلن‌ها و اشتراک
        </h1>
        <p className="text-sm text-zinc-500">
          پلن این صفحه را تغییر دهید، چرخه‌ی صورت‌حساب را عوض کنید، یا اشتراک را
          لغو کنید.
        </p>
      </header>

      {/* "صفحه‌ی در حال ارتقا" card — the URL no longer contains the
       *  page id, so the user needs an unambiguous visual that names
       *  which of their pages this checkout will affect. Switching pages
       *  from the sidebar updates the cookie and re-renders this card
       *  with new context — no extra navigation required. */}
      <Card className="relative overflow-hidden border-primary/20 bg-primary/5 shadow-sm">
        <CardContent className="relative flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <div className="relative shrink-0">
              <Avatar className="size-14 ring-2 ring-background [&_svg]:size-full!">
                {page.avatarUrl ? (
                  <AvatarImage src={page.avatarUrl} alt={displayName} />
                ) : (
                  <AvatarFallback className="bg-transparent p-0">
                    <BoringAvatar seed={page.avatarSeed} size={56} />
                  </AvatarFallback>
                )}
              </Avatar>
              <Badge
                variant="outline"
                className={
                  "absolute -bottom-1 -inset-e-1 h-5 px-1.5 text-[9px] font-bold shadow-sm " +
                  planBadge.className
                }
              >
                {planBadge.label}
              </Badge>
            </div>
            <div className="min-w-0 space-y-0.5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-primary/70">
                در حال ارتقای این صفحه
              </p>
              <p className="truncate text-base font-bold sm:text-lg">
                {displayName}
              </p>
              <p
                dir="ltr"
                className="truncate text-[11px] font-medium text-zinc-500"
              >
                {shareHost}
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            render={
              <Link
                href={`/dashboard/pages/${page.id}/billing` as Route}
                className="h-9 shrink-0 self-start sm:self-auto"
              />
            }
          >
            صورت‌حساب صفحه
          </Button>
        </CardContent>
      </Card>

      <BillingActionsCard state={billingState} />

      <section className="space-y-3">
        <div>
          <h2 className="text-base font-bold">مقایسه‌ی امکانات پلن‌ها</h2>
          <p className="mt-1 text-xs text-zinc-500">
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
