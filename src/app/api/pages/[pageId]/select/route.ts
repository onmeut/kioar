/**
 * POST /api/pages/[pageId]/select
 *
 * Switches the caller's "current page" cookie to the requested page,
 * verifying they own it first.
 *
 * Using a plain HTTP route instead of a Server Action means the endpoint
 * URL is stable across deployments — no hashed action IDs that can go
 * stale when a client has cached JS from an older build.
 */
import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";

import { requireUser } from "@/lib/auth/session";
import { switchCurrentPageForOwner } from "@/lib/pages";

type Params = Promise<{ pageId: string }>;

export async function POST(
  _request: NextRequest,
  { params }: { params: Params },
): Promise<NextResponse> {
  const { pageId } = await params;

  let viewer;
  try {
    viewer = await requireUser();
  } catch {
    return NextResponse.json(
      { ok: false, message: "احراز هویت لازم است." },
      { status: 401 },
    );
  }

  const page = await switchCurrentPageForOwner(pageId, viewer.user.id);
  if (!page) {
    return NextResponse.json(
      { ok: false, message: "صفحه پیدا نشد." },
      { status: 404 },
    );
  }

  // Bust the authenticated shell so the sidebar/header reflect the
  // newly-selected page on the next navigation, consistent with
  // switchPageAction (the server-action equivalent).
  revalidatePath("/", "layout");

  return NextResponse.json({ ok: true, slug: page.slug });
}
