"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getDb } from "@/db";
import { profiles } from "@/db/schema";
import {
  setPendingConnect,
  clearPendingConnect,
} from "@/lib/auth/pending-intent";
import { getCurrentViewer } from "@/lib/auth/session";
import { createConnection, removeConnection } from "@/lib/connections";
import { resolveCurrentPageForOwner } from "@/lib/pages";
import { checkRateLimit } from "@/lib/rate-limit";
import { normalizeSlug } from "@/lib/slug";

// 30 connect-or-disconnect taps per minute per session/IP. Loose enough
// that nobody hits it organically; tight enough that we don't waste a
// row per scroll-spam tap from a misbehaving client.
const CONNECT_PER_USER_LIMIT = 30;
const CONNECT_PER_USER_WINDOW_SEC = 60;

async function rateLimitConnect(userId: string) {
  const result = await checkRateLimit(
    `connect:${userId}`,
    CONNECT_PER_USER_LIMIT,
    CONNECT_PER_USER_WINDOW_SEC,
  );
  return result.allowed;
}

/**
 * Connect the current viewer's page to the page identified by `slug`.
 *
 * Flow:
 *  - Anonymous viewer → drop the pending-connect cookie and bounce to
 *    /auth. After OTP the session helper completes the connection and
 *    redirects them back to /slug in the connected state.
 *  - Logged-in viewer with no completed page → same pending cookie,
 *    but redirect to /start (finish onboarding first).
 *  - Logged-in viewer + own page → noop (button is hidden anyway).
 *  - Logged-in viewer + other page → insert the connection row,
 *    invalidate the relevant paths, return.
 *
 * Idempotent: tapping Connect on a pair you're already connected to
 * is a successful no-op (the unique index hits `ON CONFLICT DO NOTHING`).
 */
export async function connectToPageAction(formData: FormData) {
  const slug = normalizeSlug(String(formData.get("slug") || ""));
  if (!slug) return;

  const db = getDb();
  const target = await db.query.profiles.findFirst({
    where: eq(profiles.slug, slug),
  });
  if (!target || target.adminDisabledAt) return;

  const viewer = await getCurrentViewer();

  if (!viewer) {
    await setPendingConnect(slug);
    redirect("/auth");
  }

  if (viewer.user.id === target.userId) {
    return;
  }

  if (!viewer.profile?.isComplete) {
    await setPendingConnect(slug);
    redirect("/start");
  }

  if (!(await rateLimitConnect(viewer.user.id))) {
    return;
  }

  const viewerPage = await resolveCurrentPageForOwner(viewer.user.id);
  if (!viewerPage) return;

  await createConnection({
    viewerPageId: viewerPage.id,
    targetPageId: target.id,
  });

  revalidatePath(`/${slug}`);
  revalidatePath("/connections");
}

/**
 * Remove the connection between the current viewer's page and the page
 * identified by `slug`. Either side can call this; the row disappears
 * for both. Silent no-op if the row didn't exist.
 */
export async function disconnectFromPageAction(formData: FormData) {
  const slug = normalizeSlug(String(formData.get("slug") || ""));
  if (!slug) return;

  const viewer = await getCurrentViewer();
  if (!viewer || !viewer.profile?.isComplete) return;

  if (!(await rateLimitConnect(viewer.user.id))) return;

  const db = getDb();
  const target = await db.query.profiles.findFirst({
    where: eq(profiles.slug, slug),
  });
  if (!target) {
    // Target gone — clean up any stale pending cookie just in case.
    await clearPendingConnect();
    return;
  }

  const viewerPage = await resolveCurrentPageForOwner(viewer.user.id);
  if (!viewerPage) return;

  await removeConnection({
    viewerPageId: viewerPage.id,
    targetPageId: target.id,
  });

  revalidatePath(`/${slug}`);
  revalidatePath("/connections");
}
