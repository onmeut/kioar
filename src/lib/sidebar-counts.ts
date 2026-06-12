import { and, count, eq, gte, inArray } from "drizzle-orm";

import { getDb } from "@/db";
import {
  bookings,
  formSubmissions,
  profileBookingBlocks,
  profileFormBlocks,
} from "@/db/schema";
import { countIncomingForViewer } from "@/lib/transfer-service";

export interface SidebarBadgeCounts {
  bookings: number;
  forms: number;
  notifications: number;
}

/**
 * Returns badge counts for the sidebar nav items in a single round-trip
 * per resource type.
 *
 * - `bookings`: upcoming confirmed bookings (startsAt ≥ now) on the page.
 * - `forms`: total form submissions on the page.
 * - `notifications`: pending incoming page-transfer offers for the viewer
 *   (matched by phone). Drives the red dot on the notifications nav item.
 *
 * `viewerPhone` is optional so legacy callers that only have `userId` keep
 * working (notifications falls back to 0).
 */
export async function getSidebarBadgeCounts(
  pageId: string,
  _userId: string,
  viewerPhone?: string,
): Promise<SidebarBadgeCounts> {
  const db = getDb();
  const now = new Date();

  const [bookingBlockRows, formBlockRows] = await Promise.all([
    db
      .select({ id: profileBookingBlocks.id })
      .from(profileBookingBlocks)
      .where(eq(profileBookingBlocks.profileId, pageId)),
    db
      .select({ id: profileFormBlocks.id })
      .from(profileFormBlocks)
      .where(eq(profileFormBlocks.profileId, pageId)),
  ]);

  const bookingBlockIds = bookingBlockRows.map((r) => r.id);
  const formBlockIds = formBlockRows.map((r) => r.id);

  const [bookingCountRow, formCountRow] = await Promise.all([
    bookingBlockIds.length > 0
      ? db
          .select({ n: count() })
          .from(bookings)
          .where(
            and(
              inArray(bookings.blockId, bookingBlockIds),
              gte(bookings.startsAt, now),
            ),
          )
          .then((rows) => rows[0])
      : Promise.resolve({ n: 0 }),
    formBlockIds.length > 0
      ? db
          .select({ n: count() })
          .from(formSubmissions)
          .where(inArray(formSubmissions.blockId, formBlockIds))
          .then((rows) => rows[0])
      : Promise.resolve({ n: 0 }),
  ]);

  const notifications = viewerPhone
    ? await countIncomingForViewer(viewerPhone).catch(() => 0)
    : 0;

  return {
    bookings: bookingCountRow?.n ?? 0,
    forms: formCountRow?.n ?? 0,
    notifications,
  };
}
