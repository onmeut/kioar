import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";

import { getDb } from "@/db";
import { eventRegistrations, events, profiles } from "@/db/schema";
import { getCurrentViewer } from "@/lib/auth/session";
import { readLocalPrivateReceipt } from "@/lib/storage";

export const dynamic = "force-dynamic";

/**
 * Local-dev only: streams a private payment-receipt image. In production
 * (S3 configured) receipts are served via short-lived presigned URLs and this
 * route returns 404 — `readLocalPrivateReceipt` short-circuits.
 *
 * Owner-gated: the viewer must be authenticated and must host an event that
 * has a registration whose `receiptKey` matches the requested file (or be an
 * admin). This mirrors the authorization the host management view applies
 * before ever calling `getPrivateObjectSignedUrl`.
 */
export async function GET(request: Request) {
  const viewer = await getCurrentViewer();
  if (!viewer) {
    return new NextResponse(null, { status: 401 });
  }

  const fileName = new URL(request.url).searchParams.get("file");
  if (!fileName) {
    return new NextResponse(null, { status: 400 });
  }

  const key = `event-receipts/${fileName}`;
  const db = getDb();

  // Find a registration with this receipt key and confirm the viewer hosts
  // its event (page owner) — unless the viewer is an admin.
  const match = await db
    .select({ eventId: eventRegistrations.eventId, ownerId: profiles.userId })
    .from(eventRegistrations)
    .innerJoin(events, eq(eventRegistrations.eventId, events.id))
    .innerJoin(profiles, eq(events.pageId, profiles.id))
    .where(
      and(
        eq(eventRegistrations.receiptKey, key),
        viewer.user.role === "admin"
          ? undefined
          : eq(profiles.userId, viewer.user.id),
      ),
    )
    .limit(1);

  if (match.length === 0) {
    return new NextResponse(null, { status: 404 });
  }

  const bytes = await readLocalPrivateReceipt(fileName);
  if (!bytes) {
    return new NextResponse(null, { status: 404 });
  }

  return new NextResponse(new Uint8Array(bytes), {
    status: 200,
    headers: {
      "Content-Type": "image/webp",
      "Cache-Control": "private, no-store",
    },
  });
}
