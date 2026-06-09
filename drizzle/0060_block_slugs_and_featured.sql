-- 0060_block_slugs_and_featured.sql
-- Per-profile slug for product & booking blocks (dedicated public pages),
-- and an is_featured flag on product items.
--
-- Events already have a globally-unique slug (events.slug) + route; left untouched.
-- Slug is scoped UNIQUE per profile_id (NOT global), so two different profiles
-- can both have a "menu" block. NULL slugs are allowed and excluded from the
-- uniqueness check via a partial index.

ALTER TABLE "profile_product_blocks" ADD COLUMN IF NOT EXISTS "slug" varchar(60);--> statement-breakpoint
ALTER TABLE "profile_booking_blocks" ADD COLUMN IF NOT EXISTS "slug" varchar(60);--> statement-breakpoint
ALTER TABLE "product_items" ADD COLUMN IF NOT EXISTS "is_featured" boolean DEFAULT false NOT NULL;--> statement-breakpoint

-- Per-profile uniqueness, NULLs excluded (a profile may have many slug-less blocks).
CREATE UNIQUE INDEX IF NOT EXISTS "profile_product_blocks_profile_slug_idx"
  ON "profile_product_blocks" ("profile_id", "slug") WHERE "slug" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "profile_booking_blocks_profile_slug_idx"
  ON "profile_booking_blocks" ("profile_id", "slug") WHERE "slug" IS NOT NULL;
