import { cookies } from "next/headers";

import { normalizeSlug } from "@/lib/slug";

const PENDING_EVENT_COOKIE = "kioar_pending_event";
const PENDING_SLUG_COOKIE = "kioar_pending_slug";

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
