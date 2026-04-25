import {
  PublicProfileCard,
  type PublicProfileCardData,
} from "@/components/public/public-profile-card";
import { cn } from "@/lib/utils";

/**
 * Live preview shown next to the links editor. Renders the EXACT same
 * visual as the public profile so users see what visitors will see.
 * Not interactive.
 */
export function ProfilePreviewMock({
  profile,
  className,
}: {
  profile: PublicProfileCardData;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "pointer-events-none mx-auto w-full select-none",
        className,
      )}
    >
      <PublicProfileCard profile={profile} interactive={false} />
    </div>
  );
}
