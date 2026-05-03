-- 0027_referral_code_aliases.sql
--
-- Rebuild referral codes as 4 random lowercase letters.
--
-- Old format was `<slug-or-prefix>-<4hex>` (e.g. `amir-3f9a`). The new
-- format is 4 random a-z letters (`xqfm`, `btzk`). The code doubles as
-- a public link slug (`/r/xqfm`) AND a verbal short code, so it has
-- to be short, memorable, and identity-free.
--
-- Migration plan:
--
--   1. Create `referral_code_aliases` — append-only mapping of every
--      previously-issued normalized code → its canonical
--      `referral_codes.id`. Lookup paths in `lib/referrals.ts` consult
--      both this table and the primary code so any link already shared
--      in the wild keeps resolving forever.
--
--   2. Snapshot every existing primary code into the alias table.
--
--   3. Regenerate every primary code as 4 random letters, retrying on
--      collision against the union of (new primaries chosen so far,
--      remaining old primaries, alias table). 26^4 = 456,976 — plenty.
--
-- After this migration, primary code_normalized is uniformly 4 letters.

CREATE TABLE "referral_code_aliases" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "referral_code_id" uuid NOT NULL,
  "code" text NOT NULL,
  "code_normalized" text NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint

ALTER TABLE "referral_code_aliases"
  ADD CONSTRAINT "referral_code_aliases_referral_code_id_fk"
  FOREIGN KEY ("referral_code_id") REFERENCES "public"."referral_codes"("id")
  ON DELETE CASCADE ON UPDATE NO ACTION;
--> statement-breakpoint

CREATE UNIQUE INDEX "referral_code_aliases_code_normalized_idx"
  ON "referral_code_aliases" USING btree ("code_normalized");
--> statement-breakpoint

CREATE INDEX "referral_code_aliases_referral_code_id_idx"
  ON "referral_code_aliases" USING btree ("referral_code_id");
--> statement-breakpoint

-- Step 2: snapshot every existing primary code into the alias table.
-- Skip rows already present (idempotent re-run).
INSERT INTO "referral_code_aliases" ("referral_code_id", "code", "code_normalized")
  SELECT rc.id, rc.code, rc.code_normalized
    FROM "referral_codes" rc
    WHERE NOT EXISTS (
      SELECT 1 FROM "referral_code_aliases" a
        WHERE a.code_normalized = rc.code_normalized
    );
--> statement-breakpoint

-- Step 3: regenerate primary codes as 4 random lowercase letters.
--
-- Pure random — no slug derivation, no numeric suffix, no dictionary.
-- Collision check is against the union of (a) other primary codes,
-- which still hold their pre-migration values until we update them,
-- and (b) every alias row, which already includes the about-to-be-
-- replaced value of the row we're updating. The new value cannot
-- collide with the row's own old value because the new value is
-- 4 a-z letters while the old value contains a hyphen.
DO $$
DECLARE
  rc RECORD;
  candidate text;
  attempts integer;
  i integer;
BEGIN
  FOR rc IN
    SELECT id FROM "referral_codes"
    -- Only regenerate codes that don't already match the new shape
    -- (so re-running this migration is a no-op).
    WHERE code_normalized !~ '^[a-z]{4}$'
  LOOP
    attempts := 0;
    LOOP
      attempts := attempts + 1;
      IF attempts > 50 THEN
        RAISE EXCEPTION 'referral code collision budget exhausted for %', rc.id;
      END IF;

      candidate := '';
      FOR i IN 1..4 LOOP
        -- chr(97) = 'a' ... chr(122) = 'z'. floor(random()*26) ∈ [0,25].
        candidate := candidate || chr(97 + floor(random() * 26)::int);
      END LOOP;

      -- Reject if the candidate is already used as a primary code on
      -- some other row OR as any alias.
      IF EXISTS (
        SELECT 1 FROM "referral_codes"
          WHERE code_normalized = candidate AND id <> rc.id
      ) THEN CONTINUE; END IF;
      IF EXISTS (
        SELECT 1 FROM "referral_code_aliases"
          WHERE code_normalized = candidate
      ) THEN CONTINUE; END IF;

      UPDATE "referral_codes"
        SET code = candidate,
            code_normalized = candidate,
            updated_at = now()
        WHERE id = rc.id;
      EXIT;
    END LOOP;
  END LOOP;
END $$;
