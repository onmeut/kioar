ALTER TABLE "profiles" ADD COLUMN "discover_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "discover_category" text;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "city" text;--> statement-breakpoint
CREATE INDEX "profiles_discover_idx" ON "profiles" USING btree ("discover_enabled","discover_category");