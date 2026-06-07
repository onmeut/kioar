/**
 * Persian display labels for event enums. Single source of truth shared by
 * the attendee (/my-events), host management, and admin surfaces so the same
 * status never gets two different Persian strings. The registration state
 * machine itself lives in `registration-service.ts`; this is display-only.
 */

import type {
  eventRegistrationStatusEnum,
  eventStatusEnum,
} from "@/db/schema";

export type EventRegistrationStatus =
  (typeof eventRegistrationStatusEnum.enumValues)[number];
export type EventStatus = (typeof eventStatusEnum.enumValues)[number];

export const REGISTRATION_STATUS_LABELS: Record<
  EventRegistrationStatus,
  string
> = {
  pending_approval: "در انتظار تأیید",
  payment_pending: "در انتظار پرداخت",
  payment_submitted: "رسید ارسال شد",
  approved: "تأیید شده",
  waitlisted: "در فهرست انتظار",
  rejected: "رد شده",
  cancelled: "لغو شده",
  attended: "حاضر شد",
};

export const EVENT_STATUS_LABELS: Record<EventStatus, string> = {
  draft: "پیش‌نویس",
  published: "منتشر شده",
  cancelled: "لغو شده",
};
