import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  isNotNull,
  isNull,
  or,
  sql,
  sum,
} from "drizzle-orm";

import { getDb } from "@/db";
import {
  cardRequests,
  eventRegistrations,
  events,
  linkStatsByDay,
  profileLinks,
  profileStatsByDay,
  profiles,
  sessions,
  users,
} from "@/db/schema";
import { isReservedSlug } from "@/lib/slug";

export async function getProfileWithLinksByUserId(userId: string) {
  const db = getDb();
  const profile = await db.query.profiles.findFirst({
    where: eq(profiles.userId, userId),
  });

  if (!profile) {
    return null;
  }

  const links = await db
    .select()
    .from(profileLinks)
    .where(eq(profileLinks.profileId, profile.id))
    .orderBy(asc(profileLinks.sortOrder));

  return {
    ...profile,
    links,
  };
}

export async function getPublicProfileBySlug(slug: string) {
  if (isReservedSlug(slug)) {
    return null;
  }

  const db = getDb();
  const profile = await db.query.profiles.findFirst({
    where: and(eq(profiles.slug, slug), eq(profiles.isComplete, true)),
  });

  if (!profile) {
    return null;
  }

  const links = await db
    .select()
    .from(profileLinks)
    .where(
      and(
        eq(profileLinks.profileId, profile.id),
        eq(profileLinks.isActive, true),
      ),
    )
    .orderBy(asc(profileLinks.sortOrder));

  const { getPublicActiveBookingBlocks } = await import("@/lib/booking-data");
  const bookingBlocks = await getPublicActiveBookingBlocks(profile.id);

  const owner = await db.query.users.findFirst({
    where: eq(users.id, profile.userId),
  });

  return {
    ...profile,
    links,
    bookingBlocks,
    owner,
  };
}

export async function getPublishedEvents() {
  const db = getDb();

  return db
    .select()
    .from(events)
    .where(eq(events.status, "published"))
    .orderBy(asc(events.startsAt));
}

export async function getRegisteredEventIds(userId: string) {
  const db = getDb();
  const rows = await db
    .select({
      eventId: eventRegistrations.eventId,
    })
    .from(eventRegistrations)
    .where(
      and(
        eq(eventRegistrations.userId, userId),
        eq(eventRegistrations.status, "registered"),
      ),
    );

  return new Set(rows.map((item) => item.eventId));
}

export async function getEventBySlug(slug: string) {
  const db = getDb();

  return db.query.events.findFirst({
    where: eq(events.slug, slug),
  });
}

export async function getDashboardRegistrations(userId: string) {
  const db = getDb();

  return db
    .select({
      registrationId: eventRegistrations.id,
      registeredAt: eventRegistrations.createdAt,
      eventId: events.id,
      title: events.title,
      slug: events.slug,
      description: events.description,
      location: events.location,
      startsAt: events.startsAt,
      endsAt: events.endsAt,
      coverUrl: events.coverUrl,
      status: events.status,
    })
    .from(eventRegistrations)
    .innerJoin(events, eq(eventRegistrations.eventId, events.id))
    .where(
      and(
        eq(eventRegistrations.userId, userId),
        eq(eventRegistrations.status, "registered"),
      ),
    )
    .orderBy(asc(events.startsAt));
}

export async function getProfileStats(profileId: string) {
  const db = getDb();
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const sevenDaysAgoStr = sevenDaysAgo.toISOString().slice(0, 10);

  // Single query over at most 7 rows — trivially fast regardless of traffic.
  const rows = await db
    .select({
      statDate: profileStatsByDay.statDate,
      views: profileStatsByDay.views,
      linkClicks: profileStatsByDay.linkClicks,
    })
    .from(profileStatsByDay)
    .where(
      and(
        eq(profileStatsByDay.profileId, profileId),
        gte(profileStatsByDay.statDate, sevenDaysAgoStr),
      ),
    );

  let views7d = 0;
  let totalLinkClicks = 0;
  const weeklyViews: { day: string; total: number }[] = [];

  for (const row of rows) {
    views7d += row.views;
    totalLinkClicks += row.linkClicks;
    weeklyViews.push({ day: row.statDate, total: row.views });
  }

  return { views7d, totalLinkClicks, weeklyViews };
}

/** Returns a map of linkId → total all-time clicks for the given link IDs. */
export async function getLinkClickCounts(
  linkIds: string[],
): Promise<Record<string, number>> {
  if (!linkIds.length) return {};
  const db = getDb();
  const rows = await db
    .select({
      linkId: linkStatsByDay.linkId,
      total: sum(linkStatsByDay.clicks),
    })
    .from(linkStatsByDay)
    .where(inArray(linkStatsByDay.linkId, linkIds))
    .groupBy(linkStatsByDay.linkId);

  return Object.fromEntries(rows.map((r) => [r.linkId, Number(r.total ?? 0)]));
}

export async function getLatestCardRequest(userId: string) {
  const db = getDb();

  return db.query.cardRequests.findFirst({
    where: eq(cardRequests.userId, userId),
    orderBy: [desc(cardRequests.createdAt)],
  });
}

export async function getAdminEvents() {
  const db = getDb();

  return db.select().from(events).orderBy(desc(events.createdAt));
}

export async function getAdminEventsWithCounts() {
  const db = getDb();
  const rows = await db
    .select({
      id: events.id,
      title: events.title,
      slug: events.slug,
      description: events.description,
      coverUrl: events.coverUrl,
      location: events.location,
      startsAt: events.startsAt,
      endsAt: events.endsAt,
      status: events.status,
      createdAt: events.createdAt,
    })
    .from(events)
    .orderBy(desc(events.createdAt));

  if (rows.length === 0) return [];

  const counts = await db
    .select({
      eventId: eventRegistrations.eventId,
      registered: count(eventRegistrations.id),
    })
    .from(eventRegistrations)
    .where(
      and(
        eq(eventRegistrations.status, "registered"),
        inArray(
          eventRegistrations.eventId,
          rows.map((row) => row.id),
        ),
      ),
    )
    .groupBy(eventRegistrations.eventId);

  const countMap = new Map(
    counts.map((row) => [row.eventId, Number(row.registered)]),
  );

  return rows.map((row) => ({
    ...row,
    registeredCount: countMap.get(row.id) ?? 0,
  }));
}

export async function getAdminEventRegistrations(eventId: string) {
  const db = getDb();

  return db
    .select({
      registrationId: eventRegistrations.id,
      status: eventRegistrations.status,
      registeredAt: eventRegistrations.createdAt,
      userId: users.id,
      phone: users.phone,
      role: users.role,
      profileSlug: profiles.slug,
      fullName: profiles.fullName,
      profileTitle: profiles.title,
      avatarUrl: profiles.avatarUrl,
      email: profiles.email,
    })
    .from(eventRegistrations)
    .innerJoin(users, eq(eventRegistrations.userId, users.id))
    .leftJoin(profiles, eq(profiles.userId, users.id))
    .where(eq(eventRegistrations.eventId, eventId))
    .orderBy(desc(eventRegistrations.createdAt));
}

export async function getEventRegisteredCount(eventId: string) {
  const db = getDb();
  const [row] = await db
    .select({ value: count(eventRegistrations.id) })
    .from(eventRegistrations)
    .where(
      and(
        eq(eventRegistrations.eventId, eventId),
        eq(eventRegistrations.status, "registered"),
      ),
    );

  return Number(row?.value ?? 0);
}

export async function getEventRecentAttendees(eventId: string, limit = 6) {
  const db = getDb();
  return db
    .select({
      userId: users.id,
      fullName: profiles.fullName,
      avatarUrl: profiles.avatarUrl,
      profileSlug: profiles.slug,
    })
    .from(eventRegistrations)
    .innerJoin(users, eq(eventRegistrations.userId, users.id))
    .leftJoin(profiles, eq(profiles.userId, users.id))
    .where(
      and(
        eq(eventRegistrations.eventId, eventId),
        eq(eventRegistrations.status, "registered"),
      ),
    )
    .orderBy(desc(eventRegistrations.createdAt))
    .limit(limit);
}

export async function getAdminCardRequests() {
  const db = getDb();

  return db
    .select({
      id: cardRequests.id,
      status: cardRequests.status,
      createdAt: cardRequests.createdAt,
      fullName: cardRequests.fullName,
      phone: cardRequests.phone,
      deliveryInfo: cardRequests.deliveryInfo,
      cardType: cardRequests.cardType,
      cardDesign: cardRequests.cardDesign,
      notes: cardRequests.notes,
      userId: cardRequests.userId,
      userPhone: users.phone,
    })
    .from(cardRequests)
    .innerJoin(users, eq(cardRequests.userId, users.id))
    .orderBy(desc(cardRequests.createdAt));
}

// --- Admin user management ----------------------------------------------

export type AdminUserFilter =
  | "all"
  | "active"
  | "banned"
  | "incomplete"
  | "admins";

export type AdminUserListItem = {
  id: string;
  phone: string;
  role: "user" | "admin";
  createdAt: Date;
  lastLoginAt: Date | null;
  bannedAt: Date | null;
  bannedReason: string | null;
  slug: string | null;
  fullName: string | null;
  title: string | null;
  avatarUrl: string | null;
  isComplete: boolean;
  linkCount: number;
  eventCount: number;
  cardRequestCount: number;
};

const ADMIN_USERS_PAGE_SIZE = 25;

export async function listAdminUsers({
  query,
  filter = "all",
  page = 1,
  pageSize = ADMIN_USERS_PAGE_SIZE,
}: {
  query?: string;
  filter?: AdminUserFilter;
  page?: number;
  pageSize?: number;
} = {}) {
  const db = getDb();

  const q = (query ?? "").trim();
  const searchPattern = q ? `%${q}%` : null;

  const whereClauses = [] as ReturnType<typeof eq>[];
  if (searchPattern) {
    whereClauses.push(
      or(
        ilike(users.phone, searchPattern),
        ilike(profiles.fullName, searchPattern),
        ilike(profiles.slug, searchPattern),
        ilike(profiles.email, searchPattern),
      )!,
    );
  }
  if (filter === "banned") {
    whereClauses.push(isNotNull(users.bannedAt));
  } else if (filter === "active") {
    whereClauses.push(isNull(users.bannedAt));
  } else if (filter === "admins") {
    whereClauses.push(eq(users.role, "admin"));
  } else if (filter === "incomplete") {
    whereClauses.push(or(isNull(profiles.id), eq(profiles.isComplete, false))!);
  }

  const where = whereClauses.length ? and(...whereClauses) : undefined;

  const safePage = Math.max(1, Math.floor(page));
  const safeSize = Math.max(1, Math.min(100, Math.floor(pageSize)));

  const rows = await db
    .select({
      id: users.id,
      phone: users.phone,
      role: users.role,
      createdAt: users.createdAt,
      lastLoginAt: users.lastLoginAt,
      bannedAt: users.bannedAt,
      bannedReason: users.bannedReason,
      slug: profiles.slug,
      fullName: profiles.fullName,
      title: profiles.title,
      avatarUrl: profiles.avatarUrl,
      isComplete: profiles.isComplete,
    })
    .from(users)
    .leftJoin(profiles, eq(profiles.userId, users.id))
    .where(where)
    .orderBy(desc(users.createdAt))
    .limit(safeSize)
    .offset((safePage - 1) * safeSize);

  const [{ total } = { total: 0 }] = await db
    .select({ total: count(users.id) })
    .from(users)
    .leftJoin(profiles, eq(profiles.userId, users.id))
    .where(where);

  if (rows.length === 0) {
    return {
      items: [] as AdminUserListItem[],
      total: Number(total ?? 0),
      page: safePage,
      pageSize: safeSize,
    };
  }

  const userIds = rows.map((row) => row.id);
  const profileIds = rows
    .map((row) => row.slug)
    .filter((value): value is string => Boolean(value));

  const [linkCounts, eventCounts, cardCounts] = await Promise.all([
    profileIds.length
      ? db
          .select({
            profileId: profileLinks.profileId,
            value: count(profileLinks.id),
          })
          .from(profileLinks)
          .innerJoin(profiles, eq(profiles.id, profileLinks.profileId))
          .where(inArray(profiles.userId, userIds))
          .groupBy(profileLinks.profileId)
      : Promise.resolve([] as { profileId: string; value: number }[]),
    db
      .select({
        userId: eventRegistrations.userId,
        value: count(eventRegistrations.id),
      })
      .from(eventRegistrations)
      .where(
        and(
          inArray(eventRegistrations.userId, userIds),
          eq(eventRegistrations.status, "registered"),
        ),
      )
      .groupBy(eventRegistrations.userId),
    db
      .select({
        userId: cardRequests.userId,
        value: count(cardRequests.id),
      })
      .from(cardRequests)
      .where(inArray(cardRequests.userId, userIds))
      .groupBy(cardRequests.userId),
  ]);

  // Map link counts via profile → user id.
  const userIdByProfileId = new Map<string, string>();
  if (profileIds.length) {
    const profileRows = await db
      .select({ id: profiles.id, userId: profiles.userId })
      .from(profiles)
      .where(inArray(profiles.userId, userIds));
    for (const row of profileRows) {
      userIdByProfileId.set(row.id, row.userId);
    }
  }

  const linkByUser = new Map<string, number>();
  for (const row of linkCounts) {
    const uid = userIdByProfileId.get(row.profileId);
    if (uid) linkByUser.set(uid, Number(row.value));
  }
  const eventByUser = new Map<string, number>(
    eventCounts.map((row) => [row.userId, Number(row.value)]),
  );
  const cardByUser = new Map<string, number>(
    cardCounts.map((row) => [row.userId, Number(row.value)]),
  );

  const items: AdminUserListItem[] = rows.map((row) => ({
    id: row.id,
    phone: row.phone,
    role: row.role,
    createdAt: row.createdAt,
    lastLoginAt: row.lastLoginAt,
    bannedAt: row.bannedAt,
    bannedReason: row.bannedReason,
    slug: row.slug,
    fullName: row.fullName,
    title: row.title,
    avatarUrl: row.avatarUrl,
    isComplete: Boolean(row.isComplete),
    linkCount: linkByUser.get(row.id) ?? 0,
    eventCount: eventByUser.get(row.id) ?? 0,
    cardRequestCount: cardByUser.get(row.id) ?? 0,
  }));

  return {
    items,
    total: Number(total ?? 0),
    page: safePage,
    pageSize: safeSize,
  };
}

export async function getAdminUserStats() {
  const db = getDb();
  const now = new Date();
  const dayMs = 24 * 60 * 60 * 1000;
  const last24h = new Date(now.getTime() - dayMs);
  const last7d = new Date(now.getTime() - 7 * dayMs);
  const last30d = new Date(now.getTime() - 30 * dayMs);

  const [
    [{ total = 0 } = {}],
    [{ banned = 0 } = {}],
    [{ admins = 0 } = {}],
    [{ withCompleteProfile = 0 } = {}],
    [{ newLast7d = 0 } = {}],
    [{ newLast30d = 0 } = {}],
    [{ activeLast24h = 0 } = {}],
    [{ activeLast7d = 0 } = {}],
  ] = await Promise.all([
    db.select({ total: count(users.id) }).from(users),
    db
      .select({ banned: count(users.id) })
      .from(users)
      .where(isNotNull(users.bannedAt)),
    db
      .select({ admins: count(users.id) })
      .from(users)
      .where(eq(users.role, "admin")),
    db
      .select({ withCompleteProfile: count(profiles.id) })
      .from(profiles)
      .where(eq(profiles.isComplete, true)),
    db
      .select({ newLast7d: count(users.id) })
      .from(users)
      .where(gte(users.createdAt, last7d)),
    db
      .select({ newLast30d: count(users.id) })
      .from(users)
      .where(gte(users.createdAt, last30d)),
    db
      .select({ activeLast24h: count(users.id) })
      .from(users)
      .where(
        and(isNotNull(users.lastLoginAt), gte(users.lastLoginAt, last24h)),
      ),
    db
      .select({ activeLast7d: count(users.id) })
      .from(users)
      .where(and(isNotNull(users.lastLoginAt), gte(users.lastLoginAt, last7d))),
  ]);

  // 14-day signup trend for a small sparkline.
  const start14 = new Date(now.getTime() - 14 * dayMs);
  const signupRows = await db
    .select({
      day: sql<string>`date_trunc('day', ${users.createdAt})::date::text`,
      value: count(users.id),
    })
    .from(users)
    .where(gte(users.createdAt, start14))
    .groupBy(sql`date_trunc('day', ${users.createdAt})`);

  const signupByDay = new Map<string, number>(
    signupRows.map((row) => [row.day, Number(row.value)]),
  );
  const signupTrend: { date: string; value: number }[] = [];
  for (let i = 13; i >= 0; i -= 1) {
    const d = new Date(now.getTime() - i * dayMs);
    const key = d.toISOString().slice(0, 10);
    signupTrend.push({ date: key, value: signupByDay.get(key) ?? 0 });
  }

  return {
    total: Number(total),
    banned: Number(banned),
    admins: Number(admins),
    withCompleteProfile: Number(withCompleteProfile),
    incompleteProfile: Number(total) - Number(withCompleteProfile),
    newLast7d: Number(newLast7d),
    newLast30d: Number(newLast30d),
    activeLast24h: Number(activeLast24h),
    activeLast7d: Number(activeLast7d),
    signupTrend,
  };
}

export async function getAdminUserDetail(userId: string) {
  const db = getDb();

  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });
  if (!user) return null;

  const profile = await db.query.profiles.findFirst({
    where: eq(profiles.userId, user.id),
  });

  const links = profile
    ? await db
        .select()
        .from(profileLinks)
        .where(eq(profileLinks.profileId, profile.id))
        .orderBy(asc(profileLinks.sortOrder))
    : [];

  const registrations = await db
    .select({
      registrationId: eventRegistrations.id,
      status: eventRegistrations.status,
      registeredAt: eventRegistrations.createdAt,
      eventId: events.id,
      title: events.title,
      slug: events.slug,
      startsAt: events.startsAt,
      eventStatus: events.status,
    })
    .from(eventRegistrations)
    .innerJoin(events, eq(eventRegistrations.eventId, events.id))
    .where(eq(eventRegistrations.userId, user.id))
    .orderBy(desc(eventRegistrations.createdAt));

  const cards = await db
    .select()
    .from(cardRequests)
    .where(eq(cardRequests.userId, user.id))
    .orderBy(desc(cardRequests.createdAt));

  const sessionRows = await db
    .select({
      id: sessions.id,
      createdAt: sessions.createdAt,
      lastSeenAt: sessions.lastSeenAt,
      expiresAt: sessions.expiresAt,
      revokedAt: sessions.revokedAt,
      userAgent: sessions.userAgent,
      ipAddress: sessions.ipAddress,
    })
    .from(sessions)
    .where(eq(sessions.userId, user.id))
    .orderBy(desc(sessions.createdAt))
    .limit(5);

  return {
    user,
    profile: profile ?? null,
    links,
    registrations,
    cardRequests: cards,
    recentSessions: sessionRows,
  };
}
