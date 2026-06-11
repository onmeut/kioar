// Write path for media blocks ("مدیا": photos / video / file). One engine,
// three content modes, mirroring product blocks (parent block + child items)
// and text-block-service's single-row CRUD + cache-invalidation discipline.
//
// Page-owned (`profile_media_blocks`), gated behind the `media_block` feature
// (granted on every plan). The real differentiator is the storage quota:
// `getPageMediaUsageBytes` sums `byte_size` across all the page's media items
// LIVE, so deleting an item returns quota immediately — there is no running
// counter to drift. Per-plan caps (storage / per-file / per-gallery) are read
// from the registry by the action layer and passed in as `MediaLimits`; this
// service stays free of entitlement lookups so it's testable in isolation.

import { and, asc, eq, inArray, max, sum } from "drizzle-orm";

import { getDb } from "@/db";
import {
  events,
  profileBookingBlocks,
  profileFormBlocks,
  profileLinks,
  profileMediaBlocks,
  profileMediaItems,
  profileProductBlocks,
  profileTextBlocks,
} from "@/db/schema";
import { invalidateProfileCacheBySlug } from "@/lib/cache/profile-cache";
import { resolveCurrentPageForOwner } from "@/lib/pages";
import { deletePublicImage } from "@/lib/storage";
import {
  mediaBlockInputSchema,
  type MediaBlockInput,
} from "@/lib/validations";

export type MediaBlockRow = typeof profileMediaBlocks.$inferSelect;
export type MediaItemRow = typeof profileMediaItems.$inferSelect;
export type FullMediaBlock = MediaBlockRow & { items: MediaItemRow[] };

/**
 * Per-plan limits resolved from the registry by the action layer. `null` for
 * any field means "no cap configured" → falls back to a sane absolute ceiling.
 * Storage is in MEGABYTES; the rest are counts.
 */
export type MediaLimits = {
  storageMb: number | null;
  maxPhotoMb: number | null;
  maxVideoMb: number | null;
  maxFileMb: number | null;
  maxGalleryCount: number | null;
};

type SaveResult<T = undefined> =
  | { ok: true; data?: T }
  | {
      ok: false;
      fieldErrors?: Record<string, string[] | undefined>;
      message?: string;
    };

const MB = 1_000_000;
/** Absolute ceiling on photos per gallery regardless of plan (matches the
 * validator's hard cap). */
const GALLERY_HARD_CAP = 50;

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
  const [links, bookings, forms, products, eventRows, texts, media] =
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
      db
        .select({ m: max(profileMediaBlocks.sortOrder) })
        .from(profileMediaBlocks)
        .where(eq(profileMediaBlocks.profileId, profileId)),
    ]);
  const current = Math.max(
    links[0]?.m ?? -1,
    bookings[0]?.m ?? -1,
    forms[0]?.m ?? -1,
    products[0]?.m ?? -1,
    eventRows[0]?.m ?? -1,
    texts[0]?.m ?? -1,
    media[0]?.m ?? -1,
  );
  return current + 1;
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export async function getMediaBlocksByProfileId(
  profileId: string,
): Promise<FullMediaBlock[]> {
  const db = getDb();
  const blocks = await db
    .select()
    .from(profileMediaBlocks)
    .where(eq(profileMediaBlocks.profileId, profileId))
    .orderBy(asc(profileMediaBlocks.sortOrder));

  if (!blocks.length) return [];

  const blockIds = blocks.map((b) => b.id);
  const items = await db
    .select()
    .from(profileMediaItems)
    .where(inArray(profileMediaItems.blockId, blockIds))
    .orderBy(asc(profileMediaItems.sortOrder));

  return blocks.map((b) => ({
    ...b,
    items: items.filter((i) => i.blockId === b.id),
  }));
}

export async function getMediaBlocksByUserId(userId: string) {
  const profile = await getProfileByUserId(userId);
  if (!profile) return [];
  return getMediaBlocksByProfileId(profile.id);
}

/** Active media blocks for the public renderer (drops empty blocks). */
export async function getPublicActiveMediaBlocks(
  profileId: string,
): Promise<FullMediaBlock[]> {
  const all = await getMediaBlocksByProfileId(profileId);
  return all.filter(
    (b) => b.isActive && (b.items.length > 0 || Boolean(b.videoUrl)),
  );
}

/**
 * Live storage usage for a page, in bytes. Sums `byte_size` across every media
 * item belonging to any of the page's media blocks. "Live files only" falls
 * out for free — a deleted item is gone from this sum, so quota is returned the
 * instant a block or item is removed.
 */
export async function getPageMediaUsageBytes(
  profileId: string,
): Promise<number> {
  const db = getDb();
  const blockIds = await db
    .select({ id: profileMediaBlocks.id })
    .from(profileMediaBlocks)
    .where(eq(profileMediaBlocks.profileId, profileId));
  if (!blockIds.length) return 0;
  const [row] = await db
    .select({ total: sum(profileMediaItems.byteSize) })
    .from(profileMediaItems)
    .where(
      inArray(
        profileMediaItems.blockId,
        blockIds.map((b) => b.id),
      ),
    );
  // `sum` returns a string (or null when no rows).
  return Number(row?.total ?? 0);
}

// ---------------------------------------------------------------------------
// Limit enforcement
// ---------------------------------------------------------------------------

/**
 * Validate the incoming items against the page's plan limits + remaining
 * storage. `existingBytes` is the page's current usage MINUS the bytes of the
 * block being updated (so an edit re-counts its own items fresh). Returns a
 * Persian error message on breach, or null if everything fits.
 */
function checkLimits(
  data: MediaBlockInput,
  limits: MediaLimits,
  existingBytesExcludingThisBlock: number,
): string | null {
  // Per-gallery photo count.
  if (data.mode === "photos") {
    const galleryCap = Math.min(
      limits.maxGalleryCount ?? GALLERY_HARD_CAP,
      GALLERY_HARD_CAP,
    );
    if (data.items.length > galleryCap) {
      return `حداکثر ${galleryCap} عکس در هر گالری قابل افزودن است.`;
    }
  }

  // Per-file size caps.
  for (const item of data.items) {
    if (item.kind === "image" && limits.maxPhotoMb !== null) {
      if (item.byteSize > limits.maxPhotoMb * MB) {
        return `حجم هر عکس باید کمتر از ${limits.maxPhotoMb} مگابایت باشد.`;
      }
    }
    if (item.kind === "video" && limits.maxVideoMb !== null) {
      if (item.byteSize > limits.maxVideoMb * MB) {
        return `حجم ویدئو باید کمتر از ${limits.maxVideoMb} مگابایت باشد.`;
      }
    }
    if (item.kind === "file" && limits.maxFileMb !== null) {
      if (item.byteSize > limits.maxFileMb * MB) {
        return `حجم فایل باید کمتر از ${limits.maxFileMb} مگابایت باشد.`;
      }
    }
  }

  // Total storage quota.
  if (limits.storageMb !== null) {
    const incomingBytes = data.items.reduce((acc, it) => acc + it.byteSize, 0);
    const total = existingBytesExcludingThisBlock + incomingBytes;
    if (total > limits.storageMb * MB) {
      return `فضای ذخیره‌سازی شما پر شده است (${limits.storageMb} مگابایت). برای آزاد کردن فضا، یک رسانه را حذف کنید یا پلن خود را ارتقا دهید.`;
    }
  }

  return null;
}

function buildItemRows(
  blockId: string,
  items: MediaBlockInput["items"],
): (typeof profileMediaItems.$inferInsert)[] {
  return items.map((it, index) => ({
    blockId,
    kind: it.kind,
    url: it.url,
    byteSize: it.byteSize ?? 0,
    mime: it.mime ?? null,
    displayName: it.displayName ?? null,
    thumbnailUrl: it.thumbnailUrl ?? null,
    sortOrder: index,
  }));
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

export async function createMediaBlockForUser(
  userId: string,
  input: unknown,
  limits: MediaLimits,
): Promise<SaveResult<{ id: string }>> {
  const parsed = mediaBlockInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      fieldErrors: parsed.error.flatten().fieldErrors,
      message: parsed.error.issues[0]?.message ?? "اطلاعات مدیا نامعتبر است.",
    };
  }

  const profile = await getProfileByUserId(userId);
  if (!profile) {
    return { ok: false, message: "ابتدا اطلاعات پروفایل را تکمیل کنید." };
  }

  const data = parsed.data;
  const usage = await getPageMediaUsageBytes(profile.id);
  const limitError = checkLimits(data, limits, usage);
  if (limitError) return { ok: false, message: limitError };

  const sortOrder = await nextBlockSortOrder(profile.id);
  const db = getDb();

  const id = await db.transaction(async (tx) => {
    const [block] = await tx
      .insert(profileMediaBlocks)
      .values({
        profileId: profile.id,
        mode: data.mode,
        preset: data.preset,
        name: data.name,
        caption: data.caption,
        videoUrl: data.videoUrl,
        spotlight: data.spotlight,
        animationStyle: data.animationStyle,
        sortOrder,
        isActive: true,
      })
      .returning({ id: profileMediaBlocks.id });

    if (data.items.length) {
      await tx
        .insert(profileMediaItems)
        .values(buildItemRows(block.id, data.items));
    }
    return block.id;
  });

  await invalidateProfileCacheBySlug(profile.slug);
  return { ok: true, data: { id } };
}

export async function updateMediaBlockForUser(
  userId: string,
  blockId: string,
  input: unknown,
  limits: MediaLimits,
): Promise<SaveResult> {
  const parsed = mediaBlockInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      fieldErrors: parsed.error.flatten().fieldErrors,
      message: parsed.error.issues[0]?.message ?? "اطلاعات مدیا نامعتبر است.",
    };
  }

  const profile = await getProfileByUserId(userId);
  if (!profile) return { ok: false, message: "پروفایل یافت نشد." };

  const db = getDb();
  const existing = await db.query.profileMediaBlocks.findFirst({
    where: and(
      eq(profileMediaBlocks.id, blockId),
      eq(profileMediaBlocks.profileId, profile.id),
    ),
  });
  if (!existing) return { ok: false, message: "بلوک مدیا یافت نشد." };

  const data = parsed.data;

  // Existing items (we'll delete the storage objects for any that the new
  // payload drops, and re-count quota excluding this block's current bytes).
  const oldItems = await db
    .select()
    .from(profileMediaItems)
    .where(eq(profileMediaItems.blockId, blockId));
  const oldBytes = oldItems.reduce((acc, it) => acc + Number(it.byteSize), 0);

  const usage = await getPageMediaUsageBytes(profile.id);
  const limitError = checkLimits(data, limits, usage - oldBytes);
  if (limitError) return { ok: false, message: limitError };

  // URLs present after the update; anything in oldItems not here is orphaned.
  const keptUrls = new Set(data.items.map((it) => it.url));
  const removedUrls = oldItems
    .map((it) => it.url)
    .filter((url) => !keptUrls.has(url));

  await db.transaction(async (tx) => {
    await tx
      .update(profileMediaBlocks)
      .set({
        mode: data.mode,
        preset: data.preset,
        name: data.name,
        caption: data.caption,
        videoUrl: data.videoUrl,
        spotlight: data.spotlight,
        animationStyle: data.animationStyle,
        updatedAt: new Date(),
      })
      .where(eq(profileMediaBlocks.id, blockId));

    // Replace items wholesale (delete-all-then-reinsert, like booking sub-rows)
    // so we never diff client state against DB state.
    await tx
      .delete(profileMediaItems)
      .where(eq(profileMediaItems.blockId, blockId));
    if (data.items.length) {
      await tx
        .insert(profileMediaItems)
        .values(buildItemRows(blockId, data.items));
    }
  });

  // Delete orphaned storage objects AFTER the tx commits. Best-effort; the
  // helper is URL-prefix-safe and no-ops on anything not ours.
  await Promise.all(removedUrls.map((url) => deletePublicImage(url)));

  await invalidateProfileCacheBySlug(profile.slug);
  return { ok: true };
}

export async function deleteMediaBlockForUser(
  userId: string,
  blockId: string,
): Promise<SaveResult> {
  const profile = await getProfileByUserId(userId);
  if (!profile) return { ok: false, message: "پروفایل یافت نشد." };

  const db = getDb();
  // Capture the storage URLs before the cascade removes the item rows.
  const existing = await db.query.profileMediaBlocks.findFirst({
    where: and(
      eq(profileMediaBlocks.id, blockId),
      eq(profileMediaBlocks.profileId, profile.id),
    ),
  });
  if (!existing) return { ok: false, message: "بلوک مدیا یافت نشد." };

  const items = await db
    .select({ url: profileMediaItems.url })
    .from(profileMediaItems)
    .where(eq(profileMediaItems.blockId, blockId));

  await db
    .delete(profileMediaBlocks)
    .where(
      and(
        eq(profileMediaBlocks.id, blockId),
        eq(profileMediaBlocks.profileId, profile.id),
      ),
    );

  await Promise.all(items.map((it) => deletePublicImage(it.url)));
  await invalidateProfileCacheBySlug(profile.slug);
  return { ok: true };
}

export async function toggleMediaBlockActiveForUser(
  userId: string,
  blockId: string,
  isActive: boolean,
): Promise<SaveResult> {
  const profile = await getProfileByUserId(userId);
  if (!profile) return { ok: false, message: "پروفایل یافت نشد." };

  const db = getDb();
  await db
    .update(profileMediaBlocks)
    .set({ isActive, updatedAt: new Date() })
    .where(
      and(
        eq(profileMediaBlocks.id, blockId),
        eq(profileMediaBlocks.profileId, profile.id),
      ),
    );
  await invalidateProfileCacheBySlug(profile.slug);
  return { ok: true };
}
