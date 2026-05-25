import { z } from "zod";

import type { PageAppearance } from "./types";

/**
 * Server-side validation for the appearance blob. Run before every write
 * — the client cannot be trusted, and a single bad row would crash the
 * public page renderer for that profile until manually fixed.
 *
 * Mirrors `PageAppearance` from `./types`. If you add a new field there,
 * add it here in the same commit.
 */

/**
 * Accept either a hex (`#fff`, `#ffffff`, `#ffffffff`), an `oklch(...)`
 * literal, an `rgb(...)`/`rgba(...)` literal, or one of our CSS token
 * variables (e.g. `var(--background)`). Anything else is rejected — we
 * never want a stray `javascript:` URL or `expression(...)` payload to
 * land in `style` attributes on the public page.
 */
const cssColor = z
  .string()
  .min(1)
  .max(128)
  .refine(
    (v) =>
      /^#([0-9a-fA-F]{3,8})$/.test(v) ||
      /^oklch\([^)]*\)$/i.test(v) ||
      /^rgba?\([^)]*\)$/i.test(v) ||
      /^var\(--[a-z0-9-]+\)$/i.test(v),
    "رنگ معتبر نیست.",
  );

/**
 * Image URLs come from our own uploader (S3 or local public/). We
 * additionally allow `https://` for safety in case a future feature
 * lets the user paste a remote URL.
 */
const imageUrl = z
  .string()
  .min(1)
  .max(2048)
  .refine(
    (v) => /^https?:\/\//i.test(v) || v.startsWith("/"),
    "نشانی تصویر معتبر نیست.",
  );

const themeId = z.enum([
  "light",
  "dark",
  "sand",
  "ocean",
  "forest",
  "rose",
  "slate",
  "mono",
  "ember",
  "sunlight",
  "tangerine",
  "orchid",
  "blossom",
  "cocoa",
]);

const wallpaperFill = z.object({
  type: z.literal("fill"),
  color: cssColor,
});

const wallpaperGradient = z.object({
  type: z.literal("gradient"),
  from: cssColor,
  to: cssColor,
  direction: z.enum(["linear-up", "linear-down", "radial"]),
  noise: z.boolean().optional(),
});

const wallpaperImage = z.object({
  type: z.literal("image"),
  imageUrl,
  effect: z.enum(["none", "mono", "blur", "halftone"]),
  tint: z.number().int().min(0).max(100),
});

const wallpaper = z.discriminatedUnion("type", [
  wallpaperFill,
  wallpaperGradient,
  wallpaperImage,
]);

export const pageAppearanceSchema = z.object({
  version: z.literal(1),
  theme: themeId,
  wallpaper,
}) satisfies z.ZodType<PageAppearance>;

export type PageAppearanceInput = z.infer<typeof pageAppearanceSchema>;
