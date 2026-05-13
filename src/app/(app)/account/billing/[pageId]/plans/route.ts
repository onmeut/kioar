/**
 * Back-compat shim. The plan picker moved to `/pro` (which resolves the
 * page being upgraded from the page-switcher cookie — no page id in the
 * URL). This route still exists so deep links from older emails / docs /
 * the per-page billing hub keep working: it pins the cookie to the page
 * id from the URL (verified for ownership) and forwards to `/pro`.
 *
 * Must be a Route Handler (not a page component) because writing cookies
 * is only permitted in Server Actions and Route Handlers.
 */
import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";

import { requireUser } from "@/lib/auth/session";
import { switchCurrentPageForOwner } from "@/lib/pages";

type Params = Promise<{ pageId: string }>;

export async function GET(
  _request: NextRequest,
  { params }: { params: Params },
) {
  const { pageId } = await params;
  const viewer = await requireUser();
  // Verifies ownership before writing the cookie — a forged URL with
  // someone else's page id won't pin the cookie to it.
  await switchCurrentPageForOwner(pageId, viewer.user.id);
  redirect("/pro");
}
