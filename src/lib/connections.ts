import { and, desc, eq, or, sql } from "drizzle-orm";

import { getDb } from "@/db";
import { pageConnections, profiles } from "@/db/schema";

/**
 * Canonicalize an unordered pair of page ids into the (lt, gt) tuple used
 * by `page_connections`. The unique index + CHECK constraint on that
 * column pair is what makes "exactly one connection per pair" a DB-level
 * invariant — every caller MUST go through this helper before writing.
 *
 * Throws if both ids are the same. Self-connections are also blocked by
 * the `distinct_chk` CHECK constraint at the DB layer, but failing fast
 * here avoids the round-trip.
 */
export function pairKey(
  pageId1: string,
  pageId2: string,
): { lt: string; gt: string } {
  if (pageId1 === pageId2) {
    throw new Error("connections.pair_key.self_pair");
  }
  return pageId1 < pageId2
    ? { lt: pageId1, gt: pageId2 }
    : { lt: pageId2, gt: pageId1 };
}

/**
 * Whether the two pages are currently connected. Single indexed lookup
 * (the unique index covers the canonical-order tuple). Returns false for
 * the self-pair instead of throwing — callers in the public-page render
 * path can pass `viewerPageId` and `targetPageId` without pre-checking.
 */
export async function isConnected(
  pageId1: string,
  pageId2: string,
): Promise<boolean> {
  if (pageId1 === pageId2) return false;
  const { lt, gt } = pairKey(pageId1, pageId2);
  const row = await getDb()
    .select({ id: pageConnections.id })
    .from(pageConnections)
    .where(
      and(
        eq(pageConnections.pageALt, lt),
        eq(pageConnections.pageBGt, gt),
      ),
    )
    .limit(1);
  return row.length > 0;
}

export type CreateConnectionResult =
  | { ok: true; createdNew: boolean }
  | { ok: false; reason: "self" };

/**
 * Insert a connection. Idempotent under races: simultaneous Connect taps
 * from both sides normalize to the same (lt, gt) tuple and the second
 * insert hits `ON CONFLICT DO NOTHING`.
 *
 * `initiatedBy` is whichever side actually tapped Connect; we don't
 * surface it in the UI, but it's useful for product analytics.
 */
export async function createConnection(input: {
  viewerPageId: string;
  targetPageId: string;
}): Promise<CreateConnectionResult> {
  if (input.viewerPageId === input.targetPageId) {
    return { ok: false, reason: "self" };
  }
  const { lt, gt } = pairKey(input.viewerPageId, input.targetPageId);
  const inserted = await getDb()
    .insert(pageConnections)
    .values({
      pageALt: lt,
      pageBGt: gt,
      initiatedBy: input.viewerPageId,
    })
    .onConflictDoNothing({
      target: [pageConnections.pageALt, pageConnections.pageBGt],
    })
    .returning({ id: pageConnections.id });
  return { ok: true, createdNew: inserted.length > 0 };
}

/**
 * Remove the connection between two pages, if any. Symmetric: either
 * side calls this and the row disappears for both. Returns whether a
 * row was actually deleted (useful for the dashboard's optimistic UI
 * confirmation toast).
 */
export async function removeConnection(input: {
  viewerPageId: string;
  targetPageId: string;
}): Promise<{ removed: boolean }> {
  if (input.viewerPageId === input.targetPageId) {
    return { removed: false };
  }
  const { lt, gt } = pairKey(input.viewerPageId, input.targetPageId);
  const deleted = await getDb()
    .delete(pageConnections)
    .where(
      and(
        eq(pageConnections.pageALt, lt),
        eq(pageConnections.pageBGt, gt),
      ),
    )
    .returning({ id: pageConnections.id });
  return { removed: deleted.length > 0 };
}

export type ConnectionListItem = {
  pageId: string;
  slug: string;
  fullName: string | null;
  avatarUrl: string | null;
  avatarSeed: string | null;
  domain: string;
  connectedAt: Date;
};

/**
 * All pages connected to `pageId`, newest first. We do the "other side
 * of the row" pivot in one query: each row is `(pageALt, pageBGt)` and
 * we select the side that isn't `pageId`. The two index lookups
 * (`page_connections_a_idx`, `page_connections_b_idx`) keep this O(log n)
 * in the user's connection count.
 */
export async function listConnectionsForPage(
  pageId: string,
): Promise<ConnectionListItem[]> {
  const db = getDb();
  const otherSide = sql<string>`CASE
    WHEN ${pageConnections.pageALt} = ${pageId} THEN ${pageConnections.pageBGt}
    ELSE ${pageConnections.pageALt}
  END`;

  const rows = await db
    .select({
      pageId: profiles.id,
      slug: profiles.slug,
      fullName: profiles.fullName,
      avatarUrl: profiles.avatarUrl,
      avatarSeed: profiles.avatarSeed,
      domain: profiles.domain,
      connectedAt: pageConnections.createdAt,
    })
    .from(pageConnections)
    .innerJoin(profiles, eq(profiles.id, otherSide))
    .where(
      or(
        eq(pageConnections.pageALt, pageId),
        eq(pageConnections.pageBGt, pageId),
      ),
    )
    .orderBy(desc(pageConnections.createdAt));

  return rows;
}
