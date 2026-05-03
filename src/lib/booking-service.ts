// Write path for booking blocks. Kept separate from `profile-service.ts` to
// avoid bloat. Mirrors the existing "delete-all-then-reinsert" pattern used
// by `saveProfileLinksForUser` for its sub-rows (types + availability) so we
// never have to diff client state against DB state on save.

import { and, eq, max } from "drizzle-orm";

import { getDb } from "@/db";
import {
  bookingAvailability,
  bookingTypes,
  profileBookingBlocks,
  profileLinks,
} from "@/db/schema";
import {
  bookingBlockInputSchema,
  type BookingBlockInput,
} from "@/lib/validations";
import { resolveCurrentPageForOwner } from "@/lib/pages";

type SaveResult<T = undefined> =
  | { ok: true; data?: T }
  | {
      ok: false;
      fieldErrors?: Record<string, string[] | undefined>;
      message?: string;
    };

async function getProfileByUserId(userId: string) {
  // Multi-page: write against the page the user is currently editing.
  return resolveCurrentPageForOwner(userId);
}

async function nextBlockSortOrder(profileId: string): Promise<number> {
  const db = getDb();
  const [a, b] = await Promise.all([
    db
      .select({ m: max(profileLinks.sortOrder) })
      .from(profileLinks)
      .where(eq(profileLinks.profileId, profileId)),
    db
      .select({ m: max(profileBookingBlocks.sortOrder) })
      .from(profileBookingBlocks)
      .where(eq(profileBookingBlocks.profileId, profileId)),
  ]);
  const current = Math.max(a[0]?.m ?? -1, b[0]?.m ?? -1);
  return current + 1;
}

export async function createBookingBlockForUser(
  userId: string,
  input: unknown,
): Promise<SaveResult<{ id: string }>> {
  const parsed = bookingBlockInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      fieldErrors: parsed.error.flatten().fieldErrors,
      message: "اطلاعات رزرو ناقص یا نامعتبر است.",
    };
  }

  const profile = await getProfileByUserId(userId);
  if (!profile) {
    return { ok: false, message: "ابتدا اطلاعات پروفایل را تکمیل کنید." };
  }

  const data = parsed.data;
  const sortOrder = await nextBlockSortOrder(profile.id);
  const db = getDb();

  const id = await db.transaction(async (tx) => {
    const [block] = await tx
      .insert(profileBookingBlocks)
      .values({
        profileId: profile.id,
        name: data.name,
        description: data.description,
        avatarUrl: data.avatarUrl,
        timezone: data.timezone,
        locationType: data.locationType,
        locationAddress: data.locationAddress,
        locationLat: data.locationLat,
        locationLng: data.locationLng,
        locationPlaceId: data.locationPlaceId,
        meetingProvider: data.meetingProvider,
        meetingLink: data.meetingLink,
        skyroomApiKey: data.skyroomApiKey,
        skyroomRoomNamePrefix: data.skyroomRoomNamePrefix,
        bufferBeforeMin: data.bufferBeforeMin,
        bufferAfterMin: data.bufferAfterMin,
        calendarEmail: data.calendarEmail,
        sortOrder,
        isActive: true,
      })
      .returning({ id: profileBookingBlocks.id });

    if (data.availability.length) {
      await tx.insert(bookingAvailability).values(
        data.availability.map((a) => ({
          blockId: block.id,
          dayOfWeek: a.dayOfWeek,
          startMinute: a.startMinute,
          endMinute: a.endMinute,
        })),
      );
    }

    await tx.insert(bookingTypes).values(
      data.types.map((t, index) => ({
        blockId: block.id,
        title: t.title,
        durationMin: t.durationMin,
        priceAmount: t.priceAmount,
        priceCurrency: t.priceCurrency,
        sortOrder: index,
        isActive: true,
      })),
    );

    return block.id;
  });

  return { ok: true, data: { id } };
}

export async function updateBookingBlockForUser(
  userId: string,
  blockId: string,
  input: unknown,
): Promise<SaveResult> {
  const parsed = bookingBlockInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      fieldErrors: parsed.error.flatten().fieldErrors,
      message: "اطلاعات رزرو ناقص یا نامعتبر است.",
    };
  }

  const profile = await getProfileByUserId(userId);
  if (!profile) return { ok: false, message: "پروفایل یافت نشد." };

  const db = getDb();
  const existing = await db.query.profileBookingBlocks.findFirst({
    where: and(
      eq(profileBookingBlocks.id, blockId),
      eq(profileBookingBlocks.profileId, profile.id),
    ),
  });
  if (!existing) return { ok: false, message: "بلوک رزرو یافت نشد." };

  const data = parsed.data;
  await db.transaction(async (tx) => {
    await tx
      .update(profileBookingBlocks)
      .set({
        name: data.name,
        description: data.description,
        avatarUrl: data.avatarUrl,
        timezone: data.timezone,
        locationType: data.locationType,
        locationAddress: data.locationAddress,
        locationLat: data.locationLat,
        locationLng: data.locationLng,
        locationPlaceId: data.locationPlaceId,
        meetingProvider: data.meetingProvider,
        meetingLink: data.meetingLink,
        skyroomApiKey: data.skyroomApiKey,
        skyroomRoomNamePrefix: data.skyroomRoomNamePrefix,
        bufferBeforeMin: data.bufferBeforeMin,
        bufferAfterMin: data.bufferAfterMin,
        calendarEmail: data.calendarEmail,
        updatedAt: new Date(),
      })
      .where(eq(profileBookingBlocks.id, blockId));

    // Replace availability + types atomically. Safe because `bookings` keeps
    // `bookingTypeId` on a `ON DELETE SET NULL` — visitors retain their
    // confirmed slot even if the owner renames / re-orders types.
    await tx
      .delete(bookingAvailability)
      .where(eq(bookingAvailability.blockId, blockId));
    if (data.availability.length) {
      await tx.insert(bookingAvailability).values(
        data.availability.map((a) => ({
          blockId,
          dayOfWeek: a.dayOfWeek,
          startMinute: a.startMinute,
          endMinute: a.endMinute,
        })),
      );
    }

    await tx.delete(bookingTypes).where(eq(bookingTypes.blockId, blockId));
    await tx.insert(bookingTypes).values(
      data.types.map((t, index) => ({
        blockId,
        title: t.title,
        durationMin: t.durationMin,
        priceAmount: t.priceAmount,
        priceCurrency: t.priceCurrency,
        sortOrder: index,
        isActive: true,
      })),
    );
  });

  return { ok: true };
}

export async function deleteBookingBlockForUser(
  userId: string,
  blockId: string,
): Promise<SaveResult> {
  const profile = await getProfileByUserId(userId);
  if (!profile) return { ok: false, message: "پروفایل یافت نشد." };

  const db = getDb();
  await db
    .delete(profileBookingBlocks)
    .where(
      and(
        eq(profileBookingBlocks.id, blockId),
        eq(profileBookingBlocks.profileId, profile.id),
      ),
    );
  return { ok: true };
}

export async function toggleBookingBlockActiveForUser(
  userId: string,
  blockId: string,
  isActive: boolean,
): Promise<SaveResult> {
  const profile = await getProfileByUserId(userId);
  if (!profile) return { ok: false, message: "پروفایل یافت نشد." };

  const db = getDb();
  await db
    .update(profileBookingBlocks)
    .set({ isActive, updatedAt: new Date() })
    .where(
      and(
        eq(profileBookingBlocks.id, blockId),
        eq(profileBookingBlocks.profileId, profile.id),
      ),
    );
  return { ok: true };
}
