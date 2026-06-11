-- ---------------------------------------------------------------------------
-- 0067_media_blocks
-- ---------------------------------------------------------------------------
-- New "media" (مدیا) block type: photos / video / file. One engine, three
-- content modes, surfaced through thin variant cards (gallery / video / resume
-- / download / menu_file / portfolio). Parent block + child items, mirroring
-- product blocks. Page-owned; shares the sort_order / is_active / spotlight /
-- animation_style axis so it renders intermixed with other blocks on the
-- public page.
--
-- `profile_media_items.byte_size` is the single source of truth for the page's
-- media_storage_mb quota (summed live, so deletes return quota immediately).
--
-- Reuses the existing `block_spotlight` / `block_animation` enums. Introduces
-- `media_block_mode` and `media_item_kind`. CREATE TYPE has no IF NOT EXISTS,
-- so each enum is wrapped in an idempotent DO block (the auto-migrator may
-- re-run; it must not fail on a pre-existing type).
-- ---------------------------------------------------------------------------

DO $$ BEGIN
	CREATE TYPE "media_block_mode" AS ENUM ('photos', 'video', 'file');
EXCEPTION
	WHEN duplicate_object THEN null;
END $$;
-->statement-breakpoint
DO $$ BEGIN
	CREATE TYPE "media_item_kind" AS ENUM ('image', 'video', 'file');
EXCEPTION
	WHEN duplicate_object THEN null;
END $$;
-->statement-breakpoint
CREATE TABLE IF NOT EXISTS "profile_media_blocks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL REFERENCES "profiles"("id") ON DELETE CASCADE,
	"mode" "media_block_mode" DEFAULT 'photos' NOT NULL,
	"preset" text,
	"name" text,
	"caption" text,
	"video_url" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"spotlight" "block_spotlight" DEFAULT 'none' NOT NULL,
	"animation_style" "block_animation",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
-->statement-breakpoint
CREATE TABLE IF NOT EXISTS "profile_media_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"block_id" uuid NOT NULL REFERENCES "profile_media_blocks"("id") ON DELETE CASCADE,
	"kind" "media_item_kind" NOT NULL,
	"url" text NOT NULL,
	"byte_size" bigint DEFAULT 0 NOT NULL,
	"mime" text,
	"display_name" text,
	"thumbnail_url" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
-->statement-breakpoint
CREATE INDEX IF NOT EXISTS "profile_media_blocks_profile_sort_idx" ON "profile_media_blocks" ("profile_id","sort_order");
-->statement-breakpoint
CREATE INDEX IF NOT EXISTS "profile_media_items_block_sort_idx" ON "profile_media_items" ("block_id","sort_order");
