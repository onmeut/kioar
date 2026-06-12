-- ---------------------------------------------------------------------------
-- 0069_page_transfers
-- ---------------------------------------------------------------------------
-- Page ownership transfer requests. Moving a page reassigns profiles.user_id
-- and lets all page-keyed data follow (subscription, entitlements, links,
-- blocks, bookings, forms, products, cards). User-keyed billing/legal records
-- (invoices, card_orders) intentionally stay with the original owner.
--
-- `token` is a single-use locator for the public /transfer/[token] landing +
-- QR; it does NOT authorize acceptance. Acceptance always asserts the
-- authenticated viewer's phone equals `to_phone`.
--
-- CREATE TYPE has no IF NOT EXISTS, so the enum is wrapped in an idempotent
-- DO block (the auto-migrator may re-run; it must not fail on a pre-existing
-- type).
-- ---------------------------------------------------------------------------

DO $$ BEGIN
	CREATE TYPE "page_transfer_status" AS ENUM ('pending', 'accepted', 'rejected', 'canceled', 'expired');
EXCEPTION
	WHEN duplicate_object THEN null;
END $$;
-->statement-breakpoint
CREATE TABLE IF NOT EXISTS "page_transfers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"page_id" uuid NOT NULL REFERENCES "profiles"("id") ON DELETE CASCADE,
	"from_user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
	"to_phone" text NOT NULL,
	"to_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
	"token" text NOT NULL,
	"status" "page_transfer_status" DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"accepted_at" timestamp with time zone,
	"rejected_at" timestamp with time zone,
	"canceled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
-->statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "page_transfers_token_idx" ON "page_transfers" ("token");
-->statement-breakpoint
CREATE INDEX IF NOT EXISTS "page_transfers_to_phone_status_idx" ON "page_transfers" ("to_phone","status");
-->statement-breakpoint
CREATE INDEX IF NOT EXISTS "page_transfers_from_user_status_idx" ON "page_transfers" ("from_user_id","status");
-->statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "page_transfers_page_pending_idx" ON "page_transfers" ("page_id") WHERE "status" = 'pending';
-->statement-breakpoint
CREATE INDEX IF NOT EXISTS "page_transfers_expires_at_idx" ON "page_transfers" ("expires_at");
