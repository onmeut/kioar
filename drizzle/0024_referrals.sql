-- 0024_referrals.sql
--
-- Referral / invitation system.
--
-- Three tables:
--
--   1. `referral_codes` — one row per user. Unique short-and-memorable
--      handle of the form `<slug>-<4hex>` (e.g. `amir-3f9a`). Auto-
--      generated for every existing user via the backfill block at the
--      bottom of this migration; new users get one in app code on
--      first sign-in (`findOrCreateUserByPhone`).
--
--   2. `referrals` — lifecycle row for an invited visitor. States:
--        clicked   → set on `/r/:code` GET (cookie written)
--        signed_up → set when a referee completes OTP verify
--        converted → set after Zarinpal verify, before fraud checks
--        rewarded  → set after fraud checks pass + bonuses applied
--        rejected  → hard reject (self-referral, same phone)
--        flagged   → 2+ fraud signals → manual review
--      Click rows for visitors who never sign up are kept for stats but
--      have no `referee_user_id` until signup attaches it. We keep them
--      forever (no GC) — there's never enough volume to need pruning,
--      and `referrer_user_id` cascades on user delete.
--
--   3. `referral_credits` — append-only ledger.
--        kind='earned'   → referrer gets +N months on a successful
--                          rewarded referral. UNIQUE on referral_id so
--                          re-running Zarinpal verify never doubles.
--        kind='redeemed' → referrer applies one credit to a chosen
--                          page. Period extended by months × 30 days.
--      Balance = SUM(earned.months) − SUM(redeemed.months).
--
-- Why a ledger and not auto-issued discount codes:
--   Referrer credits need to be redeemable WITHOUT a checkout flow
--   ("apply 1 month to any page I own, anytime"); discount codes only
--   apply at invoice creation time. The ledger also gives clean
--   idempotency on `(referral_id)` for the earned side.

CREATE TABLE "referral_codes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  -- Display form, e.g. "amir-3f9a". Lowercased, ASCII, no spaces.
  "code" text NOT NULL,
  -- Lowercased lookup key. UNIQUE — case-insensitive matching.
  "code_normalized" text NOT NULL,
  -- Denormalized counter incremented on every `/r/:code` hit.
  "clicks_count" integer NOT NULL DEFAULT 0,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "referral_codes"
  ADD CONSTRAINT "referral_codes_user_id_users_id_fk"
  FOREIGN KEY ("user_id") REFERENCES "public"."users"("id")
  ON DELETE CASCADE ON UPDATE NO ACTION;
--> statement-breakpoint
CREATE UNIQUE INDEX "referral_codes_user_id_idx"
  ON "referral_codes" USING btree ("user_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "referral_codes_code_normalized_idx"
  ON "referral_codes" USING btree ("code_normalized");
--> statement-breakpoint

CREATE TABLE "referrals" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "referrer_user_id" uuid NOT NULL,
  "referral_code_id" uuid NOT NULL,
  "referee_user_id" uuid,
  -- Opaque token written into the visitor's `kioar_ref` cookie. We use
  -- this (not the bare code) for the cookie value so revoking a code
  -- in the future can't replay arbitrary attribution.
  "cookie_id" uuid NOT NULL,
  -- Lifecycle: clicked | signed_up | converted | rewarded | rejected | flagged.
  -- Plain text — adding a state is a code change in lib/referrals.ts.
  "status" text NOT NULL DEFAULT 'clicked',
  "click_ip" text,
  "click_user_agent" text,
  "clicked_at" timestamp with time zone NOT NULL DEFAULT now(),
  "signed_up_at" timestamp with time zone,
  "converted_at" timestamp with time zone,
  "rewarded_at" timestamp with time zone,
  "converting_page_id" uuid,
  "converting_invoice_id" uuid,
  "rejection_reason" text,
  -- Array of signal identifiers ("ip_match","card_pan","velocity") that
  -- contributed to the flag/reward decision. Empty for clean rewards.
  "flag_signals" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "referrals"
  ADD CONSTRAINT "referrals_referrer_user_id_users_id_fk"
  FOREIGN KEY ("referrer_user_id") REFERENCES "public"."users"("id")
  ON DELETE CASCADE ON UPDATE NO ACTION;
--> statement-breakpoint
ALTER TABLE "referrals"
  ADD CONSTRAINT "referrals_referral_code_id_referral_codes_id_fk"
  FOREIGN KEY ("referral_code_id") REFERENCES "public"."referral_codes"("id")
  ON DELETE CASCADE ON UPDATE NO ACTION;
--> statement-breakpoint
ALTER TABLE "referrals"
  ADD CONSTRAINT "referrals_referee_user_id_users_id_fk"
  FOREIGN KEY ("referee_user_id") REFERENCES "public"."users"("id")
  ON DELETE SET NULL ON UPDATE NO ACTION;
--> statement-breakpoint
ALTER TABLE "referrals"
  ADD CONSTRAINT "referrals_converting_page_id_profiles_id_fk"
  FOREIGN KEY ("converting_page_id") REFERENCES "public"."profiles"("id")
  ON DELETE SET NULL ON UPDATE NO ACTION;
--> statement-breakpoint
ALTER TABLE "referrals"
  ADD CONSTRAINT "referrals_converting_invoice_id_invoices_id_fk"
  FOREIGN KEY ("converting_invoice_id") REFERENCES "public"."invoices"("id")
  ON DELETE SET NULL ON UPDATE NO ACTION;
--> statement-breakpoint
-- One referral per referee, lifetime. NULL referees (still anonymous
-- click rows) are excluded from the unique constraint so multiple
-- visitors can share a click trail.
CREATE UNIQUE INDEX "referrals_referee_user_id_idx"
  ON "referrals" USING btree ("referee_user_id")
  WHERE "referee_user_id" IS NOT NULL;
--> statement-breakpoint
CREATE INDEX "referrals_referrer_status_idx"
  ON "referrals" USING btree ("referrer_user_id", "status");
--> statement-breakpoint
CREATE INDEX "referrals_cookie_id_idx"
  ON "referrals" USING btree ("cookie_id");
--> statement-breakpoint
CREATE INDEX "referrals_converted_at_idx"
  ON "referrals" USING btree ("converted_at");
--> statement-breakpoint

CREATE TABLE "referral_credits" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  -- 'earned' | 'redeemed'. Plain text.
  "kind" text NOT NULL,
  "months" integer NOT NULL DEFAULT 1,
  "referral_id" uuid,
  "redeemed_on_page_id" uuid,
  "redeemed_on_subscription_id" uuid,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "referral_credits"
  ADD CONSTRAINT "referral_credits_user_id_users_id_fk"
  FOREIGN KEY ("user_id") REFERENCES "public"."users"("id")
  ON DELETE CASCADE ON UPDATE NO ACTION;
--> statement-breakpoint
ALTER TABLE "referral_credits"
  ADD CONSTRAINT "referral_credits_referral_id_referrals_id_fk"
  FOREIGN KEY ("referral_id") REFERENCES "public"."referrals"("id")
  ON DELETE SET NULL ON UPDATE NO ACTION;
--> statement-breakpoint
ALTER TABLE "referral_credits"
  ADD CONSTRAINT "referral_credits_redeemed_on_page_id_profiles_id_fk"
  FOREIGN KEY ("redeemed_on_page_id") REFERENCES "public"."profiles"("id")
  ON DELETE SET NULL ON UPDATE NO ACTION;
--> statement-breakpoint
ALTER TABLE "referral_credits"
  ADD CONSTRAINT "referral_credits_redeemed_on_subscription_id_page_subscriptions_id_fk"
  FOREIGN KEY ("redeemed_on_subscription_id") REFERENCES "public"."page_subscriptions"("id")
  ON DELETE SET NULL ON UPDATE NO ACTION;
--> statement-breakpoint
-- Idempotency: at most one earned row per referral. Re-running the
-- Zarinpal verify path is a no-op on the credits ledger.
CREATE UNIQUE INDEX "referral_credits_referral_earned_idx"
  ON "referral_credits" USING btree ("referral_id")
  WHERE "kind" = 'earned';
--> statement-breakpoint
CREATE INDEX "referral_credits_user_kind_idx"
  ON "referral_credits" USING btree ("user_id", "kind");
--> statement-breakpoint

-- Backfill: every existing user gets a referral_codes row. Code format:
-- `<slug-or-prefix>-<4hex>`. We pick the user's oldest profile slug
-- (sanitized lowercase ASCII) and fall back to a `u-<8hex>` prefix when
-- the user has no profile yet. Conflicts on `code_normalized` retry
-- once with a fresh suffix; in the unlikely event of two collisions in
-- a row we widen to 8 hex chars.
DO $$
DECLARE
  u RECORD;
  base_slug text;
  candidate text;
  attempts integer;
BEGIN
  FOR u IN
    SELECT users.id AS user_id,
           (SELECT lower(regexp_replace(p.slug, '[^a-z0-9]', '', 'g'))
              FROM profiles p
              WHERE p.user_id = users.id
              ORDER BY p.created_at ASC
              LIMIT 1) AS slug
      FROM users
      WHERE NOT EXISTS (
        SELECT 1 FROM referral_codes rc WHERE rc.user_id = users.id
      )
  LOOP
    -- Cap slug at 16 chars and require ≥3 to look like a real handle;
    -- otherwise fall back to a stable random prefix.
    base_slug := COALESCE(NULLIF(substring(u.slug FROM 1 FOR 16), ''), '');
    IF length(base_slug) < 3 THEN
      base_slug := 'u' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 6);
    END IF;

    attempts := 0;
    LOOP
      attempts := attempts + 1;
      IF attempts <= 3 THEN
        candidate := base_slug || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 4);
      ELSE
        -- Widen the suffix on persistent collision (extremely unlikely).
        candidate := base_slug || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8);
      END IF;

      BEGIN
        INSERT INTO referral_codes (user_id, code, code_normalized)
          VALUES (u.user_id, candidate, candidate);
        EXIT;
      EXCEPTION WHEN unique_violation THEN
        IF attempts > 6 THEN
          RAISE EXCEPTION 'referral_codes backfill: could not allocate code for user % after 6 attempts', u.user_id;
        END IF;
        -- Retry with a fresh suffix.
      END;
    END LOOP;
  END LOOP;
END $$;
