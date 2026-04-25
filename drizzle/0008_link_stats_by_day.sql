CREATE TABLE "link_stats_by_day" (
	"link_id" uuid NOT NULL,
	"stat_date" date NOT NULL,
	"clicks" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "link_stats_by_day_link_id_stat_date_pk" PRIMARY KEY("link_id","stat_date")
);
--> statement-breakpoint
ALTER TABLE "link_stats_by_day" ADD CONSTRAINT "link_stats_by_day_link_id_profile_links_id_fk" FOREIGN KEY ("link_id") REFERENCES "public"."profile_links"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "link_stats_by_day_link_id_idx" ON "link_stats_by_day" USING btree ("link_id");