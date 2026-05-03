-- 0018_invoices_payments.sql
--
-- Phase 6: invoices + payments (Zarinpal).
--
-- An `invoices` row is the source of truth for every billable subscription
-- event: trial-end auto-bill, manual upgrade, renewal reminder follow-up.
-- A `payments` row is one Zarinpal transaction attempt against an invoice.
-- One invoice can have many payment attempts (re-checkout after failure)
-- but each Zarinpal `authority` token is unique, which is what keeps the
-- callback handler idempotent against retries / the user double-clicking
-- the gateway return URL.
--
-- Numbering: Phase 6 prints invoice numbers like `KIOAR-1404-000001` ─
-- `KIOAR` literal, Persian fiscal year (Farvardin-Esfand boundary), and a
-- per-year monotonically increasing sequence. The sequence lives in its
-- own `billing_invoice_sequences` table guarded by `pg_advisory_xact_lock`
-- so concurrent checkouts don't collide. We do NOT use `serial`/`bigserial`
-- because the year resets the counter; a per-year row in this table is
-- the simplest way to model that.
--
-- Money: ALL amounts are stored as integer toman. No floats, no decimals.
-- VAT defaults to 0 in the app (configurable via `BILLING_VAT_RATE` env);
-- the column exists so we can ship VAT-on-invoice without a schema change.

CREATE TYPE "invoice_status" AS ENUM (
  'unpaid',
  'paid',
  'expired',
  'canceled'
);
--> statement-breakpoint
CREATE TYPE "payment_provider" AS ENUM ('zarinpal');
--> statement-breakpoint
CREATE TYPE "payment_status" AS ENUM (
  'initiated',
  'verified',
  'failed'
);
--> statement-breakpoint

CREATE TABLE "invoices" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  -- Human-readable invoice number, e.g. `KIOAR-1404-000001`. Persian
  -- fiscal year prefix + 6-digit zero-padded per-year sequence. UNIQUE.
  "number" text NOT NULL,
  "user_id" uuid NOT NULL,
  "page_id" uuid NOT NULL,
  "plan_id" uuid NOT NULL,
  "billing_cycle" "billing_cycle" NOT NULL,
  -- Pre-discount, pre-VAT amount in integer toman.
  "subtotal_toman" integer NOT NULL,
  -- FK is added in Phase 11 when `discount_codes` lands. Until then we
  -- accept any uuid and validate at the application layer.
  "discount_code_id" uuid,
  "discount_amount_toman" integer NOT NULL DEFAULT 0,
  "vat_toman" integer NOT NULL DEFAULT 0,
  -- subtotal - discount + vat. The Zarinpal-charged amount.
  "total_toman" integer NOT NULL,
  "status" "invoice_status" NOT NULL DEFAULT 'unpaid',
  "due_at" timestamp with time zone NOT NULL,
  "paid_at" timestamp with time zone,
  "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "invoices"
  ADD CONSTRAINT "invoices_user_id_users_id_fk"
  FOREIGN KEY ("user_id") REFERENCES "public"."users"("id")
  ON DELETE RESTRICT ON UPDATE NO ACTION;
--> statement-breakpoint
ALTER TABLE "invoices"
  ADD CONSTRAINT "invoices_page_id_profiles_id_fk"
  FOREIGN KEY ("page_id") REFERENCES "public"."profiles"("id")
  ON DELETE RESTRICT ON UPDATE NO ACTION;
--> statement-breakpoint
ALTER TABLE "invoices"
  ADD CONSTRAINT "invoices_plan_id_plans_id_fk"
  FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id")
  ON DELETE RESTRICT ON UPDATE NO ACTION;
--> statement-breakpoint
CREATE UNIQUE INDEX "invoices_number_idx" ON "invoices" USING btree ("number");
--> statement-breakpoint
CREATE INDEX "invoices_user_id_idx" ON "invoices" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX "invoices_page_id_idx" ON "invoices" USING btree ("page_id");
--> statement-breakpoint
CREATE INDEX "invoices_status_due_at_idx"
  ON "invoices" USING btree ("status", "due_at");
--> statement-breakpoint

CREATE TABLE "payments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "invoice_id" uuid NOT NULL,
  "provider" "payment_provider" NOT NULL DEFAULT 'zarinpal',
  -- Zarinpal authority token, returned from PaymentRequest, used as the
  -- callback's idempotency key. UNIQUE so a duplicate callback hit can't
  -- create a second `payments` row.
  "authority" text NOT NULL,
  -- Zarinpal RefID, set after successful verification. Optional until then.
  "ref_id" text,
  "amount_toman" integer NOT NULL,
  "status" "payment_status" NOT NULL DEFAULT 'initiated',
  "verified_at" timestamp with time zone,
  -- Raw provider response captured for support / dispute resolution.
  "raw_response" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "payments"
  ADD CONSTRAINT "payments_invoice_id_invoices_id_fk"
  FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id")
  ON DELETE CASCADE ON UPDATE NO ACTION;
--> statement-breakpoint
CREATE UNIQUE INDEX "payments_authority_idx"
  ON "payments" USING btree ("authority");
--> statement-breakpoint
CREATE INDEX "payments_invoice_id_idx"
  ON "payments" USING btree ("invoice_id");
--> statement-breakpoint
CREATE INDEX "payments_status_idx" ON "payments" USING btree ("status");
--> statement-breakpoint

-- Per-Persian-fiscal-year monotonic counter for invoice numbering. We
-- allocate a row per year (created lazily by the numbering helper) and
-- guard increments with `pg_advisory_xact_lock(LOCK_NAMESPACE, year)`
-- so two concurrent checkouts can't read the same `last_seq` and emit
-- duplicate `KIOAR-YYYY-NNNNNN` numbers.
CREATE TABLE "billing_invoice_sequences" (
  -- Persian fiscal year, e.g. 1404.
  "year" integer PRIMARY KEY,
  "last_seq" integer NOT NULL DEFAULT 0,
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
