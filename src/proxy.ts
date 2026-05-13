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

  if (pathname === "/auth") {
    const handle = searchParams.get("handle");
    if (handle) {
      const normalized = normalizeSlug(handle);
      const url = request.nextUrl.clone();
      url.searchParams.delete("handle");
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
  matcher: ["/", "/auth"],
};
