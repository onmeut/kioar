CREATE TYPE "public"."meeting_provider" AS ENUM('google_meet', 'zoom', 'skyroom', 'lahzenegar', 'custom');--> statement-breakpoint
CREATE TYPE "public"."oauth_provider" AS ENUM('google', 'zoom');--> statement-breakpoint
CREATE TABLE "oauth_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"provider" "oauth_provider" NOT NULL,
	"provider_account_id" text NOT NULL,
	"account_email" text,
	"access_token" text NOT NULL,
	"refresh_token" text,
	"expires_at" timestamp with time zone,
	"scope" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "meeting_url" text;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "meeting_provider_event_id" text;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "calendar_event_id" text;--> statement-breakpoint
ALTER TABLE "profile_booking_blocks" ADD COLUMN "location_lat" text;--> statement-breakpoint
ALTER TABLE "profile_booking_blocks" ADD COLUMN "location_lng" text;--> statement-breakpoint
ALTER TABLE "profile_booking_blocks" ADD COLUMN "location_place_id" text;--> statement-breakpoint
ALTER TABLE "profile_booking_blocks" ADD COLUMN "meeting_provider" "meeting_provider" DEFAULT 'custom' NOT NULL;--> statement-breakpoint
ALTER TABLE "profile_booking_blocks" ADD COLUMN "skyroom_api_key" text;--> statement-breakpoint
ALTER TABLE "profile_booking_blocks" ADD COLUMN "skyroom_room_name_prefix" text;--> statement-breakpoint
ALTER TABLE "oauth_accounts" ADD CONSTRAINT "oauth_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "oauth_accounts_user_provider_idx" ON "oauth_accounts" USING btree ("user_id","provider");