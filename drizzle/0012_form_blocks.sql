CREATE TYPE "public"."form_field_kind" AS ENUM('name', 'email', 'phone', 'country', 'short_answer', 'paragraph', 'single_choice', 'checkboxes', 'dropdown', 'date');--> statement-breakpoint
CREATE TABLE "profile_form_blocks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"name" text DEFAULT 'فرم' NOT NULL,
	"intro" text,
	"outro" text DEFAULT 'Thanks for submitting!',
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "form_fields" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"block_id" uuid NOT NULL,
	"kind" "form_field_kind" NOT NULL,
	"label" text NOT NULL,
	"required" boolean DEFAULT false NOT NULL,
	"options" jsonb,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "form_submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"block_id" uuid NOT NULL,
	"data" jsonb NOT NULL,
	"ip_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "profile_form_blocks" ADD CONSTRAINT "profile_form_blocks_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "form_fields" ADD CONSTRAINT "form_fields_block_id_profile_form_blocks_id_fk" FOREIGN KEY ("block_id") REFERENCES "public"."profile_form_blocks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "form_submissions" ADD CONSTRAINT "form_submissions_block_id_profile_form_blocks_id_fk" FOREIGN KEY ("block_id") REFERENCES "public"."profile_form_blocks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "profile_form_blocks_profile_sort_idx" ON "profile_form_blocks" USING btree ("profile_id","sort_order");--> statement-breakpoint
CREATE INDEX "form_fields_block_sort_idx" ON "form_fields" USING btree ("block_id","sort_order");--> statement-breakpoint
CREATE INDEX "form_submissions_block_created_idx" ON "form_submissions" USING btree ("block_id","created_at");
