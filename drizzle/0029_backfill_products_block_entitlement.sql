-- 0029_backfill_products_block_entitlement.sql
--
-- Backfill `products_block` (and the matching limit row
-- `products_max_items_per_block`) into `page_entitlements` for every
-- page that already has an active subscription.
--
-- Why: the `products_block` feature was added to the registry after
-- subscriptions were created. `rebuildEntitlements()` only runs on
-- subscription state-change (checkout/renewal/admin edit), so existing
-- pages — including Business pages — never picked up the new row.
-- Symptom: clicking "ذخیره" on a product block returns
-- «این قابلیت در پلن فعلی فعال نیست.» even though the plan grants it.
--
-- This migration is idempotent: ON CONFLICT DO NOTHING preserves
-- admin_grant / promo rows that may already exist for the same key.

INSERT INTO "page_entitlements" ("page_id", "feature_key", "source")
SELECT s."page_id", f."key", 'subscription'
FROM "page_subscriptions" s
JOIN "plan_features" pf ON pf."plan_id" = s."plan_id"
JOIN "features" f       ON f."id" = pf."feature_id"
WHERE f."key" IN ('products_block', 'products_max_items_per_block')
ON CONFLICT ("page_id", "feature_key") DO NOTHING;
