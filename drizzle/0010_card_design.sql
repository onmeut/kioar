CREATE TYPE "public"."card_design" AS ENUM('design_1', 'design_2', 'design_3');--> statement-breakpoint
ALTER TABLE "card_requests" ADD COLUMN "card_design" "card_design" DEFAULT 'design_1' NOT NULL;