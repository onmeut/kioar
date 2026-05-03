-- 0028_product_blocks.sql
--
-- Universal "products & services" block — used for restaurant menus,
-- e-commerce items with outbound links, services (salons, freelancers),
-- packages, portfolio listings. Universal schema; the `preset` column is
-- a UI hint that drives default copy at create time and never branches in
-- the data layer.
--
-- Hierarchy:
--   profile_product_blocks (1) ── (N) product_sections (optional grouping)
--   profile_product_blocks (1) ── (N) product_items
--
-- Money is stored in **minor units** (rials for IRT, cents for USD/EUR).

CREATE TYPE "public"."product_block_layout" AS ENUM('list', 'grid', 'cards');--> statement-breakpoint
CREATE TYPE "public"."product_block_display_mode" AS ENUM('pill', 'inline');--> statement-breakpoint
CREATE TYPE "public"."product_item_price_type" AS ENUM('fixed', 'from', 'range', 'on_request', 'free');--> statement-breakpoint
CREATE TYPE "public"."product_item_availability" AS ENUM('available', 'sold_out', 'hidden');--> statement-breakpoint

CREATE TABLE "profile_product_blocks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"name" text DEFAULT 'محصولات' NOT NULL,
	"description" text,
	"preset" text,
	"layout" "product_block_layout" DEFAULT 'list' NOT NULL,
	"item_label" text,
	"currency" text DEFAULT 'IRT' NOT NULL,
	"show_prices" boolean DEFAULT true NOT NULL,
	"display_mode" "product_block_display_mode" DEFAULT 'pill' NOT NULL,
	"pill_label" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"spotlight" "block_spotlight" DEFAULT 'none' NOT NULL,
	"animation_style" "block_animation",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE TABLE "product_sections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"block_id" uuid NOT NULL,
	"title" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE TABLE "product_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"block_id" uuid NOT NULL,
	"section_id" uuid,
	"title" text NOT NULL,
	"description" text,
	"image_url" text,
	"price_type" "product_item_price_type" DEFAULT 'fixed' NOT NULL,
	"price_amount" integer DEFAULT 0 NOT NULL,
	"price_amount_max" integer,
	"availability" "product_item_availability" DEFAULT 'available' NOT NULL,
	"external_url" text,
	"badge" text,
	"sku" text,
	"click_count" integer DEFAULT 0 NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

ALTER TABLE "profile_product_blocks" ADD CONSTRAINT "profile_product_blocks_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_sections" ADD CONSTRAINT "product_sections_block_id_profile_product_blocks_id_fk" FOREIGN KEY ("block_id") REFERENCES "public"."profile_product_blocks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_items" ADD CONSTRAINT "product_items_block_id_profile_product_blocks_id_fk" FOREIGN KEY ("block_id") REFERENCES "public"."profile_product_blocks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_items" ADD CONSTRAINT "product_items_section_id_product_sections_id_fk" FOREIGN KEY ("section_id") REFERENCES "public"."product_sections"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint

CREATE INDEX "profile_product_blocks_profile_sort_idx" ON "profile_product_blocks" USING btree ("profile_id","sort_order");--> statement-breakpoint
CREATE INDEX "product_sections_block_sort_idx" ON "product_sections" USING btree ("block_id","sort_order");--> statement-breakpoint
CREATE INDEX "product_items_block_sort_idx" ON "product_items" USING btree ("block_id","sort_order");--> statement-breakpoint
CREATE INDEX "product_items_section_sort_idx" ON "product_items" USING btree ("section_id","sort_order");
