import { NextResponse } from "next/server";

import { requireUser } from "@/lib/auth/session";
import {
  buildGoogleAuthUrl,
  isGoogleOAuthConfigured,
} from "@/lib/oauth/google";
import { createOAuthState } from "@/lib/oauth/state";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!isGoogleOAuthConfigured()) {
    return NextResponse.json(
      { error: "google_not_configured" },
      { status: 501 },
    );
  }
  const viewer = await requireUser();
  const url = new URL(request.url);
  const returnTo = url.searchParams.get("returnTo") ?? "/dashboard";
  const safeReturnTo = returnTo.startsWith("/") ? returnTo : "/dashboard";

  const state = createOAuthState({
    userId: viewer.user.id,
    provider: "google",
    returnTo: safeReturnTo,
  });
  return NextResponse.redirect(buildGoogleAuthUrl(state));
}
