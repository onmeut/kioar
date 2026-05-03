-- 0020_sms.sql
--
-- Phase 10: SMS templates registry + outbound queue.
--
-- Until now, billing/trial code has called `enqueueSms()` (see
-- `src/lib/sms-queue.ts`), but the implementation only logged the
-- intent. This migration introduces the persistent queue + the
-- admin-editable template registry that the worker (`/api/cron/sms`,
-- every minute) drains against Kavenegar's lookup endpoint.
--
-- Two tables:
--
--   1. `sms_templates` — one row per logical event (`trial_started`,
--      `payment_received`, …). Owned by ops via `/admin/sms`.
--      `kavenegar_template` is the actual template name registered with
--      Kavenegar; nullable until ops fills it in. `variable_schema`
--      records the variable keys the template understands so the admin
--      tooling can lint outgoing payloads.
--
--   2. `sms_queue` — one row per send attempt cluster. `idempotency_key`
--      is the dedup boundary: callers (billing cron, callback, trial
--      start) construct stable keys like
--      `payment_received:{invoiceId}` and `INSERT … ON CONFLICT DO
--      NOTHING` collapses retries onto a single row. `template_key` is
--      stored as plain text (no FK) so adding a new event in code
--      doesn't fail the INSERT before ops has seeded the matching
--      template — the worker handles missing rows by marking the
--      message `failed` with a clear `last_error`.
--
-- Worker contract (see `lib/sms-queue.ts#processSmsQueue`):
--
--   - Claim up to N `queued` rows whose `scheduled_for <= now()` using
--     `FOR UPDATE SKIP LOCKED` so concurrent workers don't double-send.
--   - Mark `sending`, dispatch to Kavenegar, mark `sent` on success.
--   - On failure: increment `attempts`. attempts<3 ⇒ reschedule
--     (`scheduled_for = now() + 2^attempts minutes`, capped at 60m) and
--     drop back to `queued`. attempts>=3 ⇒ mark `failed`.

CREATE TYPE "sms_status" AS ENUM ('queued', 'sending', 'sent', 'failed');
--> statement-breakpoint

CREATE TABLE "sms_templates" (
  "key" text PRIMARY KEY NOT NULL,
  "name_fa" text NOT NULL,
  "description_fa" text,
  -- Kavenegar-side template name (verify/lookup). NULL = not yet
  -- mapped; the worker treats this as a hard failure with
  -- `last_error = 'template_not_mapped'` so an operator notices.
  "kavenegar_template" text,
  -- Array of variable keys the template understands, e.g.
  -- ["plan", "daysLeft"]. Used by `/admin/sms` to validate payloads
  -- and by the test-send tool to render a preview.
  "variable_schema" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint

CREATE TABLE "sms_queue" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  -- Optional owner FK so the admin queue browser can pivot on user.
  -- Many enqueues happen from cron paths where the user isn't loaded
  -- (we only have phone), so this stays nullable.
  "user_id" uuid,
  -- Always stored in the same `98...` form the rest of the codebase
  -- uses (see `lib/phone.ts`). The Kavenegar adapter converts to the
  -- `0...` form on dispatch.
  "phone" text NOT NULL,
  "template_key" text NOT NULL,
  "variables" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "status" "sms_status" NOT NULL DEFAULT 'queued',
  "scheduled_for" timestamp with time zone NOT NULL DEFAULT now(),
  "sent_at" timestamp with time zone,
  "attempts" integer NOT NULL DEFAULT 0,
  "last_error" text,
  -- UNIQUE — collapses caller-side retries onto one row. See header.
  "idempotency_key" text NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "sms_queue"
  ADD CONSTRAINT "sms_queue_user_id_users_id_fk"
  FOREIGN KEY ("user_id") REFERENCES "public"."users"("id")
  ON DELETE SET NULL ON UPDATE NO ACTION;
--> statement-breakpoint
CREATE UNIQUE INDEX "sms_queue_idempotency_key_idx"
  ON "sms_queue" USING btree ("idempotency_key");
--> statement-breakpoint
-- Hot path index for the worker: pick due `queued` rows.
CREATE INDEX "sms_queue_status_scheduled_for_idx"
  ON "sms_queue" USING btree ("status", "scheduled_for");
--> statement-breakpoint
CREATE INDEX "sms_queue_created_at_idx"
  ON "sms_queue" USING btree ("created_at");
