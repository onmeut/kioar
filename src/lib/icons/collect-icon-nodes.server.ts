// Server helper: given a loaded public profile, find every icon the page will
// render that lives OUTSIDE the curated static bundle, and resolve its raw SVG
// nodes so the renderer can show it inline (see icon-nodes-context).
//
// Runs at render time, AFTER the profile cache — node arrays must never enter
// the cached Redis payload. Returns a small map (only icons actually used).

import type { IconNodeMap } from "@/lib/icons/icon-node";
import { getIconNodesMap } from "@/lib/icons/tabler-catalog.server";
import { TABLER_ICONS, tablerNameOf } from "@/lib/link-icons-tabler";

/** Pull the kebab name out of a `t:<name>` key IFF it's not in the curated
 * bundle (curated keys already render via a static component). */
function nonCuratedTablerName(iconKey: unknown): string | null {
  if (typeof iconKey !== "string") return null;
  const name = tablerNameOf(iconKey);
  if (!name) return null;
  if (name in TABLER_ICONS) return null;
  return name;
}

type WithIconKey = { iconKey?: string | null };
type ProfileLike = {
  links?: WithIconKey[];
  textBlocks?: WithIconKey[];
  productBlocks?: (WithIconKey & { sections?: WithIconKey[] })[];
};

/** Collect node arrays for all non-curated Tabler icons used on the page. */
export function resolveProfileIconNodes(profile: ProfileLike): IconNodeMap {
  const names = new Set<string>();

  const add = (entries?: WithIconKey[]) => {
    for (const e of entries ?? []) {
      const name = nonCuratedTablerName(e.iconKey);
      if (name) names.add(name);
    }
  };

  add(profile.links);
  add(profile.textBlocks);
  for (const block of profile.productBlocks ?? []) {
    const blockName = nonCuratedTablerName(block.iconKey);
    if (blockName) names.add(blockName);
    add(block.sections);
  }

  if (names.size === 0) return {};
  return getIconNodesMap(names);
}
