/**
 * Page-centric helpers.
 *
 * Storage-wise a "page" is still a row in the `profiles` table (we kept the
 * table name to avoid a churn-heavy rename in Phase 1). Semantically the row
 * is a single page owned by a user. A user can own many pages now that the
 * unique-on-`user_id` index has been relaxed.
 *
 * Free-plan period sentinel
 * -------------------------
 * A page on the Free plan stores `current_period_end = createdAt + 100 years`
 * in `page_subscriptions`. That sentinel means "never expires, never
 * invoices". The Phase 7 billing cron MUST filter Free subscriptions out of
 * its renewal/grace/expiry queries. Don't change the sentinel without
 * updating the cron filter.
 *
 * TODO(rename-cleanup): The underlying SQL table is still `profiles` for
 * historical reasons. When `page_subscriptions` (Phase 3+) joins to it as
 * `JOIN profiles ON profiles.id = page_subscriptions.page_id`, that's
 * intentional. A future cleanup phase should rename `profiles` -> `pages`
 * (and `profile_links` -> `page_links`, etc.) once the surface area is
 * stable. See IMPLEMENTATION_PLAN.md §"Future cleanup".
 */
import { and, asc, desc, eq, sql } from "drizzle-orm";

import { getDb } from "@/db";
import {
  features,
  pageEntitlements,
  pageSubscriptions,
  planFeatures,
  plans,
  profiles,
} from "@/db/schema";
import { generateAvatarSeed } from "@/lib/avatar-seed";
import { invalidateProfileCacheBySlug } from "@/lib/cache/profile-cache";
import { invalidateDiscoverCache } from "@/lib/cache/page-list-cache";
import {
  readCurrentPageIdCookie,
  writeCurrentPageIdCookie,
} from "@/lib/page-cookie";
import { isReservedSlug } from "@/lib/slug";

export type PageRow = typeof profiles.$inferSelect;

/** Every page owned by `ownerId`, oldest-first so "first page" is stable. */
export async function listPagesForOwner(ownerId: string): Promise<PageRow[]> {
  const db = getDb();
  return db
    .select()
    .from(profiles)
    .where(eq(profiles.userId, ownerId))
    .orderBy(asc(profiles.createdAt));
}

export async function countPagesForOwner(ownerId: string): Promise<number> {
  const rows = await listPagesForOwner(ownerId);
  return rows.length;
}

export async function getPageById(pageId: string): Promise<PageRow | null> {
  const db = getDb();
  const row = await db.query.profiles.findFirst({
    where: eq(profiles.id, pageId),
  });
  return row ?? null;
}

/**
 * Returns the page only if it's owned by `ownerId`. Use this on every
 * dashboard mutation so a user can't edit another user's page even if they
 * forge the cookie.
 */
export async function getOwnedPageById(
  pageId: string,
  ownerId: string,
): Promise<PageRow | null> {
  const db = getDb();
  const row = await db.query.profiles.findFirst({
    where: and(eq(profiles.id, pageId), eq(profiles.userId, ownerId)),
  });
  return row ?? null;
}

/**
 * Resolve the "current page" for a logged-in owner.
 *
 * Order of preference:
 *   1. The page named in the `kioar_page_id` cookie, if it's owned by them.
 *   2. The oldest page they own (their first one) \u2014 stable fallback.
 *   3. `null` if they own no pages yet (still in onboarding).
 */
export async function resolveCurrentPageForOwner(
  ownerId: string,
): Promise<PageRow | null> {
  const cookiePageId = await readCurrentPageIdCookie();
  if (cookiePageId) {
    const owned = await getOwnedPageById(cookiePageId, ownerId);
    if (owned) return owned;
  }
  const db = getDb();
  return (
    (await db.query.profiles.findFirst({
      where: eq(profiles.userId, ownerId),
      orderBy: [asc(profiles.createdAt)],
    })) ?? null
  );
}

/**
 * Switch the current page. Verifies ownership before writing the cookie so
 * a malicious request can't pin the cookie to someone else's page id.
 */
export async function switchCurrentPageForOwner(
  pageId: string,
  ownerId: string,
): Promise<PageRow | null> {
  const owned = await getOwnedPageById(pageId, ownerId);
  if (!owned) return null;
  await writeCurrentPageIdCookie(owned.id);
  return owned;
}

export type CreatePageInput = {
  ownerId: string;
  slug: string;
  fullName: string;
  title?: string | null;
  /** Page archetype captured during onboarding. Optional. */
  pageType?: string | null;
  /** Discover category slug. Optional — listed under "همه" when null. */
  discoverCategory?: string | null;
};

export type CreatePageResult =
  | { ok: true; page: PageRow }
  | { ok: false; reason: "slug_taken" | "slug_reserved" | "slug_invalid" };

/**
 * Seed a Free `page_subscriptions` row + `page_entitlements` rows for a
 * page that doesn't have any yet.
 *
 * Idempotent: a page already pinned to a subscription is left untouched
 * (we never downgrade a Pro/Business page back to Free here). Use this
 * from every code path that inserts a `profiles` row, so the
 * "every page has exactly one subscription" invariant always holds.
 *
 * Pass the same Drizzle transaction handle if you're inside one — that's
 * how `createPageForOwner` keeps the page insert + subscription seed
 * atomic. Outside a TX, pass the singleton db.
 */
export async function ensureFreeSubscriptionForPage(
  tx: Pick<ReturnType<typeof getDb>, "query" | "insert" | "execute">,
  pageId: string,
): Promise<void> {
  const existing = await tx.query.pageSubscriptions.findFirst({
    where: eq(pageSubscriptions.pageId, pageId),
  });
  if (existing) return;

  const freePlan = await tx.query.plans.findFirst({
    where: eq(plans.key, "free"),
  });
  if (!freePlan) {
    throw new Error(
      "ensureFreeSubscriptionForPage: free plan missing from registry. Run `pnpm db:seed:plans`.",
    );
  }

  await tx.insert(pageSubscriptions).values({
    pageId,
    planId: freePlan.id,
    planKey: freePlan.key,
    billingCycle: "monthly",
    status: "active",
    // 100-year sentinel — see file header.
    currentPeriodEnd: sql`now() + interval '100 years'`,
  });

  await tx.execute(
    sql`
      INSERT INTO ${pageEntitlements} ("page_id", "feature_key", "source")
      SELECT ${pageId}::uuid, ${features.key}, 'subscription'::"entitlement_source"
      FROM ${planFeatures}
      INNER JOIN ${features} ON ${features.id} = ${planFeatures.featureId}
      WHERE ${planFeatures.planId} = ${freePlan.id}
      ON CONFLICT ("page_id", "feature_key") DO NOTHING
    `,
  );
}

/**
 * Create a new page for an existing user. Validates slug uniqueness against
 * the global `profiles_slug_idx`. Inside the same transaction also seeds:
 *
 *   - one `page_subscriptions` row pinned to the Free plan (with the
 *     100-year sentinel `currentPeriodEnd`).
 *   - one `page_entitlements` row per feature granted by the Free plan.
 *
 * A page existing without a subscription row is an invalid state — that's
 * why this is one transaction. The Phase 3 backfill (drizzle/0017_*) does
 * the same job for pre-existing pages.
 */
export async function createPageForOwner(
  input: CreatePageInput,
): Promise<CreatePageResult> {
  const slug = input.slug.trim().toLowerCase();
  if (!/^[a-z0-9](?:[a-z0-9-]{1,28}[a-z0-9])?$/.test(slug)) {
    return { ok: false, reason: "slug_invalid" };
  }
  if (isReservedSlug(slug)) {
    return { ok: false, reason: "slug_reserved" };
  }

  const db = getDb();
  try {
    const page = await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(profiles)
        .values({
          userId: input.ownerId,
          slug,
          fullName: input.fullName.trim() || null,
          title: input.title?.trim() || null,
          pageType: input.pageType?.trim() || null,
          discoverCategory: input.discoverCategory?.trim() || null,
          // `discover_enabled` defaults to TRUE at the column level
          // (migration 0037), so new pages join the directory by default.
          avatarSeed: generateAvatarSeed(),
          // A new page starts incomplete; the owner can flesh it out from
          // the editor. We mark it complete & published so the public URL
          // works immediately — the editor still knows how to nudge them
          // to fill in details (Phase 5+ shows the locked-config affordance
          // there).
          isComplete: true,
          isPublished: true,
        })
        .returning();

      await ensureFreeSubscriptionForPage(tx, created.id);
      return created;
    });
    // A previous visit to /[slug] (back when the slug was unclaimed) may
    // have cached the 404 sentinel; drop it so the new page is visible
    // immediately instead of after 60s.
    await invalidateProfileCacheBySlug(slug);
    // New page joins discover by default (discover_enabled col default=true);
    // bump the version so the directory reflects the new entry immediately.
    await invalidateDiscoverCache();
    return { ok: true, page };
  } catch (error) {
    // 23505 = unique_violation. With the user_id unique gone, the only
    // unique left on this table is the slug, so we know what conflicted.
    const code = (error as { code?: string } | null)?.code;
    if (code === "23505") {
      return { ok: false, reason: "slug_taken" };
    }
    throw error;
  }
}

export async function listOwnedPagesWithCurrent(ownerId: string): Promise<{
  pages: PageRow[];
  currentPageId: string | null;
}> {
  const [pages, current] = await Promise.all([
    listPagesForOwner(ownerId),
    resolveCurrentPageForOwner(ownerId),
  ]);
  return { pages, currentPageId: current?.id ?? null };
}

/**
 * Latest-first listing for admin tooling \u2014 not used in user-facing UI.
 */
export async function listPagesForOwnerNewestFirst(
  ownerId: string,
): Promise<PageRow[]> {
  const db = getDb();
  return db
    .select()
    .from(profiles)
    .where(eq(profiles.userId, ownerId))
    .orderBy(desc(profiles.createdAt));
}

export type OwnedPageWithPlan = {
  id: string;
  slug: string;
  fullName: string | null;
  title: string | null;
  avatarUrl: string | null;
  avatarSeed: string | null;
  planKey: "free" | "pro" | "business";
  isOnTrial: boolean;
  /**
   * End of the current trial window, when `isOnTrial` is true. Surfaced
   * here so the dashboard chrome (promo bar, upgrade card) can compute
   * a days-remaining countdown without a second round-trip.
   */
  trialEndsAt: Date | null;
};

/**
 * Page-switcher data: every page owned by `ownerId` joined to its
 * `page_subscriptions` row so the dropdown can render a plan badge.
 * Oldest-first so the "first page" stays on top consistently.
 */
export async function listOwnedPagesWithPlan(
  ownerId: string,
): Promise<OwnedPageWithPlan[]> {
  const db = getDb();
  const rows = await db
    .select({
      id: profiles.id,
      slug: profiles.slug,
      fullName: profiles.fullName,
      title: profiles.title,
      avatarUrl: profiles.avatarUrl,
      avatarSeed: profiles.avatarSeed,
      planKey: plans.key,
      status: pageSubscriptions.status,
      trialEndsAt: pageSubscriptions.trialEndsAt,
    })
    .from(profiles)
    .leftJoin(pageSubscriptions, eq(pageSubscriptions.pageId, profiles.id))
    .leftJoin(plans, eq(plans.id, pageSubscriptions.planId))
    .where(eq(profiles.userId, ownerId))
    .orderBy(asc(profiles.createdAt));

  const now = Date.now();
  return rows.map((r) => {
    // An active trial requires both the trialing status AND a future end date.
    // If the cron hasn't run yet after the trial elapsed, we must NOT treat
    // the row as still-trialing — that would show a negative or zero countdown
    // and keep the "آزمایشی" badge alive indefinitely in dev/staging.
    const isActivelyTrialing =
      r.status === "trialing" &&
      r.trialEndsAt != null &&
      r.trialEndsAt.getTime() > now;

    // A page is "effectively free" when there is no active paid entitlement:
    // - No subscription row (null status)
    // - Subscription expired or canceled (cron already downgraded it)
    // - Was trialing but trial_ends_at has passed (cron hasn't run yet)
    // Grace-period pages still have their paid entitlements, so we preserve
    // the plan key for them until the cron fires grace_ended_to_expired.
    const isEffectivelyFree =
      !r.status ||
      r.status === "expired" ||
      r.status === "canceled" ||
      (r.status === "trialing" && !isActivelyTrialing);

    return {
      id: r.id,
      slug: r.slug,
      fullName: r.fullName,
      title: r.title,
      avatarUrl: r.avatarUrl,
      avatarSeed: r.avatarSeed,
      planKey: (isEffectivelyFree ? "free" : (r.planKey ?? "free")) as
        | "free"
        | "pro"
        | "business",
      isOnTrial: isActivelyTrialing,
      trialEndsAt: r.trialEndsAt ?? null,
    };
  });
}
