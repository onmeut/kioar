-- 0038_plan_key_denormalize.sql
--
-- Phase 4 (hardening): denormalize `plan_key` onto `page_subscriptions`.
--
-- Motivation
-- ----------
-- The billing cron (`transitionForToday`) currently JOINs `plans` on every
-- scan just to filter out Free rows (`WHERE p.key <> 'free'`). Adding a
-- `plan_key` column to `page_subscriptions` lets the cron drop that join
-- while still being trivially readable.  It also makes ad-hoc admin queries
-- ("how many pages are on Pro?") instant without joining.
--
-- Safety rules applied here:
--
--   1. Column is nullable first; data must be present before we can add
--      NOT NULL.  The backfill runs in the same migration, after which
--      we set NOT NULL in the next migration (or a future ALTER).
--      Do NOT flip to NOT NULL here — the migration runs against live
--      data and must not fail if the backfill misses a row due to a race.
--
--   2. `plan_id` stays as the source of truth (FK to `plans.id`).
--      `plan_key` is a read-optimised replica updated by every write site.
--      A future Postgres trigger can enforce the sync constraint (see the
--      trigger proposal in the Phase 4 implementation notes).
--
--   3. The composite index `(status, plan_key)` is created CONCURRENTLY
--      to avoid a long AccessShareLock on the table during a live deploy.
--      NOTE: CONCURRENTLY cannot run inside a transaction block; it is
--      separated below with `--> statement-breakpoint`.

-- Step 1: add nullable column.
ALTER TABLE "page_subscriptions"
  ADD COLUMN "plan_key" text;
--> statement-breakpoint

-- Step 2: backfill from the already-loaded plans table.
UPDATE "page_subscriptions" s
SET "plan_key" = p."key"
FROM "plans" p
WHERE p."id" = s."plan_id";
--> statement-breakpoint

-- Step 3: partial composite index for the cron's non-Free scan.
-- (plan_key IS NOT NULL because the backfill ran; partial on <> 'free'
--  keeps the index small — only rows the cron actually visits.)
CREATE INDEX CONCURRENTLY IF NOT EXISTS "ps_status_plan_key_idx"
  ON "page_subscriptions" ("status", "plan_key")
  WHERE "plan_key" <> 'free';
