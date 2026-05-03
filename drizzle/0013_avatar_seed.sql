ALTER TABLE "profiles" ADD COLUMN "avatar_seed" text;--> statement-breakpoint
-- Backfill: assign a random seed to every existing profile so the fallback
-- avatar is stable per user. `gen_random_bytes` lives in the pgcrypto
-- extension, which is not enabled by default on a fresh DB.
CREATE EXTENSION IF NOT EXISTS pgcrypto;--> statement-breakpoint
UPDATE "profiles" SET "avatar_seed" = encode(gen_random_bytes(8), 'hex') WHERE "avatar_seed" IS NULL;
