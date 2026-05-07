-- 0033_subscription_admin.sql
--
-- Subscription Management admin surface — DDL only. Backfill / seeders
-- live in scripts/seed-app-settings.ts (Phase 2).
--
-- New tables:
--   app_settings                     k/v JSONB for billing knobs (grace
--                                    days, reminder offsets, VAT rate,
--                                    grandfathering policy default).
--   subscription_price_locks         per-page price snapshot taken when
--                                    an admin grandfathers a subscription
--                                    against a price change. Reading
--                                    order: lock row exists → use locked_*;
--                                    no lock → use plans.price_*.
--   subscription_price_change_events one row per published price change
--                                    on a plan (audit + notification).
--
-- Column additions:
--   plans.annual_discount_percent           UI helper for the editor's
--                                            "computed from %" toggle.
--                                            Pricing math always reads
--                                            the absolute price columns.
--   discount_codes.deleted_at                Soft-delete; validator joins
--                                            `deleted_at IS NULL`.
--   discount_codes.batch_id                  Groups bulk-generated codes.
--   page_subscriptions.pending_discount_*    "Apply this discount on the
--                                            next renewal invoice" intent.
--                                            Cleared once consumed.
--   sms_templates.body_fa_preview            Documentation-only mirror of
--                                            the body that lives on the
--                                            Kavenegar dashboard. We never
--                                            transmit raw text from here.
--   sms_templates.body_preview_updated_at    For sync indicator.
--   sms_templates.kavenegar_synced_at        Admin click-through time.
--
-- All new FKs are SET NULL or RESTRICT — never CASCADE — for plans,
-- users, and discount_codes references.

CREATE TABLE "app_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"description_fa" text,
	"updated_by_user_id" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscription_price_change_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plan_id" uuid NOT NULL,
	"actor_user_id" uuid NOT NULL,
	"previous_monthly_toman" integer,
	"previous_annual_toman" integer,
	"previous_annual_discount_percent" integer,
	"new_monthly_toman" integer,
	"new_annual_toman" integer,
	"new_annual_discount_percent" integer,
	"policy" text NOT NULL,
	"grandfathered_count" integer DEFAULT 0 NOT NULL,
	"notification_sent" boolean DEFAULT false NOT NULL,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscription_price_locks" (
	"page_id" uuid PRIMARY KEY NOT NULL,
	"plan_id" uuid NOT NULL,
	"billing_cycle" "billing_cycle",
	"locked_monthly_toman" integer,
	"locked_annual_toman" integer,
	"reason" text,
	"locked_by_user_id" uuid,
	"locked_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "discount_codes" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "discount_codes" ADD COLUMN "batch_id" uuid;--> statement-breakpoint
ALTER TABLE "page_subscriptions" ADD COLUMN "pending_discount_code_id" uuid;--> statement-breakpoint
ALTER TABLE "page_subscriptions" ADD COLUMN "pending_discount_applied_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "page_subscriptions" ADD COLUMN "pending_discount_queued_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "plans" ADD COLUMN "annual_discount_percent" integer;--> statement-breakpoint
ALTER TABLE "sms_templates" ADD COLUMN "body_fa_preview" text;--> statement-breakpoint
ALTER TABLE "sms_templates" ADD COLUMN "body_preview_updated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "sms_templates" ADD COLUMN "kavenegar_synced_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "app_settings" ADD CONSTRAINT "app_settings_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_price_change_events" ADD CONSTRAINT "subscription_price_change_events_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_price_change_events" ADD CONSTRAINT "subscription_price_change_events_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_price_locks" ADD CONSTRAINT "subscription_price_locks_page_id_profiles_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_price_locks" ADD CONSTRAINT "subscription_price_locks_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_price_locks" ADD CONSTRAINT "subscription_price_locks_locked_by_user_id_users_id_fk" FOREIGN KEY ("locked_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "subscription_price_change_events_plan_created_idx" ON "subscription_price_change_events" USING btree ("plan_id","created_at");--> statement-breakpoint
CREATE INDEX "subscription_price_locks_plan_id_idx" ON "subscription_price_locks" USING btree ("plan_id");--> statement-breakpoint
ALTER TABLE "page_subscriptions" ADD CONSTRAINT "page_subscriptions_pending_discount_code_id_discount_codes_id_fk" FOREIGN KEY ("pending_discount_code_id") REFERENCES "public"."discount_codes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "discount_codes_batch_id_idx" ON "discount_codes" USING btree ("batch_id") WHERE "discount_codes"."batch_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "discount_codes_active_normalized_idx" ON "discount_codes" USING btree ("code_normalized") WHERE "discount_codes"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "page_subscriptions_pending_discount_idx" ON "page_subscriptions" USING btree ("pending_discount_code_id") WHERE "page_subscriptions"."pending_discount_code_id" IS NOT NULL;