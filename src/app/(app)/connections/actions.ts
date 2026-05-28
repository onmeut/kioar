"use server";

import { revalidatePath } from "next/cache";

import { requireCompletedProfile } from "@/lib/auth/session";
import { removeConnection } from "@/lib/connections";
import { resolveCurrentPageForOwner } from "@/lib/pages";
import { checkRateLimit } from "@/lib/rate-limit";

const REMOVE_PER_USER_LIMIT = 30;
const REMOVE_PER_USER_WINDOW_SEC = 60;

/**
 * Dashboard-side "remove from network" wrapper. Identical semantics to
 * `disconnectFromPageAction` (the public-page one) but keyed by the
 * target's pageId — the dashboard already knows the pageId from the
 * list query, so we don't pay a slug → page lookup again. The cooldown
 * is the same bucket, intentionally — a user yanking 50 connections
 * shouldn't get extra runway just because they're in the dashboard.
 */
export async function removeFromNetworkAction(formData: FormData) {
  const targetPageId = String(formData.get("pageId") || "");
  const targetSlug = String(formData.get("slug") || "");
  if (!targetPageId) return;

  const viewer = await requireCompletedProfile();

  const rl = await checkRateLimit(
    `connect:${viewer.user.id}`,
    REMOVE_PER_USER_LIMIT,
    REMOVE_PER_USER_WINDOW_SEC,
  );
  if (!rl.allowed) return;

  const viewerPage = await resolveCurrentPageForOwner(viewer.user.id);
  if (!viewerPage) return;

  await removeConnection({
    viewerPageId: viewerPage.id,
    targetPageId,
  });

  revalidatePath("/connections");
  if (targetSlug) revalidatePath(`/${targetSlug}`);
}
