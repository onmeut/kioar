-- Seed `business_events` into the feature registry and backfill entitlements.
--
-- The seeder (scripts/seed-plans.ts) is not run by server-wrapper.cjs, so
-- any feature added after the initial deploy must also be inserted via a
-- migration. This migration is idempotent (ON CONFLICT DO NOTHING) and safe
-- to run multiple times.
--
-- Step 1: insert the feature row (if missing).
INSERT INTO "features" ("key", "name_fa", "category", "display_order")
VALUES (
  'business_events',
  'رویدادها',
  'business_tools',
  (
    SELECT coalesce(max("display_order"), 0) + 1
    FROM "features"
    WHERE "category" = 'business_tools'
  )
)
ON CONFLICT ("key") DO NOTHING;

-- Step 2: link the feature to the Business plan (if missing).
INSERT INTO "plan_features" ("plan_id", "feature_id", "limit_value")
SELECT
  p."id",
  f."id",
  NULL
FROM "plans" p
CROSS JOIN "features" f
WHERE p."key" = 'business'
  AND f."key" = 'business_events'
ON CONFLICT ("plan_id", "feature_id") DO NOTHING;

-- Step 3: backfill page_entitlements for all Business-plan pages.
-- ON CONFLICT DO NOTHING preserves admin_grant / promo rows.
INSERT INTO "page_entitlements" ("page_id", "feature_key", "source")
SELECT
  s."page_id",
  'business_events',
  'subscription'
FROM "page_subscriptions" s
JOIN "plans" p ON p."id" = s."plan_id"
WHERE p."key" = 'business'
ON CONFLICT ("page_id", "feature_key") DO NOTHING;
