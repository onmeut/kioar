import { NextResponse } from "next/server";

import {
  exchangeZoomCode,
  fetchZoomUserInfo,
  isZoomOAuthConfigured,
} from "@/lib/oauth/zoom";
import { upsertOAuthAccount } from "@/lib/oauth/store";
import { verifyOAuthState } from "@/lib/oauth/state";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!isZoomOAuthConfigured()) {
    return NextResponse.json({ error: "not_configured" }, { status: 501 });
  }
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const stateRaw = url.searchParams.get("state");
  const error = url.searchParams.get("error");
  const base =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ??
    `${url.protocol}//${url.host}`;

  if (error) {
    return NextResponse.redirect(
      `${base}/dashboard?zoom=error&reason=${encodeURIComponent(error)}`,
    );
  }
  if (!code || !stateRaw) {
    return NextResponse.redirect(`${base}/dashboard?zoom=error&reason=missing`);
  }
  const state = verifyOAuthState(stateRaw);
  if (!state || state.provider !== "zoom") {
    return NextResponse.redirect(`${base}/dashboard?zoom=error&reason=state`);
  }
  try {
    const tokens = await exchangeZoomCode(code);
    const me = await fetchZoomUserInfo(tokens.access_token);
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);
    await upsertOAuthAccount({
      userId: state.userId,
      provider: "zoom",
      providerAccountId: me.id,
      accountEmail: me.email ?? null,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt,
      scope: tokens.scope,
    });
  } catch (err) {
    const reason = encodeURIComponent(
      err instanceof Error ? err.message : "unknown",
    );
    return NextResponse.redirect(
      `${base}/dashboard?zoom=error&reason=${reason}`,
    );
  }
  const dest = state.returnTo ?? "/dashboard";
  const sep = dest.includes("?") ? "&" : "?";
  return NextResponse.redirect(`${base}${dest}${sep}zoom=connected`);
}
