-- Mutual page-to-page connections ("اتصال" / شبکه من).
--
-- One row per undirected pair. The pair is stored in canonical order
-- (page_a_lt < page_b_gt) so the unique index on (page_a_lt, page_b_gt)
-- enforces "exactly one connection per pair" — including under the
-- race where both sides tap Connect simultaneously. Callers normalize
-- the tuple via `pairKey()` in src/lib/connections.ts before insert.
--
-- Both FKs cascade on delete: a user delete cascades to their pages,
-- which cascades to the connection rows. No application cleanup needed
-- for the account-deletion case.

CREATE TABLE IF NOT EXISTS "page_connections" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "page_a_lt" uuid NOT NULL REFERENCES "profiles"("id") ON DELETE CASCADE,
  "page_b_gt" uuid NOT NULL REFERENCES "profiles"("id") ON DELETE CASCADE,
  "initiated_by" uuid NOT NULL REFERENCES "profiles"("id") ON DELETE CASCADE,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "page_connections_ordered_chk" CHECK ("page_a_lt" < "page_b_gt"),
  CONSTRAINT "page_connections_distinct_chk" CHECK ("page_a_lt" <> "page_b_gt")
);

CREATE UNIQUE INDEX IF NOT EXISTS "page_connections_pair_idx"
  ON "page_connections" ("page_a_lt", "page_b_gt");

CREATE INDEX IF NOT EXISTS "page_connections_a_idx"
  ON "page_connections" ("page_a_lt");

CREATE INDEX IF NOT EXISTS "page_connections_b_idx"
  ON "page_connections" ("page_b_gt");
