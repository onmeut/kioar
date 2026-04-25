import { eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";

import { getDb } from "@/db";
import { linkStatsByDay, profileLinks, profileStatsByDay } from "@/db/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const db = getDb();

  const link = await db.query.profileLinks.findFirst({
    where: eq(profileLinks.id, id),
  });

  if (!link || !link.isActive) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  // Record the click fire-and-forget: profile-level counter + per-link counter.
  const today = new Date().toISOString().slice(0, 10);
  void Promise.all([
    db
      .insert(profileStatsByDay)
      .values({ profileId: link.profileId, statDate: today, views: 0, linkClicks: 1 })
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
  ]).catch(() => undefined);

  return NextResponse.redirect(link.url, { status: 302 });
}
