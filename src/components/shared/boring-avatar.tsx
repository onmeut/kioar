import Avatar from "boring-avatars";

import { BORING_AVATAR_COLORS_PROP, BORING_AVATAR_VARIANT } from "@/lib/avatar";

/**
 * Deterministic SVG avatar fallback used everywhere a user has no uploaded
 * picture. Uses the brand-locked palette + `beam` variant from
 * `lib/avatar.ts`. The visual is varied per-user via the `seed` prop.
 *
 * Keep this component "dumb" — no border, no ring, no background. The
 * caller decides on chrome (e.g. `rounded-full border` wrapper) so that
 * one avatar element looks the same in every surface (public profile,
 * dashboard preview, sidebar, etc.).
 */
export function BoringAvatar({
  seed,
  size = 80,
  square = false,
  className,
}: {
  /** Stable seed (e.g. `profiles.avatarSeed`). Falls back to a constant. */
  seed: string | null | undefined;
  size?: number;
  /** When true renders a square (no rounded mask). Default is circle. */
  square?: boolean;
  className?: string;
}) {
  return (
    <Avatar
      name={seed || "kioar"}
      colors={BORING_AVATAR_COLORS_PROP}
      variant={BORING_AVATAR_VARIANT}
      square={square}
      size={size}
      className={className}
    />
  );
}
