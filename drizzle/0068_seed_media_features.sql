-- ---------------------------------------------------------------------------
-- 0068_seed_media_features
-- ---------------------------------------------------------------------------
-- Seed the media feature registry rows + plan mappings + entitlement backfill.
--
-- The seeder (scripts/seed-plans.ts) is NOT run by server-wrapper.cjs on
-- deploy — only migrations are. So every feature added after the initial
-- deploy must ALSO be inserted via a migration, or production pages silently
-- lack the entitlement forever. Mirrors 0062_seed_link_text_block_feature.sql.
--
-- All six media features are granted on every plan (free/pro/business). The
-- per-page limit_value differs only for media_storage_mb (50/200/500); the
-- other limits are equal across tiers for now. Idempotent (ON CONFLICT DO
-- NOTHING) and safe to re-run.
-- ---------------------------------------------------------------------------

-- Step 1: insert the feature rows (if missing). display_order = next within
-- the row's category, matching the seeder's per-category ordering.
INSERT INTO "features" ("key", "name_fa", "category", "display_order")
VALUES
  ('media_block', 'بلوک مدیا (عکس، ویدئو، فایل)', 'business_tools',
    (SELECT coalesce(max("display_order"), 0) + 1 FROM "features" WHERE "category" = 'business_tools')),
  ('media_storage_mb', 'فضای ذخیره‌سازی مدیا', 'limits',
    (SELECT coalesce(max("display_order"), 0) + 1 FROM "features" WHERE "category" = 'limits')),
  ('media_max_photo_mb', 'حداکثر حجم هر عکس', 'limits',
    (SELECT coalesce(max("display_order"), 0) + 2 FROM "features" WHERE "category" = 'limits')),
  ('media_max_video_mb', 'حداکثر حجم هر ویدئو', 'limits',
    (SELECT coalesce(max("display_order"), 0) + 3 FROM "features" WHERE "category" = 'limits')),
  ('media_max_file_mb', 'حداکثر حجم هر فایل', 'limits',
    (SELECT coalesce(max("display_order"), 0) + 4 FROM "features" WHERE "category" = 'limits')),
  ('media_max_gallery_count', 'حداکثر تعداد عکس در هر گالری', 'limits',
    (SELECT coalesce(max("display_order"), 0) + 5 FROM "features" WHERE "category" = 'limits'))
ON CONFLICT ("key") DO NOTHING;
-->statement-breakpoint

-- Step 2a: boolean grants (media_block) on every plan.
INSERT INTO "plan_features" ("plan_id", "feature_id", "limit_value")
SELECT p."id", f."id", NULL
FROM "plans" p
CROSS JOIN "features" f
WHERE f."key" = 'media_block'
ON CONFLICT ("plan_id", "feature_id") DO NOTHING;
-->statement-breakpoint

-- Step 2b: media_storage_mb — per-plan numeric limit (free 50 / pro 200 / business 500).
INSERT INTO "plan_features" ("plan_id", "feature_id", "limit_value")
SELECT p."id", f."id",
  CASE p."key"
    WHEN 'free' THEN 50
    WHEN 'pro' THEN 200
    WHEN 'business' THEN 500
  END
FROM "plans" p
CROSS JOIN "features" f
WHERE f."key" = 'media_storage_mb'
  AND p."key" IN ('free', 'pro', 'business')
ON CONFLICT ("plan_id", "feature_id") DO NOTHING;
-->statement-breakpoint

-- Step 2c: per-file / per-gallery caps — equal across tiers for now.
INSERT INTO "plan_features" ("plan_id", "feature_id", "limit_value")
SELECT p."id", f."id",
  CASE f."key"
    WHEN 'media_max_photo_mb' THEN 10
    WHEN 'media_max_video_mb' THEN 100
    WHEN 'media_max_file_mb' THEN 20
    WHEN 'media_max_gallery_count' THEN 20
  END
FROM "plans" p
CROSS JOIN "features" f
WHERE f."key" IN ('media_max_photo_mb', 'media_max_video_mb', 'media_max_file_mb', 'media_max_gallery_count')
  AND p."key" IN ('free', 'pro', 'business')
ON CONFLICT ("plan_id", "feature_id") DO NOTHING;
-->statement-breakpoint

-- Step 3: backfill page_entitlements (subscription-sourced) for every page,
-- for all six media features. ON CONFLICT preserves admin_grant / promo rows.
INSERT INTO "page_entitlements" ("page_id", "feature_key", "source")
SELECT s."page_id", f."key", 'subscription'
FROM "page_subscriptions" s
JOIN "plan_features" pf ON pf."plan_id" = s."plan_id"
JOIN "features" f ON f."id" = pf."feature_id"
WHERE f."key" IN (
  'media_block', 'media_storage_mb', 'media_max_photo_mb',
  'media_max_video_mb', 'media_max_file_mb', 'media_max_gallery_count'
)
ON CONFLICT ("page_id", "feature_key") DO NOTHING;
