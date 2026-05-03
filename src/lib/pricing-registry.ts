/**
 * Phase 12 — registry-driven plan summaries for pricing UI.
 *
 * Loads active `plans` + the top N feature highlights for each plan,
 * picked from `plan_features` joined with `features`. The highlights are
 * the per-plan "marquee" features rendered in pricing cards.
 *
 * NEVER reads or writes plan-key gates here — this module is purely a
 * read model for the marketing surface.
 */
import { eq, inArray } from "drizzle-orm";

import { getDb } from "@/db";
import { features, planFeatures, plans } from "@/db/schema";
import type { PricingCardsPlan } from "@/components/billing/pricing-cards";

const HIGHLIGHT_COUNT_PER_PLAN = 6;

/**
 * Categories we surface in pricing cards, in priority order. Limit rows
 * (`limits` category) come first when the plan upgrades a quota; design /
 * business_tools / analytics show next; core last so we don't pad with
 * "have email lol" on paid cards.
 */
const HIGHLIGHT_CATEGORY_ORDER: string[] = [
  "business_tools",
  "marketing",
  "analytics",
  "design",
  "branding",
  "link_types",
  "support",
  "limits",
  "core",
];

export async function loadPricingPlans(): Promise<PricingCardsPlan[]> {
  const db = getDb();

  const allPlans = await db.query.plans.findMany({
    where: eq(plans.isActive, true),
    orderBy: (p, { asc }) => [asc(p.displayOrder)],
  });

  if (allPlans.length === 0) return [];

  const planIds = allPlans.map((p) => p.id);

  const mappings = await db
    .select({
      planId: planFeatures.planId,
      featureId: planFeatures.featureId,
      limitValue: planFeatures.limitValue,
      featureName: features.nameFa,
      featureCategory: features.category,
      featureOrder: features.displayOrder,
    })
    .from(planFeatures)
    .innerJoin(features, eq(planFeatures.featureId, features.id))
    .where(inArray(planFeatures.planId, planIds));

  // Group mappings by plan and rank by category priority + displayOrder.
  const byPlan = new Map<string, typeof mappings>();
  for (const m of mappings) {
    if (!byPlan.has(m.planId)) byPlan.set(m.planId, []);
    byPlan.get(m.planId)!.push(m);
  }

  // Pre-build a feature-id → set of plans that grant it, so we can prefer
  // *upgrade* features (granted on Pro/Business but not Free) for paid
  // plans instead of generic "has email" filler.
  const featureToGrantingPlans = new Map<string, Set<string>>();
  for (const m of mappings) {
    if (!featureToGrantingPlans.has(m.featureId)) {
      featureToGrantingPlans.set(m.featureId, new Set());
    }
    featureToGrantingPlans.get(m.featureId)!.add(m.planId);
  }
  const freePlanId = allPlans.find((p) => p.key === "free")?.id;

  const categoryRank = (cat: string) => {
    const idx = HIGHLIGHT_CATEGORY_ORDER.indexOf(cat);
    return idx === -1 ? HIGHLIGHT_CATEGORY_ORDER.length : idx;
  };

  return allPlans.map((p) => {
    const rows = byPlan.get(p.id) ?? [];
    const ranked = [...rows].sort((a, b) => {
      // For paid plans, prefer features that are NOT also on Free
      // (i.e. real upgrades). For Free itself, just use the natural order.
      if (p.key !== "free" && freePlanId) {
        const aIsUpgrade = !featureToGrantingPlans
          .get(a.featureId)
          ?.has(freePlanId);
        const bIsUpgrade = !featureToGrantingPlans
          .get(b.featureId)
          ?.has(freePlanId);
        if (aIsUpgrade !== bIsUpgrade) return aIsUpgrade ? -1 : 1;
      }
      const ca = categoryRank(a.featureCategory);
      const cb = categoryRank(b.featureCategory);
      if (ca !== cb) return ca - cb;
      return a.featureOrder - b.featureOrder;
    });

    const highlights = ranked
      .slice(0, HIGHLIGHT_COUNT_PER_PLAN)
      .map((m) =>
        typeof m.limitValue === "number"
          ? `${m.featureName} (${m.limitValue})`
          : m.featureName,
      );

    return {
      id: p.id,
      key: p.key as PricingCardsPlan["key"],
      nameFa: p.nameFa,
      descriptionFa: p.descriptionFa,
      priceMonthlyToman: p.priceMonthlyToman,
      priceAnnualToman: p.priceAnnualToman,
      trialDays: p.trialDays,
      highlights,
    };
  });
}
