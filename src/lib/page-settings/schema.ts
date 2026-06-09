import { z } from "zod";

import type { PageSettings } from "./types";

/**
 * Server-side validation for the `settings` blob. Run before EVERY write —
 * the client cannot be trusted, and an unvalidated jsonb write has no
 * DB-level constraint to catch a malformed payload.
 *
 * Mirrors `PageSettings` from `./types`. When you add a new key there, add
 * its validator here in the same commit.
 *
 * `.strip()` (the Zod default) drops unknown keys rather than rejecting the
 * write, so a client running against a slightly newer/older deploy can't
 * poison the blob with extra properties — they're simply discarded. We do
 * NOT use `.passthrough()`: only keys this version understands are persisted.
 */
export const pageSettingsSchema = z.object({
  version: z.literal(1),
  // ---- per-key validators go here --------------------------------------
  // e.g. hideBranding: z.boolean().optional(),
}) satisfies z.ZodType<PageSettings>;

export type PageSettingsInput = z.infer<typeof pageSettingsSchema>;
