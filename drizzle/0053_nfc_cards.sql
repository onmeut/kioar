-- NFC / QR physical cards — the `/c/{id}` system.
--
-- A physical card whose printed QR + locked NFC chip + the `cards` row all
-- encode the same permanent URL `https://kioar.com/c/{id}`. `cards.id` is a
-- short collision-checked base32 code (NOT a uuid) — it IS the printed value.
-- The card binds to a PAGE (profiles row) via `page_id`; the chip/QR never
-- change on (re)bind. `page_id` NULL + status 'unassigned' = a gift card
-- awaiting activation-on-tap.

DO $$ BEGIN
  CREATE TYPE "card_status" AS ENUM ('unassigned', 'assigned', 'disabled');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "card_material" AS ENUM ('colorful', 'metal');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "card_source" AS ENUM ('purchased', 'gift_pro', 'gift_business');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "card_order_status" AS ENUM (
    'pending_payment', 'paid', 'processing', 'shipped', 'fulfilled', 'cancelled'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS "cards" (
  "id" text PRIMARY KEY NOT NULL,
  "page_id" uuid REFERENCES "profiles"("id") ON DELETE SET NULL,
  "status" "card_status" NOT NULL DEFAULT 'unassigned',
  "batch" text NOT NULL,
  "color" text NOT NULL,
  "material" "card_material" NOT NULL,
  "source" "card_source" NOT NULL,
  "nfc_written_at" timestamptz,
  "nfc_locked_at" timestamptz,
  "claimed_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "cards_page_id_idx" ON "cards" ("page_id");
CREATE INDEX IF NOT EXISTS "cards_status_idx" ON "cards" ("status");
CREATE INDEX IF NOT EXISTS "cards_batch_idx" ON "cards" ("batch");

CREATE TABLE IF NOT EXISTS "card_orders" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "page_id" uuid NOT NULL REFERENCES "profiles"("id") ON DELETE CASCADE,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "color" text NOT NULL,
  "material" "card_material" NOT NULL,
  "name_on_card" text NOT NULL,
  "province" text NOT NULL,
  "city" text NOT NULL,
  "address" text NOT NULL,
  "postal_code" text NOT NULL,
  "status" "card_order_status" NOT NULL DEFAULT 'pending_payment',
  "source" "card_source" NOT NULL DEFAULT 'purchased',
  "card_id" text REFERENCES "cards"("id") ON DELETE SET NULL,
  "amount_toman" integer NOT NULL DEFAULT 0,
  "payment_authority" text,
  "payment_ref_id" text,
  "paid_at" timestamptz,
  "shipped_at" timestamptz,
  "fulfilled_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "card_orders_page_id_idx" ON "card_orders" ("page_id");
CREATE INDEX IF NOT EXISTS "card_orders_user_id_idx" ON "card_orders" ("user_id");
CREATE INDEX IF NOT EXISTS "card_orders_status_idx" ON "card_orders" ("status");
CREATE UNIQUE INDEX IF NOT EXISTS "card_orders_payment_authority_idx"
  ON "card_orders" ("payment_authority");

CREATE TABLE IF NOT EXISTS "card_entitlements" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "page_id" uuid NOT NULL REFERENCES "profiles"("id") ON DELETE CASCADE,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "material" "card_material" NOT NULL,
  "source" "card_source" NOT NULL,
  "source_key" text NOT NULL,
  "redeemed_at" timestamptz,
  "redeemed_order_id" uuid REFERENCES "card_orders"("id") ON DELETE SET NULL,
  "expires_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "card_entitlements_page_id_idx" ON "card_entitlements" ("page_id");
CREATE INDEX IF NOT EXISTS "card_entitlements_user_id_idx" ON "card_entitlements" ("user_id");
CREATE UNIQUE INDEX IF NOT EXISTS "card_entitlements_source_key_idx"
  ON "card_entitlements" ("source_key");
