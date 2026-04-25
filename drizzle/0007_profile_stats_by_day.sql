CREATE TABLE "profile_stats_by_day" (
	"profile_id" uuid NOT NULL,
	"stat_date" date NOT NULL,
	"views" integer DEFAULT 0 NOT NULL,
	"link_clicks" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "profile_stats_by_day_profile_id_stat_date_pk" PRIMARY KEY("profile_id","stat_date")
);
--> statement-breakpoint
DROP TABLE "link_clicks" CASCADE;--> statement-breakpoint
DROP TABLE "profile_views" CASCADE;--> statement-breakpoint
ALTER TABLE "profile_stats_by_day" ADD CONSTRAINT "profile_stats_by_day_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;