// Full Tabler catalog search for the icon picker's "search all icons" mode.
//
// The curated icon set ships as static React components (fast, in-bundle). The
// full 5039-icon catalog lives only on the server as raw SVG path data; this
// route is how the editor reaches it on demand. Results carry their node
// arrays so the picker renders matches inline (TablerNodeIcon) without
// importing any icon components.
//
// Gated behind auth (editor-only feature) and lightly rate-limited so the
// search-as-you-type traffic can't be abused.

import { NextResponse } from "next/server";

import { requireUser } from "@/lib/auth/session";
import { searchIcons } from "@/lib/icons/tabler-catalog.server";
import { checkRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const viewer = await requireUser();

  const limited = await checkRateLimit(
    `icons:search:${viewer.user.id}`,
    60,
    60,
  );
  if (!limited.allowed) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() ?? "";
  const category = searchParams.get("category")?.trim() || undefined;

  // Require either a query or a category — never dump the whole catalog.
  if (!q && !category) {
    return NextResponse.json({ icons: [] });
  }

  const results = searchIcons(q, { category, limit: 120 });
  return NextResponse.json({
    icons: results.map((r) => ({
      key: `t:${r.name}`,
      name: r.name,
      label: r.name.replace(/-/g, " "),
      category: r.category,
      nodes: r.nodes,
    })),
  });
}
