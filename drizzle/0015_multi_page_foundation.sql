-- Phase 1 of the subscription/multi-page foundation.
--
-- A user account can now own many pages (formerly "profiles"). The table
-- name stays `profiles` for now; we just relax the one-page-per-user
-- constraint and add `is_published` so a draft page can exist without a
-- public URL going live.
--
-- Backfill is a no-op: every existing user already has at most one row,
-- which is still valid in the new model.

-- Phase 1: multi-page foundation.
--
-- TODO(rename-cleanup): The table this touches is still called `profiles` for
-- historical reasons — semantically each row is now a "page" (a user can own
-- many). Future cleanup should rename `profiles` -> `pages` (and the related
-- `profile_*` tables). All Phase 2+ FKs that target a page reference
-- `profiles(id)`. See IMPLEMENTATION_PLAN.md §"Future cleanup".
--
-- Drop the unique constraint on user_id so a user can own many pages.
DROP INDEX IF EXISTS "profiles_user_id_idx";--> statement-breakpoint
CREATE INDEX "profiles_user_id_idx" ON "profiles" USING btree ("user_id");--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "is_published" boolean DEFAULT true NOT NULL;
