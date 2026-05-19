-- Safety net: adds columns with IF NOT EXISTS because migration 0048
-- was recorded in __drizzle_migrations but the DDL never actually landed.
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "show_public_phone" boolean DEFAULT false NOT NULL;
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "show_public_email" boolean DEFAULT false NOT NULL;
