import { relations, sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  type AnyPgColumn,
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
export const planKeyEnum = pgEnum("plan_key", ["free", "pro", "business"]);
export const subscriptionStatusEnum = pgEnum("subscription_status", [
  "active",
  "trialing",
  "pending_renewal",
  "grace",
  "expired",
  "canceled",
]);
export const billingCycleEnum = pgEnum("billing_cycle", ["monthly", "annual"]);
export const entitlementSourceEnum = pgEnum("entitlement_source", [
  "subscription",
  "admin_grant",
  "promo",
]);
export const invoiceStatusEnum = pgEnum("invoice_status", [
  "unpaid",
  "paid",
  "expired",
  "canceled",
]);
export const paymentProviderEnum = pgEnum("payment_provider", ["zarinpal"]);
export const paymentStatusEnum = pgEnum("payment_status", [
  "initiated",
  "verified",
  "failed",
]);
export const formFieldKindEnum = pgEnum("form_field_kind", [
  "name",
  "email",
  "phone",
  "country",
  "short_answer",
  "paragraph",
  "single_choice",
  "checkboxes",
  "dropdown",
  "date",
]);
export const smsStatusEnum = pgEnum("sms_status", [
  "queued",
  "sending",
  "sent",
  "failed",
]);
export const discountTypeEnum = pgEnum("discount_type", [
  "percent",
  "fixed_amount",
  "free_months",
]);
export const blockSpotlightEnum = pgEnum("block_spotlight", [
  "none",
  "pin",
  "animate",
]);
export const blockAnimationEnum = pgEnum("block_animation", [
  "buzz",
  "wobble",
  "pop",
  "swipe",
]);

// ---- Product blocks (universal Linktree-style "products & services") -----
// Universal schema, vertical-specific presentation. Used for menus,
// e-commerce items, services, packages, portfolio. The "preset" column is
// purely a UI hint; the data model never branches on it.
export const productBlockLayoutEnum = pgEnum("product_block_layout", [
  "list",
  "grid",
  "cards",
]);
export const productBlockDisplayModeEnum = pgEnum(
  "product_block_display_mode",
  ["pill", "inline"],
);
export const productItemPriceTypeEnum = pgEnum("product_item_price_type", [
  "fixed",
  "from",
  "range",
  "on_request",
  "free",
]);
export const productItemAvailabilityEnum = pgEnum("product_item_availability", [
  "available",
  "sold_out",
  "hidden",
]);

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    phone: text("phone").notNull(),
    role: userRoleEnum("role").default("user").notNull(),
    /** Legal / billing name — collected on demand, not at sign-up. */
    firstName: text("first_name"),
    lastName: text("last_name"),
    /**
     * IANA timezone string the user has selected (e.g. "Asia/Tehran").
     * Nullable; display layer falls back to the detected browser zone
     * or Asia/Tehran. Never store offsets or abbreviations here.
     */
    timezone: text("timezone"),
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
    /**
     * Seed used for the deterministic DiceBear (bottts-neutral) fallback
     * avatar when no `avatarUrl` is set. Generated server-side at profile
     * creation and persisted so the same user always sees the same
     * generated avatar.
     */
    avatarSeed: text("avatar_seed"),
    publicPhone: text("public_phone"),
    email: text("email"),
    /**
     * Public host the user prefers for their share URL. Stored separately
     * from the slug so it can change without breaking the canonical URL.
     */
    domain: text("domain").default("kioar.com").notNull(),
    /** Optional SEO overrides; falls back to fullName/title/bio. */
    seoTitle: text("seo_title"),
    seoDescription: text("seo_description"),
    /** Custom OG image. When null we fall back to a generated ImageResponse. */
    ogImageUrl: text("og_image_url"),
    /** When false we emit `noindex,nofollow` and exclude from sitemap. */
    indexEnabled: boolean("index_enabled").default(true).notNull(),
    /** Icon catalog key used for the per-profile PWA / favicon. */
    appIconKey: text("app_icon_key"),
    /** Background color (hex) behind `appIconKey` in the rendered icon. */
    appIconColor: text("app_icon_color"),
    isComplete: boolean("is_complete").default(false).notNull(),
    /**
     * Whether the page should be reachable at its public URL. Defaults to
     * true. Used by the editor to keep a page private (or by graceful
     * degradation when a paid feature is hard-disabling the surface).
     */
    isPublished: boolean("is_published").default(true).notNull(),
    /**
     * IANA timezone of the page owner's working hours. Nullable; display
     * falls back to Asia/Tehran. Booking blocks own their own `timezone`
     * column for finer control, but this is the page-level default.
     */
    timezone: text("timezone"),
    /**
     * Discover (kioar.com/discover) opt-in. When true AND the page is
     * complete + published, the page is listed publicly in the directory.
     * Default ON — new pages join Discover by default; users can opt out
     * from page settings at any time. Existing pages were backfilled to
     * `true` in migration 0037.
     */
    discoverEnabled: boolean("discover_enabled").default(true).notNull(),
    /**
     * Stable slug from the hardcoded Discover category list (see
     * `src/lib/discover.ts`). Nullable — pages can opt-in without picking
     * a category, in which case they only show under "همه".
     */
    discoverCategory: text("discover_category"),
    /**
     * Page archetype, captured during onboarding. One of `personal` or
     * `business` (validated at the app layer; stored as plain text so
     * we don't pay the cost of a Postgres ENUM migration the next time
     * we add a value). Nullable for legacy rows; the editor exposes a
     * field in page settings so users can fill it in later.
     */
    pageType: text("page_type"),
    /**
     * Free-text city (Persian). Used by Discover cards and an optional
     * badge under the name on the public page. Not indexed/searched.
     */
    city: text("city"),
    /**
     * Persisted QR code style chosen by the user in the share modal
     * QR customise view. Stored as jsonb so we can add/remove fields
     * without schema migrations. Null = use DEFAULT_QR_STYLE.
     */
    qrStyle: jsonb("qr_style"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  // A user owns many pages now (formerly 1:1). The table is still called
  // `profiles` for storage compatibility; semantically a row is a "page"
  // owned by `userId`.
  (table) => [
    index("profiles_user_id_idx").on(table.userId),
    uniqueIndex("profiles_slug_idx").on(table.slug),
    // Discover listing reads filter by enabled + category + complete; this
    // composite index keeps the directory query cheap as it grows.
    index("profiles_discover_idx").on(
      table.discoverEnabled,
      table.discoverCategory,
    ),
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
    spotlight: blockSpotlightEnum("spotlight").default("none").notNull(),
    animationStyle: blockAnimationEnum("animation_style"),
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

export const usersRelations = relations(users, ({ many }) => ({
  // A user owns many pages. Callers that previously read `viewer.profile`
  // now resolve a single "current page" via the cookie-driven helper in
  // `lib/auth/session.ts` — the relation itself is plural.
  pages: many(profiles),
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
  productBlocks: many(profileProductBlocks),
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
    spotlight: blockSpotlightEnum("spotlight").default("none").notNull(),
    animationStyle: blockAnimationEnum("animation_style"),
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
    /** IANA timezone the guest reported at booking time. */
    guestTimezone: text("guest_timezone"),
    /**
     * IANA timezone the booking block was configured in at the moment of
     * booking. Snapshot — preserves context if the host later changes it.
     */
    hostTimezone: text("host_timezone"),
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

// ---------------------------------------------------------------------------
// Form blocks
// ---------------------------------------------------------------------------
// A "form block" is a profile block that lets visitors submit a custom form
// (Linktree-style "Add a form"). Submissions are stored as JSON keyed by
// field id and surfaced in the dashboard.

export const profileFormBlocks = pgTable(
  "profile_form_blocks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    profileId: uuid("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    name: text("name").default("فرم").notNull(),
    intro: text("intro"),
    outro: text("outro").default("Thanks for submitting!"),
    sortOrder: integer("sort_order").default(0).notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    spotlight: blockSpotlightEnum("spotlight").default("none").notNull(),
    animationStyle: blockAnimationEnum("animation_style"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("profile_form_blocks_profile_sort_idx").on(
      table.profileId,
      table.sortOrder,
    ),
  ],
);

export const formFields = pgTable(
  "form_fields",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    blockId: uuid("block_id")
      .notNull()
      .references(() => profileFormBlocks.id, { onDelete: "cascade" }),
    kind: formFieldKindEnum("kind").notNull(),
    label: text("label").notNull(),
    required: boolean("required").default(false).notNull(),
    options: jsonb("options").$type<string[] | null>(),
    sortOrder: integer("sort_order").default(0).notNull(),
  },
  (table) => [
    index("form_fields_block_sort_idx").on(table.blockId, table.sortOrder),
  ],
);

export const formSubmissions = pgTable(
  "form_submissions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    blockId: uuid("block_id")
      .notNull()
      .references(() => profileFormBlocks.id, { onDelete: "cascade" }),
    data: jsonb("data").$type<Record<string, string | string[]>>().notNull(),
    ipHash: text("ip_hash"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("form_submissions_block_created_idx").on(
      table.blockId,
      table.createdAt,
    ),
  ],
);

export const profileFormBlocksRelations = relations(
  profileFormBlocks,
  ({ one, many }) => ({
    profile: one(profiles, {
      fields: [profileFormBlocks.profileId],
      references: [profiles.id],
    }),
    fields: many(formFields),
    submissions: many(formSubmissions),
  }),
);

export const formFieldsRelations = relations(formFields, ({ one }) => ({
  block: one(profileFormBlocks, {
    fields: [formFields.blockId],
    references: [profileFormBlocks.id],
  }),
}));

export const formSubmissionsRelations = relations(
  formSubmissions,
  ({ one }) => ({
    block: one(profileFormBlocks, {
      fields: [formSubmissions.blockId],
      references: [profileFormBlocks.id],
    }),
  }),
);

// ---------------------------------------------------------------------------
// Product blocks
// ---------------------------------------------------------------------------
// A "product block" is a universal listing block — used for restaurant menus,
// e-commerce products with outbound links, service catalogs (salons, freelance
// pricing), packages, portfolios, etc. The model is intentionally generic;
// `preset` is a UI hint that drives default copy and sensible defaults at
// create-time, never branches in the data layer.
//
// Hierarchy:
//   profile_product_blocks (1) ── (N) product_sections (optional grouping)
//   profile_product_blocks (1) ── (N) product_items
//   product_sections      (1) ── (N) product_items (sectionId nullable)
//
// Money: `priceAmount` / `priceAmountMax` are stored in **minor units** (rials
// for IRT, cents for USD/EUR) so we never hit float rounding. Range presets
// use both columns; "from" presets use only `priceAmount`; "on_request" and
// "free" leave both at 0.

export const profileProductBlocks = pgTable(
  "profile_product_blocks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    profileId: uuid("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    name: text("name").default("محصولات").notNull(),
    description: text("description"),
    /** Free-text preset hint: "menu" | "shop" | "services" | "packages" |
     * "portfolio" | "custom". Drives default copy at create time. */
    preset: text("preset"),
    layout: productBlockLayoutEnum("layout").default("list").notNull(),
    /** Optional override for the singular item label visible to visitors
     * ("غذا", "محصول", "خدمت", "پکیج"…). Falls back to a per-preset default
     * resolved client-side. */
    itemLabel: text("item_label"),
    /** ISO 4217-ish: "IRT" (Toman), "USD", "EUR". */
    currency: text("currency").default("IRT").notNull(),
    showPrices: boolean("show_prices").default(true).notNull(),
    displayMode: productBlockDisplayModeEnum("display_mode")
      .default("pill")
      .notNull(),
    /** Custom pill label. Falls back to `name`. */
    pillLabel: text("pill_label"),
    /** Custom icon / cover — same semantics as profile_links icon fields. */
    iconKey: text("icon_key"),
    iconUrl: text("icon_url"),
    imageUrl: text("image_url"),
    sortOrder: integer("sort_order").default(0).notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    spotlight: blockSpotlightEnum("spotlight").default("none").notNull(),
    animationStyle: blockAnimationEnum("animation_style"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("profile_product_blocks_profile_sort_idx").on(
      table.profileId,
      table.sortOrder,
    ),
  ],
);

export const productSections = pgTable(
  "product_sections",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    blockId: uuid("block_id")
      .notNull()
      .references(() => profileProductBlocks.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    sortOrder: integer("sort_order").default(0).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("product_sections_block_sort_idx").on(table.blockId, table.sortOrder),
  ],
);

export const productItems = pgTable(
  "product_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    blockId: uuid("block_id")
      .notNull()
      .references(() => profileProductBlocks.id, { onDelete: "cascade" }),
    sectionId: uuid("section_id").references(() => productSections.id, {
      onDelete: "set null",
    }),
    title: text("title").notNull(),
    description: text("description"),
    imageUrl: text("image_url"),
    priceType: productItemPriceTypeEnum("price_type")
      .default("fixed")
      .notNull(),
    /** Minor units. For "fixed" = price; for "from" = floor; for "range"
     * = lower bound; ignored for "on_request" / "free". */
    priceAmount: integer("price_amount").default(0).notNull(),
    /** Upper bound for "range". Null otherwise. */
    priceAmountMax: integer("price_amount_max"),
    availability: productItemAvailabilityEnum("availability")
      .default("available")
      .notNull(),
    /** Optional outbound link (product page, order page, etc.). */
    externalUrl: text("external_url"),
    /** Free-text marketing badge: "تازه", "پرفروش", "تخفیف ۲۰٪" — host-defined. */
    badge: text("badge"),
    sku: text("sku"),
    clickCount: integer("click_count").default(0).notNull(),
    sortOrder: integer("sort_order").default(0).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("product_items_block_sort_idx").on(table.blockId, table.sortOrder),
    index("product_items_section_sort_idx").on(
      table.sectionId,
      table.sortOrder,
    ),
  ],
);

export const profileProductBlocksRelations = relations(
  profileProductBlocks,
  ({ one, many }) => ({
    profile: one(profiles, {
      fields: [profileProductBlocks.profileId],
      references: [profiles.id],
    }),
    sections: many(productSections),
    items: many(productItems),
  }),
);

export const productSectionsRelations = relations(
  productSections,
  ({ one, many }) => ({
    block: one(profileProductBlocks, {
      fields: [productSections.blockId],
      references: [profileProductBlocks.id],
    }),
    items: many(productItems),
  }),
);

export const productItemsRelations = relations(productItems, ({ one }) => ({
  block: one(profileProductBlocks, {
    fields: [productItems.blockId],
    references: [profileProductBlocks.id],
  }),
  section: one(productSections, {
    fields: [productItems.sectionId],
    references: [productSections.id],
  }),
}));

// ---------------------------------------------------------------------------
// Plan + feature registry (Phase 2)
//
// `plans`, `features`, and `plan_features` form the source of truth for what
// each subscription tier grants. Product code never branches on plan.key —
// it always asks `pageHasFeature(pageId, "feature_key")` (Phase 4). Limit
// rows (e.g. storage_image_uploads) put their cap in `plan_features.limitValue`.
// ---------------------------------------------------------------------------

export const plans = pgTable("plans", {
  id: uuid("id").primaryKey().defaultRandom(),
  key: planKeyEnum("key").notNull().unique(),
  nameFa: text("name_fa").notNull(),
  descriptionFa: text("description_fa"),
  priceMonthlyToman: integer("price_monthly_toman").default(0).notNull(),
  priceAnnualToman: integer("price_annual_toman").default(0).notNull(),
  /**
   * Optional UI helper for the plan-prices editor's "computed from %"
   * toggle. When non-NULL, the editor recomputes annual = monthly * 12 *
   * (1 - pct/100) and grays out the absolute field. Pricing math always
   * reads `priceAnnualToman` directly — this column is never authoritative.
   */
  annualDiscountPercent: integer("annual_discount_percent"),
  trialDays: integer("trial_days").default(7).notNull(),
  displayOrder: integer("display_order").default(0).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  isDefault: boolean("is_default").default(false).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const features = pgTable(
  "features",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    key: text("key").notNull().unique(),
    nameFa: text("name_fa").notNull(),
    descriptionFa: text("description_fa"),
    category: text("category").notNull(),
    displayOrder: integer("display_order").default(0).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [index("features_category_idx").on(table.category)],
);

export const planFeatures = pgTable(
  "plan_features",
  {
    planId: uuid("plan_id")
      .notNull()
      .references(() => plans.id, { onDelete: "cascade" }),
    featureId: uuid("feature_id")
      .notNull()
      .references(() => features.id, { onDelete: "cascade" }),
    // NULL = pure boolean grant. Non-NULL = quantitative cap (e.g. MB of
    // image storage). Interpretation is feature-key-specific and lives in
    // lib/entitlements.ts (Phase 4).
    limitValue: bigint("limit_value", { mode: "number" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.planId, table.featureId] }),
    index("plan_features_feature_idx").on(table.featureId),
  ],
);

export const plansRelations = relations(plans, ({ many }) => ({
  planFeatures: many(planFeatures),
}));

export const featuresRelations = relations(features, ({ many }) => ({
  planFeatures: many(planFeatures),
}));

export const planFeaturesRelations = relations(planFeatures, ({ one }) => ({
  plan: one(plans, {
    fields: [planFeatures.planId],
    references: [plans.id],
  }),
  feature: one(features, {
    fields: [planFeatures.featureId],
    references: [features.id],
  }),
}));

// ---------------------------------------------------------------------------
// Per-page subscription + entitlement cache (Phase 3)
//
// One `page_subscriptions` row per page (unique on `pageId`). Free plans use
// `currentPeriodEnd = now() + 100 years` as a sentinel — see
// drizzle/0017_page_subscriptions.sql header for the rationale and the
// Phase 7 cron filter requirement.
//
// `page_entitlements` is the read-side projection used by Phase 4's
// `pageHasFeature(pageId, featureKey)`. `featureKey` is denormalized from
// `features.key` so the lookup is a hash probe with no joins.
// ---------------------------------------------------------------------------

export const pageSubscriptions = pgTable(
  "page_subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    pageId: uuid("page_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    planId: uuid("plan_id")
      .notNull()
      .references(() => plans.id, { onDelete: "restrict" }),
    billingCycle: billingCycleEnum("billing_cycle")
      .default("monthly")
      .notNull(),
    status: subscriptionStatusEnum("status").default("active").notNull(),
    currentPeriodStart: timestamp("current_period_start", {
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),
    currentPeriodEnd: timestamp("current_period_end", {
      withTimezone: true,
    }).notNull(),
    trialEndsAt: timestamp("trial_ends_at", { withTimezone: true }),
    hasUsedTrialPro: boolean("has_used_trial_pro").default(false).notNull(),
    hasUsedTrialBusiness: boolean("has_used_trial_business")
      .default(false)
      .notNull(),
    cancelAtPeriodEnd: boolean("cancel_at_period_end").default(false).notNull(),
    pendingPlanChangePlanId: uuid("pending_plan_change_plan_id").references(
      () => plans.id,
      { onDelete: "set null" },
    ),
    /**
     * Admin-queued discount intent. Consumed by the trial-end /
     * renewal-invoice path: the next invoice generated for this page
     * attaches the redemption and clears these three columns.
     */
    pendingDiscountCodeId: uuid("pending_discount_code_id").references(
      (): AnyPgColumn => discountCodes.id,
      { onDelete: "set null" },
    ),
    pendingDiscountAppliedAt: timestamp("pending_discount_applied_at", {
      withTimezone: true,
    }),
    pendingDiscountQueuedAt: timestamp("pending_discount_queued_at", {
      withTimezone: true,
    }),
    /**
     * Denormalized copy of `plans.key` for the page's current plan.
     * Allows the billing cron to filter out Free rows without joining
     * `plans`. Kept in sync by every write site that also sets `planId`.
     * `plan_id` remains the FK source of truth.
     */
    planKey: text("plan_key"),
    /**
     * Set to true when an admin manually assigns/changes a plan without
     * a corresponding payment. Such subscriptions are excluded from MRR /
     * revenue calculations since no money was collected.
     */
    isAdminOverride: boolean("is_admin_override").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("page_subscriptions_page_id_idx").on(table.pageId),
    index("page_subscriptions_plan_id_idx").on(table.planId),
    index("page_subscriptions_status_period_end_idx").on(
      table.status,
      table.currentPeriodEnd,
    ),
    index("ps_status_plan_key_idx")
      .on(table.status, table.planKey)
      .where(sql`${table.planKey} <> 'free'`),
    index("page_subscriptions_pending_discount_idx")
      .on(table.pendingDiscountCodeId)
      .where(sql`${table.pendingDiscountCodeId} IS NOT NULL`),
  ],
);

export const pageEntitlements = pgTable(
  "page_entitlements",
  {
    pageId: uuid("page_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    featureKey: text("feature_key").notNull(),
    source: entitlementSourceEnum("source").default("subscription").notNull(),
    grantedAt: timestamp("granted_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
  },
  (table) => [
    primaryKey({ columns: [table.pageId, table.featureKey] }),
    index("page_entitlements_feature_key_idx").on(table.featureKey),
  ],
);

export const pageSubscriptionsRelations = relations(
  pageSubscriptions,
  ({ one }) => ({
    page: one(profiles, {
      fields: [pageSubscriptions.pageId],
      references: [profiles.id],
    }),
    plan: one(plans, {
      fields: [pageSubscriptions.planId],
      references: [plans.id],
    }),
    pendingPlanChange: one(plans, {
      fields: [pageSubscriptions.pendingPlanChangePlanId],
      references: [plans.id],
    }),
  }),
);

export const pageEntitlementsRelations = relations(
  pageEntitlements,
  ({ one }) => ({
    page: one(profiles, {
      fields: [pageEntitlements.pageId],
      references: [profiles.id],
    }),
  }),
);

// ---------------------------------------------------------------------------
// Phase 6 — Invoices + Zarinpal payments
//
// One invoice per billable subscription event (manual upgrade, trial-end
// auto-bill, renewal). Many payment attempts per invoice — Zarinpal
// `authority` is the unique idempotency key for callback handling. All
// money is integer toman; VAT defaults to 0 and is configurable via the
// `BILLING_VAT_RATE` env. Free-total invoices skip Zarinpal entirely
// (see `lib/billing-pricing.ts`).
//
// Invoice numbering: `KIOAR-{persianFiscalYear}-{6-digit-seq}`. Per-year
// counter lives in `billing_invoice_sequences` and is allocated under
// `pg_advisory_xact_lock`. See `lib/invoice-numbering.ts`.
// ---------------------------------------------------------------------------

export const invoices = pgTable(
  "invoices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Human-readable invoice number, e.g. `KIOAR-1404-000001`. UNIQUE. */
    number: text("number").notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    pageId: uuid("page_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "restrict" }),
    planId: uuid("plan_id")
      .notNull()
      .references(() => plans.id, { onDelete: "restrict" }),
    billingCycle: billingCycleEnum("billing_cycle").notNull(),
    /** Pre-discount, pre-VAT amount in integer toman. */
    subtotalToman: integer("subtotal_toman").notNull(),
    /**
     * Discount code applied at creation time. FK is added when Phase 11
     * lands `discount_codes`; until then the column accepts any uuid and
     * is validated at the application layer.
     */
    discountCodeId: uuid("discount_code_id"),
    discountAmountToman: integer("discount_amount_toman").notNull().default(0),
    vatToman: integer("vat_toman").notNull().default(0),
    /** subtotal - discount + vat. The Zarinpal-charged amount. */
    totalToman: integer("total_toman").notNull(),
    status: invoiceStatusEnum("status").notNull().default("unpaid"),
    dueAt: timestamp("due_at", { withTimezone: true }).notNull(),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    metadata: jsonb("metadata").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("invoices_number_idx").on(table.number),
    index("invoices_user_id_idx").on(table.userId),
    index("invoices_page_id_idx").on(table.pageId),
    index("invoices_status_due_at_idx").on(table.status, table.dueAt),
  ],
);

export const payments = pgTable(
  "payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    invoiceId: uuid("invoice_id")
      .notNull()
      .references(() => invoices.id, { onDelete: "cascade" }),
    provider: paymentProviderEnum("provider").notNull().default("zarinpal"),
    /**
     * Zarinpal authority token returned from PaymentRequest. Used as the
     * callback handler's idempotency key — UNIQUE across the table so a
     * duplicate callback hit cannot create a second `payments` row.
     */
    authority: text("authority").notNull(),
    /** Zarinpal RefID, set on successful verification. */
    refId: text("ref_id"),
    amountToman: integer("amount_toman").notNull(),
    status: paymentStatusEnum("status").notNull().default("initiated"),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    /** Raw provider payload captured for support / dispute resolution. */
    rawResponse: jsonb("raw_response").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("payments_authority_idx").on(table.authority),
    index("payments_invoice_id_idx").on(table.invoiceId),
    index("payments_status_idx").on(table.status),
  ],
);

/**
 * Per-Persian-fiscal-year invoice number counter. Allocated lazily by
 * `lib/invoice-numbering.ts` under a transaction-scoped advisory lock so
 * concurrent checkouts can't read the same `last_seq` and emit duplicate
 * numbers.
 */
export const billingInvoiceSequences = pgTable("billing_invoice_sequences", {
  /** Persian fiscal year, e.g. 1404. */
  year: integer("year").primaryKey(),
  lastSeq: integer("last_seq").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const invoicesRelations = relations(invoices, ({ one, many }) => ({
  user: one(users, { fields: [invoices.userId], references: [users.id] }),
  page: one(profiles, {
    fields: [invoices.pageId],
    references: [profiles.id],
  }),
  plan: one(plans, { fields: [invoices.planId], references: [plans.id] }),
  payments: many(payments),
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
  invoice: one(invoices, {
    fields: [payments.invoiceId],
    references: [invoices.id],
  }),
}));

// ---------------------------------------------------------------------------
// Phase 7 — Subscription state machine idempotency log
//
// Every cron-driven transition (trial reminder, period-end → grace,
// grace → expired, etc.) writes one row here keyed by
// `(pageId, transitionType, keyDate)`. The composite PK with
// ON CONFLICT DO NOTHING is the per-transition idempotency claim — it's
// what lets the cron run twice on the same day with no side-effect
// duplication, independent of the advisory lock on the route handler.
// See `lib/billing-state.ts` for the transition catalog and the
// `keyDate` derivation rules.
// ---------------------------------------------------------------------------

export const billingTransitionsLog = pgTable(
  "billing_transitions_log",
  {
    pageId: uuid("page_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    // TODO(archival): purge rows where created_at < now() - interval '7 years'.
    // Financial audit trail — 7-year window matches standard accounting retention.
    /**
     * Transition identifier. Free-form text — adding a new transition
     * type is a code change in `lib/billing-state.ts`, not a migration.
     */
    transitionType: text("transition_type").notNull(),
    /**
     * Date the transition is keyed off (trial-end date or period-end
     * date). `date`, not `timestamp`, so two cron firings on the same
     * calendar day collapse onto the same row.
     */
    keyDate: date("key_date").notNull(),
    metadata: jsonb("metadata").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.pageId, table.transitionType, table.keyDate],
    }),
    index("billing_transitions_log_created_at_idx").on(table.createdAt),
  ],
);

export const billingTransitionsLogRelations = relations(
  billingTransitionsLog,
  ({ one }) => ({
    page: one(profiles, {
      fields: [billingTransitionsLog.pageId],
      references: [profiles.id],
    }),
  }),
);

// ---------------------------------------------------------------------------
// Phase 10 — SMS templates registry + outbound queue.
//
// `enqueueSms()` writes into `smsQueue` with a stable `idempotencyKey`;
// the cron worker (`/api/cron/sms`) drains due `queued` rows against
// Kavenegar's lookup endpoint. `smsTemplates` is admin-editable: ops
// fills in each `kavenegarTemplate` mapping via `/admin/sms`. See
// drizzle/0020_sms.sql for the rationale on storing `templateKey` as
// plain text (no FK).
// ---------------------------------------------------------------------------

export const smsTemplates = pgTable("sms_templates", {
  /** Stable code-side identifier. Matches `SmsTemplateKey` in lib/sms-queue.ts. */
  key: text("key").primaryKey(),
  nameFa: text("name_fa").notNull(),
  descriptionFa: text("description_fa"),
  /**
   * Kavenegar-side template name for verify/lookup. NULL ⇒ unmapped;
   * the worker hard-fails such sends so an operator notices.
   */
  kavenegarTemplate: text("kavenegar_template"),
  /**
   * Array of variable keys this template understands, e.g.
   * ["plan","daysLeft"]. Used by /admin/sms to lint payloads.
   */
  variableSchema: jsonb("variable_schema")
    .$type<string[]>()
    .notNull()
    .default([]),
  /**
   * Documentation-only mirror of the Farsi body that lives on the
   * Kavenegar dashboard. Sending always uses tokens via lookup; we
   * never transmit raw text from this column.
   */
  bodyFaPreview: text("body_fa_preview"),
  bodyPreviewUpdatedAt: timestamp("body_preview_updated_at", {
    withTimezone: true,
  }),
  /**
   * Set when an admin clicks "I've reconciled with Kavenegar". The UI
   * flags rows where `bodyPreviewUpdatedAt > kavenegarSyncedAt`.
   */
  kavenegarSyncedAt: timestamp("kavenegar_synced_at", {
    withTimezone: true,
  }),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const smsQueue = pgTable(
  "sms_queue",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // TODO(archival): purge rows where status IN ('sent','failed') AND updated_at < now() - interval '30 days'.
    // Sent/failed rows are inert; the idempotency index stays useful for ~30 days post-dispatch.
    /** Optional owner FK — nullable because cron paths only have phone. */
    userId: uuid("user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    /** `98...` form. Adapter converts to local `0...` on dispatch. */
    phone: text("phone").notNull(),
    templateKey: text("template_key").notNull(),
    variables: jsonb("variables")
      .$type<Record<string, string | number>>()
      .notNull()
      .default({}),
    status: smsStatusEnum("status").default("queued").notNull(),
    scheduledFor: timestamp("scheduled_for", { withTimezone: true })
      .defaultNow()
      .notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    attempts: integer("attempts").default(0).notNull(),
    lastError: text("last_error"),
    /** UNIQUE — collapses caller-side retries onto one row. */
    idempotencyKey: text("idempotency_key").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("sms_queue_idempotency_key_idx").on(table.idempotencyKey),
    index("sms_queue_status_scheduled_for_idx").on(
      table.status,
      table.scheduledFor,
    ),
    index("sms_queue_created_at_idx").on(table.createdAt),
  ],
);

export const smsQueueRelations = relations(smsQueue, ({ one }) => ({
  user: one(users, {
    fields: [smsQueue.userId],
    references: [users.id],
  }),
}));

// ---------------------------------------------------------------------------
// Phase 11 — discount codes + redemptions.
//
// `discountCodes.codeNormalized` is the lookup key (lowercased, trimmed).
// `redemptionsCount` is denormalized so the validator can reject without
// a JOIN+COUNT against `discountRedemptions`. Per-redemption
// `recurringCyclesRemaining` carries the recurring chain forward — see
// `lib/discounts.ts`. The FK from `invoices.discountCodeId` to this
// table is added in drizzle/0021 (Phase 6 left it FK-less).
// ---------------------------------------------------------------------------

export const discountCodes = pgTable(
  "discount_codes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Display form. Preserved for the admin UI. */
    code: text("code").notNull(),
    /** Lowercased + trimmed lookup key. UNIQUE. */
    codeNormalized: text("code_normalized").notNull(),
    nameFa: text("name_fa").notNull(),
    descriptionFa: text("description_fa"),
    discountType: discountTypeEnum("discount_type").notNull(),
    /**
     * Semantics by `discountType`:
     *   percent       → 1..100, percentage off subtotal
     *   fixed_amount  → integer toman off subtotal (clamped to subtotal)
     *   free_months   → number of free calendar months granted
     */
    amount: integer("amount").notNull(),
    startsAt: timestamp("starts_at", { withTimezone: true }),
    endsAt: timestamp("ends_at", { withTimezone: true }),
    /** Cap on total redemptions across all users. NULL ⇒ unlimited. */
    maxRedemptions: integer("max_redemptions"),
    /** Denormalized counter; bumped inside the apply transaction. */
    redemptionsCount: integer("redemptions_count").notNull().default(0),
    /** Cap per individual user. NULL ⇒ unlimited. */
    maxPerUser: integer("max_per_user"),
    firstTimeOnly: boolean("first_time_only").notNull().default(false),
    /** NULL ⇒ any paid plan. */
    appliesToPlanKeys: text("applies_to_plan_keys").array().$type<string[]>(),
    /** NULL ⇒ either monthly or annual. */
    appliesToBillingCycles: text("applies_to_billing_cycles")
      .array()
      .$type<string[]>(),
    /** Total cycles (THIS invoice + N-1 renewals). 1 ⇒ single-use. */
    recurringCycles: integer("recurring_cycles").notNull().default(1),
    isActive: boolean("is_active").notNull().default(true),
    /** Soft-delete: validator joins `deleted_at IS NULL`. */
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    /** Groups bulk-generated codes (CSV download / batch deactivate). */
    batchId: uuid("batch_id"),
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
    uniqueIndex("discount_codes_code_normalized_idx").on(table.codeNormalized),
    index("discount_codes_is_active_idx").on(table.isActive),
    index("discount_codes_batch_id_idx")
      .on(table.batchId)
      .where(sql`${table.batchId} IS NOT NULL`),
    index("discount_codes_active_normalized_idx")
      .on(table.codeNormalized)
      .where(sql`${table.deletedAt} IS NULL`),
  ],
);

export const discountRedemptions = pgTable(
  "discount_redemptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    discountCodeId: uuid("discount_code_id")
      .notNull()
      .references(() => discountCodes.id, { onDelete: "restrict" }),
    invoiceId: uuid("invoice_id")
      .notNull()
      .references(() => invoices.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    pageId: uuid("page_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    appliedAmountToman: integer("applied_amount_toman").notNull(),
    /** Cycles still owed after this redemption. 0 ⇒ chain ended. */
    recurringCyclesRemaining: integer("recurring_cycles_remaining")
      .notNull()
      .default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("discount_redemptions_invoice_id_idx").on(table.invoiceId),
    index("discount_redemptions_code_id_idx").on(table.discountCodeId),
    index("discount_redemptions_user_id_idx").on(table.userId),
    index("discount_redemptions_page_id_idx").on(table.pageId),
  ],
);

export const discountCodesRelations = relations(
  discountCodes,
  ({ one, many }) => ({
    creator: one(users, {
      fields: [discountCodes.createdByUserId],
      references: [users.id],
    }),
    redemptions: many(discountRedemptions),
  }),
);

export const discountRedemptionsRelations = relations(
  discountRedemptions,
  ({ one }) => ({
    code: one(discountCodes, {
      fields: [discountRedemptions.discountCodeId],
      references: [discountCodes.id],
    }),
    invoice: one(invoices, {
      fields: [discountRedemptions.invoiceId],
      references: [invoices.id],
    }),
    user: one(users, {
      fields: [discountRedemptions.userId],
      references: [users.id],
    }),
    page: one(profiles, {
      fields: [discountRedemptions.pageId],
      references: [profiles.id],
    }),
  }),
);

// ---------------------------------------------------------------------------
// Phase 13 — Admin audit log.
//
// Records every manual admin action that touches billing/entitlement
// state. Cron-driven (automated) transitions live in
// `billing_transitions_log`; this table is human-initiated only.
// `action` is plain text — adding a new admin action is a code change
// in `lib/admin-audit.ts`, not a follow-up migration.
// ---------------------------------------------------------------------------

export const adminAuditLog = pgTable(
  "admin_audit_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // TODO(archival): purge rows where created_at < now() - interval '5 years'.
    // Human-initiated admin actions; 5-year window balances compliance with table size.
    actorUserId: uuid("actor_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    /** Free-form action identifier, e.g. `entitlement.grant`, `invoice.mark_paid`. */
    action: text("action").notNull(),
    targetUserId: uuid("target_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    targetPageId: uuid("target_page_id").references(() => profiles.id, {
      onDelete: "set null",
    }),
    /** No FK — invoices may be archived, audit row outlives them. */
    targetInvoiceId: uuid("target_invoice_id"),
    reason: text("reason"),
    metadata: jsonb("metadata").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("admin_audit_log_target_page_id_idx").on(
      table.targetPageId,
      table.createdAt,
    ),
    index("admin_audit_log_target_user_id_idx").on(
      table.targetUserId,
      table.createdAt,
    ),
    index("admin_audit_log_target_invoice_id_idx").on(table.targetInvoiceId),
    index("admin_audit_log_actor_user_id_idx").on(
      table.actorUserId,
      table.createdAt,
    ),
    index("admin_audit_log_created_at_idx").on(table.createdAt),
  ],
);

export const adminAuditLogRelations = relations(adminAuditLog, ({ one }) => ({
  actor: one(users, {
    fields: [adminAuditLog.actorUserId],
    references: [users.id],
  }),
  targetUser: one(users, {
    fields: [adminAuditLog.targetUserId],
    references: [users.id],
  }),
  targetPage: one(profiles, {
    fields: [adminAuditLog.targetPageId],
    references: [profiles.id],
  }),
}));

// ---------------------------------------------------------------------------
// Referral / invitation system (drizzle/0024_referrals.sql).
//
// Three tables in lifecycle order:
//
//   - `referralCodes` — one row per user with a stable short code.
//     Backfilled in the migration; new users get one in app code on
//     first sign-in.
//
//   - `referrals` — per-visitor lifecycle row. `status` is plain text
//     so adding a new state is a code change, not a migration. See the
//     header in the migration file for the full lifecycle.
//
//   - `referralCredits` — append-only ledger. `kind='earned'` rows
//     have a UNIQUE constraint on `referralId` (partial index in SQL)
//     so re-running Zarinpal verify never doubles a reward.
// ---------------------------------------------------------------------------

export const referralCodes = pgTable("referral_codes", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  /** Display form, e.g. "amir-3f9a". Lowercased ASCII. */
  code: text("code").notNull(),
  /** Lowercased lookup key. UNIQUE — case-insensitive matching. */
  codeNormalized: text("code_normalized").notNull(),
  clicksCount: integer("clicks_count").notNull().default(0),
  /**
   * Discriminator added in 0025.
   *   - 'user'      : friend-invite code (default — every user has one).
   *   - 'affiliate' : approved partner code; commercial terms snapshot
   *                   below applies; conversions issue commission instead
   *                   of free-month credits.
   * Wired in code via `lib/referrals.ts` + `lib/affiliate.ts`.
   */
  kind: text("kind").notNull().default("user"),
  /** 'active' | 'paused' | 'banned'. NULL for kind='user'. */
  affiliateStatus: text("affiliate_status"),
  /** Snapshot of terms at approval — see migration 0025 header. */
  commissionPct: integer("commission_pct"),
  holdingPeriodDays: integer("holding_period_days"),
  minWithdrawalToman: integer("min_withdrawal_toman"),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  approvedByUserId: uuid("approved_by_user_id").references(() => users.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const referrals = pgTable("referrals", {
  // TODO(archival): purge rows where status IN ('clicked','rejected') AND clicked_at < now() - interval '2 years'.
  // Never-converted clicks have no financial relevance after 2 years; converted rows should be retained with invoices.
  id: uuid("id").primaryKey().defaultRandom(),
  referrerUserId: uuid("referrer_user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  referralCodeId: uuid("referral_code_id")
    .notNull()
    .references(() => referralCodes.id, { onDelete: "cascade" }),
  refereeUserId: uuid("referee_user_id").references(() => users.id, {
    onDelete: "set null",
  }),
  /** Opaque cookie token. Distinct from the public referral code. */
  cookieId: uuid("cookie_id").notNull(),
  /** clicked | signed_up | converted | rewarded | rejected | flagged */
  status: text("status").notNull().default("clicked"),
  clickIp: text("click_ip"),
  clickUserAgent: text("click_user_agent"),
  clickedAt: timestamp("clicked_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  signedUpAt: timestamp("signed_up_at", { withTimezone: true }),
  convertedAt: timestamp("converted_at", { withTimezone: true }),
  rewardedAt: timestamp("rewarded_at", { withTimezone: true }),
  convertingPageId: uuid("converting_page_id").references(() => profiles.id, {
    onDelete: "set null",
  }),
  convertingInvoiceId: uuid("converting_invoice_id").references(
    () => invoices.id,
    { onDelete: "set null" },
  ),
  rejectionReason: text("rejection_reason"),
  flagSignals: jsonb("flag_signals").$type<string[]>().notNull().default([]),
  /**
   * Affiliate commission fields — populated only when the converting
   * referral was attributed to a `kind='affiliate'` code AND the paid
   * invoice is on the annual cycle. See `lib/referrals.ts` conversion
   * branch + migration 0025 header for full lifecycle.
   */
  commissionNetAmountToman: integer("commission_net_amount_toman"),
  commissionAmountToman: integer("commission_amount_toman"),
  /** 'monthly' | 'annual' */
  commissionBillingCycle: text("commission_billing_cycle"),
  /** 'pending'|'available'|'requested'|'paid'|'rejected'|'flagged' */
  commissionStatus: text("commission_status"),
  commissionUnlockAt: timestamp("commission_unlock_at", {
    withTimezone: true,
  }),
  affiliatePayoutId: uuid("affiliate_payout_id"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const referralCredits = pgTable("referral_credits", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  /** 'earned' | 'redeemed' */
  kind: text("kind").notNull(),
  months: integer("months").notNull().default(1),
  referralId: uuid("referral_id").references(() => referrals.id, {
    onDelete: "set null",
  }),
  redeemedOnPageId: uuid("redeemed_on_page_id").references(() => profiles.id, {
    onDelete: "set null",
  }),
  redeemedOnSubscriptionId: uuid("redeemed_on_subscription_id").references(
    () => pageSubscriptions.id,
    { onDelete: "set null" },
  ),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

/**
 * Permanent aliases for previously-issued referral codes. When we
 * regenerate a user's primary code (e.g. the 2026 migration to
 * 4-letter random codes), the prior `code` is moved here so any link
 * already shared in the wild keeps resolving forever. Aliases are
 * read-only: a row is inserted once and never updated. Lookup hits
 * `referral_codes.code_normalized` first, falls back to this table.
 */
export const referralCodeAliases = pgTable(
  "referral_code_aliases",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    referralCodeId: uuid("referral_code_id")
      .notNull()
      .references(() => referralCodes.id, { onDelete: "cascade" }),
    code: text("code").notNull(),
    codeNormalized: text("code_normalized").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("referral_code_aliases_code_normalized_idx").on(
      table.codeNormalized,
    ),
    index("referral_code_aliases_referral_code_id_idx").on(
      table.referralCodeId,
    ),
  ],
);

export const referralCodesRelations = relations(
  referralCodes,
  ({ one, many }) => ({
    user: one(users, {
      fields: [referralCodes.userId],
      references: [users.id],
    }),
    referrals: many(referrals),
    aliases: many(referralCodeAliases),
  }),
);

export const referralCodeAliasesRelations = relations(
  referralCodeAliases,
  ({ one }) => ({
    code: one(referralCodes, {
      fields: [referralCodeAliases.referralCodeId],
      references: [referralCodes.id],
    }),
  }),
);

export const referralsRelations = relations(referrals, ({ one, many }) => ({
  referrer: one(users, {
    fields: [referrals.referrerUserId],
    references: [users.id],
  }),
  referee: one(users, {
    fields: [referrals.refereeUserId],
    references: [users.id],
  }),
  code: one(referralCodes, {
    fields: [referrals.referralCodeId],
    references: [referralCodes.id],
  }),
  convertingPage: one(profiles, {
    fields: [referrals.convertingPageId],
    references: [profiles.id],
  }),
  convertingInvoice: one(invoices, {
    fields: [referrals.convertingInvoiceId],
    references: [invoices.id],
  }),
  credits: many(referralCredits),
}));

export const referralCreditsRelations = relations(
  referralCredits,
  ({ one }) => ({
    user: one(users, {
      fields: [referralCredits.userId],
      references: [users.id],
    }),
    referral: one(referrals, {
      fields: [referralCredits.referralId],
      references: [referrals.id],
    }),
    page: one(profiles, {
      fields: [referralCredits.redeemedOnPageId],
      references: [profiles.id],
    }),
    subscription: one(pageSubscriptions, {
      fields: [referralCredits.redeemedOnSubscriptionId],
      references: [pageSubscriptions.id],
    }),
  }),
);

// ---------------------------------------------------------------------------
// Affiliate program (drizzle/0025_affiliate_program.sql).
//
// Built ON TOP of the referral primitives above. `referral_codes.kind`
// discriminates 'user' vs 'affiliate'; `referrals.commission_*` carry
// the ledger entry for each rewarded affiliate conversion. Standalone
// tables here cover application intake, banking, payouts, and singleton
// settings.
// ---------------------------------------------------------------------------

export const affiliateApplications = pgTable("affiliate_applications", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  /** 'pending' | 'approved' | 'rejected' | 'needs_info' */
  status: text("status").notNull().default("pending"),
  applicantName: text("applicant_name").notNull(),
  contactPhone: text("contact_phone").notNull(),
  contactEmail: text("contact_email"),
  /** instagram | telegram | youtube | blog | podcast | agency | other */
  channelKind: text("channel_kind").notNull(),
  channelUrl: text("channel_url").notNull(),
  /** lt_1k | 1k_10k | 10k_50k | 50k_200k | 200k_plus */
  audienceSize: text("audience_size").notNull(),
  promotionPlan: text("promotion_plan").notNull(),
  adminNote: text("admin_note"),
  reviewedByUserId: uuid("reviewed_by_user_id").references(() => users.id, {
    onDelete: "set null",
  }),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  approvedReferralCodeId: uuid("approved_referral_code_id").references(
    () => referralCodes.id,
    { onDelete: "set null" },
  ),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const affiliateProfiles = pgTable("affiliate_profiles", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  displayName: text("display_name").notNull(),
  channelKind: text("channel_kind").notNull(),
  channelUrl: text("channel_url").notNull(),
  shebaNumber: text("sheba_number"),
  accountHolderName: text("account_holder_name"),
  nationalId: text("national_id"),
  contactEmail: text("contact_email"),
  adminNotes: text("admin_notes"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const affiliatePayouts = pgTable("affiliate_payouts", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  requestedAmountToman: integer("requested_amount_toman").notNull(),
  /** 'requested' | 'processing' | 'paid' | 'rejected' */
  status: text("status").notNull().default("requested"),
  shebaSnapshot: text("sheba_snapshot").notNull(),
  holderNameSnapshot: text("holder_name_snapshot").notNull(),
  nationalIdSnapshot: text("national_id_snapshot"),
  transactionRef: text("transaction_ref"),
  rejectedReason: text("rejected_reason"),
  adminNote: text("admin_note"),
  processedByUserId: uuid("processed_by_user_id").references(() => users.id, {
    onDelete: "set null",
  }),
  processedAt: timestamp("processed_at", { withTimezone: true }),
  paidAt: timestamp("paid_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

/** Singleton settings row — `id = 1` enforced by SQL CHECK. */
export const affiliateSettings = pgTable("affiliate_settings", {
  id: integer("id").primaryKey().default(1),
  minWithdrawalToman: integer("min_withdrawal_toman")
    .notNull()
    .default(5_000_000),
  holdingPeriodDays: integer("holding_period_days").notNull().default(30),
  commissionPct: integer("commission_pct").notNull().default(30),
  contentRulesMd: text("content_rules_md"),
  updatedByUserId: uuid("updated_by_user_id").references(() => users.id, {
    onDelete: "set null",
  }),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const affiliateApplicationsRelations = relations(
  affiliateApplications,
  ({ one }) => ({
    user: one(users, {
      fields: [affiliateApplications.userId],
      references: [users.id],
    }),
    reviewer: one(users, {
      fields: [affiliateApplications.reviewedByUserId],
      references: [users.id],
    }),
    approvedCode: one(referralCodes, {
      fields: [affiliateApplications.approvedReferralCodeId],
      references: [referralCodes.id],
    }),
  }),
);

export const affiliateProfilesRelations = relations(
  affiliateProfiles,
  ({ one }) => ({
    user: one(users, {
      fields: [affiliateProfiles.userId],
      references: [users.id],
    }),
  }),
);

export const affiliatePayoutsRelations = relations(
  affiliatePayouts,
  ({ one }) => ({
    user: one(users, {
      fields: [affiliatePayouts.userId],
      references: [users.id],
    }),
    processedBy: one(users, {
      fields: [affiliatePayouts.processedByUserId],
      references: [users.id],
    }),
  }),
);

// ---------------------------------------------------------------------------
// Phase 13 — Subscription admin
//
// `app_settings` stores billing knobs (grace days, reminder offsets, VAT
// rate, default grandfathering policy) as typed JSONB. Reads/writes go
// through `lib/app-settings.ts` which validates each key with zod. Pure
// k/v table on purpose — adding a new knob is one seeder line, not a
// migration.
//
// `subscription_price_locks` snapshots a page's price at the moment an
// admin chose to grandfather it against a plan-level price change. The
// invoice generator reads locks first, falls back to `plans.price_*`. A
// manual plan change drops the lock (audit `subscription.price_lock_dropped_on_plan_change`).
//
// `subscription_price_change_events` is the audit + notification source
// for every published price change.
// ---------------------------------------------------------------------------

export const appSettings = pgTable("app_settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  descriptionFa: text("description_fa"),
  updatedByUserId: uuid("updated_by_user_id").references(() => users.id, {
    onDelete: "set null",
  }),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const subscriptionPriceLocks = pgTable(
  "subscription_price_locks",
  {
    pageId: uuid("page_id")
      .primaryKey()
      .references(() => profiles.id, { onDelete: "cascade" }),
    planId: uuid("plan_id")
      .notNull()
      .references(() => plans.id, { onDelete: "restrict" }),
    billingCycle: billingCycleEnum("billing_cycle"),
    lockedMonthlyToman: integer("locked_monthly_toman").notNull(),
    lockedAnnualToman: integer("locked_annual_toman").notNull(),
    reason: text("reason"),
    lockedByUserId: uuid("locked_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    lockedAt: timestamp("locked_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [index("subscription_price_locks_plan_id_idx").on(table.planId)],
);

export const subscriptionPriceLocksRelations = relations(
  subscriptionPriceLocks,
  ({ one }) => ({
    page: one(profiles, {
      fields: [subscriptionPriceLocks.pageId],
      references: [profiles.id],
    }),
    plan: one(plans, {
      fields: [subscriptionPriceLocks.planId],
      references: [plans.id],
    }),
    lockedBy: one(users, {
      fields: [subscriptionPriceLocks.lockedByUserId],
      references: [users.id],
    }),
  }),
);

export const subscriptionPriceChangeEvents = pgTable(
  "subscription_price_change_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    planId: uuid("plan_id")
      .notNull()
      .references(() => plans.id, { onDelete: "cascade" }),
    actorUserId: uuid("actor_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    previousMonthlyToman: integer("previous_monthly_toman"),
    previousAnnualToman: integer("previous_annual_toman"),
    previousAnnualDiscountPercent: integer("previous_annual_discount_percent"),
    newMonthlyToman: integer("new_monthly_toman"),
    newAnnualToman: integer("new_annual_toman"),
    newAnnualDiscountPercent: integer("new_annual_discount_percent"),
    /** "always_current" | "grandfather" */
    policy: text("policy").notNull(),
    grandfatheredCount: integer("grandfathered_count").notNull().default(0),
    notificationSent: boolean("notification_sent").notNull().default(false),
    reason: text("reason"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("subscription_price_change_events_plan_created_idx").on(
      table.planId,
      table.createdAt,
    ),
  ],
);

export const subscriptionPriceChangeEventsRelations = relations(
  subscriptionPriceChangeEvents,
  ({ one }) => ({
    plan: one(plans, {
      fields: [subscriptionPriceChangeEvents.planId],
      references: [plans.id],
    }),
    actor: one(users, {
      fields: [subscriptionPriceChangeEvents.actorUserId],
      references: [users.id],
    }),
  }),
);

// ---------------------------------------------------------------------------
// Industries → Categories (admin-managed two-level taxonomy).
//
// Replaces the flat `discover_categories` table. The slug on `categories`
// is the stable identifier persisted in `profiles.discover_category`.
// Slug renames are handled transactionally in the admin action: both this
// row and all referencing profiles rows are updated atomically.
//
// `account_types` on industries is an array because an industry can apply
// to personal pages, business pages, or both. On `categories.account_type`
// it's a single value — each category row is either personal or business.
//
// icon_key matches the link-icon system (e.g. "t:music", "t:star").
// ---------------------------------------------------------------------------

export const industries = pgTable(
  "industries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    slug: text("slug").notNull(),
    titleFa: text("title_fa").notNull(),
    titleEn: text("title_en").notNull(),
    iconKey: text("icon_key").notNull().default("t:star"),
    /** Either ['personal'], ['business'], or both. */
    accountTypes: text("account_types").array().notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("industries_slug_idx").on(table.slug),
    index("industries_sort_idx")
      .on(table.sortOrder)
      .where(sql`${table.isActive} = true`),
  ],
);

export const categories = pgTable(
  "categories",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    industryId: uuid("industry_id")
      .notNull()
      .references(() => industries.id, { onDelete: "restrict" }),
    slug: text("slug").notNull(),
    titleFa: text("title_fa").notNull(),
    titleEn: text("title_en").notNull(),
    iconKey: text("icon_key").notNull().default("t:star"),
    /** 'personal' | 'business' — enforced by a CHECK constraint in SQL. */
    accountType: text("account_type").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("categories_slug_idx").on(table.slug),
    index("categories_industry_account_sort_idx")
      .on(table.industryId, table.accountType, table.sortOrder)
      .where(sql`${table.isActive} = true`),
  ],
);

export const industriesRelations = relations(industries, ({ many }) => ({
  categories: many(categories),
}));

export const categoriesRelations = relations(categories, ({ one }) => ({
  industry: one(industries, {
    fields: [categories.industryId],
    references: [industries.id],
  }),
}));
