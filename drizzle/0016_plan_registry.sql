-- Phase 2: plan + feature registry.
--
-- Three tables form the source of truth for "what does each plan include":
--   plans          — free / pro / business definitions with prices in toman.
--   features       — every gateable capability, identified by a stable `key`.
--   plan_features  — N-to-N mapping; rows that exist mean the plan grants the
--                    feature. `limit_value` is the numeric cap (NULL = boolean
--                    grant, value = quantitative limit such as MB of storage).
--
-- All product code reads through this registry via lib/entitlements.ts. The
-- strings 'pro' and 'business' must NEVER appear in feature-gating logic —
-- only in the registry, the admin matrix editor, and the public pricing page.

CREATE TYPE "plan_key" AS ENUM ('free', 'pro', 'business');--> statement-breakpoint

CREATE TABLE "plans" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "key" "plan_key" NOT NULL,
        "name_fa" text NOT NULL,
        "description_fa" text,
        "price_monthly_toman" integer DEFAULT 0 NOT NULL,
        "price_annual_toman" integer DEFAULT 0 NOT NULL,
        "trial_days" integer DEFAULT 7 NOT NULL,
        "display_order" integer DEFAULT 0 NOT NULL,
        "is_active" boolean DEFAULT true NOT NULL,
        "is_default" boolean DEFAULT false NOT NULL,
        "created_at" timestamp with time zone DEFAULT now() NOT NULL,
        "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
        CONSTRAINT "plans_key_unique" UNIQUE("key")
);--> statement-breakpoint

CREATE UNIQUE INDEX "plans_default_singleton_idx"
        ON "plans" ((1)) WHERE "is_default" = true;--> statement-breakpoint

CREATE TABLE "features" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "key" text NOT NULL,
        "name_fa" text NOT NULL,
        "description_fa" text,
        "category" text NOT NULL,
        "display_order" integer DEFAULT 0 NOT NULL,
        "created_at" timestamp with time zone DEFAULT now() NOT NULL,
        CONSTRAINT "features_key_unique" UNIQUE("key")
);--> statement-breakpoint

CREATE INDEX "features_category_idx" ON "features" USING btree ("category");--> statement-breakpoint

CREATE TABLE "plan_features" (
        "plan_id" uuid NOT NULL REFERENCES "plans"("id") ON DELETE CASCADE,
        "feature_id" uuid NOT NULL REFERENCES "features"("id") ON DELETE CASCADE,
        "limit_value" bigint,
        "created_at" timestamp with time zone DEFAULT now() NOT NULL,
        CONSTRAINT "plan_features_pk" PRIMARY KEY ("plan_id", "feature_id")
);--> statement-breakpoint

CREATE INDEX "plan_features_feature_idx"
        ON "plan_features" USING btree ("feature_id");
