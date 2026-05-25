/**
 * Tiny colour utilities used by the design panel for:
 *   1. Deriving a tasteful gradient from a single base colour (the
 *      `gradientFromBase` helper).
 *   2. Listing the named "suggested" swatches surfaced under the fill
 *      and gradient pickers (`SUGGESTED_BASE_COLORS` + `SUGGESTED_GRADIENT_BASES`).
 *
 * Everything is pure and hex-in/hex-out — the picker speaks hex, the
 * Zod schema accepts hex, and the renderer interpolates hex without
 * coordinate-system games. We deliberately do NOT pull in a colour
 * library; HSL math is a few lines and the math runs once per user
 * interaction.
 */

export type Hex = string;

export type GradientShade = {
  from: Hex;
  to: Hex;
};

/** Named swatch surfaced in the "suggested" rows of the design panel. */
export type NamedSwatch = {
  /** Persian display name. */
  nameFa: string;
  /** Canonical hex. Used for both fill chips and as the base for gradients. */
  hex: Hex;
};

/**
 * Eight base hues the user explicitly asked for, plus Black + White (which
 * are useful as gradient ends — e.g. "blue → white" is the most common
 * tasteful gradient on the web). The Persian display names match the
 * "cool" naming convention used by the theme presets in `themes.ts`.
 */
export const SUGGESTED_BASE_COLORS: NamedSwatch[] = [
  { nameFa: "آتش", hex: "#ef4444" },
  { nameFa: "نارنج", hex: "#f97316" },
  { nameFa: "آفتاب", hex: "#eab308" },
  { nameFa: "جنگل", hex: "#16a34a" },
  { nameFa: "اقیانوس", hex: "#2563eb" },
  { nameFa: "ارغوان", hex: "#9333ea" },
  { nameFa: "شکوفه", hex: "#ec4899" },
  { nameFa: "شکلات", hex: "#7c4a2d" },
];

/** Same eight colours plus the neutral end-stops users reach for in
 *  gradients. Black and White intentionally sit at the end of the row. */
export const SUGGESTED_GRADIENT_BASES: NamedSwatch[] = [
  ...SUGGESTED_BASE_COLORS,
  { nameFa: "مشکی", hex: "#111111" },
  { nameFa: "سفید", hex: "#ffffff" },
];

/* ───────────────────────── conversions ───────────────────────── */

function clamp(n: number, lo: number, hi: number): number {
  if (n < lo) return lo;
  if (n > hi) return hi;
  return n;
}

function normalizeHex(input: string): Hex | null {
  if (!input) return null;
  let v = input.trim();
  if (!v) return null;
  if (!v.startsWith("#")) v = `#${v}`;
  if (/^#[0-9a-fA-F]{3}$/.test(v)) {
    return `#${v[1]}${v[1]}${v[2]}${v[2]}${v[3]}${v[3]}`.toLowerCase();
  }
  if (/^#[0-9a-fA-F]{6}$/.test(v)) return v.toLowerCase();
  if (/^#[0-9a-fA-F]{8}$/.test(v)) return v.slice(0, 7).toLowerCase();
  return null;
}

function hexToRgb(hex: Hex): [number, number, number] {
  const v = normalizeHex(hex) ?? "#000000";
  return [
    parseInt(v.slice(1, 3), 16),
    parseInt(v.slice(3, 5), 16),
    parseInt(v.slice(5, 7), 16),
  ];
}

function rgbToHex(r: number, g: number, b: number): Hex {
  const toHex = (n: number) =>
    Math.round(clamp(n, 0, 255)).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/** RGB (0–255) → HSL (h: 0–360, s/l: 0–1). */
function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const R = r / 255;
  const G = g / 255;
  const B = b / 255;
  const max = Math.max(R, G, B);
  const min = Math.min(R, G, B);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case R:
        h = ((G - B) / d + (G < B ? 6 : 0)) * 60;
        break;
      case G:
        h = ((B - R) / d + 2) * 60;
        break;
      default:
        h = ((R - G) / d + 4) * 60;
    }
  }
  return [h, s, l];
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const H = ((h % 360) + 360) % 360 / 360;
  const S = clamp(s, 0, 1);
  const L = clamp(l, 0, 1);

  const hue2rgb = (p: number, q: number, t: number) => {
    let T = t;
    if (T < 0) T += 1;
    if (T > 1) T -= 1;
    if (T < 1 / 6) return p + (q - p) * 6 * T;
    if (T < 1 / 2) return q;
    if (T < 2 / 3) return p + (q - p) * (2 / 3 - T) * 6;
    return p;
  };

  if (S === 0) {
    const v = L * 255;
    return [v, v, v];
  }
  const q = L < 0.5 ? L * (1 + S) : L + S - L * S;
  const p = 2 * L - q;
  return [
    hue2rgb(p, q, H + 1 / 3) * 255,
    hue2rgb(p, q, H) * 255,
    hue2rgb(p, q, H - 1 / 3) * 255,
  ];
}

export function hexToHsl(hex: Hex): [number, number, number] {
  const [r, g, b] = hexToRgb(hex);
  return rgbToHsl(r, g, b);
}

export function hslToHex(h: number, s: number, l: number): Hex {
  const [r, g, b] = hslToRgb(h, s, l);
  return rgbToHex(r, g, b);
}

/* ───────────────────────── gradient ───────────────────────── */

/**
 * Pick a tasteful gradient pair from a single base colour.
 *
 * Strategy: the brighter the base, the more we darken the bottom end so
 * the result reads as a coherent "deepening" gradient; the darker the
 * base, the more we lift the top end so the result reads as "rising
 * dawn". For near-greys we drift hue by a hint so the gradient isn't
 * stripe-flat. The math intentionally lives in HSL: matching saturation
 * + slightly different lightness is what makes a gradient feel native
 * to its base hue. Returns `{ from, to }` ready to drop into a
 * `linear-gradient(to bottom, from, to)`.
 */
export function gradientFromBase(base: Hex): GradientShade {
  const cleaned = normalizeHex(base) ?? "#000000";
  const [h, s, l] = hexToHsl(cleaned);

  // Greyscale special case: derive a soft slate-style gradient instead of
  // two near-identical greys.
  if (s < 0.05) {
    if (l > 0.85) {
      return { from: "#ffffff", to: hslToHex(220, 0.08, 0.78) };
    }
    if (l < 0.18) {
      return { from: hslToHex(220, 0.08, 0.18), to: "#000000" };
    }
    return {
      from: hslToHex(220, 0.05, Math.min(1, l + 0.2)),
      to: hslToHex(220, 0.05, Math.max(0, l - 0.2)),
    };
  }

  // Coloured case. Pivot lightness around the base so the gradient stays
  // anchored to the colour the user picked instead of drifting toward
  // black/white. The spread shrinks for very-dark/very-light bases so
  // the result doesn't blow out to pure black/white.
  const spread = l > 0.85 || l < 0.15 ? 0.18 : 0.22;
  const topL = Math.min(0.95, l + spread);
  const bottomL = Math.max(0.18, l - spread);
  // Slightly bump saturation on the lighter end and pull it back on the
  // darker end — gives the gradient a hint of "fresh → settled".
  const topS = Math.min(1, s * 1.05);
  const bottomS = Math.max(0.2, s * 0.9);

  return {
    from: hslToHex(h, topS, topL),
    to: hslToHex(h, bottomS, bottomL),
  };
}
