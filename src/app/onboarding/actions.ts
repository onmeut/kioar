"use server";

import { redirect } from "next/navigation";
import type { Route } from "next";

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

  if (result.isFirstPage) {
    redirect(`/dashboard/pages/${result.pageId}/trial` as Route);
  }
  redirect("/me");
}
