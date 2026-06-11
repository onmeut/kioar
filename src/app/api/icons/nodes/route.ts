// Batch node lookup for the editor: given a list of `t:<name>` icon keys,
// returns their raw SVG path nodes so the editor can render saved non-curated
// icons without re-querying the search endpoint.
//
// POST body: { keys: string[] }   (e.g. ["t:blender", "t:avocado"])
// Response:  { nodes: Record<string, IconNode[]> }  (kebab name → nodes)

import { NextResponse } from "next/server";

import { requireUser } from "@/lib/auth/session";
import { getIconNodesMap } from "@/lib/icons/tabler-catalog.server";
import { TABLER_ICONS, tablerNameOf } from "@/lib/link-icons-tabler";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  await requireUser();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ nodes: {} });
  }

  if (!body || typeof body !== "object" || !Array.isArray((body as { keys?: unknown }).keys)) {
    return NextResponse.json({ nodes: {} });
  }

  const keys = (body as { keys: unknown[] }).keys;
  const names = new Set<string>();
  for (const k of keys) {
    if (typeof k !== "string") continue;
    const name = tablerNameOf(k);
    // Only look up non-curated icons — curated ones render via static components.
    if (name && !(name in TABLER_ICONS)) names.add(name);
  }

  if (names.size === 0) return NextResponse.json({ nodes: {} });

  const result = getIconNodesMap(names);
  return NextResponse.json({ nodes: result });
}
