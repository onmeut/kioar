-- ---------------------------------------------------------------------------
-- 0061_profile_text_blocks
-- ---------------------------------------------------------------------------
-- New "text" block type: Notion-style free text with an optional title,
-- optional icon (same vocabulary as link blocks), and optional photo. Page-
-- owned; shares the sort_order / is_active / spotlight / animation_style axis
-- so it renders intermixed with other blocks on the public page. `body` is the
-- only required field. Gated behind the `link_text_block` feature (Pro+).
--
-- Reuses the existing `block_spotlight` / `block_animation` enums.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "profile_text_blocks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL REFERENCES "profiles"("id") ON DELETE CASCADE,
	"title" text,
	"icon_key" text,
	"icon_url" text,
	"body" text NOT NULL,
	"photo_url" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"spotlight" "block_spotlight" DEFAULT 'none' NOT NULL,
	"animation_style" "block_animation",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
-->statement-breakpoint
CREATE INDEX IF NOT EXISTS "profile_text_blocks_profile_sort_idx" ON "profile_text_blocks" ("profile_id","sort_order");
