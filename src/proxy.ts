import { type NextRequest, NextResponse } from "next/server";

const PENDING_SLUG_COOKIE = "kioar_pending_slug";
const SESSION_COOKIE = "kioar_session";

function normalizeSlug(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/[\u200c\u200f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function proxy(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  // Legacy `/auth?handle=…` deep-links and the old `/onboarding` route both
  // get rewritten to the new `/start` wizard. We also still set the
  // pending-slug cookie for /start to pick up as a prefill.
  if (pathname === "/auth" || pathname === "/onboarding") {
    const handle = searchParams.get("handle");
    const url = request.nextUrl.clone();
    if (handle) {
      const normalized = normalizeSlug(handle);
      url.pathname = "/start";
      url.searchParams.delete("handle");
      if (normalized) {
        url.searchParams.set("handle", normalized);
      }
      const response = NextResponse.redirect(url);
      if (normalized) {
        response.cookies.set(PENDING_SLUG_COOKIE, normalized, {
          httpOnly: true,
          sameSite: "lax",
          secure: process.env.NODE_ENV === "production",
          maxAge: 60 * 30,
          path: "/",
        });
      }
      return response;
    }
    if (pathname === "/onboarding") {
      url.pathname = "/start";
      return NextResponse.redirect(url);
    }
  }

  // Root "/" — logged-in users go to /me, not the marketing landing page.
  // We only check cookie presence here (full session validation stays in the
  // server component); an invalid/expired cookie is caught at the page level.
  if (pathname === "/" && request.cookies.has(SESSION_COOKIE)) {
    const url = request.nextUrl.clone();
    url.pathname = "/me";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/auth", "/onboarding"],
};
