"use server";

import { and, eq } from "drizzle-orm";
import { notFound } from "next/navigation";

import { getDb } from "@/db";
import {
  bookings as bookingsTable,
  bookingTypes,
  profileBookingBlocks,
  profiles,
} from "@/db/schema";
import { getCurrentViewer } from "@/lib/auth/session";
import { blockKindToFeatureKey } from "@/lib/block-features";
import {
  getAvailableSlotsForDay,
  getPublicBookingBlockById,
} from "@/lib/booking-data";
import { pageHasFeature } from "@/lib/entitlements";
import { log } from "@/lib/log";
import { getOAuthAccount } from "@/lib/oauth/store";
import { createCalendarEvent } from "@/lib/oauth/google";
import { createSkyroomRoomForBooking } from "@/lib/oauth/skyroom";
import { createZoomMeeting } from "@/lib/oauth/zoom";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/request-ip";
import { publicBookingSubmitSchema } from "@/lib/validations";

export type PublicBookingSubmitResult =
  | {
      ok: true;
      booking: { id: string; startsAtIso: string; endsAtIso: string };
    }
  | { ok: false; message: string; fieldErrors?: Record<string, string[]> };

/**
 * Public: fetch bookable slots for a given block + type + date. Returns ISO
 * start timestamps the client can render in the visitor's timezone.
 */
export async function getPublicBookingSlotsAction(input: {
  blockId: string;
  bookingTypeId: string;
  dateIso: string;
}): Promise<{ ok: true; slots: string[] } | { ok: false; message: string }> {
  if (
    !input.blockId ||
    !input.bookingTypeId ||
    !/^\d{4}-\d{2}-\d{2}$/.test(input.dateIso)
  ) {
    return { ok: false, message: "ورودی معتبر نیست." };
  }
  // Phase 5 — entitlement gate. If the page no longer has bookings, the
  // endpoint behaves as if it doesn't exist (404). The page owner is
  // allowed through regardless so the dashboard live-preview keeps working
  // when bookings are present in the editor but not granted on the plan.
  const featureKey = blockKindToFeatureKey("booking");
  if (featureKey) {
    const block = await getDb().query.profileBookingBlocks.findFirst({
      where: eq(profileBookingBlocks.id, input.blockId),
      columns: { id: true, profileId: true },
    });
    if (!block) notFound();
    const granted = await pageHasFeature(block.profileId, featureKey);
    if (!granted) {
      const viewer = await getCurrentViewer();
      const profile = await getDb().query.profiles.findFirst({
        where: eq(profiles.id, block.profileId),
        columns: { userId: true },
      });
      const isOwner = !!viewer && profile?.userId === viewer.user.id;
      if (!isOwner) notFound();
    }
  }
  try {
    const slots = await getAvailableSlotsForDay(input);
    return { ok: true, slots: slots.map((s) => s.startIso) };
  } catch {
    return { ok: false, message: "دریافت زمان‌ها ممکن نشد." };
  }
}

/**
 * Public: submit a booking. Verifies:
 *   1. block + type exist and are active
 *   2. chosen start instant is an actually-available slot right now
 *      (prevents a visitor racing a newly-booked slot)
 *   3. basic per-IP rate limit
 */
export async function submitPublicBookingAction(
  input: unknown,
): Promise<PublicBookingSubmitResult> {
  const parsed = publicBookingSubmitSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: "اطلاعات فرم کامل نیست.",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<
        string,
        string[]
      >,
    };
  }

  const ip = await getClientIp();
  const rl = await checkRateLimit(`public-booking:${ip || "unknown"}`, 10, 60);
  if (!rl.allowed) {
    return {
      ok: false,
      message: "تعداد درخواست‌ها زیاد است. کمی بعد تلاش کنید.",
    };
  }

  const data = parsed.data;
  const block = await getPublicBookingBlockById(data.blockId);
  if (!block) {
    return { ok: false, message: "بلوک رزرو یافت نشد یا غیرفعال است." };
  }
  // Phase 5 — entitlement gate. If the page lost the bookings feature
  // since this form was rendered, refuse the write entirely (404).
  const featureKey = blockKindToFeatureKey("booking");
  if (featureKey) {
    const granted = await pageHasFeature(block.profileId, featureKey);
    if (!granted) notFound();
  }
  const type = block.types.find((t) => t.id === data.bookingTypeId);
  if (!type) {
    return { ok: false, message: "نوع رزرو معتبر نیست." };
  }

  const startsAt = new Date(data.startsAtIso);
  if (startsAt < new Date()) {
    return { ok: false, message: "این زمان از دسترس خارج شده است." };
  }

  // Verify the slot is actually still free right now.
  const dateIso = startsAt.toISOString().slice(0, 10);
  const available = await getAvailableSlotsForDay({
    blockId: block.id,
    bookingTypeId: type.id,
    dateIso,
  });
  const isFree = available.some((s) => s.startIso === startsAt.toISOString());
  if (!isFree) {
    // Try ±1 day since visitor tz could put the slot on a neighbouring day.
    const prev = new Date(startsAt.getTime() - 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
    const next = new Date(startsAt.getTime() + 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
    const [p, n] = await Promise.all([
      getAvailableSlotsForDay({
        blockId: block.id,
        bookingTypeId: type.id,
        dateIso: prev,
      }),
      getAvailableSlotsForDay({
        blockId: block.id,
        bookingTypeId: type.id,
        dateIso: next,
      }),
    ]);
    const stillFree = [...p, ...n].some(
      (s) => s.startIso === startsAt.toISOString(),
    );
    if (!stillFree) {
      return { ok: false, message: "این زمان دیگر در دسترس نیست." };
    }
  }

  const endsAt = new Date(startsAt.getTime() + type.durationMin * 60_000);

  const db = getDb();
  // Re-check block is still active transactionally.
  const stillActive = await db.query.profileBookingBlocks.findFirst({
    where: and(
      eq(profileBookingBlocks.id, block.id),
      eq(profileBookingBlocks.isActive, true),
    ),
  });
  if (!stillActive) {
    return { ok: false, message: "این رزرو در حال حاضر در دسترس نیست." };
  }
  const typeStillActive = await db.query.bookingTypes.findFirst({
    where: and(eq(bookingTypes.id, type.id), eq(bookingTypes.isActive, true)),
  });
  if (!typeStillActive) {
    return { ok: false, message: "این نوع رزرو در حال حاضر در دسترس نیست." };
  }

  const [inserted] = await db
    .insert(bookingsTable)
    .values({
      blockId: block.id,
      bookingTypeId: type.id,
      guestName: data.guestName,
      guestEmail: data.guestEmail ?? "",
      guestTimezone: data.guestTimezone ?? null,
      hostTimezone: block.timezone ?? null,
      startsAt,
      endsAt,
      status: "confirmed",
    })
    .returning({
      id: bookingsTable.id,
      startsAt: bookingsTable.startsAt,
      endsAt: bookingsTable.endsAt,
    });

  // ── Provider integration ────────────────────────────────────────────────
  // Best-effort: provider failures must NOT roll back the confirmed booking.
  // The owner can still see the booking and reach out manually if a Meet /
  // Zoom / Skyroom room couldn't be created. Each branch updates the row in
  // place with the resulting URL/event ids.
  try {
    const profile = await db.query.profiles.findFirst({
      where: eq(profiles.id, block.profileId),
      columns: { userId: true },
    });
    const ownerUserId = profile?.userId;
    if (ownerUserId) {
      const provider = block.meetingProvider;
      const summary = type.title;
      const description =
        `رزرو از طرف ${data.guestName} (${data.guestEmail}).` +
        (block.description ? `\n\n${block.description}` : "");
      const startIso = startsAt.toISOString();
      const endIso = endsAt.toISOString();
      const tz = block.timezone;

      let meetingUrl: string | null = null;
      let calendarEventId: string | null = null;
      let meetingProviderEventId: string | null = null;

      // Skyroom — uses per-block API key, no OAuth.
      if (provider === "skyroom" && block.skyroomApiKey) {
        try {
          const room = await createSkyroomRoomForBooking({
            apiKey: block.skyroomApiKey,
            name: `${block.skyroomRoomNamePrefix ?? "meeting"}-${inserted.id.slice(0, 8)}`,
            title: `${summary} — ${data.guestName}`,
            guests: [data.guestName],
          });
          meetingUrl = room.joinUrl;
          meetingProviderEventId = String(room.id);
        } catch (e) {
          log.warn("booking.skyroom_failed", {
            bookingId: inserted.id,
            error: e instanceof Error ? e.message : String(e),
          });
        }
      }

      // Zoom — OAuth-backed.
      if (provider === "zoom") {
        const acct = await getOAuthAccount(ownerUserId, "zoom");
        if (acct) {
          try {
            const meeting = await createZoomMeeting(ownerUserId, {
              topic: `${summary} — ${data.guestName}`,
              startIso,
              durationMin: type.durationMin,
              timezone: tz,
              agenda: description,
            });
            meetingUrl = meeting.joinUrl;
            meetingProviderEventId = String(meeting.id);
          } catch (e) {
            log.warn("booking.zoom_failed", {
              bookingId: inserted.id,
              error: e instanceof Error ? e.message : String(e),
            });
          }
        }
      }

      // Google Calendar — runs whenever Google is connected (regardless of
      // provider) so the owner gets a calendar entry. If the chosen provider
      // is google_meet, also requests a Meet link in the same call.
      const googleAcct = await getOAuthAccount(ownerUserId, "google");
      if (googleAcct) {
        try {
          const event = await createCalendarEvent(ownerUserId, {
            summary,
            description,
            startIso,
            endIso,
            timezone: tz,
            attendees: [
              { email: data.guestEmail ?? "", displayName: data.guestName },
            ],
            createMeet: provider === "google_meet",
            location:
              block.locationType === "in_person"
                ? (block.locationAddress ?? undefined)
                : undefined,
          });
          calendarEventId = event.id;
          if (provider === "google_meet" && event.meetUrl) {
            meetingUrl = event.meetUrl;
          }
        } catch (e) {
          log.warn("booking.google_calendar_failed", {
            bookingId: inserted.id,
            error: e instanceof Error ? e.message : String(e),
          });
        }
      }

      // Fallback to the static link the owner saved on the block.
      if (!meetingUrl && block.locationType === "online") {
        meetingUrl = block.meetingLink;
      }

      if (meetingUrl || calendarEventId || meetingProviderEventId) {
        await db
          .update(bookingsTable)
          .set({
            meetingUrl,
            calendarEventId,
            meetingProviderEventId,
          })
          .where(eq(bookingsTable.id, inserted.id));
      }
    }
  } catch (e) {
    log.warn("booking.provider_integration_failed", {
      bookingId: inserted.id,
      error: e instanceof Error ? e.message : String(e),
    });
  }

  return {
    ok: true,
    booking: {
      id: inserted.id,
      startsAtIso: inserted.startsAt.toISOString(),
      endsAtIso: inserted.endsAt.toISOString(),
    },
  };
}
