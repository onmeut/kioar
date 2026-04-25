import { LinksPageClient } from "@/components/dashboard/links-page-client";
import { requireCompletedProfile } from "@/lib/auth/session";
import { getBookingBlocksByUserId } from "@/lib/booking-data";
import { getLinkClickCounts, getProfileWithLinksByUserId } from "@/lib/data";
import { isIconKey } from "@/lib/link-icons";
import { getProviderConnections } from "@/lib/oauth/connections";
import { absoluteUrl } from "@/lib/site";

import { fetchLinkMetadataAction } from "./actions";
import {
  autosaveAvatarAction,
  autosaveLinkImageAction,
  autosaveLinksAction,
  autosaveProfileDetailsAction,
} from "./autosave-actions";
import {
  createBookingBlockAction,
  deleteBookingBlockAction,
  toggleBookingBlockActiveAction,
  updateBookingBlockAction,
} from "@/app/dashboard/bookings/actions";

export default async function DashboardLinksPage() {
  const viewer = await requireCompletedProfile();
  const profile = await getProfileWithLinksByUserId(viewer.user.id);

  const slug = profile?.slug ?? viewer.profile.slug;
  const publicUrl = absoluteUrl(`/${slug}`);

  const links =
    profile?.links.map((link) => ({
      id: link.id,
      label: link.label,
      url: link.url,
      description: link.description,
      imageUrl: link.imageUrl,
      iconKey: isIconKey(link.iconKey) ? link.iconKey : null,
      iconUrl: link.iconUrl,
      sortOrder: link.sortOrder,
      isActive: link.isActive,
    })) ?? [];

  const clickCounts = await getLinkClickCounts(links.map((l) => l.id));

  const rawBookingBlocks = await getBookingBlocksByUserId(viewer.user.id);
  const bookingBlocks = rawBookingBlocks.map((b) => ({
    id: b.id,
    name: b.name,
    description: b.description,
    avatarUrl: b.avatarUrl,
    timezone: b.timezone,
    locationType: b.locationType,
    locationAddress: b.locationAddress,
    locationLat: b.locationLat,
    locationLng: b.locationLng,
    locationPlaceId: b.locationPlaceId,
    meetingProvider: b.meetingProvider,
    meetingLink: b.meetingLink,
    skyroomApiKey: b.skyroomApiKey,
    skyroomRoomNamePrefix: b.skyroomRoomNamePrefix,
    bufferBeforeMin: b.bufferBeforeMin,
    bufferAfterMin: b.bufferAfterMin,
    calendarEmail: b.calendarEmail,
    isActive: b.isActive,
    sortOrder: b.sortOrder,
    availability: b.availability.map((a) => ({
      dayOfWeek: a.dayOfWeek,
      startMinute: a.startMinute,
      endMinute: a.endMinute,
    })),
    types: b.types.map((t) => ({
      id: t.id,
      title: t.title,
      durationMin: t.durationMin,
      priceAmount: t.priceAmount,
      priceCurrency: t.priceCurrency,
    })),
  }));

  const providerConnections = await getProviderConnections(viewer.user.id);

  return (
    <LinksPageClient
      initialProfile={{
        fullName: profile?.fullName ?? "",
        title: profile?.title ?? "",
        bio: profile?.bio ?? "",
        slug,
        publicPhone: profile?.publicPhone ?? "",
        email: profile?.email ?? "",
        avatarUrl: profile?.avatarUrl ?? null,
      }}
      initialLinks={links}
      initialBookingBlocks={bookingBlocks}
      providerConnections={providerConnections}
      linkClickCounts={clickCounts}
      publicUrl={publicUrl}
      fetchMetadataAction={fetchLinkMetadataAction}
      autosaveLinksAction={autosaveLinksAction}
      autosaveProfileDetailsAction={autosaveProfileDetailsAction}
      autosaveAvatarAction={autosaveAvatarAction}
      autosaveLinkImageAction={autosaveLinkImageAction}
      createBookingBlockAction={createBookingBlockAction}
      updateBookingBlockAction={updateBookingBlockAction}
      deleteBookingBlockAction={deleteBookingBlockAction}
      toggleBookingBlockActiveAction={toggleBookingBlockActiveAction}
    />
  );
}
