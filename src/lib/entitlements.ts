/**
 * Phase 4 entitlement helper.
 *
 * Reads the denormalized `page_entitlements` cache (see drizzle/0017) to
 * answer "can this page use feature X?" with a single hash-probe query.
 * `getPageEntitlements` does one JOIN through to `plan_features` so that
 * numeric limits (e.g. `storage_image_uploads`) ride along on the same
 * fetch — admins /promo grants surface `limitValue = null` because they
 * aren't pinned to a plan row.
 *
 * Caching: wrapped in React's `cache()` so server-component renders that
 * call `pageHasFeature` multiple times for the same page collapse to one
 * DB query. We deliberately do NOT add cross-request caching (no Redis,
 * no `unstable_cache`). Cross-request invalidation is a separate problem
 * — adding it now means every plan upgrade, admin grant, and promo expiry
 * must thread through a cache buster. Start without it; revisit only if
 * profiling shows it matters.
 *
 * Both server components and route handlers can call these directly —
 * `cache()` is a no-op in route handlers (no shared render scope), but
 * the underlying queries are fast (composite PK probe + small join) and
 * each handler typically calls them once.
 *
 * Phase 5 will graceful-degrade renderers using these helpers; Phase 7
 * will rebuild entitlements on subscription state transitions.
 */

import { cache } from "react";
import { sql } from "drizzle-orm";

import { getDb } from "@/db";

export type EntitlementSource = "subscription" | "admin_grant" | "promo";

/**
 * Compile-time union of every feature lookup_key that ships in
 * `scripts/seed-plans.ts`. Keep this in sync with the seeder — adding
 * a feature row to the registry without updating this union means call
 * sites can typo the key and tsc won't catch it.
 *
 * The helpers below intentionally accept `FeatureKey | (string & {})` so
 * (a) typos against the union are caught at the call site and (b) admin
 * code paths that read out-of-band keys (admin_grant on a feature added
 * in production via the matrix editor) still compile.
 */
export type FeatureKey =
  // core
  | "unlimited_links"
  | "kioar_username_url"
  | "responsive_layout"
  | "qr_code_basic"
  | "qr_code_customization"
  // branding
  | "remove_branding"
  | "favicon_upload"
  | "seo_meta"
  // design
  | "themes_limited"
  | "themes_full_library"
  | "custom_colors"
  | "custom_fonts"
  | "background_media"
  | "link_animations"
  | "featured_links"
  // link types
  | "link_url"
  | "link_video_embed"
  | "link_audio_embed"
  | "link_image_gallery"
  | "link_newsletter_signup"
  | "link_scheduled"
  | "link_shop"
  | "link_product"
  // analytics
  | "analytics_basic"
  | "analytics_history_7d"
  | "analytics_history_unlimited"
  | "analytics_geo"
  | "analytics_device_referrer"
  | "analytics_ctr_conversion"
  | "analytics_csv_export"
  | "analytics_funnel_cohort"
  // marketing
  | "utm_auto_tagging"
  | "pixel_meta"
  | "pixel_google_analytics"
  | "pixel_tiktok"
  | "email_integration"
  | "ab_testing"
  // business tools
  | "business_contact_form"
  | "business_lead_capture_form"
  | "business_form_submissions_dashboard"
  | "business_form_csv_export"
  | "business_bookings"
  | "business_booking_calendar_sync"
  | "business_business_hours"
  | "business_booking_sms_confirmation"
  | "business_events"
  // products & services (universal listing block — menus, shops, services,
  // packages, portfolio). Boolean grant + numeric cap on items per block.
  | "products_block"
  | "products_max_items_per_block"
  // media ("مدیا": photos / video / file). Boolean grant on every plan; the
  // storage quota + per-file/per-gallery caps are numeric limits below.
  | "media_block"
  // support
  | "support_help_center"
  | "support_email_best_effort"
  | "support_email_standard_48h"
  | "support_email_priority_24h"
  // limits (numeric — pair with getPageEntitlementLimit)
  | "storage_image_uploads"
  | "form_submissions_unlimited"
  | "booking_slots_unlimited"
  // media limits (numeric — storage in MB, the rest are counts)
  | "media_storage_mb"
  | "media_max_photo_mb"
  | "media_max_video_mb"
  | "media_max_file_mb"
  | "media_max_gallery_count";

/**
 * Accepted shape at gate call sites. Prefer the union literal — the
 * `(string & {})` branch is an escape hatch for admin/promo grants on
 * registry rows that haven't been added to the union yet.
 */
type FeatureKeyArg = FeatureKey | (string & {});

export type PageEntitlement = {
  featureKey: string;
  source: EntitlementSource;
  /**
   * Numeric cap pulled from `plan_features.limit_value` for the page's
   * current subscription plan. `null` means either:
   *   - the feature is boolean (no cap), or
   *   - the entitlement was granted out-of-band (admin/promo) and isn't
   *     tied to a plan row.
   * Callers that need a numeric limit should treat `null` as "unlimited"
   * for admin/promo grants and as "boolean feature" otherwise — the
   * `source` field disambiguates.
   */
  limitValue: bigint | null;
  expiresAt: Date | null;
};

type Row = {
  feature_key: string;
  source: EntitlementSource;
  limit_value: string | null;
  expires_at: Date | null;
};

/**
 * Load every active entitlement for a page as a Map keyed by feature_key.
 * Filters out expired admin/promo grants (NULL `expires_at` = permanent).
 */
export const getPageEntitlements = cache(
  async (pageId: string): Promise<Map<string, PageEntitlement>> => {
    const db = getDb();
    const rows = (await db.execute(sql`
      SELECT
        e."feature_key"  AS feature_key,
        e."source"       AS source,
        e."expires_at"   AS expires_at,
        pf."limit_value" AS limit_value
      FROM "page_entitlements" e
      LEFT JOIN "page_subscriptions" s ON s."page_id" = e."page_id"
      LEFT JOIN "features" f           ON f."key" = e."feature_key"
      LEFT JOIN "plan_features" pf
        ON pf."plan_id" = s."plan_id"
       AND pf."feature_id" = f."id"
      WHERE e."page_id" = ${pageId}::uuid
        AND (e."expires_at" IS NULL OR e."expires_at" > now())
    `)) as unknown as Row[];

    const map = new Map<string, PageEntitlement>();
    for (const r of rows) {
      map.set(r.feature_key, {
        featureKey: r.feature_key,
        source: r.source,
        limitValue: r.limit_value === null ? null : BigInt(r.limit_value),
        expiresAt: r.expires_at,
      });
    }
    return map;
  },
);

/**
 * `true` if the page currently has the named feature. Use this as the
 * canonical gate everywhere — server components, route handlers, server
 * actions. Never compare plan keys directly (`plan === 'pro'`); plan
 * shape is allowed to change, feature_key contracts are stable.
 */
export const pageHasFeature = cache(
  async (pageId: string, featureKey: FeatureKeyArg): Promise<boolean> => {
    const ents = await getPageEntitlements(pageId);
    return ents.has(featureKey);
  },
);

/**
 * Throwing variant of `pageHasFeature`. Use in route handlers / server
 * actions where falling through to a 404 is the desired behaviour:
 *
 *     await requireFeature(pageId, "business_bookings");
 *
 * Throws `FeatureGateError` (a tagged error) on miss. Callers that want
 * to render a custom upgrade screen should use `pageHasFeature` instead;
 * `requireFeature` is for surfaces where the feature simply doesn't exist
 * for unentitled pages (inbound submit/booking endpoints, public renders
 * of paid block types).
 */
export class FeatureGateError extends Error {
  readonly code = "feature_gate" as const;
  readonly featureKey: string;
  constructor(featureKey: string) {
    super(`feature ${featureKey} not entitled`);
    this.name = "FeatureGateError";
    this.featureKey = featureKey;
  }
}

export async function requireFeature(
  pageId: string,
  featureKey: FeatureKeyArg,
): Promise<void> {
  const ok = await pageHasFeature(pageId, featureKey);
  if (!ok) throw new FeatureGateError(featureKey);
}

/**
 * Numeric cap for a feature, or `null` if the feature is boolean / not
 * granted / granted without a cap (admin/promo). Pair with
 * `pageHasFeature` for the gate, then call this for the limit.
 */
export async function getPageEntitlementLimit(
  pageId: string,
  featureKey: FeatureKeyArg,
): Promise<bigint | null> {
  const ents = await getPageEntitlements(pageId);
  return ents.get(featureKey)?.limitValue ?? null;
}

/**
 * Wipe and re-grant the `subscription`-sourced entitlements for a page
 * from its currently-effective plan. Preserves out-of-band grants:
 *   - `admin_grant` rows are untouched.
 *   - `promo` rows whose `expires_at` is NULL or in the future are kept.
 *
 * Call this after every state change that could shift the effective plan:
 *   - successful checkout / renewal,
 *   - trial start / trial expiry,
 *   - admin manual plan change,
 *   - grace-period exit (downgrade to Free),
 *   - plan-feature matrix edit (admin "rebuild" action).
 *
 * MUST run inside the same transaction that mutates `page_subscriptions`
 * so observers can never see a stale (plan, entitlements) pair. Pass the
 * transaction's executor; callers using top-level `getDb()` can pass that
 * directly because the API surface is identical.
 */
/**
 * Lowest **paid** plan tier that currently grants `featureKey` per the
 * live `plan_features` matrix. Used by the editor to color the lock
 * chip on a gated block row:
 *   - "pro"      → emerald chip ("ارتقا به حرفه‌ای")
 *   - "business" → purple chip ("ارتقا به کسب‌وکار")
 *   - null       → no paid plan grants it (matrix has it on Free only,
 *                  or no plan at all). Caller should fall back to "pro"
 *                  defensively — a locked-yet-Free feature usually means
 *                  an admin-revoke, not a true upgrade path.
 *
 * This intentionally does NOT honour the `business_*` / non-prefix naming
 * convention (`featureKeyToRequiredPlan`); admins can edit the matrix
 * freely from `/admin/plans`, and the chip must reflect the *current*
 * state of `plan_features`, not the original seed convention.
 *
 * Cached per render via React's `cache()` so multiple gated rows on the
 * same page collapse to one query per feature.
 */
export const getFeatureLockTier = cache(
  async (featureKey: FeatureKeyArg): Promise<"pro" | "business" | null> => {
    const db = getDb();
    const rows = (await db.execute(sql`
      SELECT p."key" AS plan_key
      FROM "plan_features" pf
      JOIN "plans" p    ON p."id" = pf."plan_id"
      JOIN "features" f ON f."id" = pf."feature_id"
      WHERE f."key" = ${featureKey}
        AND p."is_active" = true
        AND p."key" IN ('pro', 'business')
      ORDER BY p."display_order" ASC
      LIMIT 1
    `)) as unknown as { plan_key: "pro" | "business" }[];
    return rows[0]?.plan_key ?? null;
  },
);

export async function rebuildEntitlements(
  tx: { execute(query: ReturnType<typeof sql>): Promise<unknown> },
  pageId: string,
): Promise<void> {
  // 1. Drop subscription-sourced rows. admin_grant + promo are preserved.
  await tx.execute(sql`
    DELETE FROM "page_entitlements"
    WHERE "page_id" = ${pageId}::uuid
      AND "source" = 'subscription'
  `);

  // 2. Re-insert from the page's current plan. ON CONFLICT is a defensive
  // no-op against admin_grant / promo rows for the same feature_key.
  await tx.execute(sql`
    INSERT INTO "page_entitlements" ("page_id", "feature_key", "source")
    SELECT ${pageId}::uuid, f."key", 'subscription'
    FROM "page_subscriptions" s
    JOIN "plan_features" pf ON pf."plan_id" = s."plan_id"
    JOIN "features" f       ON f."id" = pf."feature_id"
    WHERE s."page_id" = ${pageId}::uuid
    ON CONFLICT ("page_id", "feature_key") DO NOTHING
  `);
}
