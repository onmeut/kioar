import "server-only";

import { and, eq, isNull } from "drizzle-orm";

import { getDb } from "@/db";
import {
  cardEntitlements,
  cardOrders,
  pageSubscriptions,
  plans,
} from "@/db/schema";
import { invalidateProfileCacheById } from "@/lib/cache/profile-cache";
import { getCardStudioSettings } from "@/lib/cards/settings";
import { rebuildEntitlements } from "@/lib/entitlements";
import { log } from "@/lib/log";

/**
 * Phase 5 — plans ↔ cards gifting.
 *
 * Two directions, both idempotent:
 *   - `grantCardEntitlementForSubscription` — a yearly Pro/Business purchase
 *     grants a free card (colorful/metal per settings). Records a redeemable
 *     `card_entitlements` row; the user completes a free card order to redeem.
 *   - `grantPlanYearForCardPurchase` — a paid card order grants 1 year of the
 *     configured plan tier to the buyer's page.
 *
 * No hardcoded tiers/materials — everything reads from `app_settings` via
 * `getCardStudioSettings()`.
 */

const PLAN_RANK: Record<string, number> = { free: 0, pro: 1, business: 2 };

function addOneYear(from: Date): Date {
  const d = new Date(from);
  d.setUTCFullYear(d.getUTCFullYear() + 1);
  return d;
}

/**
 * Grant a redeemable free-card entitlement for a yearly subscription purchase.
 *
 * @param sourceKey idempotency key, e.g. `invoice:{invoiceId}` — a UNIQUE
 *   constraint guarantees a single purchase grants at most one card.
 */
export async function grantCardEntitlementForSubscription(params: {
  pageId: string;
  userId: string;
  planKey: "pro" | "business";
  sourceKey: string;
}): Promise<{ granted: boolean }> {
  const settings = await getCardStudioSettings();
  if (!settings.offerPlanGrantsCard) return { granted: false };

  const material = settings.planGrantsMaterial[params.planKey];
  const source = params.planKey === "business" ? "gift_business" : "gift_pro";

  const db = getDb();
  // Idempotent insert — ON CONFLICT on the unique source_key does nothing.
  const inserted = await db
    .insert(cardEntitlements)
    .values({
      pageId: params.pageId,
      userId: params.userId,
      material,
      source,
      sourceKey: params.sourceKey,
    })
    .onConflictDoNothing({ target: cardEntitlements.sourceKey })
    .returning({ id: cardEntitlements.id });

  const granted = inserted.length > 0;
  if (granted) {
    log.info("card_entitlement.granted", {
      pageId: params.pageId,
      planKey: params.planKey,
      material,
      sourceKey: params.sourceKey,
    });
  }
  return { granted };
}

/**
 * Grant 1 year of the configured plan tier to the buyer's page after a paid
 * card order. Idempotent on the order id (we stamp nothing extra — re-running
 * with an already-applied order is a no-op because the order's grant marker is
 * the order's own paid state + this guard).
 *
 * Conservative: never downgrades an active higher tier; extends the period by
 * one year from max(now, currentPeriodEnd).
 */
export async function grantPlanYearForCardPurchase(
  orderId: string,
): Promise<{ granted: boolean }> {
  const settings = await getCardStudioSettings();
  if (!settings.offerCardGrantsPlan) return { granted: false };

  // NOTE: not a feature gate. `purchaseGrantsPlan` is an admin-configured
  // setting naming WHICH plan a card purchase grants. "free" is the sentinel
  // for "no plan gift", so we bail. (Feature visibility still goes through
  // pageHasFeature elsewhere — this is subscription provisioning.)
  const targetPlanKey = settings.purchaseGrantsPlan;
  if (targetPlanKey === "free") return { granted: false };

  const db = getDb();
  const order = await db.query.cardOrders.findFirst({
    where: eq(cardOrders.id, orderId),
  });
  if (!order || order.status === "cancelled") return { granted: false };

  const targetPlan = await db.query.plans.findFirst({
    where: eq(plans.key, targetPlanKey),
  });
  if (!targetPlan) return { granted: false };

  const sub = await db.query.pageSubscriptions.findFirst({
    where: eq(pageSubscriptions.pageId, order.pageId),
  });
  if (!sub) return { granted: false };

  // Don't downgrade an active, non-expired higher tier.
  const now = new Date();
  const currentRank = PLAN_RANK[sub.planKey ?? "free"] ?? 0;
  const targetRank = PLAN_RANK[targetPlanKey] ?? 0;
  const subActive =
    sub.status === "active" || sub.status === "trialing";
  const periodLive = sub.currentPeriodEnd && sub.currentPeriodEnd > now;

  // Extend from the later of now / current period end so we never shorten an
  // existing paid period.
  const base =
    periodLive && sub.currentPeriodEnd ? sub.currentPeriodEnd : now;
  const newPeriodEnd = addOneYear(base);

  // If they're already on a higher tier that's live, just extend the period at
  // their current (higher) plan rather than dropping them to the gift tier.
  const keepCurrentHigher = subActive && periodLive && currentRank > targetRank;
  const planId = keepCurrentHigher ? sub.planId : targetPlan.id;
  const planKey = keepCurrentHigher ? sub.planKey : targetPlanKey;

  await db.transaction(async (tx) => {
    await tx
      .update(pageSubscriptions)
      .set({
        planId,
        planKey,
        billingCycle: "annual",
        status: "active",
        currentPeriodStart: now,
        currentPeriodEnd: newPeriodEnd,
        cancelAtPeriodEnd: false,
      })
      .where(eq(pageSubscriptions.pageId, order.pageId));
    await rebuildEntitlements(tx, order.pageId);
  });

  await invalidateProfileCacheById(order.pageId);

  log.info("card_order.plan_granted", {
    orderId,
    pageId: order.pageId,
    planKey,
    newPeriodEnd: newPeriodEnd.toISOString(),
  });
  return { granted: true };
}

/** Unredeemed gift card entitlements for a user (studio "redeem" surface). */
export async function getRedeemableCardEntitlements(userId: string) {
  const db = getDb();
  return db
    .select()
    .from(cardEntitlements)
    .where(
      and(
        eq(cardEntitlements.userId, userId),
        isNull(cardEntitlements.redeemedAt),
      ),
    );
}
