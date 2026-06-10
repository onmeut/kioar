// Write path for text blocks. Single-row CRUD mirroring booking-service.ts.
// Text blocks are page-owned (`profile_text_blocks`), gated behind the
// `link_text_block` feature (Pro+). The body is the only required field;
// title, icon, and photo are optional.

import { and, eq, max } from "drizzle-orm";

import { getDb } from "@/db";
import {
  events,
  profileBookingBlocks,
  profileFormBlocks,
  profileLinks,
  profileProductBlocks,
  profileTextBlocks,
} from "@/db/schema";
import { textBlockInputSchema } from "@/lib/validations";
import { invalidateProfileCacheBySlug } from "@/lib/cache/profile-cache";
import { resolveCurrentPageForOwner } from "@/lib/pages";

export type TextBlockRow = typeof profileTextBlocks.$inferSelect;

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

/**
 * Next sort_order for a new block on this page. Blocks of every kind share a
 * single ordering axis (the public renderer merges them by sort_order), so a
 * fresh block must land after the current max across ALL block tables.
 */
async function nextBlockSortOrder(profileId: string): Promise<number> {
  const db = getDb();
  const [links, bookings, forms, products, eventRows, texts] =
    await Promise.all([
      db
        .select({ m: max(profileLinks.sortOrder) })
        .from(profileLinks)
        .where(eq(profileLinks.profileId, profileId)),
      db
        .select({ m: max(profileBookingBlocks.sortOrder) })
        .from(profileBookingBlocks)
        .where(eq(profileBookingBlocks.profileId, profileId)),
      db
        .select({ m: max(profileFormBlocks.sortOrder) })
        .from(profileFormBlocks)
        .where(eq(profileFormBlocks.profileId, profileId)),
      db
        .select({ m: max(profileProductBlocks.sortOrder) })
        .from(profileProductBlocks)
        .where(eq(profileProductBlocks.profileId, profileId)),
      db
        .select({ m: max(events.sortOrder) })
        .from(events)
        .where(eq(events.pageId, profileId)),
      db
        .select({ m: max(profileTextBlocks.sortOrder) })
        .from(profileTextBlocks)
        .where(eq(profileTextBlocks.profileId, profileId)),
    ]);
  const current = Math.max(
    links[0]?.m ?? -1,
    bookings[0]?.m ?? -1,
    forms[0]?.m ?? -1,
    products[0]?.m ?? -1,
    eventRows[0]?.m ?? -1,
    texts[0]?.m ?? -1,
  );
  return current + 1;
}

export async function getTextBlocksByProfileId(
  profileId: string,
): Promise<TextBlockRow[]> {
  const db = getDb();
  return db
    .select()
    .from(profileTextBlocks)
    .where(eq(profileTextBlocks.profileId, profileId))
    .orderBy(profileTextBlocks.sortOrder);
}

export async function getTextBlocksByUserId(userId: string) {
  const profile = await getProfileByUserId(userId);
  if (!profile) return [];
  return getTextBlocksByProfileId(profile.id);
}

/** Active text blocks for the public renderer. */
export async function getPublicActiveTextBlocks(
  profileId: string,
): Promise<TextBlockRow[]> {
  const all = await getTextBlocksByProfileId(profileId);
  return all.filter((b) => b.isActive);
}

export async function createTextBlockForUser(
  userId: string,
  input: unknown,
): Promise<SaveResult<{ id: string }>> {
  const parsed = textBlockInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      fieldErrors: parsed.error.flatten().fieldErrors,
      message: "اطلاعات بلوک متن ناقص یا نامعتبر است.",
    };
  }

  const profile = await getProfileByUserId(userId);
  if (!profile) {
    return { ok: false, message: "ابتدا اطلاعات پروفایل را تکمیل کنید." };
  }

  const data = parsed.data;
  const sortOrder = await nextBlockSortOrder(profile.id);
  const db = getDb();

  const [block] = await db
    .insert(profileTextBlocks)
    .values({
      profileId: profile.id,
      title: data.title,
      iconKey: data.iconKey,
      iconUrl: data.iconUrl,
      body: data.body,
      photoUrl: data.photoUrl,
      spotlight: data.spotlight,
      animationStyle: data.animationStyle,
      sortOrder,
      isActive: true,
    })
    .returning({ id: profileTextBlocks.id });

  await invalidateProfileCacheBySlug(profile.slug);
  return { ok: true, data: { id: block.id } };
}

export async function updateTextBlockForUser(
  userId: string,
  blockId: string,
  input: unknown,
): Promise<SaveResult> {
  const parsed = textBlockInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      fieldErrors: parsed.error.flatten().fieldErrors,
      message: "اطلاعات بلوک متن ناقص یا نامعتبر است.",
    };
  }

  const profile = await getProfileByUserId(userId);
  if (!profile) return { ok: false, message: "پروفایل یافت نشد." };

  const db = getDb();
  const existing = await db.query.profileTextBlocks.findFirst({
    where: and(
      eq(profileTextBlocks.id, blockId),
      eq(profileTextBlocks.profileId, profile.id),
    ),
  });
  if (!existing) return { ok: false, message: "بلوک متن یافت نشد." };

  const data = parsed.data;
  await db
    .update(profileTextBlocks)
    .set({
      title: data.title,
      iconKey: data.iconKey,
      iconUrl: data.iconUrl,
      body: data.body,
      photoUrl: data.photoUrl,
      spotlight: data.spotlight,
      animationStyle: data.animationStyle,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(profileTextBlocks.id, blockId),
        eq(profileTextBlocks.profileId, profile.id),
      ),
    );

  await invalidateProfileCacheBySlug(profile.slug);
  return { ok: true };
}

export async function deleteTextBlockForUser(
  userId: string,
  blockId: string,
): Promise<SaveResult> {
  const profile = await getProfileByUserId(userId);
  if (!profile) return { ok: false, message: "پروفایل یافت نشد." };

  const db = getDb();
  await db
    .delete(profileTextBlocks)
    .where(
      and(
        eq(profileTextBlocks.id, blockId),
        eq(profileTextBlocks.profileId, profile.id),
      ),
    );
  await invalidateProfileCacheBySlug(profile.slug);
  return { ok: true };
}

export async function toggleTextBlockActiveForUser(
  userId: string,
  blockId: string,
  isActive: boolean,
): Promise<SaveResult> {
  const profile = await getProfileByUserId(userId);
  if (!profile) return { ok: false, message: "پروفایل یافت نشد." };

  const db = getDb();
  await db
    .update(profileTextBlocks)
    .set({ isActive, updatedAt: new Date() })
    .where(
      and(
        eq(profileTextBlocks.id, blockId),
        eq(profileTextBlocks.profileId, profile.id),
      ),
    );
  await invalidateProfileCacheBySlug(profile.slug);
  return { ok: true };
}
