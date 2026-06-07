import "server-only";

import { and, eq, sql } from "drizzle-orm";

import { getDb } from "@/db";
import { cards, eventCheckins, eventRegistrations, profiles, users } from "@/db/schema";
import { invalidateProfileCacheBySlug } from "@/lib/cache/profile-cache";
import { parseQrTarget } from "@/lib/events/qr-target";

// ---------------------------------------------------------------------------
// QR → user identity resolution.
//
// Check-in re-uses the attendee's EXISTING personal Kioar QR — the one that
// encodes their public page — not a new per-event ticket. The host scans that
// QR; we parse whatever URL shape it carries and resolve it to a Kioar user:
//
//   /{slug}        → profiles.slug      → profiles.userId   (page owner)
//   /c/{cardId}    → cards.id → pageId  → profiles.userId
//   /u/{userId}    → users.id directly
//
// Returns null for anything that isn't a Kioar user (foreign QR, dead card,
// unknown slug). The scanner shows "not a Kioar QR" for null.
// ---------------------------------------------------------------------------

export type ResolvedQrUser = { userId: string; displayName: string };

async function displayNameFor(userId: string): Promise<string> {
  const db = getDb();
  // Identity is user-level: legal name (نام حقوقی) first, then phone.
  // Page names (profiles.fullName) are page-specific and must not be used here.
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { firstName: true, lastName: true, phone: true },
  });
  const full = [user?.firstName, user?.lastName]
    .filter((p) => p && p.trim())
    .join(" ")
    .trim();
  return full || user?.phone || "کاربر کی‌یوآر";
}

/**
 * Resolve a scanned QR payload to a Kioar user id + a friendly display name.
 * Returns null if the QR doesn't map to a real Kioar user.
 */
export async function resolveQrToUser(
  scanned: string,
): Promise<ResolvedQrUser | null> {
  const target = parseQrTarget(scanned);
  if (!target) return null;
  const db = getDb();

  if (target.kind === "card") {
    const row = await db
      .select({ userId: profiles.userId })
      .from(cards)
      .innerJoin(profiles, eq(cards.pageId, profiles.id))
      .where(eq(cards.id, target.cardId))
      .limit(1);
    const userId = row[0]?.userId;
    if (!userId) return null;
    return { userId, displayName: await displayNameFor(userId) };
  }

  if (target.kind === "user") {
    const user = await db.query.users.findFirst({
      where: eq(users.id, target.userId),
      columns: { id: true },
    });
    if (!user) return null;
    return { userId: target.userId, displayName: await displayNameFor(target.userId) };
  }

  // slug
  const profile = await db.query.profiles.findFirst({
    where: eq(profiles.slug, target.slug),
    columns: { userId: true },
  });
  if (!profile?.userId) return null;
  return {
    userId: profile.userId,
    displayName: await displayNameFor(profile.userId),
  };
}

// ---------------------------------------------------------------------------
// Registration state resolution for a scanned attendee at THIS event.
// ---------------------------------------------------------------------------

export type CheckinResolution =
  | {
      kind: "approved_ready";
      registrationId: string;
      userId: string;
      displayName: string;
    }
  | {
      kind: "already_checked_in";
      registrationId: string;
      userId: string;
      displayName: string;
      checkedInAt: Date;
    }
  | {
      kind: "pending_approval";
      registrationId: string;
      userId: string;
      displayName: string;
    }
  | {
      kind: "payment_pending";
      registrationId: string;
      userId: string;
      displayName: string;
    }
  | {
      kind: "payment_submitted";
      registrationId: string;
      userId: string;
      displayName: string;
    }
  | {
      kind: "waitlisted";
      registrationId: string;
      userId: string;
      displayName: string;
    }
  | {
      kind: "rejected";
      registrationId: string;
      userId: string;
      displayName: string;
    }
  | {
      kind: "cancelled";
      registrationId: string;
      userId: string;
      displayName: string;
    }
  | { kind: "not_registered"; userId: string; displayName: string }
  | { kind: "not_kioar_user" };

/**
 * Given a scanned QR and an event, resolve to a discriminated check-in state.
 * Pure read — never mutates. The scanner renders a color + a single primary
 * action from the `kind`. The host acts via `performCheckin` / the existing
 * approve / verify-receipt server actions.
 */
export async function resolveCheckin(
  eventId: string,
  scanned: string,
): Promise<CheckinResolution> {
  const resolved = await resolveQrToUser(scanned);
  if (!resolved) return { kind: "not_kioar_user" };
  const { userId, displayName } = resolved;

  const db = getDb();
  const reg = await db.query.eventRegistrations.findFirst({
    where: and(
      eq(eventRegistrations.eventId, eventId),
      eq(eventRegistrations.userId, userId),
    ),
  });

  if (!reg) return { kind: "not_registered", userId, displayName };

  const base = { registrationId: reg.id, userId, displayName };

  switch (reg.status) {
    case "approved": {
      // Defensive: a row could be approved with a check-in record if status
      // wasn't flipped; surface the existing check-in if present.
      const existing = await db.query.eventCheckins.findFirst({
        where: eq(eventCheckins.registrationId, reg.id),
      });
      if (existing) {
        return {
          kind: "already_checked_in",
          ...base,
          checkedInAt: existing.checkedInAt,
        };
      }
      return { kind: "approved_ready", ...base };
    }
    case "attended": {
      const existing = await db.query.eventCheckins.findFirst({
        where: eq(eventCheckins.registrationId, reg.id),
      });
      return {
        kind: "already_checked_in",
        ...base,
        checkedInAt: existing?.checkedInAt ?? reg.decidedAt ?? new Date(),
      };
    }
    case "pending_approval":
      return { kind: "pending_approval", ...base };
    case "payment_pending":
      return { kind: "payment_pending", ...base };
    case "payment_submitted":
      return { kind: "payment_submitted", ...base };
    case "waitlisted":
      return { kind: "waitlisted", ...base };
    case "rejected":
      return { kind: "rejected", ...base };
    case "cancelled":
      return { kind: "cancelled", ...base };
    default:
      return { kind: "not_registered", userId, displayName };
  }
}

// ---------------------------------------------------------------------------
// The check-in mutation. Idempotent via unique(registration_id) on the audit
// table: a second scan reads the existing row and reports "already checked in".
// ---------------------------------------------------------------------------

export type PerformCheckinResult =
  | { ok: true; checkedInAt: Date; alreadyCheckedIn: boolean }
  | { ok: false; message: string };

/**
 * Mark a registration attended. Re-loads the registration `FOR UPDATE`, asserts
 * the row is approved/attended, inserts the audit row (idempotent on conflict),
 * and flips status → attended. Safe under concurrent scans of the same QR.
 *
 * Caller MUST have verified the scanning user owns this event's page.
 */
export async function performCheckin(
  eventId: string,
  registrationId: string,
  scannedByUserId: string,
  pageSlug: string,
): Promise<PerformCheckinResult> {
  const db = getDb();

  const result = await db.transaction(
    async (tx): Promise<PerformCheckinResult> => {
      // Lock the registration row for the rest of the tx.
      const locked = (await tx.execute(
        sql`SELECT id, event_id, user_id, status
            FROM event_registrations WHERE id = ${registrationId} FOR UPDATE`,
      )) as unknown as Array<{
        id: string;
        event_id: string;
        user_id: string;
        status: string;
      }>;
      const reg = locked[0];
      if (!reg || reg.event_id !== eventId) {
        return { ok: false, message: "ثبت‌نام پیدا نشد." };
      }
      if (reg.status !== "approved" && reg.status !== "attended") {
        return {
          ok: false,
          message: "این ثبت‌نام تأیید نشده است؛ ابتدا تأیید کنید.",
        };
      }

      // Idempotent audit insert. unique(registration_id) → second scan no-ops.
      const existing = await tx.query.eventCheckins.findFirst({
        where: eq(eventCheckins.registrationId, registrationId),
      });
      if (existing) {
        return {
          ok: true,
          checkedInAt: existing.checkedInAt,
          alreadyCheckedIn: true,
        };
      }

      const checkedInAt = new Date();
      await tx.insert(eventCheckins).values({
        eventId,
        registrationId,
        userId: reg.user_id,
        scannedByUserId,
        checkedInAt,
      });
      await tx
        .update(eventRegistrations)
        .set({ status: "attended" })
        .where(eq(eventRegistrations.id, registrationId));

      return { ok: true, checkedInAt, alreadyCheckedIn: false };
    },
  );

  if (result.ok) await invalidateProfileCacheBySlug(pageSlug);
  return result;
}
