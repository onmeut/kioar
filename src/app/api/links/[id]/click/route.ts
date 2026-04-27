import { eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";

import { getDb } from "@/db";
import { linkStatsByDay, profileLinks, profileStatsByDay } from "@/db/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function recordClick(id: string) {
  const db = getDb();

  const link = await db.query.profileLinks.findFirst({
    where: eq(profileLinks.id, id),
    columns: { id: true, profileId: true, isActive: true },
  });

  if (!link || !link.isActive) return false;

  const today = new Date().toISOString().slice(0, 10);
  await Promise.all([
    db
      .insert(profileStatsByDay)
      .values({
        profileId: link.profileId,
        statDate: today,
        views: 0,
        linkClicks: 1,
      })
      .onConflictDoUpdate({
        target: [profileStatsByDay.profileId, profileStatsByDay.statDate],
        set: { linkClicks: sql`${profileStatsByDay.linkClicks} + 1` },
      }),
    db
      .insert(linkStatsByDay)
      .values({ linkId: link.id, statDate: today, clicks: 1 })
      .onConflictDoUpdate({
        target: [linkStatsByDay.linkId, linkStatsByDay.statDate],
        set: { clicks: sql`${linkStatsByDay.clicks} + 1` },
      }),
  ]);
  return true;
}

/**
 * Click tracking endpoint. Public profiles render direct anchors to the
 * destination URL (so visitors and crawlers see the real link); the client
 * fires `navigator.sendBeacon` against this endpoint to record the click
 * without blocking navigation. We respond with 204 — there is no redirect.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  // fire-and-forget; never throw to the caller (beacon ignores response anyway)
  recordClick(id).catch(() => undefined);
  return new NextResponse(null, { status: 204 });
}
