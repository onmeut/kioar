-- 0030_fix_malformed_image_urls.sql
--
-- A bug in `optionalHttpUrlSchema` (lib/validations.ts) was prepending
-- `https://` to root-relative upload URLs from the local-storage driver,
-- producing `https:///uploads/...` (note the empty hostname). next/image
-- chokes on these because the resulting URL has no host.
--
-- The schema is now patched to leave `/uploads/...` paths alone. This
-- migration repairs any rows that captured the bad form before the fix.

UPDATE "product_items"
SET "image_url" = SUBSTR("image_url", 8)
WHERE "image_url" LIKE 'https:///%';

UPDATE "profile_links"
SET "image_url" = SUBSTR("image_url", 8)
WHERE "image_url" LIKE 'https:///%';

UPDATE "profiles"
SET "avatar_url" = SUBSTR("avatar_url", 8)
WHERE "avatar_url" LIKE 'https:///%';
