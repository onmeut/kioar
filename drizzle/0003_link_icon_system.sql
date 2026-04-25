ALTER TABLE "profile_links" ADD COLUMN IF NOT EXISTS "icon_key" text;--> statement-breakpoint
ALTER TABLE "profile_links" ADD COLUMN IF NOT EXISTS "icon_url" text;--> statement-breakpoint
ALTER TABLE "profile_links" ADD COLUMN IF NOT EXISTS "is_active" boolean DEFAULT true NOT NULL;