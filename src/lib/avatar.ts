/**
 * Single source of truth for the deterministic fallback avatar used
 * everywhere a user has no uploaded picture.
 *
 * We use **DiceBear** (`@dicebear/core` + `@dicebear/bottts-neutral`).
 * Each profile gets a stable opaque `seed` (persisted on
 * `profiles.avatar_seed`) which deterministically picks the bot's
 * eyes, mouth, face, side, top, texture, **and background colour** —
 * so two users always get visually distinct bots and the same user
 * always gets the same one.
 *
 * This module is **isomorphic**: no Node-only deps, safe to import
 * from server components, client components, route handlers, and
 * `sharp`-based rasterizers alike. Server-only seed *generation* still
 * lives in `lib/avatar-seed.ts`.
 */
import { createAvatar } from "@dicebear/core";
import * as botttsNeutral from "@dicebear/bottts-neutral";

/** Default seed used when a profile has no `avatar_seed` (legacy NULLs). */
const DEFAULT_SEED = "kioar";

/**
 * Generate the SVG markup string for the deterministic Kioar fallback
 * avatar. Use either by passing to `dangerouslySetInnerHTML` (UI) or
 * to `sharp(Buffer.from(svg))` (server-side rasterisation).
 *
 * Background colour is part of the DiceBear seed output (default
 * palette) — no external colour is forced. The caller decides on
 * chrome (e.g. `rounded-full` wrapper).
 */
export function getKioarAvatarSvg(
  seed: string | null | undefined,
  options: { size?: number; radius?: number } = {},
): string {
  const { size = 80, radius = 0 } = options;
  return createAvatar(botttsNeutral, {
    seed: seed || DEFAULT_SEED,
    radius,
    size,
  }).toString();
}
