-- 0022_admin_audit_log.sql
--
-- Phase 13: admin audit log.
--
-- Records every manual admin action that mutates billing/entitlement
-- state so we have a forensic trail. Existing automated transitions
-- (cron-driven) live in `billing_transitions_log`; this table is for
-- HUMAN-initiated actions only.
--
-- Design notes:
--   - `actor_user_id` references the admin who performed the action.
--     ON DELETE RESTRICT — we never silently lose attribution.
--   - `target_user_id` / `target_page_id` / `target_invoice_id` are all
--     nullable; an action may target one, two, or none of them.
--   - `action` is plain text (no enum) so adding a new admin action is
--     a code change in `lib/admin-audit.ts`, not a follow-up migration.
--   - `reason` is required at the application layer (server actions
--     validate non-empty). Stored as text here so legacy rows or
--     migrations can backfill without violating NOT NULL.
--   - `metadata` captures action-specific fields (e.g. old/new plan,
--     extension days, feature key). JSONB for flexibility.
--   - No FK on `target_invoice_id` because invoices may eventually be
--     archived/canceled; we keep the audit row regardless.

CREATE TABLE "admin_audit_log" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "actor_user_id" uuid NOT NULL,
  "action" text NOT NULL,
  "target_user_id" uuid,
  "target_page_id" uuid,
  "target_invoice_id" uuid,
  "reason" text,
  "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "admin_audit_log"
  ADD CONSTRAINT "admin_audit_log_actor_user_id_users_id_fk"
  FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id")
  ON DELETE RESTRICT ON UPDATE NO ACTION;
--> statement-breakpoint
ALTER TABLE "admin_audit_log"
  ADD CONSTRAINT "admin_audit_log_target_user_id_users_id_fk"
  FOREIGN KEY ("target_user_id") REFERENCES "public"."users"("id")
  ON DELETE SET NULL ON UPDATE NO ACTION;
--> statement-breakpoint
ALTER TABLE "admin_audit_log"
  ADD CONSTRAINT "admin_audit_log_target_page_id_profiles_id_fk"
  FOREIGN KEY ("target_page_id") REFERENCES "public"."profiles"("id")
  ON DELETE SET NULL ON UPDATE NO ACTION;
--> statement-breakpoint
CREATE INDEX "admin_audit_log_target_page_id_idx"
  ON "admin_audit_log" USING btree ("target_page_id", "created_at" DESC);
--> statement-breakpoint
CREATE INDEX "admin_audit_log_target_user_id_idx"
  ON "admin_audit_log" USING btree ("target_user_id", "created_at" DESC);
--> statement-breakpoint
CREATE INDEX "admin_audit_log_target_invoice_id_idx"
  ON "admin_audit_log" USING btree ("target_invoice_id");
--> statement-breakpoint
CREATE INDEX "admin_audit_log_actor_user_id_idx"
  ON "admin_audit_log" USING btree ("actor_user_id", "created_at" DESC);
--> statement-breakpoint
CREATE INDEX "admin_audit_log_created_at_idx"
  ON "admin_audit_log" USING btree ("created_at" DESC);
