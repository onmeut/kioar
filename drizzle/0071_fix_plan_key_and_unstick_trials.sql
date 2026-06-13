-- 0071_fix_plan_key_and_unstick_trials.sql
--
-- INCIDENT FIX: ~1400+ subscriptions stuck on `status = 'trialing'` weeks
-- after `trial_ends_at` passed, because the daily billing cron never
-- transitioned them.
--
-- Root cause
-- ----------
-- Commit 12bad6e (2026-05-09) switched the cron's scan filter in
-- `transitionForToday` from `WHERE plans.key <> 'free'` (a JOIN to the
-- source of truth) to `WHERE page_subscriptions.plan_key <> 'free'` (a
-- denormalized column added in the SAME commit by 0038/0039).
--
-- Migration 0038_plan_key_denormalize.sql ends with
-- `CREATE INDEX CONCURRENTLY`. Our migration runner (scripts/migrate.ts ->
-- drizzle-orm migrate()) executes every statement of a migration file
-- inside ONE transaction (drizzle pg-core dialect.migrate wraps the file
-- in session.transaction). Postgres forbids CREATE INDEX CONCURRENTLY
-- inside a transaction block (SQLSTATE 25001), so 0038 throws on its last
-- statement and the WHOLE transaction rolls back — including the ADD COLUMN
-- and the backfill — and the journal row is never written. The production
-- raw-DDL safety net in scripts/server-wrapper.cjs covers only
-- show_public_phone / show_public_email / payment_instructions, NOT
-- plan_key. Net effect: `plan_key` is absent or NULL/'free' in prod, so the
-- cron's partial scan visits zero trialing rows and trials never expire.
--
-- This migration is the corrective fix. It is fully transaction-safe (no
-- CONCURRENTLY) and idempotent (safe to re-run):
--
--   Step 1  Ensure the `plan_key` column exists and is correctly backfilled
--           from `plan_id` (re-does what 0038 failed to commit).
--   Step 2  Ensure the partial index exists (non-concurrent — a brief
--           build-time lock on this table is acceptable; the table is small).
--   Step 3  Ensure the BEFORE INSERT/UPDATE sync trigger exists (re-does
--           0039; CREATE OR REPLACE is idempotent).
--   Step 4  Backfill `billing_transitions_log` for the stuck cohort so the
--           now-healthy cron treats every retroactive transition as already
--           handled. This SUPPRESSES the SMS/invoice storm that would
--           otherwise fire ~1400 `trial_ending_today` invoices + reminder
--           texts the moment the cron sees these rows.
--   Step 5  Silently transition the stuck cohort to its correct terminal
--           state, mirroring `applyTransition` in lib/billing-state.ts:
--             * still within grace window  -> status='grace'
--             * past grace window          -> status='expired', drop to Free
--           Rows with cancel_at_period_end or a pending plan change are
--           LEFT for the cron (they route to different transitions); see
--           Step 4's exclusion. Entitlements are rebuilt for expired rows.
--
-- "Stuck cohort" is defined ONCE in Step 4/5 identically:
--   status = 'trialing' AND trial_ends_at IS NOT NULL AND trial_ends_at < now()
--   AND cancel_at_period_end = false AND pending_plan_change_plan_id IS NULL
--   AND plan_key <> 'free'   (after Step 1 backfill, paid trials only)

-- ---------------------------------------------------------------------------
-- Step 1: ensure plan_key exists + is correct (repairs failed 0038).
-- ---------------------------------------------------------------------------
ALTER TABLE "page_subscriptions"
  ADD COLUMN IF NOT EXISTS "plan_key" text;
--> statement-breakpoint

UPDATE "page_subscriptions" s
SET "plan_key" = p."key"
FROM "plans" p
WHERE p."id" = s."plan_id"
  AND s."plan_key" IS DISTINCT FROM p."key";
--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- Step 2: partial composite index for the cron's non-Free scan.
-- NON-CONCURRENT on purpose so it commits inside the migration transaction.
-- IF NOT EXISTS makes it a no-op if a prior attempt already built it.
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS "ps_status_plan_key_idx"
  ON "page_subscriptions" ("status", "plan_key")
  WHERE "plan_key" <> 'free';
--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- Step 3: ensure the sync trigger exists (repairs 0039; idempotent).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION sync_page_subscription_plan_key()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'INSERT') OR (NEW.plan_id IS DISTINCT FROM OLD.plan_id) THEN
    SELECT "key" INTO NEW.plan_key
    FROM "plans"
    WHERE "id" = NEW.plan_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint

DROP TRIGGER IF EXISTS trg_sync_plan_key ON "page_subscriptions";
--> statement-breakpoint

CREATE TRIGGER trg_sync_plan_key
  BEFORE INSERT OR UPDATE ON "page_subscriptions"
  FOR EACH ROW
  EXECUTE FUNCTION sync_page_subscription_plan_key();
--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- Step 4: backfill billing_transitions_log for the stuck cohort, so the
-- cron treats these transitions as already fired (no retroactive SMS /
-- invoice burst). We log every transition the cron would otherwise emit
-- for an elapsed trial:
--   - trial_ending_in_3d    keyed on trial_ends_at::date
--   - trial_ending_today    keyed on trial_ends_at::date  (suppresses the
--                           retroactive UNPAID invoice + SMS)
--   - period_ended_to_grace keyed on trial_ends_at::date
--   - grace_ended_to_expired keyed on trial_ends_at::date  (current_period_end
--                           is anchored to trial_ends_at in Step 5, and the
--                           cron keys this transition off current_period_end)
-- ON CONFLICT DO NOTHING => safe to re-run and never clobbers a real firing.
-- ---------------------------------------------------------------------------
INSERT INTO "billing_transitions_log"
  ("page_id", "transition_type", "key_date", "metadata")
SELECT
  s."page_id",
  t."transition_type",
  (s."trial_ends_at" AT TIME ZONE 'UTC')::date AS key_date,
  jsonb_build_object(
    'source', '0071_unstick_trials_backfill',
    'planKey', s."plan_key",
    'status_before', s."status"
  )
FROM "page_subscriptions" s
CROSS JOIN (
  VALUES
    ('trial_ending_in_3d'),
    ('trial_ending_today'),
    ('period_ended_to_grace'),
    ('grace_ended_to_expired')
) AS t("transition_type")
WHERE s."status" = 'trialing'
  AND s."trial_ends_at" IS NOT NULL
  AND s."trial_ends_at" < now()
  AND s."cancel_at_period_end" = false
  AND s."pending_plan_change_plan_id" IS NULL
  AND s."plan_key" <> 'free'
ON CONFLICT ("page_id", "transition_type", "key_date") DO NOTHING;
--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- We split the cohort into two passes, ordered so each pass keys off the
-- status the previous pass produced — no temp table, no ordering hazard:
--
--   5a: ALL elapsed trials -> status='grace', current_period_end anchored to
--       trial_ends_at (mirrors period_ended_to_grace in billing-state).
--   5b: of those, the ones whose grace window is ALSO exhausted
--       (current_period_end < now() - grace_days) -> status='expired',
--       dropped to Free, entitlements rebuilt (mirrors grace_ended_to_expired).
--
-- Grace days are read live from app_settings (fallback 7) so the boundary
-- matches the cron's loadBillingConfig exactly.
-- ---------------------------------------------------------------------------

-- Step 5a: elapsed trials -> grace. Keeps the paid plan + entitlements; the
-- only change is status + the period-end anchor. cancel_at_period_end and
-- pending_plan_change rows are excluded — they route to different cron
-- transitions and are intentionally left for the (now-healthy) cron.
UPDATE "page_subscriptions" s
SET
  "status" = 'grace',
  "current_period_end" = s."trial_ends_at"
WHERE s."status" = 'trialing'
  AND s."trial_ends_at" IS NOT NULL
  AND s."trial_ends_at" < now()
  AND s."cancel_at_period_end" = false
  AND s."pending_plan_change_plan_id" IS NULL
  AND s."plan_key" <> 'free';
--> statement-breakpoint

-- Step 5b: of the rows just moved to grace whose grace window is also past,
-- drop to Free + expired and rebuild entitlements. A single data-modifying
-- CTE: the UPDATE flips the subscription and RETURNS the affected page_ids;
-- downstream CTEs delete the stale subscription-sourced entitlements and
-- re-insert the Free plan's features. Scoped to plan_key <> 'free' BEFORE the
-- update (the trg_sync_plan_key trigger rewrites plan_key='free' on the flip)
-- and to the trial-origin metadata key_date so we never touch a real paid
-- subscription that happens to be sitting in grace from normal operation.
WITH grace_days AS (
  SELECT COALESCE(
    (SELECT (value #>> '{}')::int FROM "app_settings"
     WHERE "key" = 'billing.grace_period_days'),
    7
  ) AS days
),
expired AS (
  UPDATE "page_subscriptions" s
  SET
    "plan_id" = (SELECT "id" FROM "plans" WHERE "key" = 'free'),
    "billing_cycle" = 'monthly',
    "status" = 'expired',
    "current_period_start" = now(),
    "current_period_end" = now() + interval '100 years',
    "trial_ends_at" = NULL,
    "cancel_at_period_end" = false,
    "pending_plan_change_plan_id" = NULL
  FROM grace_days g
  WHERE s."status" = 'grace'
    AND s."plan_key" <> 'free'
    AND s."current_period_end" < now() - (g.days || ' days')::interval
    AND EXISTS (
      SELECT 1 FROM "billing_transitions_log" btl
      WHERE btl."page_id" = s."page_id"
        AND btl."transition_type" = 'grace_ended_to_expired'
        AND btl."metadata" ->> 'source' = '0071_unstick_trials_backfill'
    )
  RETURNING s."page_id" AS page_id
),
dropped AS (
  DELETE FROM "page_entitlements" pe
  USING expired e
  WHERE pe."page_id" = e.page_id
    AND pe."source" = 'subscription'
  RETURNING pe."page_id"
)
INSERT INTO "page_entitlements" ("page_id", "feature_key", "source")
SELECT DISTINCT e.page_id, f."key", 'subscription'::"entitlement_source"
FROM expired e
JOIN "page_subscriptions" s ON s."page_id" = e.page_id
JOIN "plan_features" pf     ON pf."plan_id" = s."plan_id"
JOIN "features" f           ON f."id" = pf."feature_id"
ON CONFLICT ("page_id", "feature_key") DO NOTHING;
