ALTER TABLE "profiles" ALTER COLUMN "discover_enabled" SET DEFAULT true;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "page_type" text;--> statement-breakpoint
-- Backfill: opt every existing page into Discover. The PRD calls for
-- "opt-in everyone" — new pages default ON via the column default above,
-- and pre-existing pages get flipped to ON here in the same migration so
-- the rollout is a single atomic step. Page settings still expose a
-- toggle so anyone who opted in implicitly can opt back out.
UPDATE "profiles" SET "discover_enabled" = true WHERE "discover_enabled" = false;