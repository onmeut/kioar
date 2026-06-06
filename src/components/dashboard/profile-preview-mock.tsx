import {
  PublicProfileCard,
  type PublicProfileCardData,
} from "@/components/public/public-profile-card";
import type { ActionState } from "@/lib/action-state";
import { cn } from "@/lib/utils";

/**
 * Live preview shown next to the links editor. Renders the EXACT same
 * visual as the public profile and is fully interactive — form/booking pills
 * open inside the phone mockup (modals are portaled into the phone via
 * `MockupPortalProvider`).
 *
 * Visual overrides versus the public page:
 *   - `lg:p-6` (24px) instead of `lg:p-8` — phone frame already provides chrome
 *   - `lg:rounded-none` + `lg:shadow-none` — no double card-in-frame
 *   - `min-h-full` — card stretches to fill the phone height so its hairline
 *     reads as the bottom of the page, not a stray "card edge"
 */
export function ProfilePreviewMock({
  profile,
  formSubmitAction,
  className,
}: {
  profile: PublicProfileCardData;
  /** Server action invoked when a visitor submits a form pill. Required when
   *  the page has form blocks; otherwise the form pill stays non-interactive. */
  formSubmitAction?: (
    state: ActionState,
    formData: FormData,
  ) => Promise<ActionState>;
  className?: string;
}) {
  return (
    <div className="relative flex min-h-full w-full flex-col">
      <PublicProfileCard
        profile={profile}
        interactive
        formSubmitAction={formSubmitAction}
        className={cn(
          "flex-1 !rounded-none !shadow-none",
          className,
        )}
      />
    </div>
  );
}
