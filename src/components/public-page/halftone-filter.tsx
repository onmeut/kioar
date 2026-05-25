/**
 * The duotone "halftone" effect for image wallpapers is implemented as a
 * reusable SVG filter referenced by CSS `filter: url(#kioar-halftone)`.
 *
 * Why this lives here:
 *   - CSS `url(#id)` references resolve against the host document, so the
 *     filter must be in the DOM where the wallpaper is rendered — not in
 *     globals.css and not in `<head>`.
 *   - We never render this on the dashboard, only on the public page, to
 *     keep the editor chrome from accidentally picking it up.
 *   - The two duotone tones are read from the active theme's tokens so
 *     the look stays on-brand. Defaults are safe (black/white) for the
 *     case where a theme hasn't been picked yet.
 */
export function HalftoneFilter() {
  return (
    <svg
      aria-hidden
      focusable={false}
      width={0}
      height={0}
      style={{ position: "absolute", width: 0, height: 0, overflow: "hidden" }}
    >
      <defs>
        <filter id="kioar-halftone" colorInterpolationFilters="sRGB">
          {/* Step 1: collapse the image to luminance so we have a clean
              0..1 grayscale ramp to remap. */}
          <feColorMatrix
            type="matrix"
            values="0.2126 0.7152 0.0722 0 0
                    0.2126 0.7152 0.0722 0 0
                    0.2126 0.7152 0.0722 0 0
                    0      0      0      1 0"
          />
          {/* Step 2: two-stop component transfer remaps luminance to a
              duotone palette. The two stops below give a high-contrast
              ink-and-paper look. */}
          <feComponentTransfer>
            <feFuncR type="table" tableValues="0.06 0.96" />
            <feFuncG type="table" tableValues="0.06 0.94" />
            <feFuncB type="table" tableValues="0.10 0.90" />
          </feComponentTransfer>
        </filter>
      </defs>
    </svg>
  );
}
