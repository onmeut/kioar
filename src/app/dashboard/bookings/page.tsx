import { BookingsListClient } from "@/components/dashboard/bookings-list-client";
import { requireCompletedProfile } from "@/lib/auth/session";
import {
  getGuestBookingsForEmail,
  getIncomingBookingsForUser,
} from "@/lib/booking-data";

export const dynamic = "force-dynamic";

export default async function DashboardBookingsPage() {
  const viewer = await requireCompletedProfile();

  const [incoming, outgoing] = await Promise.all([
    getIncomingBookingsForUser(viewer.user.id),
    getGuestBookingsForEmail(viewer.profile.email ?? null),
  ]);

  // Serialize dates for the client component.
  const serializeBooking = (b: (typeof incoming)[number]) => ({
    id: b.id,
    status: b.status,
    guestName: b.guestName,
    guestEmail: b.guestEmail,
    guestTimezone: b.guestTimezone,
    startsAtIso: b.startsAt.toISOString(),
    endsAtIso: b.endsAt.toISOString(),
    createdAtIso: b.createdAt.toISOString(),
    block: b.block,
    type: b.type,
  });

  return (
    <BookingsListClient
      viewerEmail={viewer.profile.email ?? null}
      incoming={incoming.map(serializeBooking)}
      outgoing={outgoing.map(serializeBooking)}
    />
  );
}
