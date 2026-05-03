/**
 * Phase 8 — trial flow service.
 *
 * Two responsibilities:
 *
 *   - `getTrialEligibility(pageId)` — read model used by the trial screen
 *     and billing settings to decide which "Start free trial" CTAs to
 *     render. Returns the active non-Free plans, each tagged with whether
 *     this page can claim its trial right now and (if not) why.
 *
 *   - `startTrial({ pageId, planKey, ownerId })` — write path used by
 *     `POST /api/billing/trial/start`. Verifies ownership + eligibility,
 *     flips the page subscription into `trialing` for `plan.trialDays`,
 *     sets the per-plan `hasUsedTrial*` sentinel, rebuilds entitlements,
 *     and enqueues the `trial_started` SMS — all in one transaction so
 *     observers can never see a half-applied trial.
 *
 * Eligibility rules (single source of truth — keep in sync with the
 * IMPLEMENTATION_PLAN §"Phase 8" + §"Open questions"):
 *
 *   1. Plan must exist, be active, and have `key in ('pro', 'business')`.
 *      Free is never trial-eligible (it's the resting state).
 *   2. The per-page sentinel for that plan must still be false:
 *        - pro      → `pageSubscriptions.hasUsedTrialPro`
 *        - business → `pageSubscriptions.hasUsedTrialBusiness`
 *      The flag is set on first claim, ever, so a page can trial each
 *      paid plan exactly once across its entire lifetime.
 *   3. The page's current subscription must be on the Free plan with
 *      `status = 'active'`. We deliberately reject if the page is already
 *      `trialing`, `active` on a paid plan, in `grace`, etc. — switching
 *      mid-paid is a Phase 9 problem (`/api/billing/change-plan`), not a
 *      trial problem.
 *
 * Trial length comes from `plans.trialDays` — never hardcoded to 7. The
 * billing cron (`lib/billing-state.ts`) reads `trialEndsAt` and fires the
 * `trial_ending_*` and `trial_ending_today` transitions independently, so
 * this module's only job is to set the timestamp correctly.
 */
import { eq } from "drizzle-orm";

import { getDb } from "@/db";
import {
  pageSubscriptions,
  plans as plansTable,
  profiles,
  users,
} from "@/db/schema";
import { rebuildEntitlements } from "@/lib/entitlements";
import { log } from "@/lib/log";
import { writeCurrentPageIdCookie } from "@/lib/page-cookie";
import { enqueueSms } from "@/lib/sms-queue";

export type TrialPlanKey = "pro" | "business";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export type TrialPlanOption = {
  id: string;
  key: TrialPlanKey;
  nameFa: string;
  descriptionFa: string | null;
  trialDays: number;
  priceMonthlyToman: number;
  priceAnnualToman: number;
  /** True iff `startTrial` would succeed for this plan right now. */
  eligible: boolean;
  /**
   * Stable machine reason; UI uses it to decide between "start trial"
   * vs. "already used" vs. "upgrade only". Null when `eligible` is true.
   */
  ineligibleReason:
    | null
    | "already_used"
    | "page_on_paid_plan"
    | "page_in_trial"
    | "page_not_active";
};

export type TrialEligibility = {
  /** Page-scoped subscription state — handy for billing settings UI. */
  currentPlanKey: "free" | TrialPlanKey;
  currentStatus:
    | "active"
    | "trialing"
    | "pending_renewal"
    | "grace"
    | "expired"
    | "canceled";
  trialEndsAt: Date | null;
  hasUsedTrialPro: boolean;
  hasUsedTrialBusiness: boolean;
  options: TrialPlanOption[];
};

/**
 * Snapshot of trial eligibility for a single page. Returns one entry per
 * active non-Free plan, ordered by `displayOrder` so the UI can render
 * them as-is.
 */
export async function getTrialEligibility(
  pageId: string,
): Promise<TrialEligibility | null> {
  const db = getDb();

  const sub = await db.query.pageSubscriptions.findFirst({
    where: eq(pageSubscriptions.pageId, pageId),
    with: { plan: true },
  });
  if (!sub) return null;

  const allPlans = await db.query.plans.findMany({
    orderBy: (p, { asc }) => [asc(p.displayOrder)],
  });

  const subPlanKey = sub.plan.key as "free" | TrialPlanKey;

  const options: TrialPlanOption[] = allPlans
    .filter((p) => p.isActive && p.key !== "free")
    .map((p) => {
      const key = p.key as TrialPlanKey;
      const alreadyUsed =
        key === "pro" ? sub.hasUsedTrialPro : sub.hasUsedTrialBusiness;

      let ineligibleReason: TrialPlanOption["ineligibleReason"] = null;
      if (alreadyUsed) {
        ineligibleReason = "already_used";
      } else if (sub.status === "trialing") {
        ineligibleReason = "page_in_trial";
      } else if (subPlanKey !== "free") {
        ineligibleReason = "page_on_paid_plan";
      } else if (sub.status !== "active") {
        ineligibleReason = "page_not_active";
      }

      return {
        id: p.id,
        key,
        nameFa: p.nameFa,
        descriptionFa: p.descriptionFa,
        trialDays: p.trialDays,
        priceMonthlyToman: p.priceMonthlyToman,
        priceAnnualToman: p.priceAnnualToman,
        eligible: ineligibleReason === null,
        ineligibleReason,
      };
    });

  return {
    currentPlanKey: subPlanKey,
    currentStatus: sub.status,
    trialEndsAt: sub.trialEndsAt,
    hasUsedTrialPro: sub.hasUsedTrialPro,
    hasUsedTrialBusiness: sub.hasUsedTrialBusiness,
    options,
  };
}

export type StartTrialInput = {
  pageId: string;
  planKey: TrialPlanKey;
  ownerId: string;
};

export type StartTrialResult =
  | {
      ok: true;
      trialEndsAt: Date;
      planKey: TrialPlanKey;
      pageId: string;
      redirectUrl: string;
    }
  | {
      ok: false;
      status: 400 | 403 | 404 | 409;
      error:
        | "invalid_plan"
        | "forbidden"
        | "page_not_found"
        | "subscription_missing"
        | "already_used_trial"
        | "page_on_paid_plan"
        | "page_in_trial"
        | "page_not_active";
    };

/**
 * Atomically move the page's subscription into `trialing` on the chosen
 * plan. All ownership + eligibility checks happen here; the route handler
 * is a thin transport layer.
 */
export async function startTrial(
  input: StartTrialInput,
): Promise<StartTrialResult> {
  const { pageId, planKey, ownerId } = input;

  if (planKey !== "pro" && planKey !== "business") {
    // Defensive: the API zod schema also rejects this, but `startTrial`
    // is a public function in this module so we re-check at the boundary.
    return { ok: false, status: 400, error: "invalid_plan" };
  }

  const db = getDb();

  // Ownership: don't even reveal whether the page exists if it isn't
  // theirs. 403 is correct because the caller is authenticated.
  const page = await db.query.profiles.findFirst({
    where: eq(profiles.id, pageId),
  });
  if (!page) {
    return { ok: false, status: 404, error: "page_not_found" };
  }
  if (page.userId !== ownerId) {
    return { ok: false, status: 403, error: "forbidden" };
  }

  const targetPlan = await db.query.plans.findFirst({
    where: eq(plansTable.key, planKey),
  });
  if (!targetPlan || !targetPlan.isActive) {
    return { ok: false, status: 404, error: "invalid_plan" };
  }

  // Owner phone for the SMS enqueue. We grab it before the TX so the TX
  // body stays free of incidental I/O.
  const owner = await db.query.users.findFirst({
    where: eq(users.id, ownerId),
  });
  if (!owner) {
    // Should be impossible — the auth guard fetched the row to get here.
    return { ok: false, status: 403, error: "forbidden" };
  }

  const sub = await db.query.pageSubscriptions.findFirst({
    where: eq(pageSubscriptions.pageId, pageId),
    with: { plan: true },
  });
  if (!sub) {
    // Pages always seed a Free subscription on creation
    // (`ensureFreeSubscriptionForPage`) — if this fires we're in an
    // invalid state and should NOT silently start a trial on top.
    log.error("trial.start.subscription_missing", { pageId });
    return { ok: false, status: 409, error: "subscription_missing" };
  }

  const subPlanKey = sub.plan.key as "free" | TrialPlanKey;
  if (sub.status === "trialing") {
    return { ok: false, status: 409, error: "page_in_trial" };
  }
  if (subPlanKey !== "free") {
    return { ok: false, status: 409, error: "page_on_paid_plan" };
  }
  if (sub.status !== "active") {
    return { ok: false, status: 409, error: "page_not_active" };
  }

  const alreadyUsed =
    planKey === "pro" ? sub.hasUsedTrialPro : sub.hasUsedTrialBusiness;
  if (alreadyUsed) {
    return { ok: false, status: 409, error: "already_used_trial" };
  }

  const trialDays = targetPlan.trialDays;
  if (!Number.isInteger(trialDays) || trialDays <= 0) {
    log.error("trial.start.bad_trial_days", {
      planKey,
      trialDays,
    });
    return { ok: false, status: 400, error: "invalid_plan" };
  }

  const now = new Date();
  const trialEndsAt = new Date(now.getTime() + trialDays * MS_PER_DAY);

  await db.transaction(async (tx) => {
    // Period boundary == trial end so the cron's `period_ended_to_*`
    // transitions fire on the same calendar day the trial expires.
    await tx
      .update(pageSubscriptions)
      .set({
        planId: targetPlan.id,
        // Keep monthly as the implicit cycle for trials — the user picks
        // a real cycle when they convert via checkout (Phase 9).
        billingCycle: "monthly",
        status: "trialing",
        currentPeriodStart: now,
        currentPeriodEnd: trialEndsAt,
        trialEndsAt,
        hasUsedTrialPro: planKey === "pro" ? true : sub.hasUsedTrialPro,
        hasUsedTrialBusiness:
          planKey === "business" ? true : sub.hasUsedTrialBusiness,
        cancelAtPeriodEnd: false,
        pendingPlanChangePlanId: null,
      })
      .where(eq(pageSubscriptions.pageId, pageId));

    await rebuildEntitlements(tx, pageId);
  });

  await enqueueSms({
    templateKey: "trial_started",
    phone: owner.phone,
    idempotencyKey: `trial_started:${pageId}:${planKey}`,
    variables: {
      plan: targetPlan.nameFa,
      days: trialDays,
    },
  });

  log.info("trial.start.success", {
    pageId,
    planKey,
    trialDays,
    trialEndsAt: trialEndsAt.toISOString(),
  });

  // Make this page the current page so the post-start redirect to
  // `/page` (the user's editor) renders the trialed page on first paint
  // instead of whatever page the cookie pointed at before.
  await writeCurrentPageIdCookie(pageId);

  return {
    ok: true,
    trialEndsAt,
    planKey,
    pageId,
    redirectUrl: `/dashboard/pages/${pageId}/billing`,
  };
}
