import { cookies } from "next/headers";

import { isPageTypeSlug, type PageTypeSlug } from "@/lib/page-type";
import { isReservedSlug, normalizeSlug } from "@/lib/slug";

// JSON-encoded `{pageSlug, eventSlug, answers, discountCode}` carrying an
// anonymous visitor's pre-auth event-registration intent — including the
// form answers they already filled in. Set when a logged-out visitor taps
// register on a public event page; consumed by the auth continuation after
// OTP success, which completes the registration server-side and lands the
// user back on the event page (no /start detour). Tolerates a legacy
// bare-eventSlug string value from any in-flight cookie across a deploy.
const PENDING_EVENT_COOKIE = "kioar_pending_event";

// Hard cap on the serialized payload so a huge/malicious form can't blow the
// ~4KB browser cookie limit. If exceeded we drop the answers and keep only the
// slugs — the user re-enters answers on return rather than losing the flow.
const MAX_PENDING_EVENT_BYTES = 3072;
const PENDING_SLUG_COOKIE = "kioar_pending_slug";
// Slug the visitor wanted to connect to before auth. Set when an anonymous
// visitor taps Connect on a public page; consumed by verifyOtpAction after
// OTP success to complete the connection and redirect back to that page.
const PENDING_CONNECT_COOKIE = "kioar_pending_connect";
// JSON-encoded `{slug, pageType, discoverCategory}` carrying the visitor's
// pre-auth page-creation intent. Set by /start; consumed by verifyOtpAction
// after a successful OTP. Until OTP success no row exists in the DB — the
// slug is **not** reserved by setting this cookie.
const PENDING_PAGE_INTENT_COOKIE = "kioar_pending_page_intent";

const cookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  maxAge: 60 * 30,
  path: "/",
};

export type PendingEventRegistration = {
  pageSlug: string;
  eventSlug: string;
  answers?: Record<string, string | string[]>;
  discountCode?: string | null;
};

export async function setPendingEventRegistration(
  intent: PendingEventRegistration,
) {
  const pageSlug = normalizeSlug(intent.pageSlug);
  const eventSlug = normalizeSlug(intent.eventSlug);
  if (!pageSlug || !eventSlug) return;

  const payload: PendingEventRegistration = {
    pageSlug,
    eventSlug,
    answers: intent.answers,
    discountCode: intent.discountCode ?? null,
  };

  let value = JSON.stringify(payload);
  if (Buffer.byteLength(value, "utf8") > MAX_PENDING_EVENT_BYTES) {
    // Too big with answers — keep the flow alive, drop the answers.
    value = JSON.stringify({ pageSlug, eventSlug, discountCode: null });
  }

  const cookieStore = await cookies();
  cookieStore.set(PENDING_EVENT_COOKIE, value, cookieOptions);
}

export async function getPendingEventRegistration(): Promise<PendingEventRegistration | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(PENDING_EVENT_COOKIE)?.value;
  if (!raw) return null;

  // Legacy bare-eventSlug form (cookie set before the JSON upgrade). We can't
  // recover the pageSlug from it, so the continuation will resolve it via the
  // event lookup. Mark pageSlug empty for that path to handle.
  if (!raw.startsWith("{")) {
    const eventSlug = normalizeSlug(raw);
    return eventSlug ? { pageSlug: "", eventSlug } : null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<PendingEventRegistration>;
    const eventSlug =
      typeof parsed.eventSlug === "string"
        ? normalizeSlug(parsed.eventSlug)
        : "";
    if (!eventSlug) return null;
    const pageSlug =
      typeof parsed.pageSlug === "string" ? normalizeSlug(parsed.pageSlug) : "";
    const answers =
      parsed.answers && typeof parsed.answers === "object"
        ? (parsed.answers as Record<string, string | string[]>)
        : undefined;
    const discountCode =
      typeof parsed.discountCode === "string" ? parsed.discountCode : null;
    return { pageSlug, eventSlug, answers, discountCode };
  } catch {
    return null;
  }
}

export async function clearPendingEventRegistration() {
  const cookieStore = await cookies();
  cookieStore.set(PENDING_EVENT_COOKIE, "", {
    ...cookieOptions,
    maxAge: 0,
  });
}

export async function setPendingSlug(handle: string) {
  const normalized = normalizeSlug(handle);
  if (!normalized) return;
  const cookieStore = await cookies();
  cookieStore.set(PENDING_SLUG_COOKIE, normalized, cookieOptions);
}

export async function getPendingSlug() {
  const cookieStore = await cookies();
  return cookieStore.get(PENDING_SLUG_COOKIE)?.value ?? null;
}

export async function clearPendingSlug() {
  const cookieStore = await cookies();
  cookieStore.set(PENDING_SLUG_COOKIE, "", {
    ...cookieOptions,
    maxAge: 0,
  });
}

export async function setPendingConnect(slug: string) {
  const normalized = normalizeSlug(slug);
  if (!normalized) return;
  const cookieStore = await cookies();
  cookieStore.set(PENDING_CONNECT_COOKIE, normalized, cookieOptions);
}

export async function getPendingConnect() {
  const cookieStore = await cookies();
  return cookieStore.get(PENDING_CONNECT_COOKIE)?.value ?? null;
}

export async function clearPendingConnect() {
  const cookieStore = await cookies();
  cookieStore.set(PENDING_CONNECT_COOKIE, "", {
    ...cookieOptions,
    maxAge: 0,
  });
}

export type PendingPageIntent = {
  slug: string;
  pageType: PageTypeSlug | null;
  fullName: string | null;
  discoverCategory: string | null;
};

const MAX_FULL_NAME_LENGTH = 80;

function sanitizeFullName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().slice(0, MAX_FULL_NAME_LENGTH);
  return trimmed.length > 0 ? trimmed : null;
}

export async function setPendingPageIntent(intent: PendingPageIntent) {
  const slug = normalizeSlug(intent.slug);
  if (!slug || slug.length < 2 || isReservedSlug(slug)) return;
  const pageType =
    intent.pageType && isPageTypeSlug(intent.pageType) ? intent.pageType : null;
  const fullName = sanitizeFullName(intent.fullName);
  const discoverCategory = intent.discoverCategory || null;
  const value = JSON.stringify({ slug, pageType, fullName, discoverCategory });
  const cookieStore = await cookies();
  cookieStore.set(PENDING_PAGE_INTENT_COOKIE, value, cookieOptions);
}

export async function getPendingPageIntent(): Promise<PendingPageIntent | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(PENDING_PAGE_INTENT_COOKIE)?.value;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<PendingPageIntent>;
    const slug =
      typeof parsed.slug === "string" ? normalizeSlug(parsed.slug) : "";
    if (!slug || slug.length < 2 || isReservedSlug(slug)) return null;
    const pageType =
      parsed.pageType && isPageTypeSlug(parsed.pageType)
        ? parsed.pageType
        : null;
    const fullName = sanitizeFullName(parsed.fullName);
    const discoverCategory =
      typeof parsed.discoverCategory === "string" && parsed.discoverCategory
        ? parsed.discoverCategory
        : null;
    return { slug, pageType, fullName, discoverCategory };
  } catch {
    return null;
  }
}

export async function clearPendingPageIntent() {
  const cookieStore = await cookies();
  cookieStore.set(PENDING_PAGE_INTENT_COOKIE, "", {
    ...cookieOptions,
    maxAge: 0,
  });
}
