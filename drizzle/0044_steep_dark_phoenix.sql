CREATE TABLE IF NOT EXISTS "discover_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"label" text NOT NULL,
	"icon_key" text DEFAULT 't:star' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "page_subscriptions" ADD COLUMN IF NOT EXISTS "plan_key" text;--> statement-breakpoint
ALTER TABLE "page_subscriptions" ADD COLUMN IF NOT EXISTS "is_admin_override" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "qr_style" jsonb;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "discover_categories_slug_idx" ON "discover_categories" USING btree ("slug");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "discover_categories_sort_idx" ON "discover_categories" USING btree ("sort_order") WHERE "discover_categories"."is_active" = true;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ps_status_plan_key_idx" ON "page_subscriptions" USING btree ("status","plan_key") WHERE "page_subscriptions"."plan_key" <> 'free';