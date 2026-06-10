import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  inArray,
  isNotNull,
  sql,
  sum,
} from "drizzle-orm";

import { getDb } from "@/db";
import {
  eventRegistrations,
  events,
  linkStatsByDay,
  profileLinks,
  profileStatsByDay,
  profiles,
  sessions,
  users,
} from "@/db/schema";
import { blockKindToFeatureKey } from "@/lib/block-features";
import { getPublicActiveBookingBlocks } from "@/lib/booking-data";
import { withProfileCache } from "@/lib/cache/profile-cache";
import { getPageEntitlements } from "@/lib/entitlements";
import { getPublicActiveFormBlocks } from "@/lib/form-service";
import { getPublicActiveEventBlocks } from "@/lib/events/queries";
import { getPublicActiveProductBlocks } from "@/lib/product-service";
import { getPublicActiveTextBlocks } from "@/lib/text-block-service";
import { isReservedSlug } from "@/lib/slug";
import { resolveCurrentPageForOwner } from "@/lib/pages";

export async function getProfileWithLinksByUserId(userId: string) {
  const db = getDb();
  // A user can own many pages now; resolve "the page they're editing" via
  // the kioar_page_id cookie, falling back to their oldest page.
  const profile = await resolveCurrentPageForOwner(userId);

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
  return withProfileCache(slug, () => loadPublicProfileBySlug(slug));
}

/**
 * Explicit allow-list of `profiles` columns the public read path selects.
 *
 * This projection is what decouples the size/shape of the cached payload
 * (`kioar:page:v1+` in profile-cache.ts) from the column count of the
 * `profiles` table. Without it, `findFirst` returns `SELECT *`, so every
 * column added to `profiles` silently lands in the hot read path AND the
 * Redis payload — the exact coupling that made the god table hard to cache.
 *
 * Discipline: a new `profiles` column is INVISIBLE to the public page until
 * it is added here. Only add a key when a public consumer actually reads it.
 * The set below is the union of `profile.*` fields read across every caller
 * of `getPublicProfileBySlug` (the `[slug]` page, `c/[id]`, `ig/[slug]`, the
 * OG/manifest/vcf routes, and profile-icon-render). `userId` is needed by
 * the loader itself to fetch the owner; `settings` carries the page-settings
 * blob so future settings reach the renderer without re-touching this list.
 */
const PUBLIC_PROFILE_COLUMNS = {
  id: true,
  userId: true,
  slug: true,
  fullName: true,
  title: true,
  bio: true,
  avatarUrl: true,
  avatarSeed: true,
  publicPhone: true,
  showPublicPhone: true,
  email: true,
  showPublicEmail: true,
  domain: true,
  seoTitle: true,
  seoDescription: true,
  ogImageUrl: true,
  indexEnabled: true,
  appIconKey: true,
  appIconColor: true,
  isComplete: true,
  adminDisabledAt: true,
  city: true,
  qrStyle: true,
  appearance: true,
  settings: true,
  createdAt: true,
  updatedAt: true,
} as const;

async function loadPublicProfileBySlug(slug: string) {
  const db = getDb();

  // Wave 1 — profile must exist and be complete before anything else proceeds.
  // Explicit column projection (PUBLIC_PROFILE_COLUMNS) keeps the cached
  // payload independent of the table's total column count — see the comment
  // on that constant.
  const profile = await db.query.profiles.findFirst({
    where: and(eq(profiles.slug, slug), eq(profiles.isComplete, true)),
    columns: PUBLIC_PROFILE_COLUMNS,
  });

  if (!profile) {
    return null;
  }

  const bookingKey = blockKindToFeatureKey("booking");
  const formKey = blockKindToFeatureKey("form");
  const productKey = blockKindToFeatureKey("product");
  const eventKey = blockKindToFeatureKey("event");
  const textKey = blockKindToFeatureKey("text");

  // Wave 2 — all queries that only need profile.id run in parallel.
  // getPageEntitlements fetches the full entitlement map for this page in
  // one DB round-trip. We then probe the map per block kind rather than
  // calling pageHasFeature three times — this is correct even in route-
  // handler contexts where React cache() is a no-op (no shared render scope).
  const [links, entitlements, owner] = await Promise.all([
    db
      .select()
      .from(profileLinks)
      .where(
        and(
          eq(profileLinks.profileId, profile.id),
          eq(profileLinks.isActive, true),
        ),
      )
      .orderBy(asc(profileLinks.sortOrder)),
    getPageEntitlements(profile.id),
    db.query.users.findFirst({ where: eq(users.id, profile.userId) }),
  ]);

  // A null feature key means "no gate" — block is always visible.
  const bookingsGranted = bookingKey === null || entitlements.has(bookingKey);
  const formsGranted = formKey === null || entitlements.has(formKey);
  const productsGranted = productKey === null || entitlements.has(productKey);
  const eventsGranted = eventKey === null || entitlements.has(eventKey);
  const textGranted = textKey === null || entitlements.has(textKey);

  // Wave 3 — block content is conditional on entitlements. The fetches are
  // independent of each other so they run in parallel.
  const [bookingBlocks, formBlocks, productBlocks, eventBlocks, textBlocks] =
    await Promise.all([
      bookingsGranted ? getPublicActiveBookingBlocks(profile.id) : [],
      formsGranted ? getPublicActiveFormBlocks(profile.id) : [],
      productsGranted ? getPublicActiveProductBlocks(profile.id) : [],
      eventsGranted ? getPublicActiveEventBlocks(profile.id) : [],
      textGranted ? getPublicActiveTextBlocks(profile.id) : [],
    ]);

  return {
    ...profile,
    links,
    bookingBlocks,
    formBlocks,
    productBlocks,
    eventBlocks,
    textBlocks,
    owner,
  };
}

// Registration statuses that count as "the user is in this event" for
// dashboard/attending surfaces. Off-path states (rejected/cancelled) are
// excluded; everything from pending through attended is shown with its own
// status badge by the caller.
export const ACTIVE_REGISTRATION_STATUSES = [
  "pending_approval",
  "payment_pending",
  "payment_submitted",
  "approved",
  "waitlisted",
  "attended",
] as const;

/**
 * Events the user is registered for (any active status), newest event first.
 * Joins through to the owning page (`profiles`) so callers can build the
 * canonical `/{handle}/e/{slug}` URL. `locationLabel` is a display string the
 * caller can show directly (online events never leak their URL here).
 */
export async function getDashboardRegistrations(userId: string) {
  const db = getDb();

  return db
    .select({
      registrationId: eventRegistrations.id,
      registrationStatus: eventRegistrations.status,
      registeredAt: eventRegistrations.createdAt,
      eventId: events.id,
      title: events.title,
      slug: events.slug,
      description: events.description,
      locationType: events.locationType,
      locationAddress: events.locationAddress,
      startsAt: events.startsAt,
      endsAt: events.endsAt,
      timezone: events.timezone,
      coverUrl: events.coverUrl,
      status: events.status,
      pageSlug: profiles.slug,
    })
    .from(eventRegistrations)
    .innerJoin(events, eq(eventRegistrations.eventId, events.id))
    .innerJoin(profiles, eq(events.pageId, profiles.id))
    .where(
      and(
        eq(eventRegistrations.userId, userId),
        inArray(eventRegistrations.status, [...ACTIVE_REGISTRATION_STATUSES]),
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

// NOTE: Admin/host event-query helpers (list with counts, registrant lists,
// attendee previews) are rebuilt in the events feature increments
// (lib/events/queries.ts). The throwaway global-admin versions were removed
// when the schema became page-owned. See docs/EVENTS_PLAN.md.

// --- Admin user management ----------------------------------------------

export type AdminUserFilter =
  | "all"
  | "active"
  | "banned"
  | "incomplete"
  | "admins"
  | "paid"
  | "free_only"
  | "trialing"
  | "at_risk";

export type AdminUserPagePlan = {
  pageId: string;
  slug: string;
  fullName: string | null;
  planKey: "free" | "pro" | "business";
  planNameFa: string;
  status:
    | "active"
    | "trialing"
    | "pending_renewal"
    | "grace"
    | "expired"
    | "canceled";
  currentPeriodEnd: Date | null;
  trialEndsAt: Date | null;
  cancelAtPeriodEnd: boolean;
};

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
  pageCount: number;
  pagePlans: AdminUserPagePlan[];
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
  const qLike = q ? `%${q.toLowerCase()}%` : null;

  const safePage = Math.max(1, Math.floor(page));
  const safeSize = Math.max(1, Math.min(100, Math.floor(pageSize)));
  const offset = (safePage - 1) * safeSize;

  // Profile-based search: any of the user's pages match. Uses EXISTS so the
  // main row source stays one-row-per-user.
  const searchSql = qLike
    ? sql`AND (
        LOWER(u."phone") LIKE ${qLike}
        OR EXISTS (
          SELECT 1 FROM "profiles" p
          WHERE p."user_id" = u."id"
            AND (
              LOWER(COALESCE(p."full_name", '')) LIKE ${qLike}
              OR LOWER(p."slug") LIKE ${qLike}
              OR LOWER(COALESCE(p."email", '')) LIKE ${qLike}
            )
        )
      )`
    : sql``;

  // Status / role / completeness filters.
  let filterSql = sql``;
  if (filter === "banned") {
    filterSql = sql`AND u."banned_at" IS NOT NULL`;
  } else if (filter === "active") {
    filterSql = sql`AND u."banned_at" IS NULL`;
  } else if (filter === "admins") {
    filterSql = sql`AND u."role" = 'admin'`;
  } else if (filter === "incomplete") {
    // No profile yet, OR no profile of theirs is complete.
    filterSql = sql`AND NOT EXISTS (
      SELECT 1 FROM "profiles" p
      WHERE p."user_id" = u."id" AND p."is_complete" = TRUE
    )`;
  } else if (filter === "paid") {
    filterSql = sql`AND EXISTS (
      SELECT 1 FROM "page_subscriptions" s
      JOIN "profiles" p ON p."id" = s."page_id"
      JOIN "plans" pl   ON pl."id" = s."plan_id"
      WHERE p."user_id" = u."id" AND pl."key" IN ('pro','business')
    )`;
  } else if (filter === "free_only") {
    filterSql = sql`AND EXISTS (
      SELECT 1 FROM "profiles" p WHERE p."user_id" = u."id"
    ) AND NOT EXISTS (
      SELECT 1 FROM "page_subscriptions" s
      JOIN "profiles" p ON p."id" = s."page_id"
      JOIN "plans" pl   ON pl."id" = s."plan_id"
      WHERE p."user_id" = u."id" AND pl."key" IN ('pro','business')
    )`;
  } else if (filter === "trialing") {
    filterSql = sql`AND EXISTS (
      SELECT 1 FROM "page_subscriptions" s
      JOIN "profiles" p ON p."id" = s."page_id"
      WHERE p."user_id" = u."id" AND s."status" = 'trialing'
    )`;
  } else if (filter === "at_risk") {
    filterSql = sql`AND EXISTS (
      SELECT 1 FROM "page_subscriptions" s
      JOIN "profiles" p ON p."id" = s."page_id"
      WHERE p."user_id" = u."id"
        AND s."status" IN ('grace','expired')
    )`;
  }

  // Display profile = oldest page for that user (matches user-detail picker).
  const rows = (await db.execute(sql`
    SELECT
      u."id"             AS id,
      u."phone"          AS phone,
      u."role"::text     AS role,
      u."created_at"     AS "createdAt",
      u."last_login_at"  AS "lastLoginAt",
      u."banned_at"      AS "bannedAt",
      u."banned_reason"  AS "bannedReason",
      dp."slug"          AS slug,
      dp."full_name"     AS "fullName",
      dp."title"         AS title,
      dp."avatar_url"    AS "avatarUrl",
      COALESCE(dp."is_complete", FALSE) AS "isComplete"
    FROM "users" u
    LEFT JOIN LATERAL (
      SELECT p."slug", p."full_name", p."title", p."avatar_url", p."is_complete"
      FROM "profiles" p
      WHERE p."user_id" = u."id"
      ORDER BY p."created_at" ASC
      LIMIT 1
    ) dp ON TRUE
    WHERE 1=1
    ${searchSql}
    ${filterSql}
    ORDER BY u."created_at" DESC
    LIMIT ${safeSize} OFFSET ${offset}
  `)) as unknown as Array<{
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
  }>;

  const totalRows = (await db.execute(sql`
    SELECT COUNT(*)::int AS total
    FROM "users" u
    WHERE 1=1
    ${searchSql}
    ${filterSql}
  `)) as unknown as Array<{ total: number }>;
  const total = Number(totalRows[0]?.total ?? 0);

  if (rows.length === 0) {
    return {
      items: [] as AdminUserListItem[],
      total,
      page: safePage,
      pageSize: safeSize,
    };
  }

  const userIds = rows.map((row) => row.id);

  // All pages for these users with their subscription/plan summary.
  const pageRows = (await db.execute(sql`
    SELECT
      p."user_id"             AS "userId",
      p."id"                  AS "pageId",
      p."slug"                AS slug,
      p."full_name"           AS "fullName",
      pl."key"::text          AS "planKey",
      pl."name_fa"            AS "planNameFa",
      s."status"::text        AS status,
      s."current_period_end"  AS "currentPeriodEnd",
      s."trial_ends_at"       AS "trialEndsAt",
      s."cancel_at_period_end" AS "cancelAtPeriodEnd"
    FROM "profiles" p
    LEFT JOIN "page_subscriptions" s ON s."page_id" = p."id"
    LEFT JOIN "plans" pl ON pl."id" = s."plan_id"
    WHERE p."user_id" IN (${sql.join(
      userIds.map((id) => sql`${id}`),
      sql`,`,
    )})
    ORDER BY p."created_at" ASC
  `)) as unknown as Array<{
    userId: string;
    pageId: string;
    slug: string;
    fullName: string | null;
    planKey: "free" | "pro" | "business" | null;
    planNameFa: string | null;
    status: AdminUserPagePlan["status"] | null;
    currentPeriodEnd: Date | null;
    trialEndsAt: Date | null;
    cancelAtPeriodEnd: boolean | null;
  }>;

  const pagesByUser = new Map<string, AdminUserPagePlan[]>();
  for (const row of pageRows) {
    const list = pagesByUser.get(row.userId) ?? [];
    list.push({
      pageId: row.pageId,
      slug: row.slug,
      fullName: row.fullName,
      planKey: row.planKey ?? "free",
      planNameFa: row.planNameFa ?? "Free",
      status: row.status ?? "active",
      currentPeriodEnd: row.currentPeriodEnd,
      trialEndsAt: row.trialEndsAt,
      cancelAtPeriodEnd: Boolean(row.cancelAtPeriodEnd),
    });
    pagesByUser.set(row.userId, list);
  }

  const [linkCounts, eventCounts] = await Promise.all([
    db
      .select({
        userId: profiles.userId,
        value: count(profileLinks.id),
      })
      .from(profileLinks)
      .innerJoin(profiles, eq(profiles.id, profileLinks.profileId))
      .where(inArray(profiles.userId, userIds))
      .groupBy(profiles.userId),
    db
      .select({
        userId: eventRegistrations.userId,
        value: count(eventRegistrations.id),
      })
      .from(eventRegistrations)
      .where(
        and(
          inArray(eventRegistrations.userId, userIds),
          inArray(eventRegistrations.status, [
            ...ACTIVE_REGISTRATION_STATUSES,
          ]),
        ),
      )
      .groupBy(eventRegistrations.userId),
  ]);

  const linkByUser = new Map<string, number>(
    linkCounts.map((row) => [row.userId, Number(row.value)]),
  );
  const eventByUser = new Map<string, number>(
    eventCounts.map((row) => [row.userId, Number(row.value)]),
  );

  const items: AdminUserListItem[] = rows.map((row) => {
    const userPages = pagesByUser.get(row.id) ?? [];
    return {
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
      pageCount: userPages.length,
      pagePlans: userPages,
    };
  });

  return {
    items,
    total,
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

export async function getAdminUserDetail(userId: string, pageId?: string) {
  const db = getDb();

  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });
  if (!user) return null;

  // Load every page owned by this user so admin can pick which one to edit.
  const pages = await db
    .select()
    .from(profiles)
    .where(eq(profiles.userId, user.id))
    .orderBy(asc(profiles.createdAt));

  // Per-page subscription/plan summary used by the admin user-detail UI.
  const pagePlans = pages.length
    ? (
        (await db.execute(sql`
        SELECT
          p."id"                  AS "pageId",
          p."slug"                AS slug,
          p."full_name"           AS "fullName",
          pl."key"::text          AS "planKey",
          pl."name_fa"            AS "planNameFa",
          s."status"::text        AS status,
          s."current_period_end"  AS "currentPeriodEnd",
          s."trial_ends_at"       AS "trialEndsAt",
          s."cancel_at_period_end" AS "cancelAtPeriodEnd"
        FROM "profiles" p
        LEFT JOIN "page_subscriptions" s ON s."page_id" = p."id"
        LEFT JOIN "plans" pl ON pl."id" = s."plan_id"
        WHERE p."user_id" = ${user.id}
        ORDER BY p."created_at" ASC
      `)) as unknown as Array<{
          pageId: string;
          slug: string;
          fullName: string | null;
          planKey: "free" | "pro" | "business" | null;
          planNameFa: string | null;
          status: AdminUserPagePlan["status"] | null;
          currentPeriodEnd: Date | null;
          trialEndsAt: Date | null;
          cancelAtPeriodEnd: boolean | null;
        }>
      ).map<AdminUserPagePlan>((row) => ({
        pageId: row.pageId,
        slug: row.slug,
        fullName: row.fullName,
        planKey: row.planKey ?? "free",
        planNameFa: row.planNameFa ?? "Free",
        status: row.status ?? "active",
        currentPeriodEnd: row.currentPeriodEnd,
        trialEndsAt: row.trialEndsAt,
        cancelAtPeriodEnd: Boolean(row.cancelAtPeriodEnd),
      }))
    : [];

  // Resolve the edit-target page: explicit pageId wins, else first-created
  // page, else null. The caller is responsible for surfacing the picker
  // when `pages.length > 1`.
  const profile =
    (pageId ? pages.find((p) => p.id === pageId) : null) ?? pages[0] ?? null;

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
    pages,
    pagePlans,
    links,
    registrations,
    recentSessions: sessionRows,
  };
}
