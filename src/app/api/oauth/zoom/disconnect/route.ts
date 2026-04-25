import { NextResponse } from "next/server";

import { requireUser } from "@/lib/auth/session";
import { deleteOAuthAccount } from "@/lib/oauth/store";

export const dynamic = "force-dynamic";

export async function POST() {
  const viewer = await requireUser();
  await deleteOAuthAccount(viewer.user.id, "zoom");
  return NextResponse.json({ ok: true });
}
