import "server-only";

import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";

import { getDb } from "@/db";
import {
  eventCheckins,
  eventDiscountCodes,
  eventQuestions,
  eventRegistrations,
  events,
} from "@/db/schema";
import { ACTIVE_REGISTRATION_STATUSES } from "@/lib/data";

export type HostEventListItem = {
  id: string;
  slug: string;
  title: string;
  coverUrl: string | null;
  status: "draft" | "published" | "cancelled";
  startsAt: Date;
  endsAt: Date | null;
  capacity: number | null;
  registrantCount: number;
  approvedCount: number;
};

/** Events owned by a page, newest start first, with registrant counts. */
export async function listHostEvents(
  pageId: string,
): Promise<HostEventListItem[]> {
  const db = getDb();
  const rows = await db
    .select({
      id: events.id,
      slug: events.slug,
      title: events.title,
      coverUrl: events.coverUrl,
      status: events.status,
      startsAt: events.startsAt,
      endsAt: events.endsAt,
      capacity: events.capacity,
    })
    .from(events)
    .where(eq(events.pageId, pageId))
    .orderBy(desc(events.startsAt));

  if (rows.length === 0) return [];

  const ids = rows.map((r) => r.id);
  const counts = await db
    .select({
      eventId: eventRegistrations.eventId,
      status: eventRegistrations.status,
      n: sql<number>`count(*)::int`,
    })
    .from(eventRegistrations)
    .where(inArray(eventRegistrations.eventId, ids))
    .groupBy(eventRegistrations.eventId, eventRegistrations.status);

  const total = new Map<string, number>();
  const approved = new Map<string, number>();
  for (const c of counts) {
    if (
      (ACTIVE_REGISTRATION_STATUSES as readonly string[]).includes(c.status)
    ) {
      total.set(c.eventId, (total.get(c.eventId) ?? 0) + Number(c.n));
    }
    if (c.status === "approved" || c.status === "attended") {
      approved.set(c.eventId, (approved.get(c.eventId) ?? 0) + Number(c.n));
    }
  }

  return rows.map((r) => ({
    ...r,
    registrantCount: total.get(r.id) ?? 0,
    approvedCount: approved.get(r.id) ?? 0,
  }));
}

/** Full event with questions + discount codes, scoped to its owning page. */
export async function getHostEvent(eventId: string, pageId: string) {
  const db = getDb();
  const event = await db.query.events.findFirst({
    where: and(eq(events.id, eventId), eq(events.pageId, pageId)),
  });
  if (!event) return null;

  const [questions, codes] = await Promise.all([
    db
      .select()
      .from(eventQuestions)
      .where(eq(eventQuestions.eventId, eventId))
      .orderBy(asc(eventQuestions.sortOrder)),
    db
      .select()
      .from(eventDiscountCodes)
      .where(eq(eventDiscountCodes.eventId, eventId))
      .orderBy(asc(eventDiscountCodes.createdAt)),
  ]);

  return { event, questions, codes };
}

/** Count registrations that occupy a spot (approved/attended). */
export async function getApprovedCount(eventId: string): Promise<number> {
  const db = getDb();
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(eventRegistrations)
    .where(
      and(
        eq(eventRegistrations.eventId, eventId),
        inArray(eventRegistrations.status, ["approved", "attended"]),
      ),
    );
  return Number(row?.n ?? 0);
}

/** Whether a given user is checked in for an event (for the host scanner). */
export async function getCheckinForRegistration(registrationId: string) {
  const db = getDb();
  return db.query.eventCheckins.findFirst({
    where: eq(eventCheckins.registrationId, registrationId),
  });
}
