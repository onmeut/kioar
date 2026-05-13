import { NextResponse } from "next/server";

import { requireUser } from "@/lib/auth/session";
import { buildZoomAuthUrl, isZoomOAuthConfigured } from "@/lib/oauth/zoom";
import { createOAuthState } from "@/lib/oauth/state";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!isZoomOAuthConfigured()) {
    return NextResponse.json({ error: "zoom_not_configured" }, { status: 501 });
  }
  const viewer = await requireUser();
  const url = new URL(request.url);
  const returnTo = url.searchParams.get("returnTo") ?? "/me";
  const safeReturnTo = returnTo.startsWith("/") ? returnTo : "/me";
  const state = createOAuthState({
    userId: viewer.user.id,
    provider: "zoom",
    returnTo: safeReturnTo,
  });
  return NextResponse.redirect(buildZoomAuthUrl(state));
}
