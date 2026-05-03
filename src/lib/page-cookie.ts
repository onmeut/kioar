import { cookies } from "next/headers";

/**
 * httpOnly cookie that names the page the dashboard is currently editing.
 * Set/cleared via `setCurrentPageId` below. Reading the cookie does NOT
 * verify ownership \u2014 that's `requirePageOwnership`'s job.
 */
export const CURRENT_PAGE_COOKIE_NAME = "kioar_page_id";

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

export async function readCurrentPageIdCookie(): Promise<string | null> {
  const store = await cookies();
  const value = store.get(CURRENT_PAGE_COOKIE_NAME)?.value;
  return value && /^[0-9a-f-]{36}$/i.test(value) ? value : null;
}

export async function writeCurrentPageIdCookie(pageId: string): Promise<void> {
  const store = await cookies();
  store.set(CURRENT_PAGE_COOKIE_NAME, pageId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: ONE_YEAR_SECONDS,
    path: "/",
  });
}

export async function clearCurrentPageIdCookie(): Promise<void> {
  const store = await cookies();
  store.set(CURRENT_PAGE_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    expires: new Date(0),
    path: "/",
  });
}
