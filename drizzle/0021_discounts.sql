-- 0021_discounts.sql
--
-- Phase 11: discount codes + redemptions.
--
-- A `discount_codes` row is an admin-defined promotion. The
-- `code_normalized` column (lowercased + trimmed) carries the UNIQUE
-- constraint so user-entered codes match case-insensitively without
-- relying on collation. `applies_to_plan_keys` and
-- `applies_to_billing_cycles` are nullable text[] columns where NULL
-- means "any" — a code with `applies_to_plan_keys = NULL` applies to
-- every paid plan; an empty array `{}` would mean "no plans" which we
-- never write but accept defensively in the validator.
--
-- `discount_redemptions` records one row per invoice the code is
-- attached to. `recurring_cycles_remaining` carries the per-chain
-- counter forward: each renewal copies the prior redemption row,
-- decrements, and records a new row attached to the renewal invoice.
-- `recurring_cycles_remaining = 0` ⇒ chain ended; the code only fires
-- again if the user re-enters it manually (subject to max_per_user).
--
-- The `invoices.discount_code_id` column was added as a loose uuid in
-- Phase 6 (drizzle/0018) — this migration finally adds the FK now that
-- the `discount_codes` table exists.

CREATE TYPE "discount_type" AS ENUM (
  'percent',
  'fixed_amount',
  'free_months'
);
--> statement-breakpoint

CREATE TABLE "discount_codes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  -- Display form, preserved for the admin UI.
  "code" text NOT NULL,
  -- Lowercased + trimmed form. UNIQUE — this is the lookup key.
  "code_normalized" text NOT NULL,
  "name_fa" text NOT NULL,
  "description_fa" text,
  "discount_type" "discount_type" NOT NULL,
  -- Semantics depend on `discount_type`:
  --   percent       → 1..100, percentage off subtotal
  --   fixed_amount  → integer toman off subtotal (clamped to subtotal)
  --   free_months   → number of free calendar months granted; the
  --                   resulting invoice has total = 0 and the
  --                   subscription's period is extended by that many
  --                   months.
  "amount" integer NOT NULL,
  "starts_at" timestamp with time zone,
  "ends_at" timestamp with time zone,
  -- Cap on total redemptions across all users. NULL ⇒ unlimited.
  "max_redemptions" integer,
  -- Denormalized counter incremented inside the apply transaction so
  -- the validator can reject without a JOIN+COUNT against redemptions.
  "redemptions_count" integer NOT NULL DEFAULT 0,
  -- Cap per individual user. NULL ⇒ unlimited.
  "max_per_user" integer,
  -- If true, only users with no prior `paid` invoice on any page may
  -- redeem. Lets ops run "first-purchase" promos.
  "first_time_only" boolean NOT NULL DEFAULT false,
  -- NULL = applies to any paid plan. Stored as `text[]` to keep the
  -- validator schema-driven (admin can target Pro-only without us
  -- shipping new code).
  "applies_to_plan_keys" text[],
  -- NULL = applies to either monthly or annual.
  "applies_to_billing_cycles" text[],
  -- Total cycles the discount applies to (THIS invoice + N-1
  -- renewals). 1 ⇒ single-use. 12 ⇒ "1 year of discounted renewals".
  "recurring_cycles" integer NOT NULL DEFAULT 1,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_by_user_id" uuid,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "discount_codes"
  ADD CONSTRAINT "discount_codes_created_by_user_id_users_id_fk"
  FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id")
  ON DELETE SET NULL ON UPDATE NO ACTION;
--> statement-breakpoint
CREATE UNIQUE INDEX "discount_codes_code_normalized_idx"
  ON "discount_codes" USING btree ("code_normalized");
--> statement-breakpoint
CREATE INDEX "discount_codes_is_active_idx"
  ON "discount_codes" USING btree ("is_active");
--> statement-breakpoint

CREATE TABLE "discount_redemptions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "discount_code_id" uuid NOT NULL,
  "invoice_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "page_id" uuid NOT NULL,
  -- Toman amount actually deducted from this invoice's subtotal.
  "applied_amount_toman" integer NOT NULL,
  -- Cycles still owed AFTER this redemption. 0 ⇒ chain ended.
  "recurring_cycles_remaining" integer NOT NULL DEFAULT 0,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "discount_redemptions"
  ADD CONSTRAINT "discount_redemptions_discount_code_id_discount_codes_id_fk"
  FOREIGN KEY ("discount_code_id") REFERENCES "public"."discount_codes"("id")
  ON DELETE RESTRICT ON UPDATE NO ACTION;
--> statement-breakpoint
ALTER TABLE "discount_redemptions"
  ADD CONSTRAINT "discount_redemptions_invoice_id_invoices_id_fk"
  FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id")
  ON DELETE CASCADE ON UPDATE NO ACTION;
--> statement-breakpoint
ALTER TABLE "discount_redemptions"
  ADD CONSTRAINT "discount_redemptions_user_id_users_id_fk"
  FOREIGN KEY ("user_id") REFERENCES "public"."users"("id")
  ON DELETE CASCADE ON UPDATE NO ACTION;
--> statement-breakpoint
ALTER TABLE "discount_redemptions"
  ADD CONSTRAINT "discount_redemptions_page_id_profiles_id_fk"
  FOREIGN KEY ("page_id") REFERENCES "public"."profiles"("id")
  ON DELETE CASCADE ON UPDATE NO ACTION;
--> statement-breakpoint
CREATE UNIQUE INDEX "discount_redemptions_invoice_id_idx"
  ON "discount_redemptions" USING btree ("invoice_id");
--> statement-breakpoint
CREATE INDEX "discount_redemptions_code_id_idx"
  ON "discount_redemptions" USING btree ("discount_code_id");
--> statement-breakpoint
CREATE INDEX "discount_redemptions_user_id_idx"
  ON "discount_redemptions" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX "discount_redemptions_page_id_idx"
  ON "discount_redemptions" USING btree ("page_id");
--> statement-breakpoint

-- Phase 6 left `invoices.discount_code_id` FK-less because
-- `discount_codes` didn't exist yet. Add it now.
ALTER TABLE "invoices"
  ADD CONSTRAINT "invoices_discount_code_id_discount_codes_id_fk"
  FOREIGN KEY ("discount_code_id") REFERENCES "public"."discount_codes"("id")
  ON DELETE SET NULL ON UPDATE NO ACTION;
