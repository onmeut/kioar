CREATE TYPE "public"."block_spotlight" AS ENUM('none', 'pin', 'animate');--> statement-breakpoint
CREATE TYPE "public"."block_animation" AS ENUM('buzz', 'wobble', 'pop', 'swipe');--> statement-breakpoint
ALTER TABLE "profile_links" ADD COLUMN "spotlight" "block_spotlight" DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE "profile_links" ADD COLUMN "animation_style" "block_animation";--> statement-breakpoint
ALTER TABLE "profile_booking_blocks" ADD COLUMN "spotlight" "block_spotlight" DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE "profile_booking_blocks" ADD COLUMN "animation_style" "block_animation";--> statement-breakpoint
ALTER TABLE "profile_form_blocks" ADD COLUMN "spotlight" "block_spotlight" DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE "profile_form_blocks" ADD COLUMN "animation_style" "block_animation";
