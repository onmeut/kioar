-- 0042_backfill_qr_customization.sql
--
-- Backfill `qr_code_customization` into `page_entitlements` for every
-- page that currently has a Pro or Business subscription.
--
-- Why: the feature is registered (Pro + Business) but
-- `rebuildEntitlements()` only fires on subscription state-change
-- (checkout / renewal / admin edit). Without this backfill, pages
-- already on Pro/Business would see the Save button locked behind an
-- upgrade CTA they don't actually need to click.
--
-- Idempotent: ON CONFLICT DO NOTHING preserves admin_grant / promo
-- rows that may already exist for the same key.

INSERT INTO "page_entitlements" ("page_id", "feature_key", "source")
SELECT s."page_id", f."key", 'subscription'
FROM "page_subscriptions" s
JOIN "plan_features" pf ON pf."plan_id" = s."plan_id"
JOIN "features" f       ON f."id" = pf."feature_id"
WHERE f."key" = 'qr_code_customization'
ON CONFLICT ("page_id", "feature_key") DO NOTHING;
