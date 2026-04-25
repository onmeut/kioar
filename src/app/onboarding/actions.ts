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
  // directly on the links editor to finish building their card.
  const pendingEvent = await getPendingEventRegistration();
  if (pendingEvent) {
    await continuePendingEventRegistrationOrRedirect(viewer.user.id);
  }

  redirect("/dashboard/links");
}
