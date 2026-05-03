// Data helpers for booking blocks. Kept in its own module because the slot /
// availability math is non-trivial and we want it out of the grab-bag
// `src/lib/data.ts`.

import { and, asc, desc, eq, gte, inArray, lt } from "drizzle-orm";

import { getDb } from "@/db";
import {
  bookingAvailability,
  bookingTypes,
  bookings,
  profileBookingBlocks,
  profiles,
} from "@/db/schema";
import {
  type ConfirmedBooking,
  type GeneratedSlot,
  generateBookingSlots,
} from "@/lib/booking-slots";
import { resolveCurrentPageForOwner } from "@/lib/pages";

export type BookingBlockRow = typeof profileBookingBlocks.$inferSelect;
export type BookingTypeRow = typeof bookingTypes.$inferSelect;
export type BookingAvailabilityRow = typeof bookingAvailability.$inferSelect;

export type FullBookingBlock = BookingBlockRow & {
  types: BookingTypeRow[];
  availability: BookingAvailabilityRow[];
};

export async function getBookingBlocksByProfileId(
  profileId: string,
): Promise<FullBookingBlock[]> {
  const db = getDb();
  const blocks = await db
    .select()
    .from(profileBookingBlocks)
    .where(eq(profileBookingBlocks.profileId, profileId))
    .orderBy(asc(profileBookingBlocks.sortOrder));

  if (!blocks.length) return [];

  const blockIds = blocks.map((b) => b.id);

  const [typeRows, availRows] = await Promise.all([
    db
      .select()
      .from(bookingTypes)
      .where(inArray(bookingTypes.blockId, blockIds))
      .orderBy(asc(bookingTypes.sortOrder)),
    db
      .select()
      .from(bookingAvailability)
      .where(inArray(bookingAvailability.blockId, blockIds)),
  ]);

  return blocks.map((b) => ({
    ...b,
    types: typeRows.filter((t) => t.blockId === b.id),
    availability: availRows.filter((a) => a.blockId === b.id),
  }));
}

export async function getBookingBlocksByUserId(userId: string) {
  // Resolve the user's currently-edited page; multi-page accounts may
  // have several and the dashboard always works against one at a time.
  const profile = await resolveCurrentPageForOwner(userId);
  if (!profile) return [];
  return getBookingBlocksByProfileId(profile.id);
}

export async function getPublicActiveBookingBlocks(profileId: string) {
  const all = await getBookingBlocksByProfileId(profileId);
  return all.filter((b) => b.isActive && b.types.some((t) => t.isActive));
}

export async function getPublicBookingBlockById(blockId: string) {
  const db = getDb();
  const block = await db.query.profileBookingBlocks.findFirst({
    where: and(
      eq(profileBookingBlocks.id, blockId),
      eq(profileBookingBlocks.isActive, true),
    ),
  });
  if (!block) return null;

  const [types, availability] = await Promise.all([
    db
      .select()
      .from(bookingTypes)
      .where(
        and(
          eq(bookingTypes.blockId, block.id),
          eq(bookingTypes.isActive, true),
        ),
      )
      .orderBy(asc(bookingTypes.sortOrder)),
    db
      .select()
      .from(bookingAvailability)
      .where(eq(bookingAvailability.blockId, block.id)),
  ]);

  return { ...block, types, availability };
}

/**
 * Compute free slots for a `(block, type, date)` triple. Pulls confirmed
 * bookings that touch the target day (±1d) to avoid timezone edge misses.
 */
export async function getAvailableSlotsForDay(params: {
  blockId: string;
  bookingTypeId: string;
  dateIso: string;
}): Promise<GeneratedSlot[]> {
  const block = await getPublicBookingBlockById(params.blockId);
  if (!block) return [];
  const type = block.types.find((t) => t.id === params.bookingTypeId);
  if (!type) return [];

  // Pull overlapping bookings (confirmed only); buffer the window generously
  // so we never miss a booking that extends across a day boundary.
  const db = getDb();
  const anchor = new Date(`${params.dateIso}T00:00:00Z`);
  const lowerBound = new Date(anchor.getTime() - 36 * 60 * 60 * 1000);
  const upperBound = new Date(anchor.getTime() + 36 * 60 * 60 * 1000);

  const existing = await db
    .select()
    .from(bookings)
    .where(
      and(
        eq(bookings.blockId, block.id),
        eq(bookings.status, "confirmed"),
        gte(bookings.endsAt, lowerBound),
        lt(bookings.startsAt, upperBound),
      ),
    );

  const existingBookings: ConfirmedBooking[] = existing.map((b) => ({
    startsAt: b.startsAt,
    endsAt: b.endsAt,
  }));

  return generateBookingSlots({
    timezone: block.timezone,
    availability: block.availability.map((a) => ({
      dayOfWeek: a.dayOfWeek,
      startMinute: a.startMinute,
      endMinute: a.endMinute,
    })),
    durationMin: type.durationMin,
    bufferBeforeMin: block.bufferBeforeMin,
    bufferAfterMin: block.bufferAfterMin,
    targetDateIso: params.dateIso,
    existingBookings,
    earliest: new Date(),
  });
}

// ────────────────────────────────────────────────────────────────────────
// Booking list helpers (dashboard)
// ────────────────────────────────────────────────────────────────────────

export type BookingRow = typeof bookings.$inferSelect;

/**
 * Enriched booking row with the block + type the visitor booked. Used in
 * the dashboard lists so we can render titles, durations, meeting links,
 * etc. without N+1 queries on the client.
 */
export type EnrichedBooking = BookingRow & {
  block: Pick<
    BookingBlockRow,
    | "id"
    | "profileId"
    | "name"
    | "timezone"
    | "locationType"
    | "locationAddress"
    | "meetingLink"
  >;
  type: Pick<
    BookingTypeRow,
    "id" | "title" | "durationMin" | "priceAmount" | "priceCurrency"
  > | null;
};

async function enrichBookings(rows: BookingRow[]): Promise<EnrichedBooking[]> {
  if (!rows.length) return [];
  const db = getDb();
  const blockIds = Array.from(new Set(rows.map((r) => r.blockId)));
  const typeIds = Array.from(
    new Set(rows.map((r) => r.bookingTypeId).filter(Boolean) as string[]),
  );

  const [blockRows, typeRows] = await Promise.all([
    db
      .select()
      .from(profileBookingBlocks)
      .where(inArray(profileBookingBlocks.id, blockIds)),
    typeIds.length
      ? db.select().from(bookingTypes).where(inArray(bookingTypes.id, typeIds))
      : Promise.resolve([] as BookingTypeRow[]),
  ]);

  const blockMap = new Map(blockRows.map((b) => [b.id, b]));
  const typeMap = new Map(typeRows.map((t) => [t.id, t]));

  return rows.map((r) => {
    const b = blockMap.get(r.blockId);
    const t = r.bookingTypeId ? typeMap.get(r.bookingTypeId) : null;
    return {
      ...r,
      block: {
        id: b?.id ?? r.blockId,
        profileId: b?.profileId ?? "",
        name: b?.name ?? "",
        timezone: b?.timezone ?? "UTC",
        locationType: b?.locationType ?? "online",
        locationAddress: b?.locationAddress ?? null,
        meetingLink: b?.meetingLink ?? null,
      },
      type: t
        ? {
            id: t.id,
            title: t.title,
            durationMin: t.durationMin,
            priceAmount: t.priceAmount,
            priceCurrency: t.priceCurrency,
          }
        : null,
    };
  });
}

/**
 * Bookings that visitors have placed on the user's own booking blocks
 * (i.e. incoming bookings). Ordered by start time ascending for upcoming,
 * descending for past — caller splits the list client-side.
 */
export async function getIncomingBookingsForUser(
  userId: string,
): Promise<EnrichedBooking[]> {
  const db = getDb();
  // Bookings are scoped to the currently-edited page; switching the page
  // switches the bookings inbox, exactly like Linktree's per-page model.
  const profile = await resolveCurrentPageForOwner(userId);
  if (!profile) return [];

  const blockRows = await db
    .select({ id: profileBookingBlocks.id })
    .from(profileBookingBlocks)
    .where(eq(profileBookingBlocks.profileId, profile.id));
  if (!blockRows.length) return [];

  const rows = await db
    .select()
    .from(bookings)
    .where(
      inArray(
        bookings.blockId,
        blockRows.map((b) => b.id),
      ),
    )
    .orderBy(desc(bookings.startsAt));

  return enrichBookings(rows);
}

/**
 * Bookings the user has placed elsewhere (matched by their profile email).
 * Useful so the user can see "my upcoming meetings" even when they
 * booked via someone else's public card.
 */
export async function getGuestBookingsForEmail(
  email: string | null | undefined,
): Promise<EnrichedBooking[]> {
  if (!email) return [];
  const db = getDb();
  const rows = await db
    .select()
    .from(bookings)
    .where(eq(bookings.guestEmail, email))
    .orderBy(desc(bookings.startsAt));
  return enrichBookings(rows);
}

/**
 * Cancel a booking, but only if the caller is either the owner of the
 * block (host) or the guest who originally booked it.
 */
export async function cancelBookingForUser(params: {
  bookingId: string;
  userId: string;
  userEmail: string | null;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const db = getDb();
  const booking = await db.query.bookings.findFirst({
    where: eq(bookings.id, params.bookingId),
  });
  if (!booking) return { ok: false, message: "رزرو یافت نشد." };
  if (booking.status === "cancelled") return { ok: true };

  const block = await db.query.profileBookingBlocks.findFirst({
    where: eq(profileBookingBlocks.id, booking.blockId),
  });

  const ownerProfile = block
    ? await db.query.profiles.findFirst({
        where: eq(profiles.id, block.profileId),
      })
    : null;

  const isHost = ownerProfile?.userId === params.userId;
  const isGuest = !!params.userEmail && booking.guestEmail === params.userEmail;

  if (!isHost && !isGuest) {
    return { ok: false, message: "اجازه لغو این رزرو را ندارید." };
  }

  await db
    .update(bookings)
    .set({ status: "cancelled" })
    .where(eq(bookings.id, params.bookingId));

  return { ok: true };
}
