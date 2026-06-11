-- ---------------------------------------------------------------------------
-- 0064_event_ticket_types
-- ---------------------------------------------------------------------------
-- Luma-style multiple TICKET TYPES per event. Each event gains 1..N tiers, each
-- with its OWN price/approval/capacity/sales-window. A registration now points
-- at exactly one ticket type; capacity is counted per-tier.
--
-- Backward compatibility: the legacy price/approval/capacity/waitlist columns on
-- `events` are retained ONLY to seed each event's default tier here. After this
-- migration the service + renderer read tiers, not the event.
--
-- Backfill (idempotent):
--   1. create `event_ticket_types`,
--   2. add nullable `event_registrations.ticket_type_id`,
--   3. insert one default tier per event copying its current config,
--   4. stamp every existing registration with its event's default tier.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "event_ticket_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL REFERENCES "events"("id") ON DELETE CASCADE,
	"name" text NOT NULL,
	"description" text,
	"price_type" "event_price_type" DEFAULT 'free' NOT NULL,
	"price_toman" bigint DEFAULT 0 NOT NULL,
	"approval_required" boolean DEFAULT false NOT NULL,
	"capacity" integer,
	"available_from" timestamp with time zone,
	"available_until" timestamp with time zone,
	"waitlist_enabled" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
-->statement-breakpoint
CREATE INDEX IF NOT EXISTS "event_ticket_types_event_sort_idx" ON "event_ticket_types" ("event_id","sort_order");
-->statement-breakpoint
ALTER TABLE "event_registrations" ADD COLUMN IF NOT EXISTS "ticket_type_id" uuid REFERENCES "event_ticket_types"("id") ON DELETE SET NULL;
-->statement-breakpoint
-- Seed one default tier per event from its legacy config. Guarded so re-runs
-- don't duplicate: only events that have no ticket type yet get one.
INSERT INTO "event_ticket_types" (
	"event_id", "name", "price_type", "price_toman",
	"approval_required", "capacity", "waitlist_enabled", "is_active", "sort_order"
)
SELECT
	e."id",
	'بلیت استاندارد',
	e."price_type",
	e."price_toman",
	e."approval_required",
	e."capacity",
	e."waitlist_enabled",
	true,
	0
FROM "events" e
WHERE NOT EXISTS (
	SELECT 1 FROM "event_ticket_types" t WHERE t."event_id" = e."id"
);
-->statement-breakpoint
-- Stamp existing registrations with their event's default (lowest sort_order)
-- tier. Only touches rows that don't already carry a ticket type.
UPDATE "event_registrations" r
SET "ticket_type_id" = (
	SELECT t."id"
	FROM "event_ticket_types" t
	WHERE t."event_id" = r."event_id"
	ORDER BY t."sort_order" ASC, t."created_at" ASC
	LIMIT 1
)
WHERE r."ticket_type_id" IS NULL;
