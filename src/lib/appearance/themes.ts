import type { PageThemeId } from "./types";

/**
 * Source of truth for every page theme. Every value is an `oklch()` token
 * so it composes cleanly with the rest of the shadcn `base-luma` style
 * system. Three downstream consumers read from this exact list:
 *
 *   1. `generatePageThemeCSS()` (below) — emits the static
 *      `[data-page-theme="…"]` blocks that go into `globals.css`.
 *   2. The `<ThemeCard />` swatch — picks the same tokens to render the
 *      preview chip so what the user sees is what they'll get.
 *   3. `<PageThemeProvider />` — applies `data-page-theme="…"` on the
 *      public page wrapper.
 *
 * Do NOT hardcode hex values in components. Add a new preset here and it
 * shows up everywhere it should.
 *
 * Accessibility note: every preset is hand-picked so foreground/background
 * pairs hit at least 4.5:1 contrast on body text. If you tweak chroma or
 * lightness, verify with a contrast checker before merging.
 */

export type ThemeCategory = "neutral" | "color";

export type ThemeTokens = {
  background: string;
  foreground: string;
  card: string;
  cardForeground: string;
  popover: string;
  popoverForeground: string;
  primary: string;
  primaryForeground: string;
  secondary: string;
  secondaryForeground: string;
  muted: string;
  mutedForeground: string;
  accent: string;
  accentForeground: string;
  border: string;
  input: string;
  ring: string;
};

export type ThemePreset = {
  id: PageThemeId;
  /** Persian display name shown in the editor. */
  nameFa: string;
  category: ThemeCategory;
  tokens: ThemeTokens;
};

/**
 * "light" intentionally mirrors the current public-page look so existing
 * pages — which never had `appearance` set — keep rendering identically
 * after this feature ships.
 */
const light: ThemePreset = {
  id: "light",
  nameFa: "روشن",
  category: "neutral",
  tokens: {
    background: "oklch(1 0 0)",
    foreground: "oklch(0.1822 0 0)",
    card: "oklch(1 0 0)",
    cardForeground: "oklch(0.1822 0 0)",
    popover: "oklch(1 0 0)",
    popoverForeground: "oklch(0.1822 0 0)",
    primary: "oklch(0.1822 0 0)",
    primaryForeground: "oklch(0.979 0.021 166.113)",
    secondary: "oklch(0.967 0.001 286.375)",
    secondaryForeground: "oklch(0.21 0.006 285.885)",
    muted: "oklch(0.97 0 0)",
    mutedForeground: "oklch(0.556 0 0)",
    accent: "oklch(0.97 0 0)",
    accentForeground: "oklch(0.205 0 0)",
    border: "oklch(0.922 0 0)",
    input: "oklch(0.922 0 0)",
    ring: "oklch(0.708 0 0)",
  },
};

/**
 * Dark theme.
 *
 * Background is `#0a0a0a` (≈ `oklch(0.145 0 0)`) — a true near-black that
 * matches the "مشکی" swatch in our suggested palette. The card sits one
 * step above at `#171717` so the surface is still visible on the bg
 * without reading as "soft grey".
 */
const dark: ThemePreset = {
  id: "dark",
  nameFa: "تاریک",
  category: "neutral",
  tokens: {
    background: "oklch(0.145 0 0)",
    foreground: "oklch(0.985 0 0)",
    card: "oklch(0.18 0 0)",
    cardForeground: "oklch(0.985 0 0)",
    popover: "oklch(0.18 0 0)",
    popoverForeground: "oklch(0.985 0 0)",
    primary: "oklch(0.985 0 0)",
    primaryForeground: "oklch(0.145 0 0)",
    secondary: "oklch(0.24 0 0)",
    secondaryForeground: "oklch(0.985 0 0)",
    muted: "oklch(0.22 0 0)",
    mutedForeground: "oklch(0.74 0 0)",
    accent: "oklch(0.24 0 0)",
    accentForeground: "oklch(0.985 0 0)",
    border: "oklch(1 0 0 / 10%)",
    input: "oklch(1 0 0 / 12%)",
    ring: "oklch(0.556 0 0)",
  },
};

const sand: ThemePreset = {
  id: "sand",
  nameFa: "ماسه",
  category: "color",
  tokens: {
    background: "oklch(0.972 0.024 86)",
    foreground: "oklch(0.265 0.038 60)",
    card: "oklch(0.985 0.018 86)",
    cardForeground: "oklch(0.265 0.038 60)",
    popover: "oklch(0.985 0.018 86)",
    popoverForeground: "oklch(0.265 0.038 60)",
    primary: "oklch(0.4 0.06 50)",
    primaryForeground: "oklch(0.985 0.018 86)",
    secondary: "oklch(0.93 0.032 86)",
    secondaryForeground: "oklch(0.3 0.04 50)",
    muted: "oklch(0.93 0.022 86)",
    mutedForeground: "oklch(0.5 0.03 60)",
    accent: "oklch(0.9 0.045 78)",
    accentForeground: "oklch(0.3 0.04 50)",
    border: "oklch(0.88 0.025 80)",
    input: "oklch(0.88 0.025 80)",
    ring: "oklch(0.7 0.045 70)",
  },
};

const ocean: ThemePreset = {
  id: "ocean",
  nameFa: "اقیانوس",
  category: "color",
  tokens: {
    background: "oklch(0.965 0.022 220)",
    foreground: "oklch(0.245 0.06 240)",
    card: "oklch(0.98 0.014 220)",
    cardForeground: "oklch(0.245 0.06 240)",
    popover: "oklch(0.98 0.014 220)",
    popoverForeground: "oklch(0.245 0.06 240)",
    primary: "oklch(0.46 0.13 235)",
    primaryForeground: "oklch(0.98 0.014 220)",
    secondary: "oklch(0.91 0.04 220)",
    secondaryForeground: "oklch(0.3 0.08 235)",
    muted: "oklch(0.93 0.022 220)",
    mutedForeground: "oklch(0.48 0.05 235)",
    accent: "oklch(0.88 0.07 210)",
    accentForeground: "oklch(0.3 0.08 235)",
    border: "oklch(0.86 0.03 220)",
    input: "oklch(0.86 0.03 220)",
    ring: "oklch(0.62 0.1 230)",
  },
};

const forest: ThemePreset = {
  id: "forest",
  nameFa: "جنگل",
  category: "color",
  tokens: {
    background: "oklch(0.965 0.022 145)",
    foreground: "oklch(0.23 0.05 150)",
    card: "oklch(0.98 0.014 145)",
    cardForeground: "oklch(0.23 0.05 150)",
    popover: "oklch(0.98 0.014 145)",
    popoverForeground: "oklch(0.23 0.05 150)",
    primary: "oklch(0.42 0.1 155)",
    primaryForeground: "oklch(0.98 0.014 145)",
    secondary: "oklch(0.91 0.04 145)",
    secondaryForeground: "oklch(0.28 0.06 150)",
    muted: "oklch(0.93 0.022 145)",
    mutedForeground: "oklch(0.46 0.05 150)",
    accent: "oklch(0.88 0.07 140)",
    accentForeground: "oklch(0.28 0.06 150)",
    border: "oklch(0.86 0.03 145)",
    input: "oklch(0.86 0.03 145)",
    ring: "oklch(0.58 0.09 150)",
  },
};

const rose: ThemePreset = {
  id: "rose",
  nameFa: "گل‌رز",
  category: "color",
  tokens: {
    background: "oklch(0.968 0.022 20)",
    foreground: "oklch(0.25 0.055 15)",
    card: "oklch(0.98 0.014 20)",
    cardForeground: "oklch(0.25 0.055 15)",
    popover: "oklch(0.98 0.014 20)",
    popoverForeground: "oklch(0.25 0.055 15)",
    primary: "oklch(0.48 0.16 15)",
    primaryForeground: "oklch(0.98 0.014 20)",
    secondary: "oklch(0.91 0.04 20)",
    secondaryForeground: "oklch(0.3 0.07 15)",
    muted: "oklch(0.93 0.022 20)",
    mutedForeground: "oklch(0.48 0.05 15)",
    accent: "oklch(0.88 0.07 15)",
    accentForeground: "oklch(0.3 0.07 15)",
    border: "oklch(0.86 0.03 20)",
    input: "oklch(0.86 0.03 20)",
    ring: "oklch(0.62 0.12 15)",
  },
};

const slate: ThemePreset = {
  id: "slate",
  nameFa: "سنگ‌آبی",
  category: "color",
  tokens: {
    background: "oklch(0.96 0.005 250)",
    foreground: "oklch(0.22 0.018 255)",
    card: "oklch(0.98 0.004 250)",
    cardForeground: "oklch(0.22 0.018 255)",
    popover: "oklch(0.98 0.004 250)",
    popoverForeground: "oklch(0.22 0.018 255)",
    primary: "oklch(0.28 0.02 255)",
    primaryForeground: "oklch(0.98 0.004 250)",
    secondary: "oklch(0.9 0.01 250)",
    secondaryForeground: "oklch(0.26 0.02 255)",
    muted: "oklch(0.92 0.008 250)",
    mutedForeground: "oklch(0.48 0.015 255)",
    accent: "oklch(0.88 0.015 250)",
    accentForeground: "oklch(0.26 0.02 255)",
    border: "oklch(0.86 0.01 250)",
    input: "oklch(0.86 0.01 250)",
    ring: "oklch(0.56 0.02 255)",
  },
};

const mono: ThemePreset = {
  id: "mono",
  nameFa: "تک‌رنگ",
  category: "color",
  tokens: {
    background: "oklch(0.98 0 0)",
    foreground: "oklch(0.12 0 0)",
    card: "oklch(1 0 0)",
    cardForeground: "oklch(0.12 0 0)",
    popover: "oklch(1 0 0)",
    popoverForeground: "oklch(0.12 0 0)",
    primary: "oklch(0.12 0 0)",
    primaryForeground: "oklch(0.98 0 0)",
    secondary: "oklch(0.9 0 0)",
    secondaryForeground: "oklch(0.18 0 0)",
    muted: "oklch(0.94 0 0)",
    mutedForeground: "oklch(0.4 0 0)",
    accent: "oklch(0.9 0 0)",
    accentForeground: "oklch(0.18 0 0)",
    border: "oklch(0.84 0 0)",
    input: "oklch(0.84 0 0)",
    ring: "oklch(0.4 0 0)",
  },
};

/** Red — "آتش" (fire). */
const ember: ThemePreset = {
  id: "ember",
  nameFa: "آتش",
  category: "color",
  tokens: {
    background: "oklch(0.968 0.022 28)",
    foreground: "oklch(0.25 0.07 25)",
    card: "oklch(0.985 0.014 28)",
    cardForeground: "oklch(0.25 0.07 25)",
    popover: "oklch(0.985 0.014 28)",
    popoverForeground: "oklch(0.25 0.07 25)",
    primary: "oklch(0.48 0.18 27)",
    primaryForeground: "oklch(0.985 0.014 28)",
    secondary: "oklch(0.91 0.04 28)",
    secondaryForeground: "oklch(0.3 0.08 25)",
    muted: "oklch(0.93 0.022 28)",
    mutedForeground: "oklch(0.48 0.06 25)",
    accent: "oklch(0.88 0.08 25)",
    accentForeground: "oklch(0.3 0.08 25)",
    border: "oklch(0.86 0.03 28)",
    input: "oklch(0.86 0.03 28)",
    ring: "oklch(0.62 0.14 25)",
  },
};

/** Yellow — "آفتاب" (sunshine). */
const sunlight: ThemePreset = {
  id: "sunlight",
  nameFa: "آفتاب",
  category: "color",
  tokens: {
    background: "oklch(0.978 0.04 95)",
    foreground: "oklch(0.27 0.06 70)",
    card: "oklch(0.99 0.02 95)",
    cardForeground: "oklch(0.27 0.06 70)",
    popover: "oklch(0.99 0.02 95)",
    popoverForeground: "oklch(0.27 0.06 70)",
    primary: "oklch(0.5 0.12 80)",
    primaryForeground: "oklch(0.99 0.02 95)",
    secondary: "oklch(0.93 0.06 95)",
    secondaryForeground: "oklch(0.3 0.06 70)",
    muted: "oklch(0.94 0.03 95)",
    mutedForeground: "oklch(0.5 0.05 70)",
    accent: "oklch(0.9 0.09 95)",
    accentForeground: "oklch(0.3 0.06 70)",
    border: "oklch(0.88 0.04 95)",
    input: "oklch(0.88 0.04 95)",
    ring: "oklch(0.7 0.1 85)",
  },
};

/** Orange — "نارنج" (bitter orange / blossom). */
const tangerine: ThemePreset = {
  id: "tangerine",
  nameFa: "نارنج",
  category: "color",
  tokens: {
    background: "oklch(0.97 0.03 60)",
    foreground: "oklch(0.27 0.07 45)",
    card: "oklch(0.985 0.018 60)",
    cardForeground: "oklch(0.27 0.07 45)",
    popover: "oklch(0.985 0.018 60)",
    popoverForeground: "oklch(0.27 0.07 45)",
    primary: "oklch(0.55 0.16 55)",
    primaryForeground: "oklch(0.985 0.018 60)",
    secondary: "oklch(0.91 0.05 60)",
    secondaryForeground: "oklch(0.3 0.08 45)",
    muted: "oklch(0.93 0.03 60)",
    mutedForeground: "oklch(0.48 0.06 45)",
    accent: "oklch(0.88 0.09 55)",
    accentForeground: "oklch(0.3 0.08 45)",
    border: "oklch(0.86 0.04 60)",
    input: "oklch(0.86 0.04 60)",
    ring: "oklch(0.65 0.14 55)",
  },
};

/** Purple — "ارغوان" (royal purple). */
const orchid: ThemePreset = {
  id: "orchid",
  nameFa: "ارغوان",
  category: "color",
  tokens: {
    background: "oklch(0.965 0.025 310)",
    foreground: "oklch(0.25 0.07 305)",
    card: "oklch(0.98 0.016 310)",
    cardForeground: "oklch(0.25 0.07 305)",
    popover: "oklch(0.98 0.016 310)",
    popoverForeground: "oklch(0.25 0.07 305)",
    primary: "oklch(0.45 0.18 305)",
    primaryForeground: "oklch(0.98 0.016 310)",
    secondary: "oklch(0.91 0.04 310)",
    secondaryForeground: "oklch(0.3 0.08 305)",
    muted: "oklch(0.93 0.025 310)",
    mutedForeground: "oklch(0.48 0.06 305)",
    accent: "oklch(0.88 0.08 305)",
    accentForeground: "oklch(0.3 0.08 305)",
    border: "oklch(0.86 0.03 310)",
    input: "oklch(0.86 0.03 310)",
    ring: "oklch(0.62 0.14 305)",
  },
};

/** Pink — "شکوفه" (cherry blossom). */
const blossom: ThemePreset = {
  id: "blossom",
  nameFa: "شکوفه",
  category: "color",
  tokens: {
    background: "oklch(0.97 0.025 350)",
    foreground: "oklch(0.27 0.07 350)",
    card: "oklch(0.985 0.015 350)",
    cardForeground: "oklch(0.27 0.07 350)",
    popover: "oklch(0.985 0.015 350)",
    popoverForeground: "oklch(0.27 0.07 350)",
    primary: "oklch(0.55 0.18 350)",
    primaryForeground: "oklch(0.985 0.015 350)",
    secondary: "oklch(0.92 0.04 350)",
    secondaryForeground: "oklch(0.3 0.08 350)",
    muted: "oklch(0.93 0.025 350)",
    mutedForeground: "oklch(0.5 0.06 350)",
    accent: "oklch(0.88 0.08 350)",
    accentForeground: "oklch(0.3 0.08 350)",
    border: "oklch(0.86 0.03 350)",
    input: "oklch(0.86 0.03 350)",
    ring: "oklch(0.65 0.14 350)",
  },
};

/** Brown — "شکلات" (chocolate). */
const cocoa: ThemePreset = {
  id: "cocoa",
  nameFa: "شکلات",
  category: "color",
  tokens: {
    background: "oklch(0.96 0.018 60)",
    foreground: "oklch(0.25 0.04 50)",
    card: "oklch(0.98 0.012 60)",
    cardForeground: "oklch(0.25 0.04 50)",
    popover: "oklch(0.98 0.012 60)",
    popoverForeground: "oklch(0.25 0.04 50)",
    primary: "oklch(0.38 0.06 50)",
    primaryForeground: "oklch(0.98 0.012 60)",
    secondary: "oklch(0.9 0.025 60)",
    secondaryForeground: "oklch(0.3 0.04 50)",
    muted: "oklch(0.92 0.02 60)",
    mutedForeground: "oklch(0.48 0.03 50)",
    accent: "oklch(0.88 0.045 60)",
    accentForeground: "oklch(0.3 0.04 50)",
    border: "oklch(0.84 0.025 60)",
    input: "oklch(0.84 0.025 60)",
    ring: "oklch(0.58 0.05 50)",
  },
};

export const PAGE_THEMES: ThemePreset[] = [
  light,
  dark,
  ember,
  tangerine,
  sunlight,
  forest,
  ocean,
  orchid,
  blossom,
  cocoa,
  sand,
  rose,
  slate,
  mono,
];

const THEME_INDEX: Record<PageThemeId, ThemePreset> = {
  light,
  dark,
  sand,
  ocean,
  forest,
  rose,
  slate,
  mono,
  ember,
  sunlight,
  tangerine,
  orchid,
  blossom,
  cocoa,
};

export function getTheme(id: PageThemeId): ThemePreset {
  return THEME_INDEX[id] ?? light;
}

/**
 * Render the tokens object to the inline `style` value used to scope a
 * page theme to a wrapper element. Used both server-side (SSR) by
 * `<PageThemeProvider />` and client-side by the live preview.
 *
 * This sets the same custom properties the shadcn `:root` block sets, so
 * any descendant that uses `bg-background`, `text-foreground`, etc. picks
 * up the theme automatically — no component refactor required.
 */
export function themeToCssVars(
  id: PageThemeId,
): Record<string, string> {
  const t = getTheme(id).tokens;
  return {
    "--background": t.background,
    "--foreground": t.foreground,
    "--card": t.card,
    "--card-foreground": t.cardForeground,
    "--popover": t.popover,
    "--popover-foreground": t.popoverForeground,
    "--primary": t.primary,
    "--primary-foreground": t.primaryForeground,
    "--secondary": t.secondary,
    "--secondary-foreground": t.secondaryForeground,
    "--muted": t.muted,
    "--muted-foreground": t.mutedForeground,
    "--accent": t.accent,
    "--accent-foreground": t.accentForeground,
    "--border": t.border,
    "--input": t.input,
    "--ring": t.ring,
  };
}
