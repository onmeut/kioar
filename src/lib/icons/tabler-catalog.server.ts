// Server-only access to the FULL Tabler icon catalog (5039 icons).
//
// Why this exists: the link/menu icon picker ships a small CURATED set of
// Tabler icons as static React components (see link-icons-tabler.tsx) so the
// public profile page and editor stay light. This module is the other half —
// it exposes the *entire* catalog as raw SVG path data (no React components,
// no 1 MB client bundle) for two on-demand uses:
//
//   1. The picker's "search all icons" mode (via /api/icons/search).
//   2. Rendering a SAVED icon that the owner picked from the full set but that
//      isn't in the curated bundle — the public loader embeds just the node
//      arrays for icons actually used on the page.
//
// The 2 MB nodes JSON and the metadata JSON are read from disk once and cached
// in module scope. They never enter any client bundle: this file is
// `.server.ts`, reads via fs at runtime (not a static import the bundler would
// inline), and only ever returns plain arrays/strings.

import { readFileSync } from "node:fs";
import path from "node:path";

import type { IconNode } from "@/lib/icons/icon-node";

export type { IconNode };

type RawNodesFile = Record<string, IconNode[]>;
type RawIconMeta = {
  name: string;
  category?: string;
  tags?: (string | number)[];
};
type RawIconsFile = Record<string, RawIconMeta>;

function pkgFile(rel: string): string {
  // Read straight from node_modules under the project root. We avoid
  // `require.resolve("@tabler/icons/...")` because the package's `exports`
  // map (`./*`) doesn't expose package.json and webpack tries to bundle the
  // resolution. A plain cwd-relative path keeps this a pure runtime fs read
  // (same pattern as src/lib/storage.ts) with nothing for the bundler to trace.
  return path.join(process.cwd(), "node_modules", "@tabler", "icons", rel);
}

let nodesCache: RawNodesFile | null = null;
let metaCache: RawIconsFile | null = null;

function nodes(): RawNodesFile {
  if (!nodesCache) {
    nodesCache = JSON.parse(
      readFileSync(pkgFile("tabler-nodes-outline.json"), "utf8"),
    ) as RawNodesFile;
  }
  return nodesCache;
}

function meta(): RawIconsFile {
  if (!metaCache) {
    metaCache = JSON.parse(
      readFileSync(pkgFile("icons.json"), "utf8"),
    ) as RawIconsFile;
  }
  return metaCache;
}

/** Path-node array for one kebab-case icon name (e.g. "avocado"), or null. */
export function getIconNodes(name: string): IconNode[] | null {
  return nodes()[name] ?? null;
}

/** Resolve node arrays for many names at once (used by the public loader to
 * embed only the icons actually rendered on a page). Unknown names are
 * skipped. */
export function getIconNodesMap(names: Iterable<string>): Record<string, IconNode[]> {
  const all = nodes();
  const out: Record<string, IconNode[]> = {};
  for (const name of names) {
    const n = all[name];
    if (n) out[name] = n;
  }
  return out;
}

export type IconSearchResult = {
  /** kebab-case Tabler name, e.g. "avocado". */
  name: string;
  /** Native Tabler category, e.g. "Food". */
  category: string;
  /** SVG path nodes for inline rendering. */
  nodes: IconNode[];
};

/**
 * Search the full catalog by name + tags (and optionally restrict to a native
 * category). Returns up to `limit` results with their node arrays attached so
 * the picker can render them inline without a second round-trip.
 */
export function searchIcons(
  query: string,
  opts: { category?: string; limit?: number } = {},
): IconSearchResult[] {
  const limit = opts.limit ?? 120;
  const q = query.trim().toLowerCase().replace(/\s+/g, "-");
  const all = nodes();
  const m = meta();
  const wantCategory = opts.category?.trim() || null;

  const results: IconSearchResult[] = [];
  for (const [name, info] of Object.entries(m)) {
    if (wantCategory && info.category !== wantCategory) continue;

    if (q) {
      const inName =
        name.includes(q) || name.replace(/-/g, "").includes(q.replace(/-/g, ""));
      const inTags =
        !inName &&
        (info.tags ?? []).some((t) => String(t).toLowerCase().includes(q));
      if (!inName && !inTags) continue;
    }

    const node = all[name];
    if (!node) continue;
    results.push({ name, category: info.category ?? "", nodes: node });
    if (results.length >= limit) break;
  }
  return results;
}

/** Distinct native categories present in the catalog (sorted). */
export function listCategories(): string[] {
  const set = new Set<string>();
  for (const info of Object.values(meta())) {
    if (info.category) set.add(info.category);
  }
  return [...set].sort();
}
