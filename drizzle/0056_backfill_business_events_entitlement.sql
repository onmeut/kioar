-- Backfill `business_events` entitlement for all existing Business pages.
--
-- When a new feature is added to the registry AFTER pages already have active
-- subscriptions, `page_entitlements` is not automatically updated. This migration
-- inserts the missing rows so Business-plan pages can use the رویداد block.
--
-- ON CONFLICT DO NOTHING is safe here: if a page somehow already has the row
-- (e.g. via admin_grant), it is left untouched.

INSERT INTO "page_entitlements" ("page_id", "feature_key", "source")
SELECT
  s."page_id",
  'business_events',
  'subscription'
FROM "page_subscriptions" s
JOIN "plans" p ON p."id" = s."plan_id"
WHERE p."key" = 'business'
ON CONFLICT ("page_id", "feature_key") DO NOTHING;
