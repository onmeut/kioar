import { relations } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const userRoleEnum = pgEnum("user_role", ["user", "admin"]);
export const otpPurposeEnum = pgEnum("otp_purpose", ["sign-in"]);
export const eventStatusEnum = pgEnum("event_status", [
  "draft",
  "published",
  "closed",
]);
export const registrationStatusEnum = pgEnum("registration_status", [
  "registered",
  "cancelled",
]);
export const cardTypeEnum = pgEnum("card_type", ["physical", "nfc"]);
export const cardDesignEnum = pgEnum("card_design", [
  "design_1",
  "design_2",
  "design_3",
]);
export const cardRequestStatusEnum = pgEnum("card_request_status", [
  "new",
  "reviewing",
  "fulfilled",
]);
export const bookingLocationTypeEnum = pgEnum("booking_location_type", [
  "online",
  "in_person",
]);
export const bookingStatusEnum = pgEnum("booking_status", [
  "confirmed",
  "cancelled",
]);
export const meetingProviderEnum = pgEnum("meeting_provider", [
  "google_meet",
  "zoom",
  "skyroom",
  "lahzenegar",
  "custom",
]);
export const oauthProviderEnum = pgEnum("oauth_provider", ["google", "zoom"]);

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    phone: text("phone").notNull(),
    role: userRoleEnum("role").default("user").notNull(),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    bannedAt: timestamp("banned_at", { withTimezone: true }),
    bannedReason: text("banned_reason"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("users_phone_idx").on(table.phone),
    index("users_banned_at_idx").on(table.bannedAt),
    index("users_created_at_idx").on(table.createdAt),
  ],
);

export const otpCodes = pgTable(
  "otp_codes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    phone: text("phone").notNull(),
    purpose: otpPurposeEnum("purpose").default("sign-in").notNull(),
    codeHash: text("code_hash").notNull(),
    attempts: integer("attempts").default(0).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("otp_codes_phone_created_idx").on(table.phone, table.createdAt),
    index("otp_codes_expires_at_idx").on(table.expiresAt),
  ],
);

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    userAgent: text("user_agent"),
    ipAddress: text("ip_address"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [uniqueIndex("sessions_token_hash_idx").on(table.tokenHash)],
);

export const profiles = pgTable(
  "profiles",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    slug: text("slug").notNull(),
    fullName: text("full_name"),
    title: text("title"),
    bio: text("bio"),
    avatarUrl: text("avatar_url"),
    publicPhone: text("public_phone"),
    email: text("email"),
    isComplete: boolean("is_complete").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("profiles_user_id_idx").on(table.userId),
    uniqueIndex("profiles_slug_idx").on(table.slug),
  ],
);

export const profileLinks = pgTable(
  "profile_links",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    profileId: uuid("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    url: text("url").notNull(),
    description: text("description"),
    imageUrl: text("image_url"),
    iconKey: text("icon_key"),
    iconUrl: text("icon_url"),
    sortOrder: integer("sort_order").default(0).notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("profile_links_profile_sort_idx").on(
      table.profileId,
      table.sortOrder,
    ),
  ],
);

export const events = pgTable(
  "events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    title: text("title").notNull(),
    slug: text("slug").notNull(),
    description: text("description").notNull(),
    coverUrl: text("cover_url"),
    location: text("location").notNull(),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }),
    status: eventStatusEnum("status").default("draft").notNull(),
    createdByUserId: uuid("created_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("events_slug_idx").on(table.slug),
    index("events_status_starts_at_idx").on(table.status, table.startsAt),
  ],
);

export const eventRegistrations = pgTable(
  "event_registrations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: registrationStatusEnum("status").default("registered").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("event_registrations_event_user_idx").on(
      table.eventId,
      table.userId,
    ),
    index("event_registrations_user_idx").on(table.userId),
  ],
);

export const cardRequests = pgTable(
  "card_requests",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    fullName: text("full_name").notNull(),
    phone: text("phone").notNull(),
    deliveryInfo: text("delivery_info").notNull(),
    cardType: cardTypeEnum("card_type").default("physical").notNull(),
    cardDesign: cardDesignEnum("card_design").default("design_1").notNull(),
    notes: text("notes"),
    status: cardRequestStatusEnum("status").default("new").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("card_requests_status_created_idx").on(table.status, table.createdAt),
    index("card_requests_user_idx").on(table.userId),
  ],
);

export const usersRelations = relations(users, ({ one, many }) => ({
  profile: one(profiles, {
    fields: [users.id],
    references: [profiles.userId],
  }),
  sessions: many(sessions),
  registrations: many(eventRegistrations),
  cardRequests: many(cardRequests),
  createdEvents: many(events),
  oauthAccounts: many(oauthAccounts),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}));

// Stores per-user OAuth tokens for third-party providers (Google, Zoom).
// Tokens are encrypted at rest (AES-256-GCM via AUTH_SECRET) — see
// `src/lib/oauth/crypto.ts`. We deliberately keep the schema flat so the
// same table can grow to add Microsoft/Apple later without a migration.
export const oauthAccounts = pgTable(
  "oauth_accounts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    provider: oauthProviderEnum("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    accountEmail: text("account_email"),
    accessToken: text("access_token").notNull(),
    refreshToken: text("refresh_token"),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    scope: text("scope"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("oauth_accounts_user_provider_idx").on(
      table.userId,
      table.provider,
    ),
  ],
);

export const oauthAccountsRelations = relations(oauthAccounts, ({ one }) => ({
  user: one(users, {
    fields: [oauthAccounts.userId],
    references: [users.id],
  }),
}));

export const profilesRelations = relations(profiles, ({ one, many }) => ({
  user: one(users, {
    fields: [profiles.userId],
    references: [users.id],
  }),
  links: many(profileLinks),
  statsByDay: many(profileStatsByDay),
  bookingBlocks: many(profileBookingBlocks),
}));

export const profileLinksRelations = relations(profileLinks, ({ one }) => ({
  profile: one(profiles, {
    fields: [profileLinks.profileId],
    references: [profiles.id],
  }),
}));

export const eventsRelations = relations(events, ({ one, many }) => ({
  createdBy: one(users, {
    fields: [events.createdByUserId],
    references: [users.id],
  }),
  registrations: many(eventRegistrations),
}));

export const eventRegistrationsRelations = relations(
  eventRegistrations,
  ({ one }) => ({
    event: one(events, {
      fields: [eventRegistrations.eventId],
      references: [events.id],
    }),
    user: one(users, {
      fields: [eventRegistrations.userId],
      references: [users.id],
    }),
  }),
);

export const cardRequestsRelations = relations(cardRequests, ({ one }) => ({
  user: one(users, {
    fields: [cardRequests.userId],
    references: [users.id],
  }),
}));

// Pre-aggregated daily stats. One row per (profile, date); incremented via
// UPSERT so the table stays small (≤365 rows/year per profile) regardless of
// visit volume. Dashboard reads ≤7 rows — never scans millions of raw events.
export const profileStatsByDay = pgTable(
  "profile_stats_by_day",
  {
    profileId: uuid("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    statDate: date("stat_date").notNull(),
    views: integer("views").default(0).notNull(),
    linkClicks: integer("link_clicks").default(0).notNull(),
  },
  (table) => [primaryKey({ columns: [table.profileId, table.statDate] })],
);

export const profileStatsByDayRelations = relations(
  profileStatsByDay,
  ({ one }) => ({
    profile: one(profiles, {
      fields: [profileStatsByDay.profileId],
      references: [profiles.id],
    }),
  }),
);

// Per-link daily click counters. Same aggregate pattern as profileStatsByDay:
// one row per (link, date), UPSERT-incremented. Allows O(1) per-link totals
// regardless of click volume.
export const linkStatsByDay = pgTable(
  "link_stats_by_day",
  {
    linkId: uuid("link_id")
      .notNull()
      .references(() => profileLinks.id, { onDelete: "cascade" }),
    statDate: date("stat_date").notNull(),
    clicks: integer("clicks").default(0).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.linkId, table.statDate] }),
    index("link_stats_by_day_link_id_idx").on(table.linkId),
  ],
);

export const linkStatsByDayRelations = relations(linkStatsByDay, ({ one }) => ({
  link: one(profileLinks, {
    fields: [linkStatsByDay.linkId],
    references: [profileLinks.id],
  }),
}));

// Fixed-window token bucket for rate limiting. We chose a table-based
// implementation over an external cache (Redis/Upstash) because the app runs
// on servers inside Iran with restricted egress, and Postgres is already a
// hard dependency. `UPSERT ... ON CONFLICT DO UPDATE SET count = count + 1
// RETURNING count` gives us atomic increment.
export const rateLimitBuckets = pgTable(
  "rate_limit_buckets",
  {
    key: text("key").notNull(),
    windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
    count: integer("count").default(0).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.key, table.windowStart] }),
    index("rate_limit_buckets_window_start_idx").on(table.windowStart),
  ],
);

// ---------------------------------------------------------------------------
// Bookings block
// ---------------------------------------------------------------------------
// A "booking block" is a block on a profile that lets visitors schedule a
// session with the profile owner (like Linktree's Bookings). It lives
// alongside `profile_links` on the profile: both share a common `sort_order`
// axis so the public profile can render them intermixed.
//
// Structure:
//   profile_booking_blocks (1) ── (N) booking_types       (what can be booked)
//   profile_booking_blocks (1) ── (N) booking_availability (when)
//   profile_booking_blocks (1) ── (N) bookings             (actual reservations)

export const profileBookingBlocks = pgTable(
  "profile_booking_blocks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    profileId: uuid("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    avatarUrl: text("avatar_url"),
    timezone: text("timezone").default("Asia/Tehran").notNull(),
    locationType: bookingLocationTypeEnum("location_type")
      .default("online")
      .notNull(),
    locationAddress: text("location_address"),
    locationLat: text("location_lat"),
    locationLng: text("location_lng"),
    locationPlaceId: text("location_place_id"),
    meetingProvider: meetingProviderEnum("meeting_provider")
      .default("custom")
      .notNull(),
    meetingLink: text("meeting_link"),
    skyroomApiKey: text("skyroom_api_key"),
    skyroomRoomNamePrefix: text("skyroom_room_name_prefix"),
    bufferBeforeMin: integer("buffer_before_min").default(15).notNull(),
    bufferAfterMin: integer("buffer_after_min").default(15).notNull(),
    calendarEmail: text("calendar_email"),
    sortOrder: integer("sort_order").default(0).notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("profile_booking_blocks_profile_sort_idx").on(
      table.profileId,
      table.sortOrder,
    ),
  ],
);

// Individual bookable offerings on a booking block (e.g. "Free intro call",
// "Pro advice"). Price is stored in **minor units** (cents / rials) so we
// never hit float rounding issues.
export const bookingTypes = pgTable(
  "booking_types",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    blockId: uuid("block_id")
      .notNull()
      .references(() => profileBookingBlocks.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    durationMin: integer("duration_min").notNull(),
    priceAmount: integer("price_amount").default(0).notNull(),
    priceCurrency: text("price_currency").default("USD").notNull(),
    sortOrder: integer("sort_order").default(0).notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("booking_types_block_sort_idx").on(table.blockId, table.sortOrder),
  ],
);

// Weekly-recurring availability windows. A single block may have multiple
// rows per day (e.g. 9:00–12:00 and 14:00–18:00). `startMinute` / `endMinute`
// are minutes since 00:00 in the block's timezone.
export const bookingAvailability = pgTable(
  "booking_availability",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    blockId: uuid("block_id")
      .notNull()
      .references(() => profileBookingBlocks.id, { onDelete: "cascade" }),
    dayOfWeek: integer("day_of_week").notNull(), // 0 (Sun) – 6 (Sat)
    startMinute: integer("start_minute").notNull(),
    endMinute: integer("end_minute").notNull(),
  },
  (table) => [index("booking_availability_block_idx").on(table.blockId)],
);

// Actual bookings submitted by visitors. We keep the guest's name/email
// denormalized here because the visitor is anonymous (not a logged-in user).
export const bookings = pgTable(
  "bookings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    blockId: uuid("block_id")
      .notNull()
      .references(() => profileBookingBlocks.id, { onDelete: "cascade" }),
    bookingTypeId: uuid("booking_type_id").references(() => bookingTypes.id, {
      onDelete: "set null",
    }),
    guestName: text("guest_name").notNull(),
    guestEmail: text("guest_email").notNull(),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    guestTimezone: text("guest_timezone"),
    status: bookingStatusEnum("status").default("confirmed").notNull(),
    meetingUrl: text("meeting_url"),
    meetingProviderEventId: text("meeting_provider_event_id"),
    calendarEventId: text("calendar_event_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("bookings_block_starts_idx").on(table.blockId, table.startsAt),
  ],
);

export const profileBookingBlocksRelations = relations(
  profileBookingBlocks,
  ({ one, many }) => ({
    profile: one(profiles, {
      fields: [profileBookingBlocks.profileId],
      references: [profiles.id],
    }),
    types: many(bookingTypes),
    availability: many(bookingAvailability),
    bookings: many(bookings),
  }),
);

export const bookingTypesRelations = relations(bookingTypes, ({ one }) => ({
  block: one(profileBookingBlocks, {
    fields: [bookingTypes.blockId],
    references: [profileBookingBlocks.id],
  }),
}));

export const bookingAvailabilityRelations = relations(
  bookingAvailability,
  ({ one }) => ({
    block: one(profileBookingBlocks, {
      fields: [bookingAvailability.blockId],
      references: [profileBookingBlocks.id],
    }),
  }),
);

export const bookingsRelations = relations(bookings, ({ one }) => ({
  block: one(profileBookingBlocks, {
    fields: [bookings.blockId],
    references: [profileBookingBlocks.id],
  }),
  bookingType: one(bookingTypes, {
    fields: [bookings.bookingTypeId],
    references: [bookingTypes.id],
  }),
}));
