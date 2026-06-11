ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "card_enabled" boolean NOT NULL DEFAULT false;
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "card_number" text;
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "card_holder_name" text;
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "sheba_enabled" boolean NOT NULL DEFAULT false;
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "sheba_number" text;
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "sheba_holder_name" text;
