import { getKioarAvatarSvg } from "@/lib/avatar";

/**
 * Deterministic SVG avatar fallback used everywhere a user has no
 * uploaded picture. Renders the brand-locked DiceBear `bottts-neutral`
 * bot keyed off the persisted `seed`.
 *
 * Keep this component "dumb" — no border, no ring, no rounded mask.
 * The caller decides on chrome (e.g. `rounded-full border` wrapper) so
 * one avatar element looks the same in every surface (public profile,
 * dashboard preview, sidebar, etc.).
 *
 * The SVG is generated once during render and injected via
 * `dangerouslySetInnerHTML`. DiceBear's output is a self-contained,
 * sandboxed `<svg>` produced by trusted first-party code from the
 * `seed` only — there is no untrusted HTML in the input.
 */
export function KioarAvatar({
  seed,
  size = 80,
  square = false,
  className,
}: {
  /** Stable seed (e.g. `profiles.avatarSeed`). Falls back to a constant. */
  seed: string | null | undefined;
  size?: number;
  /** When true renders a square (no rounded mask). Default is square too —
   *  callers wrap in `rounded-full` themselves. Kept for API parity with
   *  the legacy fallback and for the rasteriser route. */
  square?: boolean;
  className?: string;
}) {
  // `square` defaults to false historically, but the SVG itself is now
  // always square (radius 0); the wrapper handles circular masking.
  void square;
  const svg = getKioarAvatarSvg(seed, { size });
  return (
    <span
      role="img"
      aria-label=""
      style={{
        display: "inline-block",
        width: size,
        height: size,
        lineHeight: 0,
      }}
      className={className}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
