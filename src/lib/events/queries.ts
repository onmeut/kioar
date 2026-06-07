import "server-only";

import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";

import { getDb } from "@/db";
import {
  eventCheckins,
  eventDiscountCodes,
  eventQuestions,
  eventRegistrations,
  events,
  profiles,
  users,
} from "@/db/schema";
import { ACTIVE_REGISTRATION_STATUSES } from "@/lib/data";
import type { EventRegistrationStatus } from "@/lib/events/labels";

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

export type PublicEventCard = {
  id: string;
  slug: string;
  title: string;
  coverUrl: string | null;
  locationType: "physical" | "online";
  priceType: "free" | "paid";
  priceToman: number;
  startsAt: Date;
  endsAt: Date | null;
  timezone: string;
  capacity: number | null;
  spotsRemaining: number | null;
  isFull: boolean;
  sortOrder: number;
  spotlight: (typeof events.$inferSelect)["spotlight"];
  animationStyle: (typeof events.$inferSelect)["animationStyle"];
};

/**
 * Published, upcoming, active events for a page's public block. Past events are
 * excluded. Returns Date instances (the profile cache reviver handles ISO).
 * Caller gates on `business_events` before invoking.
 */
export async function getPublicActiveEventBlocks(
  pageId: string,
): Promise<PublicEventCard[]> {
  const db = getDb();
  const now = new Date();
  const rows = await db
    .select()
    .from(events)
    .where(
      and(
        eq(events.pageId, pageId),
        eq(events.status, "published"),
        eq(events.isActive, true),
      ),
    )
    .orderBy(asc(events.startsAt));

  // Upcoming only: end (or start) in the future.
  const upcoming = rows.filter((ev) => {
    const ref = ev.endsAt ?? ev.startsAt;
    return ref.getTime() >= now.getTime();
  });
  if (upcoming.length === 0) return [];

  // Confirmed-spot counts for capacity labels.
  const ids = upcoming.map((e) => e.id);
  const counts = await db
    .select({
      eventId: eventRegistrations.eventId,
      n: sql<number>`count(*)::int`,
    })
    .from(eventRegistrations)
    .where(
      and(
        inArray(eventRegistrations.eventId, ids),
        inArray(eventRegistrations.status, ["approved", "attended"]),
      ),
    )
    .groupBy(eventRegistrations.eventId);
  const spotMap = new Map(counts.map((c) => [c.eventId, Number(c.n)]));

  return upcoming.map((ev) => {
    const spots = spotMap.get(ev.id) ?? 0;
    const spotsRemaining =
      ev.capacity != null ? Math.max(0, ev.capacity - spots) : null;
    return {
      id: ev.id,
      slug: ev.slug,
      title: ev.title,
      coverUrl: ev.coverUrl,
      locationType: ev.locationType,
      priceType: ev.priceType,
      priceToman: ev.priceToman,
      startsAt: ev.startsAt,
      endsAt: ev.endsAt,
      timezone: ev.timezone,
      capacity: ev.capacity,
      spotsRemaining,
      isFull: ev.capacity != null && spots >= ev.capacity,
      sortOrder: ev.sortOrder,
      spotlight: ev.spotlight,
      animationStyle: ev.animationStyle,
    };
  });
}

export type PublicEventView = {
  id: string;
  slug: string;
  pageSlug: string;
  pageName: string | null;
  pageAvatarUrl: string | null;
  title: string;
  description: string | null;
  coverUrl: string | null;
  locationType: "physical" | "online";
  locationAddress: string | null;
  /** ONLY present when the viewer is approved/attended — otherwise null. */
  onlineUrl: string | null;
  timezone: string;
  startsAt: Date;
  endsAt: Date | null;
  capacity: number | null;
  priceType: "free" | "paid";
  priceToman: number;
  approvalRequired: boolean;
  receiptUploadEnabled: boolean;
  waitlistEnabled: boolean;
  status: "draft" | "published" | "cancelled";
  confirmedSpots: number;
  spotsRemaining: number | null;
  isFull: boolean;
  isPast: boolean;
  questions: Array<{
    id: string;
    kind: "short_text" | "long_text" | "single_select" | "multi_select";
    label: string;
    required: boolean;
    options: string[] | null;
  }>;
  viewerRegistration: {
    status: string;
    receiptKey: string | null;
    expectedToman: number;
  } | null;
};

/**
 * Load the public view of an event by page slug + event slug, for an optional
 * viewer. **Security:** `onlineUrl` is stripped unless the viewer's
 * registration is `approved` or `attended` — the URL never reaches the client
 * for anyone else. Returns null if the event isn't published.
 */
export async function getPublicEvent(
  pageSlug: string,
  eventSlug: string,
  viewerUserId: string | null,
): Promise<PublicEventView | null> {
  const db = getDb();
  const row = await db
    .select({
      event: events,
      pageSlug: profiles.slug,
      pageName: profiles.fullName,
      pageAvatarUrl: profiles.avatarUrl,
    })
    .from(events)
    .innerJoin(profiles, eq(events.pageId, profiles.id))
    .where(and(eq(events.slug, eventSlug), eq(profiles.slug, pageSlug)))
    .limit(1);

  const found = row[0];
  if (!found || found.event.status !== "published") return null;
  const ev = found.event;

  const [questions, viewerReg, spots] = await Promise.all([
    db
      .select()
      .from(eventQuestions)
      .where(eq(eventQuestions.eventId, ev.id))
      .orderBy(asc(eventQuestions.sortOrder)),
    viewerUserId
      ? db.query.eventRegistrations.findFirst({
          where: and(
            eq(eventRegistrations.eventId, ev.id),
            eq(eventRegistrations.userId, viewerUserId),
          ),
        })
      : Promise.resolve(null),
    getApprovedCount(ev.id),
  ]);

  const viewerStatus = viewerReg?.status ?? null;
  const canSeeOnlineUrl =
    viewerStatus === "approved" || viewerStatus === "attended";

  const endRef = ev.endsAt ?? ev.startsAt;
  const isPast = endRef.getTime() < Date.now();
  const isFull = ev.capacity != null && spots >= ev.capacity;
  const spotsRemaining =
    ev.capacity != null ? Math.max(0, ev.capacity - spots) : null;

  return {
    id: ev.id,
    slug: ev.slug,
    pageSlug: found.pageSlug,
    pageName: found.pageName,
    pageAvatarUrl: found.pageAvatarUrl,
    title: ev.title,
    description: ev.description,
    coverUrl: ev.coverUrl,
    locationType: ev.locationType,
    locationAddress: ev.locationAddress,
    onlineUrl: canSeeOnlineUrl ? ev.onlineUrl : null,
    timezone: ev.timezone,
    startsAt: ev.startsAt,
    endsAt: ev.endsAt,
    capacity: ev.capacity,
    priceType: ev.priceType,
    priceToman: ev.priceToman,
    approvalRequired: ev.approvalRequired,
    receiptUploadEnabled: ev.receiptUploadEnabled,
    waitlistEnabled: ev.waitlistEnabled,
    status: ev.status,
    confirmedSpots: spots,
    spotsRemaining,
    isFull,
    isPast,
    questions: questions.map((q) => ({
      id: q.id,
      kind: q.kind,
      label: q.label,
      required: q.required,
      options: q.options ?? null,
    })),
    viewerRegistration: viewerReg
      ? {
          status: viewerReg.status,
          receiptKey: viewerReg.receiptKey,
          expectedToman: viewerReg.expectedToman,
        }
      : null,
  };
}

// ---------------------------------------------------------------------------
// Host management view (Increment 8): registrant list + aggregate stats.
// ---------------------------------------------------------------------------

export type EventRegistrant = {
  registrationId: string;
  userId: string;
  name: string;
  phone: string;
  status: EventRegistrationStatus;
  answers: Record<string, string | string[]>;
  receiptKey: string | null;
  discountCode: string | null;
  expectedToman: number;
  registeredAt: Date;
  decidedAt: Date | null;
  checkedInAt: Date | null;
};

/**
 * Full registrant list for an event, host-facing. Joins the user for a display
 * name + phone and left-joins the check-in audit row for attendance time.
 * Caller MUST have verified page ownership (pass the event's pageId).
 */
export async function listEventRegistrants(
  eventId: string,
  pageId: string,
): Promise<EventRegistrant[] | null> {
  const db = getDb();
  // Ownership guard: the event must belong to the page.
  const owns = await db.query.events.findFirst({
    where: and(eq(events.id, eventId), eq(events.pageId, pageId)),
    columns: { id: true },
  });
  if (!owns) return null;

  const rows = await db
    .select({
      registrationId: eventRegistrations.id,
      userId: eventRegistrations.userId,
      firstName: users.firstName,
      lastName: users.lastName,
      phone: users.phone,
      status: eventRegistrations.status,
      answers: eventRegistrations.answers,
      receiptKey: eventRegistrations.receiptKey,
      discountCode: eventRegistrations.discountCode,
      expectedToman: eventRegistrations.expectedToman,
      registeredAt: eventRegistrations.createdAt,
      decidedAt: eventRegistrations.decidedAt,
      checkedInAt: eventCheckins.checkedInAt,
    })
    .from(eventRegistrations)
    .innerJoin(users, eq(eventRegistrations.userId, users.id))
    .leftJoin(
      eventCheckins,
      eq(eventCheckins.registrationId, eventRegistrations.id),
    )
    .where(eq(eventRegistrations.eventId, eventId))
    .orderBy(desc(eventRegistrations.createdAt));

  return rows.map((r) => {
    const name = [r.firstName, r.lastName]
      .filter((p) => p && p.trim())
      .join(" ")
      .trim();
    return {
      registrationId: r.registrationId,
      userId: r.userId,
      name: name || r.phone,
      phone: r.phone,
      status: r.status,
      answers: r.answers ?? {},
      receiptKey: r.receiptKey,
      discountCode: r.discountCode,
      expectedToman: r.expectedToman,
      registeredAt: r.registeredAt,
      decidedAt: r.decidedAt,
      checkedInAt: r.checkedInAt,
    };
  });
}

export type EventStats = {
  total: number;
  approved: number;
  checkedIn: number;
  pending: number;
  waitlisted: number;
  capacity: number | null;
  spotsRemaining: number | null;
};

/** Aggregate counts for the management header. */
export async function getEventStats(
  eventId: string,
  pageId: string,
): Promise<EventStats | null> {
  const db = getDb();
  const event = await db.query.events.findFirst({
    where: and(eq(events.id, eventId), eq(events.pageId, pageId)),
    columns: { capacity: true },
  });
  if (!event) return null;

  const counts = await db
    .select({
      status: eventRegistrations.status,
      n: sql<number>`count(*)::int`,
    })
    .from(eventRegistrations)
    .where(eq(eventRegistrations.eventId, eventId))
    .groupBy(eventRegistrations.status);

  let total = 0;
  let approved = 0;
  let checkedIn = 0;
  let pending = 0;
  let waitlisted = 0;
  for (const c of counts) {
    const n = Number(c.n);
    if ((ACTIVE_REGISTRATION_STATUSES as readonly string[]).includes(c.status)) {
      total += n;
    }
    if (c.status === "approved" || c.status === "attended") approved += n;
    if (c.status === "attended") checkedIn += n;
    if (
      c.status === "pending_approval" ||
      c.status === "payment_pending" ||
      c.status === "payment_submitted"
    ) {
      pending += n;
    }
    if (c.status === "waitlisted") waitlisted += n;
  }

  const spotsRemaining =
    event.capacity != null ? Math.max(0, event.capacity - approved) : null;

  return {
    total,
    approved,
    checkedIn,
    pending,
    waitlisted,
    capacity: event.capacity,
    spotsRemaining,
  };
}
