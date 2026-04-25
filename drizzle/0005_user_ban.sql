ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "banned_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "banned_reason" text;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "users_banned_at_idx" ON "users" ("banned_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "users_created_at_idx" ON "users" ("created_at");
