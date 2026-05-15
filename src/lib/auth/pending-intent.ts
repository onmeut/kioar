import { cookies } from "next/headers";

import { isPageTypeSlug, type PageTypeSlug } from "@/lib/page-type";
import { isReservedSlug, normalizeSlug } from "@/lib/slug";

const PENDING_EVENT_COOKIE = "kioar_pending_event";
const PENDING_SLUG_COOKIE = "kioar_pending_slug";
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

export async function setPendingEventRegistration(slug: string) {
  const cookieStore = await cookies();
  cookieStore.set(PENDING_EVENT_COOKIE, slug, cookieOptions);
}

export async function getPendingEventRegistration() {
  const cookieStore = await cookies();
  return cookieStore.get(PENDING_EVENT_COOKIE)?.value ?? null;
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
