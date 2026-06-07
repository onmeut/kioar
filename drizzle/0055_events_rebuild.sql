-- Events feature — full rebuild.
--
-- The previous `events` / `event_registrations` tables were a throwaway,
-- admin-only, GLOBAL prototype (flat location text, 2-state registrations,
-- no pricing/approval/capacity/questions/check-in). The real feature is
-- PAGE-OWNED (a block on a profile, like booking/form/product blocks),
-- with a full registration state machine, manual paid-receipt flow,
-- discount codes, custom questions, and QR door check-in.
--
-- Per the agreed plan the throwaway rows are test-only and dropped. We drop
-- the old tables + old enums and recreate everything cleanly. `events` /
-- `event_registrations` keep their names but are redefined.
--
-- Migration discipline: this file pairs with the matching schema.ts change
-- in the same commit, and an entry in drizzle/meta/_journal.json. Verified
-- locally with `npm run db:migrate` before pushing. Run programmatic
-- migrate() ONLY — never `drizzle-kit migrate` (phantom-apply bug).

-- 1. Drop old tables (registrations first — it FKs events). The old enums
--    are only referenced by these tables, so they can be dropped after.
DROP TABLE IF EXISTS "event_registrations" CASCADE;
DROP TABLE IF EXISTS "events" CASCADE;
DROP TYPE IF EXISTS "registration_status";
DROP TYPE IF EXISTS "event_status";

-- 2. Enums (recreated). `event_status` now uses cancelled (not closed);
--    `event_registration_status` is the full state machine.
DO $$ BEGIN
  CREATE TYPE "event_status" AS ENUM ('draft', 'published', 'cancelled');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "event_location_type" AS ENUM ('physical', 'online');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "event_price_type" AS ENUM ('free', 'paid');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "event_registration_status" AS ENUM (
    'pending_approval',
    'payment_pending',
    'payment_submitted',
    'approved',
    'waitlisted',
    'rejected',
    'cancelled',
    'attended'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "event_question_kind" AS ENUM (
    'short_text', 'long_text', 'single_select', 'multi_select'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "event_discount_type" AS ENUM ('percentage', 'fixed');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 3. events — a PAGE-OWNED block (mirrors booking/form/product block shape:
--    profile_id + sort_order + is_active + spotlight + animation_style).
--    Money is bigint toman (no fractional). Future events store the host
--    IANA timezone snapshot. online_url is host-only at the app layer —
--    stripped from public payloads unless the viewer is approved/attended.
CREATE TABLE IF NOT EXISTS "events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "page_id" uuid NOT NULL REFERENCES "profiles"("id") ON DELETE CASCADE,
  "created_by_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "slug" text NOT NULL,
  "title" text NOT NULL,
  "description" text,
  "cover_url" text,
  "location_type" "event_location_type" NOT NULL DEFAULT 'physical',
  "location_address" text,
  "online_url" text,
  "timezone" text NOT NULL DEFAULT 'Asia/Tehran',
  "starts_at" timestamptz NOT NULL,
  "ends_at" timestamptz,
  "capacity" integer,
  "price_type" "event_price_type" NOT NULL DEFAULT 'free',
  "price_toman" bigint NOT NULL DEFAULT 0,
  "approval_required" boolean NOT NULL DEFAULT false,
  "receipt_upload_enabled" boolean NOT NULL DEFAULT false,
  "waitlist_enabled" boolean NOT NULL DEFAULT false,
  "status" "event_status" NOT NULL DEFAULT 'draft',
  "sort_order" integer NOT NULL DEFAULT 0,
  "is_active" boolean NOT NULL DEFAULT true,
  "spotlight" "block_spotlight" NOT NULL DEFAULT 'none',
  "animation_style" "block_animation",
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "events_slug_idx" ON "events" ("slug");
CREATE INDEX IF NOT EXISTS "events_page_sort_idx" ON "events" ("page_id", "sort_order");
CREATE INDEX IF NOT EXISTS "events_status_starts_at_idx" ON "events" ("status", "starts_at");

-- 4. event_questions — custom registration questions. Self-contained
--    (inspired by form_fields, deliberately NOT coupled to it).
CREATE TABLE IF NOT EXISTS "event_questions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "event_id" uuid NOT NULL REFERENCES "events"("id") ON DELETE CASCADE,
  "kind" "event_question_kind" NOT NULL,
  "label" text NOT NULL,
  "required" boolean NOT NULL DEFAULT false,
  "options" jsonb,
  "sort_order" integer NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS "event_questions_event_sort_idx"
  ON "event_questions" ("event_id", "sort_order");

-- 5. event_registrations — full state machine. answers keyed by question id.
--    receipt_key is the PRIVATE storage object key (never a public URL);
--    served via owner-gated presigned URL. expected_toman is the amount the
--    attendee owes after any discount (snapshot at registration).
CREATE TABLE IF NOT EXISTS "event_registrations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "event_id" uuid NOT NULL REFERENCES "events"("id") ON DELETE CASCADE,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "status" "event_registration_status" NOT NULL DEFAULT 'pending_approval',
  "answers" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "receipt_key" text,
  "discount_code" text,
  "expected_toman" bigint NOT NULL DEFAULT 0,
  "decided_at" timestamptz,
  "cancelled_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "event_registrations_event_user_idx"
  ON "event_registrations" ("event_id", "user_id");
CREATE INDEX IF NOT EXISTS "event_registrations_user_idx"
  ON "event_registrations" ("user_id");
CREATE INDEX IF NOT EXISTS "event_registrations_event_status_idx"
  ON "event_registrations" ("event_id", "status");

-- 6. event_discount_codes — per-event codes. value is percent (1-100) for
--    percentage, or toman for fixed. used_count bumped on apply; usage_limit
--    NULL = unlimited. Codes are validated server-side; money never moves.
CREATE TABLE IF NOT EXISTS "event_discount_codes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "event_id" uuid NOT NULL REFERENCES "events"("id") ON DELETE CASCADE,
  "code" text NOT NULL,
  "type" "event_discount_type" NOT NULL,
  "value" bigint NOT NULL,
  "usage_limit" integer,
  "used_count" integer NOT NULL DEFAULT 0,
  "expires_at" timestamptz,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

-- Case-insensitive uniqueness per event (codes compared lower-cased).
CREATE UNIQUE INDEX IF NOT EXISTS "event_discount_codes_event_code_idx"
  ON "event_discount_codes" ("event_id", lower("code"));

-- 7. event_checkins — auditable, idempotent door check-in.
--    unique(registration_id) is what makes a double-scan a no-op: the second
--    scan finds the existing row and reports "already checked in at <time>".
CREATE TABLE IF NOT EXISTS "event_checkins" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "event_id" uuid NOT NULL REFERENCES "events"("id") ON DELETE CASCADE,
  "registration_id" uuid NOT NULL REFERENCES "event_registrations"("id") ON DELETE CASCADE,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "scanned_by_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "checked_in_at" timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "event_checkins_registration_idx"
  ON "event_checkins" ("registration_id");
CREATE INDEX IF NOT EXISTS "event_checkins_event_idx"
  ON "event_checkins" ("event_id");
