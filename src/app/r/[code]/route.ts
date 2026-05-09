/**
 * `GET /r/:code` — referral click attribution endpoint.
 *
 * Flow:
 *   1. Resolve `:code` (case-insensitive, trim) against `referral_codes`.
 *      Unknown codes 302 to `/` so a stale share link still lands on the
 *      brand instead of a hard 404 (better social-share UX).
 *   2. Insert one `referrals` row in `clicked` state, capture IP/UA, bump
 *      `referral_codes.clicks_count`.
 *   3. Set the `kioar_ref` cookie (httpOnly, Lax, 30d) to the row's
 *      opaque `cookie_id`. Re-using an existing cookie value is fine —
 *      we always create a fresh row per click so the funnel matches
 *      reality.
 *   4. 302 to `/invited?via=<code>` so the marketing page can greet the
 *      visitor with the inviter's name.
 *
 * `dynamic = "force-dynamic"` because we set a cookie + read headers.
 */
import { NextResponse } from "next/server";

import { log } from "@/lib/log";
import { writeReferralCookie } from "@/lib/referral-cookie";
import { createClickRecord } from "@/lib/referrals";
import { getClientIp } from "@/lib/request-ip";
import { absoluteUrl } from "@/lib/site";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  ctx: { params: Promise<{ code: string }> },
) {
  const { code } = await ctx.params;
  const userAgent = request.headers.get("user-agent");

  let cookieId: string | null = null;
  try {
    const ip = await getClientIp();
    const click = await createClickRecord({ code, ip, userAgent });
    if (!click) {
      return NextResponse.redirect(absoluteUrl("/"));
    }
    cookieId = click.cookieId;
  } catch (err) {
    log.warn("referrals.click.failed", {
      code,
      error: (err as Error).message,
    });
    // Don't block the visitor on infra errors — let them land on /invited
    // without attribution. Better UX than a 500 page.
    return NextResponse.redirect(
      absoluteUrl(`/invited?via=${encodeURIComponent(code)}`),
    );
  }

  if (cookieId) await writeReferralCookie(cookieId);
  return NextResponse.redirect(
    absoluteUrl(`/invited?via=${encodeURIComponent(code)}`),
  );
}
