ALTER TABLE "profiles" ADD COLUMN "domain" text DEFAULT 'kioar.com' NOT NULL;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "seo_title" text;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "seo_description" text;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "og_image_url" text;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "index_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "app_icon_key" text;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "app_icon_color" text;
