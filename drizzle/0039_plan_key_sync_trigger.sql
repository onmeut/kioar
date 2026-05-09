-- 0039_plan_key_sync_trigger.sql
--
-- Safety trigger: keep `page_subscriptions.plan_key` in sync with
-- `plan_id` on every INSERT or UPDATE.
--
-- Motivation
-- ----------
-- `plan_key` is a denormalized read-replica of `plans.key` written by
-- every application code path that changes `plan_id` (added in 0038).
-- The application-level writes are correct at code-review time, but a
-- future code path that forgets to co-update `plan_key` would silently
-- produce a stale value.  The worst failure mode is `plan_key = 'free'`
-- on a paying subscriber — the partial index on `(status, plan_key)`
-- excludes `plan_key = 'free'` rows, so the billing cron would never
-- visit that subscription and the subscriber would never get transition
-- reminders or grace/expiry processing.
--
-- The trigger is BEFORE INSERT OR UPDATE so it fires before the row is
-- written.  It only re-derives `plan_key` when `plan_id` actually
-- changes (or on INSERT), keeping the overhead to a single sub-select
-- on the `plans` PK — effectively a hash-join on a tiny table.
--
-- The trigger intentionally does NOT enforce NOT NULL on `plan_key`.
-- If `plan_id` references a plans row that somehow doesn't exist (an
-- FK violation that Postgres would catch separately), we let the FK
-- constraint fire rather than surfacing a misleading NULL here.

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

CREATE OR REPLACE TRIGGER trg_sync_plan_key
  BEFORE INSERT OR UPDATE ON "page_subscriptions"
  FOR EACH ROW
  EXECUTE FUNCTION sync_page_subscription_plan_key();
