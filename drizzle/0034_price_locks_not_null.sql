-- ----------------------------------------------------------------------
-- Phase 5 — Subscription price-lock invoicing.
--
-- Promote `locked_monthly_toman` and `locked_annual_toman` to NOT NULL.
-- Phase 4's plan-prices editor always inserts both columns, and the
-- read path in `billing-state.ts` LEFT JOINs the lock and uses both,
-- so leaving them nullable is an unnecessary correctness hazard.
--
-- Backfill: nothing to do — no production rows yet (locks are created
-- starting in Phase 4 only).
-- ----------------------------------------------------------------------
ALTER TABLE "subscription_price_locks" ALTER COLUMN "locked_monthly_toman" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "subscription_price_locks" ALTER COLUMN "locked_annual_toman" SET NOT NULL;