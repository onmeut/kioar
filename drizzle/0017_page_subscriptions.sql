-- 0017_page_subscriptions.sql
--
-- Phase 3: per-page subscription + entitlement cache.
--
-- Every page (currently a row in `profiles`, see 0015 / lib/pages.ts) gets
-- exactly one `page_subscriptions` row. Free is the default; paid plans
-- replace it via Phase 6's checkout flow. The entitlement cache
-- (`page_entitlements`) is the read-side projection that Phase 4's
-- `pageHasFeature` reads — denormalized so we never join through
-- subscription -> plan -> plan_features on every public page render.
--
-- Conventions enforced here:
--
--   1. `page_subscriptions.page_id` is UNIQUE. One subscription per page,
--      ever. State changes mutate the row in place; we don't keep history
--      in this table (Phase 6's `invoices` is the audit trail).
--
--   2. Free plans use `current_period_end = now() + interval '100 years'`
--      as a sentinel meaning "never expires, never invoices". The Phase 7
--      cron (`/api/cron/billing`) MUST filter out subscriptions whose
--      `plan.key = 'free'` before doing renewal / grace / expiry work.
--      TODO(phase-7): when the billing cron lands, add a `WHERE p.key
--      <> 'free'` (or equivalent) to every state-machine query so Free
--      rows are inert.
--
--   3. `page_entitlements` has `(page_id, feature_key)` as composite PK.
--      `feature_key` is denormalized from `features.key` on purpose — we
--      want this lookup to be a hash probe, not a join. When the matrix
--      changes, Phase 4's `rebuildEntitlements(pageId)` rewrites the rows
--      for that page from `plan_features`.
--
--   4. The `source` column lets admins/promo grants survive a rebuild:
--      `subscription` rows are wiped + re-created on rebuild, but
--      `admin_grant` and unexpired `promo` rows are preserved.

CREATE TYPE "subscription_status" AS ENUM (
  'active',
  'trialing',
  'pending_renewal',
  'grace',
  'expired',
  'canceled'
);
--> statement-breakpoint
CREATE TYPE "billing_cycle" AS ENUM ('monthly', 'annual');
--> statement-breakpoint
CREATE TYPE "entitlement_source" AS ENUM ('subscription', 'admin_grant', 'promo');
--> statement-breakpoint

CREATE TABLE "page_subscriptions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "page_id" uuid NOT NULL,
  "plan_id" uuid NOT NULL,
  "billing_cycle" "billing_cycle" NOT NULL DEFAULT 'monthly',
  "status" "subscription_status" NOT NULL DEFAULT 'active',
  "current_period_start" timestamp with time zone NOT NULL DEFAULT now(),
  "current_period_end" timestamp with time zone NOT NULL,
  "trial_ends_at" timestamp with time zone,
  "has_used_trial_pro" boolean NOT NULL DEFAULT false,
  "has_used_trial_business" boolean NOT NULL DEFAULT false,
  "cancel_at_period_end" boolean NOT NULL DEFAULT false,
  "pending_plan_change_plan_id" uuid,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "page_subscriptions"
  ADD CONSTRAINT "page_subscriptions_page_id_profiles_id_fk"
  FOREIGN KEY ("page_id") REFERENCES "public"."profiles"("id")
  ON DELETE CASCADE ON UPDATE NO ACTION;
--> statement-breakpoint
ALTER TABLE "page_subscriptions"
  ADD CONSTRAINT "page_subscriptions_plan_id_plans_id_fk"
  FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id")
  ON DELETE RESTRICT ON UPDATE NO ACTION;
--> statement-breakpoint
ALTER TABLE "page_subscriptions"
  ADD CONSTRAINT "page_subscriptions_pending_plan_change_plan_id_plans_id_fk"
  FOREIGN KEY ("pending_plan_change_plan_id") REFERENCES "public"."plans"("id")
  ON DELETE SET NULL ON UPDATE NO ACTION;
--> statement-breakpoint
CREATE UNIQUE INDEX "page_subscriptions_page_id_idx"
  ON "page_subscriptions" USING btree ("page_id");
--> statement-breakpoint
CREATE INDEX "page_subscriptions_plan_id_idx"
  ON "page_subscriptions" USING btree ("plan_id");
--> statement-breakpoint
CREATE INDEX "page_subscriptions_status_period_end_idx"
  ON "page_subscriptions" USING btree ("status", "current_period_end");
--> statement-breakpoint

CREATE TABLE "page_entitlements" (
  "page_id" uuid NOT NULL,
  "feature_key" text NOT NULL,
  "source" "entitlement_source" NOT NULL DEFAULT 'subscription',
  "granted_at" timestamp with time zone NOT NULL DEFAULT now(),
  "expires_at" timestamp with time zone,
  CONSTRAINT "page_entitlements_pkey" PRIMARY KEY ("page_id", "feature_key")
);
--> statement-breakpoint
ALTER TABLE "page_entitlements"
  ADD CONSTRAINT "page_entitlements_page_id_profiles_id_fk"
  FOREIGN KEY ("page_id") REFERENCES "public"."profiles"("id")
  ON DELETE CASCADE ON UPDATE NO ACTION;
--> statement-breakpoint
CREATE INDEX "page_entitlements_feature_key_idx"
  ON "page_entitlements" USING btree ("feature_key");
--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- Backfill (must run inside this migration, not a separate step).
--
-- Every existing page gets a Free subscription + Free entitlements. The
-- 100-year sentinel matches the convention documented at the top of this
-- file. If the Free plan or its plan_features rows aren't seeded yet
-- (e.g. someone applied this migration without running `pnpm db:seed:plans`
-- first on a fresh DB), these statements are no-ops — the seeder is then
-- responsible for populating subscriptions/entitlements via app code on
-- next page interaction. On Amir's existing dev DB the Free plan is
-- already seeded, so this fills in every existing row in one shot.
-- ---------------------------------------------------------------------------

INSERT INTO "page_subscriptions"
  ("page_id", "plan_id", "billing_cycle", "status",
   "current_period_start", "current_period_end")
SELECT
  pr."id",
  p."id",
  'monthly'::"billing_cycle",
  'active'::"subscription_status",
  now(),
  now() + interval '100 years'
FROM "profiles" pr
CROSS JOIN LATERAL (SELECT "id" FROM "plans" WHERE "key" = 'free' LIMIT 1) p
WHERE NOT EXISTS (
  SELECT 1 FROM "page_subscriptions" ps WHERE ps."page_id" = pr."id"
);
--> statement-breakpoint

INSERT INTO "page_entitlements" ("page_id", "feature_key", "source")
SELECT pr."id", f."key", 'subscription'::"entitlement_source"
FROM "profiles" pr
CROSS JOIN "plans" p
JOIN "plan_features" pf ON pf."plan_id" = p."id"
JOIN "features" f ON f."id" = pf."feature_id"
WHERE p."key" = 'free'
ON CONFLICT ("page_id", "feature_key") DO NOTHING;
