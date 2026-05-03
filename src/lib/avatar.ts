/**
 * Fixed colour palette used by every fallback avatar across the app.
 * Mirrors the brand: 3 weights of primary green + 2 black accents. The
 * `beam` variant produces the most identifiable shapes for ~80px circles.
 *
 * If you want the avatar to vary per-user you do NOT change the colours —
 * you change the `seed` (a.k.a. the `name` prop) which deterministically
 * picks shapes/positions inside this palette. The seed is generated once
 * per profile at creation and persisted on `profiles.avatar_seed`.
 *
 * This module is safe to import from BOTH server and client components —
 * it has no Node-only deps. Server-only helpers (e.g. seed generation)
 * live in `lib/avatar-seed.ts` instead.
 */
export const BORING_AVATAR_COLORS = [
  "#158867",
  "#158867",
  "#158867",
  "#000000",
  "#000000",
] as const;

export const BORING_AVATAR_VARIANT = "beam" as const;

/** Mutable shape required by the `boring-avatars` React component prop. */
export const BORING_AVATAR_COLORS_PROP: string[] = [...BORING_AVATAR_COLORS];
