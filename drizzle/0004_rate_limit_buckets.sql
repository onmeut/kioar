CREATE TABLE IF NOT EXISTS "rate_limit_buckets" (
  "key" text NOT NULL,
  "window_start" timestamp with time zone NOT NULL,
  "count" integer NOT NULL DEFAULT 0,
  CONSTRAINT "rate_limit_buckets_pk" PRIMARY KEY ("key", "window_start")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "rate_limit_buckets_window_start_idx" ON "rate_limit_buckets" ("window_start");
