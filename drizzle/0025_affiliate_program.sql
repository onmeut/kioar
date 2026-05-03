-- 0025_affiliate_program.sql
--
-- Affiliate Program — built ON TOP of the existing referral primitives
-- (referral_codes, referrals, referral_credits) rather than as a parallel
-- system. ONE attribution lifecycle, TWO reward strategies.
--
-- Architecture decision summary:
--
--   * `referral_codes` gains a `kind` discriminator. Existing rows stay
--     `kind = 'user'` and behave exactly as before (free-month rewards
--     for both sides). Affiliate codes are minted when an admin approves
--     an `affiliate_applications` row; they carry a SNAPSHOT of the
--     commercial terms that were in effect at approval time, so future
--     changes to global settings don't retroactively re-price the deal.
--
--   * `referrals` gains commission fields. Each rewarded affiliate
--     conversion writes ONE referrals row with non-null commission
--     fields — there's no separate ledger table because the row is the
--     ledger entry. This keeps the audit trail tight: click → signup →
--     payment → commission → payout, all on one row, all FK-linked.
--
--   * NEW tables: `affiliate_applications` (intake + approval state),
--     `affiliate_profiles` (banking + contact PII, lazy-collected),
--     `affiliate_payouts` (request → processing → paid history),
--     `affiliate_settings` (singleton; admin-editable defaults).
--
-- Money: ALL amounts are integer toman (matches the rest of the
-- billing system). Never float, never rial except at the Zarinpal
-- boundary in lib/zarinpal.ts.

-- ---------------------------------------------------------------------------
-- 1. Extend `referral_codes` with affiliate metadata.
-- ---------------------------------------------------------------------------

ALTER TABLE "referral_codes"
  -- 'user' (default — friend-invite codes) or 'affiliate' (approved partner).
  ADD COLUMN "kind" text NOT NULL DEFAULT 'user',
  -- Only meaningful when kind='affiliate'.
  -- 'active' | 'paused' | 'banned'. NULL for user codes.
  ADD COLUMN "affiliate_status" text,
  -- Snapshot of commercial terms at approval. Existing affiliates keep
  -- their original terms even if admin later changes the global default.
  ADD COLUMN "commission_pct" integer,
  ADD COLUMN "holding_period_days" integer,
  ADD COLUMN "min_withdrawal_toman" integer,
  ADD COLUMN "approved_at" timestamp with time zone,
  ADD COLUMN "approved_by_user_id" uuid;
--> statement-breakpoint

ALTER TABLE "referral_codes"
  ADD CONSTRAINT "referral_codes_approved_by_user_id_users_id_fk"
  FOREIGN KEY ("approved_by_user_id") REFERENCES "public"."users"("id")
  ON DELETE SET NULL ON UPDATE NO ACTION;
--> statement-breakpoint

-- Hard guard: kind must be one of the two known values. We use a CHECK
-- (rather than an enum) so adding a third strategy later is a SQL-side
-- ALTER, not an enum-type rebuild.
ALTER TABLE "referral_codes"
  ADD CONSTRAINT "referral_codes_kind_check"
  CHECK ("kind" IN ('user', 'affiliate'));
--> statement-breakpoint

-- Affiliate-only fields must be NULL for user kind, and NOT-NULL fields
-- (status + terms snapshot) MUST be set for affiliate kind. Enforced
-- in SQL so no application path can leave a half-approved code.
ALTER TABLE "referral_codes"
  ADD CONSTRAINT "referral_codes_affiliate_consistency_check"
  CHECK (
    ("kind" = 'user' AND "affiliate_status" IS NULL)
    OR ("kind" = 'affiliate'
        AND "affiliate_status" IN ('active', 'paused', 'banned')
        AND "commission_pct" IS NOT NULL
        AND "holding_period_days" IS NOT NULL
        AND "min_withdrawal_toman" IS NOT NULL)
  );
--> statement-breakpoint

CREATE INDEX "referral_codes_kind_idx"
  ON "referral_codes" USING btree ("kind");
--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- 2. Extend `referrals` with commission fields.
-- ---------------------------------------------------------------------------

ALTER TABLE "referrals"
  -- Net amount paid (after discount, including VAT) on the converting
  -- invoice. Snapshotted here so a later refund/adjustment to the
  -- invoice doesn't change historical commission rows.
  ADD COLUMN "commission_net_amount_toman" integer,
  -- 30% of net (rounded down to integer toman). Stored independently
  -- from the snapshot so admin-side rate changes don't retroactively
  -- reprice prior conversions.
  ADD COLUMN "commission_amount_toman" integer,
  -- 'monthly' | 'annual'. Captured to make ledger views easy.
  ADD COLUMN "commission_billing_cycle" text,
  -- Lifecycle:
  --   pending   → conversion just rewarded; in 30-day hold against refund
  --   available → unlock_at passed (cron flips this); withdrawable
  --   requested → claimed by an affiliate_payouts row (yet to be paid)
  --   paid      → admin marked the payout paid; transaction ref recorded
  --   rejected  → admin rejected the payout; entry returns to available
  --                (we re-open by NULLing payout_id and flipping back)
  --   flagged   → fraud signals raised; admin must clear before payout
  ADD COLUMN "commission_status" text,
  ADD COLUMN "commission_unlock_at" timestamp with time zone,
  ADD COLUMN "affiliate_payout_id" uuid;
--> statement-breakpoint

ALTER TABLE "referrals"
  ADD CONSTRAINT "referrals_commission_status_check"
  CHECK (
    "commission_status" IS NULL
    OR "commission_status" IN ('pending','available','requested','paid','rejected','flagged')
  );
--> statement-breakpoint

CREATE INDEX "referrals_commission_status_unlock_idx"
  ON "referrals" USING btree ("commission_status", "commission_unlock_at");
--> statement-breakpoint

CREATE INDEX "referrals_affiliate_payout_idx"
  ON "referrals" USING btree ("affiliate_payout_id")
  WHERE "affiliate_payout_id" IS NOT NULL;
--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- 3. NEW: affiliate_applications — pending → approved/rejected/needs_info.
-- ---------------------------------------------------------------------------

CREATE TABLE "affiliate_applications" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  -- 'pending' | 'approved' | 'rejected' | 'needs_info'
  "status" text NOT NULL DEFAULT 'pending',
  -- Captured at submission time. Used for quick admin scanning without
  -- joining users/profiles for every row.
  "applicant_name" text NOT NULL,
  "contact_phone" text NOT NULL,
  "contact_email" text,
  -- 'instagram' | 'telegram' | 'youtube' | 'blog' | 'podcast' | 'agency' | 'other'
  "channel_kind" text NOT NULL,
  "channel_url" text NOT NULL,
  -- 'lt_1k' | '1k_10k' | '10k_50k' | '50k_200k' | '200k_plus'
  "audience_size" text NOT NULL,
  -- Free-form 1–2 sentences ("how do you plan to promote Kioar?"). 500 char cap.
  "promotion_plan" text NOT NULL,
  -- Admin-side notes; reason for rejection/needs_info fits here.
  "admin_note" text,
  "reviewed_by_user_id" uuid,
  "reviewed_at" timestamp with time zone,
  -- Set when status flips to 'approved' so we have a 1-click bridge from
  -- the applications queue to the live affiliate code.
  "approved_referral_code_id" uuid,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint

ALTER TABLE "affiliate_applications"
  ADD CONSTRAINT "affiliate_applications_user_id_users_id_fk"
  FOREIGN KEY ("user_id") REFERENCES "public"."users"("id")
  ON DELETE CASCADE ON UPDATE NO ACTION;
--> statement-breakpoint

ALTER TABLE "affiliate_applications"
  ADD CONSTRAINT "affiliate_applications_reviewed_by_user_id_users_id_fk"
  FOREIGN KEY ("reviewed_by_user_id") REFERENCES "public"."users"("id")
  ON DELETE SET NULL ON UPDATE NO ACTION;
--> statement-breakpoint

ALTER TABLE "affiliate_applications"
  ADD CONSTRAINT "affiliate_applications_approved_referral_code_id_fk"
  FOREIGN KEY ("approved_referral_code_id") REFERENCES "public"."referral_codes"("id")
  ON DELETE SET NULL ON UPDATE NO ACTION;
--> statement-breakpoint

ALTER TABLE "affiliate_applications"
  ADD CONSTRAINT "affiliate_applications_status_check"
  CHECK ("status" IN ('pending','approved','rejected','needs_info'));
--> statement-breakpoint

ALTER TABLE "affiliate_applications"
  ADD CONSTRAINT "affiliate_applications_channel_kind_check"
  CHECK ("channel_kind" IN ('instagram','telegram','youtube','blog','podcast','agency','other'));
--> statement-breakpoint

ALTER TABLE "affiliate_applications"
  ADD CONSTRAINT "affiliate_applications_audience_size_check"
  CHECK ("audience_size" IN ('lt_1k','1k_10k','10k_50k','50k_200k','200k_plus'));
--> statement-breakpoint

-- At most one open application per user — prevents duplicate intake.
-- Closed states (rejected) leave the user free to re-apply later.
CREATE UNIQUE INDEX "affiliate_applications_open_per_user_idx"
  ON "affiliate_applications" ("user_id")
  WHERE "status" IN ('pending','approved','needs_info');
--> statement-breakpoint

CREATE INDEX "affiliate_applications_status_created_idx"
  ON "affiliate_applications" ("status","created_at");
--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- 4. NEW: affiliate_profiles — banking + contact info, keyed by user_id.
--    Lazy-collected: rows are inserted on approval (with banking NULL)
--    and the affiliate fills banking on first payout request.
-- ---------------------------------------------------------------------------

CREATE TABLE "affiliate_profiles" (
  "user_id" uuid PRIMARY KEY NOT NULL,
  "display_name" text NOT NULL,
  "channel_kind" text NOT NULL,
  "channel_url" text NOT NULL,
  -- Banking — filled in lazily. Sheba is "IR..." 24 chars; we DO NOT
  -- normalize/validate at the SQL layer (Persian banking validators
  -- belong in app code).
  "sheba_number" text,
  "account_holder_name" text,
  "national_id" text,
  "contact_email" text,
  -- Free-form admin notes about this affiliate. Visible only to admins.
  "admin_notes" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint

ALTER TABLE "affiliate_profiles"
  ADD CONSTRAINT "affiliate_profiles_user_id_users_id_fk"
  FOREIGN KEY ("user_id") REFERENCES "public"."users"("id")
  ON DELETE CASCADE ON UPDATE NO ACTION;
--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- 5. NEW: affiliate_payouts — payout request / processing / paid / rejected.
-- ---------------------------------------------------------------------------

CREATE TABLE "affiliate_payouts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  -- Sum of `referrals.commission_amount_toman` for entries claimed
  -- by this payout, snapshotted at request time. Single source of
  -- truth for "what was requested" (entries can later be re-opened).
  "requested_amount_toman" integer NOT NULL,
  -- Lifecycle: 'requested' → 'processing' → 'paid' | 'rejected'.
  -- 'rejected' is a terminal state; the claimed entries flip back to
  -- 'available' (NULL payout_id) so the affiliate can request again.
  "status" text NOT NULL DEFAULT 'requested',
  -- Banking info AS OF the moment the request was made. Snapshotting
  -- protects audit trail when an affiliate later edits their Sheba.
  "sheba_snapshot" text NOT NULL,
  "holder_name_snapshot" text NOT NULL,
  "national_id_snapshot" text,
  -- Bank transfer reference (پیگیری) — admin types this when marking paid.
  "transaction_ref" text,
  -- Admin reason for rejecting (mandatory on reject). Public-visible to
  -- the affiliate so they understand why.
  "rejected_reason" text,
  -- Free-form admin notes (private).
  "admin_note" text,
  "processed_by_user_id" uuid,
  "processed_at" timestamp with time zone,
  "paid_at" timestamp with time zone,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint

ALTER TABLE "affiliate_payouts"
  ADD CONSTRAINT "affiliate_payouts_user_id_users_id_fk"
  FOREIGN KEY ("user_id") REFERENCES "public"."users"("id")
  ON DELETE CASCADE ON UPDATE NO ACTION;
--> statement-breakpoint

ALTER TABLE "affiliate_payouts"
  ADD CONSTRAINT "affiliate_payouts_processed_by_user_id_fk"
  FOREIGN KEY ("processed_by_user_id") REFERENCES "public"."users"("id")
  ON DELETE SET NULL ON UPDATE NO ACTION;
--> statement-breakpoint

ALTER TABLE "affiliate_payouts"
  ADD CONSTRAINT "affiliate_payouts_status_check"
  CHECK ("status" IN ('requested','processing','paid','rejected'));
--> statement-breakpoint

CREATE INDEX "affiliate_payouts_status_created_idx"
  ON "affiliate_payouts" ("status","created_at");
--> statement-breakpoint

CREATE INDEX "affiliate_payouts_user_idx"
  ON "affiliate_payouts" ("user_id","created_at");
--> statement-breakpoint

-- Now that the table exists we can wire the FK back from referrals.
ALTER TABLE "referrals"
  ADD CONSTRAINT "referrals_affiliate_payout_id_fk"
  FOREIGN KEY ("affiliate_payout_id") REFERENCES "public"."affiliate_payouts"("id")
  ON DELETE SET NULL ON UPDATE NO ACTION;
--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- 6. NEW: affiliate_settings — singleton config row.
--    Defaults: 30% commission, 30-day hold, 5,000,000 toman minimum.
--    Admins can edit these at /admin/affiliates/settings.
-- ---------------------------------------------------------------------------

CREATE TABLE "affiliate_settings" (
  "id" integer PRIMARY KEY NOT NULL DEFAULT 1,
  "min_withdrawal_toman" integer NOT NULL DEFAULT 5000000,
  "holding_period_days" integer NOT NULL DEFAULT 30,
  "commission_pct" integer NOT NULL DEFAULT 30,
  -- Markdown rendered on the public landing page's "rules" section and
  -- in the partner portal. Editable by admins; falls back to inline
  -- defaults in the React code when NULL.
  "content_rules_md" text,
  "updated_by_user_id" uuid,
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "affiliate_settings_singleton_check" CHECK ("id" = 1)
);
--> statement-breakpoint

ALTER TABLE "affiliate_settings"
  ADD CONSTRAINT "affiliate_settings_updated_by_user_id_fk"
  FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id")
  ON DELETE SET NULL ON UPDATE NO ACTION;
--> statement-breakpoint

-- Seed the singleton with conservative defaults. Insert-only — re-running
-- the migration on a fresh DB still gets the row; on existing DBs the
-- ON CONFLICT short-circuits.
INSERT INTO "affiliate_settings" ("id","min_withdrawal_toman","holding_period_days","commission_pct")
  VALUES (1, 5000000, 30, 30)
  ON CONFLICT ("id") DO NOTHING;
