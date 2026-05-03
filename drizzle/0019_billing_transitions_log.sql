-- 0019_billing_transitions_log.sql
--
-- Phase 7: subscription state machine + daily cron idempotency log.
--
-- The billing cron (`/api/cron/billing`) walks every non-Free
-- `page_subscriptions` row each day and decides which transition events
-- ("trial ending in 3 days", "period ended → grace", "grace ended →
-- expired", etc.) need to fire today. Side effects:
--
--   - generating an unpaid invoice when a trial ends,
--   - mutating `page_subscriptions.status`,
--   - calling `rebuildEntitlements(pageId)`,
--   - enqueueing SMS via `lib/sms-queue.ts`.
--
-- We need each transition event to fire EXACTLY ONCE, even if:
--
--   - the cron is invoked twice on the same day (retry, double-trigger),
--   - two cron hosts race the advisory lock (we fall back to per-row
--     idempotency, not just the lock),
--   - the operator backfills a missed day manually.
--
-- The composite primary key `(page_id, transition_type, key_date)` makes
-- the INSERT inside each transition's TX an idempotent claim: ON CONFLICT
-- DO NOTHING returns zero rows ⇒ "another worker already applied this
-- transition for this page on this key_date" ⇒ we skip the side effects.
--
-- `key_date` is the date that the transition is keyed off — for trial
-- transitions it's `trial_ends_at::date`, for renewal/grace transitions
-- it's `current_period_end::date`. Storing it as `date` (not `timestamp`)
-- collapses any time-of-day jitter so two cron runs on the same calendar
-- day land on the same key.

CREATE TABLE "billing_transitions_log" (
  "page_id" uuid NOT NULL,
  -- Free-form text instead of an ENUM so adding a new transition type in
  -- a code change doesn't require a follow-up migration. Values are
  -- enumerated in `lib/billing-state.ts` (`TransitionType`).
  "transition_type" text NOT NULL,
  -- Date that disambiguates *this* firing of the transition from a
  -- future one (e.g. next month's `period_ending_in_5d`). Always derived
  -- from a subscription column, never from `now()`.
  "key_date" date NOT NULL,
  -- Audit payload — what was true about the subscription when we fired
  -- the transition. Useful for support / replay.
  "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "billing_transitions_log_pkey"
    PRIMARY KEY ("page_id", "transition_type", "key_date")
);
--> statement-breakpoint
ALTER TABLE "billing_transitions_log"
  ADD CONSTRAINT "billing_transitions_log_page_id_profiles_id_fk"
  FOREIGN KEY ("page_id") REFERENCES "public"."profiles"("id")
  ON DELETE CASCADE ON UPDATE NO ACTION;
--> statement-breakpoint
CREATE INDEX "billing_transitions_log_created_at_idx"
  ON "billing_transitions_log" USING btree ("created_at");
