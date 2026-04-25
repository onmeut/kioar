import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";

import { getDb } from "@/db";
import { profiles } from "@/db/schema";
import { isReservedSlug, normalizeSlug } from "@/lib/slug";

export async function GET(request: NextRequest) {
  const handle = request.nextUrl.searchParams.get("handle") ?? "";
  const normalized = normalizeSlug(handle);

  if (!normalized || normalized.length < 2) {
    return NextResponse.json({ available: false, reason: "too_short" });
  }

  if (isReservedSlug(normalized)) {
    return NextResponse.json({ available: false, reason: "reserved" });
  }

  const db = getDb();
  const existing = await db
    .select({ id: profiles.id })
    .from(profiles)
    .where(eq(profiles.slug, normalized))
    .limit(1);

  if (existing.length > 0) {
    return NextResponse.json({ available: false, reason: "taken" });
  }

  return NextResponse.json({ available: true, normalized });
}
