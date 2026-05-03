/**
 * Phase 8 — `POST /api/billing/trial/start`.
 *
 * Body (JSON):
 *   { "pageId": uuid, "planKey": "pro" | "business" }
 *
 * Returns:
 *   200 { ok: true,  trialEndsAt: ISO, planKey, redirectUrl }
 *   400 { ok: false, error: "invalid_body" | "invalid_plan" }
 *   401            (no session — `requireUser` redirects on Server, throws on API)
 *   403 { ok: false, error: "forbidden" }
 *   404 { ok: false, error: "page_not_found" | "invalid_plan" }
 *   409 { ok: false, error: "already_used_trial" | "page_in_trial"
 *                          | "page_on_paid_plan" | "page_not_active"
 *                          | "subscription_missing" }
 *
 * All ownership + eligibility logic lives in `lib/trial.ts`. This file is
 * purely transport: shape validation, status code mapping.
 */
import { NextResponse } from "next/server";
import { z } from "zod";

import { requireUser } from "@/lib/auth/session";
import { startTrial } from "@/lib/trial";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  pageId: z.string().uuid(),
  planKey: z.enum(["pro", "business"]),
});

export async function POST(request: Request) {
  const viewer = await requireUser();

  let parsed: z.infer<typeof bodySchema>;
  try {
    parsed = bodySchema.parse(await request.json());
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: "invalid_body", detail: (err as Error).message },
      { status: 400 },
    );
  }

  const result = await startTrial({
    pageId: parsed.pageId,
    planKey: parsed.planKey,
    ownerId: viewer.user.id,
  });

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.error },
      { status: result.status },
    );
  }

  return NextResponse.json({
    ok: true,
    planKey: result.planKey,
    trialEndsAt: result.trialEndsAt.toISOString(),
    redirectUrl: result.redirectUrl,
  });
}
