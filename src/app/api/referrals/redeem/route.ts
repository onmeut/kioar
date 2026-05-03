/**
 * `POST /api/referrals/redeem`
 *
 * Body: `{ pageId: string }`. Auth-required. Atomically applies one
 * month of referral credit to the chosen page (`+30 days` on
 * `currentPeriodEnd`). Free-plan pages are rejected.
 *
 * Returns 200 with `{ ok: true, newPeriodEnd }` on success, or 4xx with
 * `{ ok: false, errorCode, message }`. Errors deliberately use stable
 * machine codes so the client can localise.
 */
import { NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentViewer } from "@/lib/auth/session";
import { redeemCredit } from "@/lib/referrals";

export const dynamic = "force-dynamic";

const Body = z.object({ pageId: z.string().uuid() });

export async function POST(request: Request) {
  const viewer = await getCurrentViewer();
  if (!viewer) {
    return NextResponse.json(
      { ok: false, errorCode: "unauthenticated" },
      { status: 401 },
    );
  }

  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await request.json());
  } catch {
    return NextResponse.json(
      { ok: false, errorCode: "bad_request" },
      { status: 400 },
    );
  }

  const result = await redeemCredit({
    userId: viewer.user.id,
    pageId: body.pageId,
  });

  if (!result.ok) {
    const status =
      result.errorCode === "page_not_owned"
        ? 403
        : result.errorCode === "no_credit" || result.errorCode === "free_plan"
          ? 409
          : 400;
    return NextResponse.json(result, { status });
  }

  return NextResponse.json({
    ok: true,
    pageId: result.pageId,
    newPeriodEnd: result.newPeriodEnd.toISOString(),
  });
}
