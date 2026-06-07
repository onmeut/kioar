"use server";

import { requireCompletedProfile } from "@/lib/auth/session";
import { pageHasFeature } from "@/lib/entitlements";
import {
  performCheckin,
  resolveCheckin,
  type CheckinResolution,
} from "@/lib/events/checkin";
import { getHostEvent } from "@/lib/events/queries";
import {
  approveRegistration,
} from "@/lib/events/registration-service";
import { resolveCurrentPageForOwner } from "@/lib/pages";

/**
 * Authorize the current user as the OWNER of the page that owns `eventId`.
 * Returns the page + event slug, or null if unauthorized. The check-in route
 * and every scanner action funnel through this — never "any authenticated
 * user" (locked constraint #3).
 */
async function authorizeHostEvent(eventId: string) {
  const viewer = await requireCompletedProfile();
  const page = await resolveCurrentPageForOwner(viewer.user.id);
  if (!page) return null;
  if (!(await pageHasFeature(page.id, "business_events"))) return null;
  const data = await getHostEvent(eventId, page.id);
  if (!data) return null;
  return {
    userId: viewer.user.id,
    pageId: page.id,
    pageSlug: page.slug,
    event: data.event,
  };
}

export type ScanResult =
  | { ok: false; message: string }
  | { ok: true; resolution: CheckinResolution };

/** Resolve a scanned QR to a check-in state (read-only). */
export async function scanQrAction(
  eventId: string,
  scanned: string,
): Promise<ScanResult> {
  const ctx = await authorizeHostEvent(eventId);
  if (!ctx) return { ok: false, message: "دسترسی غیرمجاز." };
  const resolution = await resolveCheckin(eventId, scanned);
  return { ok: true, resolution };
}

export type CheckinActionResult =
  | { ok: false; message: string }
  | { ok: true; checkedInAt: string; alreadyCheckedIn: boolean };

/** Mark an approved registration attended (idempotent). */
export async function checkinAction(
  eventId: string,
  registrationId: string,
): Promise<CheckinActionResult> {
  const ctx = await authorizeHostEvent(eventId);
  if (!ctx) return { ok: false, message: "دسترسی غیرمجاز." };
  const result = await performCheckin(
    eventId,
    registrationId,
    ctx.userId,
    ctx.pageSlug,
  );
  if (!result.ok) return result;
  return {
    ok: true,
    checkedInAt: result.checkedInAt.toISOString(),
    alreadyCheckedIn: result.alreadyCheckedIn,
  };
}

/**
 * Approve a registration on the spot (door override for pending / receipt
 * states), then immediately check them in. One round-trip so the host taps once.
 */
export async function approveAndCheckinAction(
  eventId: string,
  registrationId: string,
): Promise<CheckinActionResult> {
  const ctx = await authorizeHostEvent(eventId);
  if (!ctx) return { ok: false, message: "دسترسی غیرمجاز." };

  const approval = await approveRegistration(
    registrationId,
    ctx.pageId,
    ctx.pageSlug,
  );
  if (!approval.ok) {
    return { ok: false, message: approval.message ?? "تأیید ممکن نشد." };
  }

  const result = await performCheckin(
    eventId,
    registrationId,
    ctx.userId,
    ctx.pageSlug,
  );
  if (!result.ok) return result;
  return {
    ok: true,
    checkedInAt: result.checkedInAt.toISOString(),
    alreadyCheckedIn: result.alreadyCheckedIn,
  };
}
