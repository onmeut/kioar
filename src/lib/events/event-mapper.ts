import type { getHostEvent } from "@/lib/events/queries";
import {
  formatGregorianDateInZone,
  formatGregorianTimeInZone,
} from "@/lib/date/timezone";
import type { EventFormInitial } from "@/components/events/event-form";

type HostEvent = NonNullable<Awaited<ReturnType<typeof getHostEvent>>>;

/**
 * Map a stored (UTC) event + its questions/codes back into the form's civil
 * draft shape. The civil date/time are rendered in the event's own timezone so
 * the host edits the same wall-clock they authored — UTC stays the truth.
 */
export function toEventFormInitial(data: HostEvent): EventFormInitial {
  const { event, questions, codes, tiers } = data;
  const tz = event.timezone;
  return {
    id: event.id,
    title: event.title,
    description: event.description,
    coverUrl: event.coverUrl,
    locationType: event.locationType,
    locationAddress: event.locationAddress,
    onlineUrl: event.onlineUrl,
    timezone: tz,
    start: {
      date: formatGregorianDateInZone(event.startsAt, tz, "yyyy-MM-dd"),
      time: formatGregorianTimeInZone(event.startsAt, tz),
    },
    end: event.endsAt
      ? {
          date: formatGregorianDateInZone(event.endsAt, tz, "yyyy-MM-dd"),
          time: formatGregorianTimeInZone(event.endsAt, tz),
        }
      : { date: "", time: "" },
    capacity: event.capacity,
    paymentInstructions: event.paymentInstructions ?? null,
    cardEnabled: event.cardEnabled,
    cardNumber: event.cardNumber ?? null,
    cardHolderName: event.cardHolderName ?? null,
    shebaEnabled: event.shebaEnabled,
    shebaNumber: event.shebaNumber ?? null,
    shebaHolderName: event.shebaHolderName ?? null,
    approvalRequired: event.approvalRequired,
    receiptUploadEnabled: event.receiptUploadEnabled,
    status: event.status,
    questions: questions.map((q) => ({
      id: q.id,
      kind: q.kind,
      label: q.label,
      required: q.required,
      options: q.options ?? null,
    })),
    discountCodes: codes.map((c) => ({
      id: c.id,
      code: c.code,
      type: c.type,
      value: c.value,
      usageLimit: c.usageLimit,
      expiresAt: c.expiresAt ? c.expiresAt.toISOString() : null,
      isActive: c.isActive,
    })),
    ticketTypes: tiers.map((t) => ({
      id: t.id,
      name: t.name,
      description: t.description,
      isFree: t.priceType === "free",
      priceToman: t.priceToman,
      capacity: t.capacity,
    })),
  };
}
