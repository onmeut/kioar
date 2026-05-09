// Single source of truth for writing the per-block spotlight state
// (`spotlight` + `animation_style`) to any of the three block tables.
// Kept narrow on purpose so callers don't have to know the column shape.

import { and, eq } from "drizzle-orm";

import { getDb } from "@/db";
import {
  profileBookingBlocks,
  profileFormBlocks,
  profileLinks,
} from "@/db/schema";
import {
  type BlockAnimationStyle,
  type BlockSpotlight,
} from "@/lib/block-spotlight";
import { invalidateProfileCacheBySlug } from "@/lib/cache/profile-cache";
import { pageHasFeature } from "@/lib/entitlements";
import { resolveCurrentPageForOwner } from "@/lib/pages";

export type SpotlightBlockKind = "link" | "form" | "booking";

export type SpotlightWriteInput = {
  userId: string;
  blockKind: SpotlightBlockKind;
  blockId: string;
  spotlight: BlockSpotlight;
  animationStyle: BlockAnimationStyle | null;
};

type SaveResult = { ok: true } | { ok: false; message: string };

export async function setBlockSpotlightForUser(
  input: SpotlightWriteInput,
): Promise<SaveResult> {
  const profile = await resolveCurrentPageForOwner(input.userId);
  if (!profile) {
    return { ok: false, message: "پروفایل یافت نشد." };
  }

  // Plan gating — never trust client.
  if (input.spotlight === "pin") {
    if (!(await pageHasFeature(profile.id, "featured_links"))) {
      return { ok: false, message: "این قابلیت در پلن شما فعال نیست." };
    }
  } else if (input.spotlight === "animate") {
    if (!(await pageHasFeature(profile.id, "link_animations"))) {
      return { ok: false, message: "این قابلیت در پلن شما فعال نیست." };
    }
  }

  // Force animationStyle to null whenever spotlight !== 'animate' so the
  // DB never holds a stale style for a non-animate block.
  const animationStyle =
    input.spotlight === "animate" ? input.animationStyle : null;

  const db = getDb();
  switch (input.blockKind) {
    case "link":
      await db
        .update(profileLinks)
        .set({ spotlight: input.spotlight, animationStyle })
        .where(
          and(
            eq(profileLinks.id, input.blockId),
            eq(profileLinks.profileId, profile.id),
          ),
        );
      await invalidateProfileCacheBySlug(profile.slug);
      return { ok: true };
    case "form":
      await db
        .update(profileFormBlocks)
        .set({ spotlight: input.spotlight, animationStyle })
        .where(
          and(
            eq(profileFormBlocks.id, input.blockId),
            eq(profileFormBlocks.profileId, profile.id),
          ),
        );
      await invalidateProfileCacheBySlug(profile.slug);
      return { ok: true };
    case "booking":
      await db
        .update(profileBookingBlocks)
        .set({ spotlight: input.spotlight, animationStyle })
        .where(
          and(
            eq(profileBookingBlocks.id, input.blockId),
            eq(profileBookingBlocks.profileId, profile.id),
          ),
        );
      await invalidateProfileCacheBySlug(profile.slug);
      return { ok: true };
  }
}
