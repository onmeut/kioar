"use server";

import { redirect } from "next/navigation";

import { setPendingSlug } from "@/lib/auth/pending-intent";
import { isReservedSlug, normalizeSlug } from "@/lib/slug";

/**
 * Server action used by the public /invited landing page when a visitor
 * claims a username inline. Persists the candidate slug into the
 * `kioar_pending_slug` cookie (the same one the marketing landing page
 * uses) and redirects to /auth so the OTP flow can take over. The
 * onboarding form will pre-fill from that cookie after sign-up.
 *
 * Errors are surfaced via redirect to /auth without a slug — better than
 * a 500 page when somebody types something we can't normalize.
 */
export async function claimHandleAction(formData: FormData) {
  const raw = String(formData.get("handle") ?? "");
  const normalized = normalizeSlug(raw);
  if (normalized && normalized.length >= 2 && !isReservedSlug(normalized)) {
    await setPendingSlug(normalized);
  }
  redirect("/auth");
}
