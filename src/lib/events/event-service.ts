import "server-only";

import { and, eq, inArray, ne } from "drizzle-orm";

import { getDb, type Database } from "@/db";
import {
  eventDiscountCodes,
  eventQuestions,
  eventRegistrations,
  events,
} from "@/db/schema";
import { civilToUtc } from "@/lib/date/timezone";
import {
  invalidateProfileCacheById,
  invalidateProfileCacheBySlug,
} from "@/lib/cache/profile-cache";
import { normalizeLinkUrl } from "@/lib/validations";
import { generateSlugSuggestion, isReservedSlug, normalizeSlug } from "@/lib/slug";
import { uploadPublicImage, deletePublicImage } from "@/lib/storage";
import {
  eventFormSchema,
  type EventFormInput,
  type EventFormValues,
} from "@/lib/events/validations";

export type SaveEventResult =
  | { ok: true; eventId: string; slug: string }
  | { ok: false; message: string; fieldErrors?: Record<string, string[]> };

function minuteOfDay(time: string): number {
  const [hh, mm] = time.split(":").map(Number);
  return (hh ?? 0) * 60 + (mm ?? 0);
}

/**
 * Pick a unique event slug. Events share a single global slug namespace
 * (`events_slug_idx`), so we suggest from the title and append a short random
 * suffix until free. `excludeId` lets an edit keep its own slug.
 */
async function ensureUniqueSlug(
  desired: string,
  excludeId?: string,
): Promise<string> {
  const db = getDb();
  let candidate = normalizeSlug(desired);
  if (candidate.length < 3 || isReservedSlug(candidate)) {
    candidate = generateSlugSuggestion(desired);
  }
  for (let attempt = 0; attempt < 8; attempt++) {
    const existing = await db.query.events.findFirst({
      where: excludeId
        ? and(eq(events.slug, candidate), ne(events.id, excludeId))
        : eq(events.slug, candidate),
      columns: { id: true },
    });
    if (!existing) return candidate;
    candidate = `${normalizeSlug(desired) || "event"}-${Math.random()
      .toString(36)
      .slice(2, 7)}`;
  }
  // Last resort — a fully random slug.
  return `event-${Math.random().toString(36).slice(2, 10)}`;
}

/** Convert validated civil date/time fields to UTC instants. */
function resolveInstants(v: {
  timezone: string;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
}): { startsAt: Date; endsAt: Date | null } {
  const startsAt = civilToUtc(
    v.startDate,
    minuteOfDay(v.startTime),
    v.timezone,
  );
  const endsAt =
    v.endDate && v.endTime
      ? civilToUtc(v.endDate, minuteOfDay(v.endTime), v.timezone)
      : null;
  return { startsAt, endsAt };
}

/**
 * Create or update an event for `pageId`. The caller MUST have already
 * verified the viewer owns `pageId` (server action does this). Handles the
 * cover upload, civil→UTC conversion, and a full sync of nested questions +
 * discount codes inside one transaction. Invalidates the public profile cache
 * after commit (events render on the page).
 */
export async function saveEvent(
  input: EventFormInput,
  ctx: {
    pageId: string;
    pageSlug: string;
    createdByUserId: string;
    eventId?: string;
    cover?: File | null;
  },
): Promise<SaveEventResult> {
  const parsed = eventFormSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors as Record<
      string,
      string[]
    >;
    const first = Object.values(fieldErrors).find((a) => a && a.length)?.[0];
    return {
      ok: false,
      message: first ?? "لطفاً خطاهای فرم را اصلاح کنید.",
      fieldErrors,
    };
  }
  const v = parsed.data;

  const db = getDb();

  // Load existing event (for edit) and confirm it belongs to this page.
  const existing = ctx.eventId
    ? await db.query.events.findFirst({
        where: and(eq(events.id, ctx.eventId), eq(events.pageId, ctx.pageId)),
      })
    : null;
  if (ctx.eventId && !existing) {
    return { ok: false, message: "رویداد پیدا نشد." };
  }

  // Cover upload (public bucket). On failure surface a friendly error.
  let coverUrl = existing?.coverUrl ?? null;
  if (ctx.cover instanceof File && ctx.cover.size > 0) {
    try {
      const uploaded = await uploadPublicImage(ctx.cover, "events");
      if (uploaded?.url) {
        if (existing?.coverUrl) await deletePublicImage(existing.coverUrl);
        coverUrl = uploaded.url;
      }
    } catch (error) {
      return {
        ok: false,
        message:
          error instanceof Error ? error.message : "آپلود تصویر ناموفق بود.",
      };
    }
  }

  const slug = await ensureUniqueSlug(
    existing?.slug ?? v.title,
    existing?.id,
  );
  const { startsAt, endsAt } = resolveInstants(v);

  // Reject a start in the past on CREATE only — editing an event that has
  // already started (e.g. fixing a typo, re-opening) stays allowed.
  if (!existing && startsAt.getTime() < Date.now()) {
    return {
      ok: false,
      message: "زمان شروع نمی‌تواند در گذشته باشد.",
      fieldErrors: { startTime: ["زمان شروع باید در آینده باشد."] },
    };
  }

  const baseValues = {
    title: v.title,
    description: v.description,
    coverUrl,
    locationType: v.locationType,
    locationAddress: v.locationType === "physical" ? v.locationAddress : null,
    onlineUrl:
      v.locationType === "online" && v.onlineUrl
        ? normalizeLinkUrl(v.onlineUrl)
        : null,
    timezone: v.timezone,
    startsAt,
    endsAt,
    capacity: v.capacity ?? null,
    priceType: v.priceType,
    priceToman: v.priceType === "paid" ? v.priceToman : 0,
    paymentInstructions:
      v.priceType === "paid" ? (v.paymentInstructions ?? null) : null,
    approvalRequired: v.approvalRequired,
    receiptUploadEnabled:
      v.priceType === "paid" ? v.receiptUploadEnabled : false,
    waitlistEnabled: v.waitlistEnabled,
    status: v.status,
  };

  const eventId = await db.transaction(async (tx) => {
    let id: string;
    if (existing) {
      await tx
        .update(events)
        .set({ ...baseValues, slug })
        .where(eq(events.id, existing.id));
      id = existing.id;
    } else {
      const [created] = await tx
        .insert(events)
        .values({
          ...baseValues,
          slug,
          pageId: ctx.pageId,
          createdByUserId: ctx.createdByUserId,
        })
        .returning({ id: events.id });
      id = created.id;
    }

    await syncQuestions(tx, id, v.questions);
    await syncDiscountCodes(tx, id, v.discountCodes);
    return id;
  });

  // Cache invalidation AFTER commit, never inside tx.
  await invalidateProfileCacheBySlug(ctx.pageSlug);

  return { ok: true, eventId, slug };
}

type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];

/** Replace the event's questions with the submitted set (id-stable upsert). */
async function syncQuestions(
  tx: Tx,
  eventId: string,
  questions: EventFormValues["questions"],
): Promise<void> {
  const keepIds: string[] = [];
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    const options =
      q.kind === "single_select" || q.kind === "multi_select"
        ? (q.options ?? [])
        : null;
    if (q.id) {
      await tx
        .update(eventQuestions)
        .set({
          kind: q.kind,
          label: q.label,
          required: q.required ?? false,
          options,
          sortOrder: i,
        })
        .where(
          and(
            eq(eventQuestions.id, q.id),
            eq(eventQuestions.eventId, eventId),
          ),
        );
      keepIds.push(q.id);
    } else {
      const [row] = await tx
        .insert(eventQuestions)
        .values({
          eventId,
          kind: q.kind,
          label: q.label,
          required: q.required ?? false,
          options,
          sortOrder: i,
        })
        .returning({ id: eventQuestions.id });
      keepIds.push(row.id);
    }
  }
  // Delete questions no longer present.
  const all = await tx
    .select({ id: eventQuestions.id })
    .from(eventQuestions)
    .where(eq(eventQuestions.eventId, eventId));
  const toDelete = all.map((r) => r.id).filter((id) => !keepIds.includes(id));
  if (toDelete.length) {
    await tx
      .delete(eventQuestions)
      .where(inArray(eventQuestions.id, toDelete));
  }
}

/** Sync discount codes. Preserves `usedCount` on existing rows. */
async function syncDiscountCodes(
  tx: Tx,
  eventId: string,
  codes: EventFormValues["discountCodes"],
): Promise<void> {
  const keepIds: string[] = [];
  for (const c of codes) {
    const expiresAt =
      c.expiresAt && c.expiresAt.length ? new Date(c.expiresAt) : null;
    if (c.id) {
      await tx
        .update(eventDiscountCodes)
        .set({
          code: c.code,
          type: c.type,
          value: c.value,
          usageLimit: c.usageLimit ?? null,
          expiresAt,
          isActive: c.isActive ?? true,
        })
        .where(
          and(
            eq(eventDiscountCodes.id, c.id),
            eq(eventDiscountCodes.eventId, eventId),
          ),
        );
      keepIds.push(c.id);
    } else {
      const [row] = await tx
        .insert(eventDiscountCodes)
        .values({
          eventId,
          code: c.code,
          type: c.type,
          value: c.value,
          usageLimit: c.usageLimit ?? null,
          expiresAt,
          isActive: c.isActive ?? true,
        })
        .returning({ id: eventDiscountCodes.id });
      keepIds.push(row.id);
    }
  }
  const all = await tx
    .select({ id: eventDiscountCodes.id })
    .from(eventDiscountCodes)
    .where(eq(eventDiscountCodes.eventId, eventId));
  const toDelete = all.map((r) => r.id).filter((id) => !keepIds.includes(id));
  if (toDelete.length) {
    await tx
      .delete(eventDiscountCodes)
      .where(inArray(eventDiscountCodes.id, toDelete));
  }
}

/** Flip an event's status (publish / unpublish / cancel). Owner-gated by caller. */
export async function setEventStatus(
  eventId: string,
  pageId: string,
  pageSlug: string,
  status: "draft" | "published" | "cancelled",
): Promise<SaveEventResult> {
  const db = getDb();
  const updated = await db
    .update(events)
    .set({ status })
    .where(and(eq(events.id, eventId), eq(events.pageId, pageId)))
    .returning({ id: events.id, slug: events.slug });
  if (!updated.length) return { ok: false, message: "رویداد پیدا نشد." };
  await invalidateProfileCacheBySlug(pageSlug);
  return { ok: true, eventId, slug: updated[0].slug };
}

/**
 * Delete an event (cascades questions/registrations/codes/checkins). Owner-
 * gated by caller. Cleans up the cover image and invalidates the page cache.
 */
export async function deleteEvent(
  eventId: string,
  pageId: string,
  pageSlug: string,
): Promise<{ ok: boolean; message?: string; registrantCount?: number }> {
  const db = getDb();
  const event = await db.query.events.findFirst({
    where: and(eq(events.id, eventId), eq(events.pageId, pageId)),
    columns: { id: true, coverUrl: true },
  });
  if (!event) return { ok: false, message: "رویداد پیدا نشد." };

  await db.delete(events).where(eq(events.id, eventId));
  if (event.coverUrl) await deletePublicImage(event.coverUrl);
  await invalidateProfileCacheBySlug(pageSlug);
  return { ok: true };
}

/** Count active registrants for a delete-confirmation warning. */
export async function countEventRegistrants(eventId: string): Promise<number> {
  const db = getDb();
  const rows = await db
    .select({ id: eventRegistrations.id })
    .from(eventRegistrations)
    .where(eq(eventRegistrations.eventId, eventId));
  return rows.length;
}

// Re-export for callers that invalidate by pageId (admin/cron paths).
export { invalidateProfileCacheById };
