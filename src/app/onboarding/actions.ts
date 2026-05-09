"use server";

import { redirect } from "next/navigation";

import { type ActionState } from "@/lib/action-state";
import {
  clearPendingSlug,
  getPendingEventRegistration,
} from "@/lib/auth/pending-intent";
import {
  continuePendingEventRegistrationOrRedirect,
  requireUser,
} from "@/lib/auth/session";
import { saveOnboardingProfileForUser } from "@/lib/profile-service";
import { startTrial } from "@/lib/trial";

export async function saveOnboardingProfileAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const viewer = await requireUser();
  const result = await saveOnboardingProfileForUser(viewer.user.id, formData);

  if (!result.ok) {
    return {
      status: "error",
      fieldErrors: result.fieldErrors,
      message: result.message,
    };
  }

  // The pending slug cookie has done its job (prefilled the form) — clear it
  // so later sign-ins don't keep resurrecting the original landing-page claim.
  await clearPendingSlug();

  // Honor a pre-auth event intent if one exists; otherwise drop the user
  // directly on the trial screen if this is their FIRST page (Phase 8 —
  // matches the Linktree-style "Claim a free 7-day trial" timeline). For
  // edits to an existing page we go straight to the editor to avoid an
  // unwanted detour.
  const pendingEvent = await getPendingEventRegistration();
  if (pendingEvent) {
    await continuePendingEventRegistrationOrRedirect(viewer.user.id);
  }

  // Auto-start the trial for every newly created page — no extra
  // opt-in screen needed. Plan is chosen from the user's selected page
  // type: "business" pages get the Business trial, everyone else gets
  // Pro. Errors are intentionally swallowed so a missing plan config
  // never blocks the user from reaching their dashboard.
  if (result.isFirstPage) {
    const pageType = formData.get("pageType");
    const planKey = pageType === "business" ? "business" : "pro";
    await startTrial({
      pageId: result.pageId,
      planKey,
      ownerId: viewer.user.id,
    });
  }
  redirect("/me");
}
