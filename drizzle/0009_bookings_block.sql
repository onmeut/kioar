CREATE TYPE "public"."booking_location_type" AS ENUM('online', 'in_person');--> statement-breakpoint
CREATE TYPE "public"."booking_status" AS ENUM('confirmed', 'cancelled');--> statement-breakpoint
CREATE TABLE "booking_availability" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"block_id" uuid NOT NULL,
	"day_of_week" integer NOT NULL,
	"start_minute" integer NOT NULL,
	"end_minute" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "booking_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"block_id" uuid NOT NULL,
	"title" text NOT NULL,
	"duration_min" integer NOT NULL,
	"price_amount" integer DEFAULT 0 NOT NULL,
	"price_currency" text DEFAULT 'USD' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bookings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"block_id" uuid NOT NULL,
	"booking_type_id" uuid,
	"guest_name" text NOT NULL,
	"guest_email" text NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"guest_timezone" text,
	"status" "booking_status" DEFAULT 'confirmed' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "profile_booking_blocks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"avatar_url" text,
	"timezone" text DEFAULT 'Asia/Tehran' NOT NULL,
	"location_type" "booking_location_type" DEFAULT 'online' NOT NULL,
	"location_address" text,
	"meeting_link" text,
	"buffer_before_min" integer DEFAULT 15 NOT NULL,
	"buffer_after_min" integer DEFAULT 15 NOT NULL,
	"calendar_email" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "booking_availability" ADD CONSTRAINT "booking_availability_block_id_profile_booking_blocks_id_fk" FOREIGN KEY ("block_id") REFERENCES "public"."profile_booking_blocks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_types" ADD CONSTRAINT "booking_types_block_id_profile_booking_blocks_id_fk" FOREIGN KEY ("block_id") REFERENCES "public"."profile_booking_blocks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_block_id_profile_booking_blocks_id_fk" FOREIGN KEY ("block_id") REFERENCES "public"."profile_booking_blocks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_booking_type_id_booking_types_id_fk" FOREIGN KEY ("booking_type_id") REFERENCES "public"."booking_types"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_booking_blocks" ADD CONSTRAINT "profile_booking_blocks_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "booking_availability_block_idx" ON "booking_availability" USING btree ("block_id");--> statement-breakpoint
CREATE INDEX "booking_types_block_sort_idx" ON "booking_types" USING btree ("block_id","sort_order");--> statement-breakpoint
CREATE INDEX "bookings_block_starts_idx" ON "bookings" USING btree ("block_id","starts_at");--> statement-breakpoint
CREATE INDEX "profile_booking_blocks_profile_sort_idx" ON "profile_booking_blocks" USING btree ("profile_id","sort_order");