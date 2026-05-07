/**
 * Phase 5 — subscription price-lock resolver.
 *
 * `subscription_price_locks` snapshots a (page, plan) pair to a fixed
 * pair of monthly/annual toman prices, set when an admin grandfathered
 * an existing subscriber after a plan-price change. The lock takes
 * precedence over `plans.price_*_toman` for both renewal invoice
 * generation and any pre-purchase price preview.
 *
 * Manual plan changes (admin moving a page off plan X) automatically
 * drop the lock — see `dropPriceLockForPage` and the call site in
 * `admin/billing/actions.ts`. A user-initiated checkout for a different
 * plan does NOT drop the lock; locks are scoped to (page, plan), so a
 * lock for the OLD plan is harmless once the page moves on.
 */

import { and, eq } from "drizzle-orm";

import { type Database, getDb } from "@/db";
import { subscriptionPriceLocks } from "@/db/schema";

export type PriceLockRow = {
  pageId: string;
  planId: string;
  billingCycle: "monthly" | "annual" | null;
  lockedMonthlyToman: number;
  lockedAnnualToman: number;
  reason: string | null;
  lockedAt: Date;
};

/** Plan-shaped fragment that pricing math operates on. */
export type PlanPriceShape = {
  id: string;
  priceMonthlyToman: number;
  priceAnnualToman: number;
};

/**
 * Load the lock for (pageId, planId). When a lock exists for a different
 * plan than the one being purchased, it does NOT apply — locks are
 * keyed on plan, by design.
 */
export async function loadPriceLock(
  db: Database,
  pageId: string,
  planId: string,
): Promise<PriceLockRow | null> {
  const row = await db.query.subscriptionPriceLocks.findFirst({
    where: and(
      eq(subscriptionPriceLocks.pageId, pageId),
      eq(subscriptionPriceLocks.planId, planId),
    ),
  });
  return row ?? null;
}

/**
 * Return a plan-priced shape with the lock's prices substituted in.
 * Pure: no DB call. Pass `null` to get the original plan back.
 *
 * If `lock.billingCycle` is non-null and != the cycle being priced,
 * we still return the lock's prices for whichever cycle column is set
 * (locks always carry both columns at insert time). Bookkeeping for the
 * dual-cycle case lives in the admin grandfather path.
 */
export function applyPriceLock<P extends PlanPriceShape>(
  plan: P,
  lock: PriceLockRow | null,
): P {
  if (!lock) return plan;
  return {
    ...plan,
    priceMonthlyToman: lock.lockedMonthlyToman,
    priceAnnualToman: lock.lockedAnnualToman,
  };
}

/**
 * Convenience: load+apply in one call.
 */
export async function resolveEffectivePlan<P extends PlanPriceShape>(
  pageId: string,
  plan: P,
  db: Database = getDb(),
): Promise<{ plan: P; lock: PriceLockRow | null }> {
  const lock = await loadPriceLock(db, pageId, plan.id);
  return { plan: applyPriceLock(plan, lock), lock };
}

/**
 * Drop a lock for (pageId). Used by manual-plan-change so a future
 * checkout on the new plan starts from the catalog price. Returns the
 * deleted row (or null) so callers can audit which lock was removed.
 */
export async function dropPriceLockForPage(
  db: Database,
  pageId: string,
): Promise<PriceLockRow | null> {
  const [deleted] = await db
    .delete(subscriptionPriceLocks)
    .where(eq(subscriptionPriceLocks.pageId, pageId))
    .returning();
  return (deleted as PriceLockRow | undefined) ?? null;
}
