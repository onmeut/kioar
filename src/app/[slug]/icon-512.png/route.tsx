import { renderProfileIcon } from "@/lib/profile-icon-render";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  // High-DPI tab favicon: pure avatar, no chrome. Browsers downscale
  // for tabs; macOS Safari and some pinned-tab cases want a 512 PNG.
  return renderProfileIcon(slug, 512, "favicon");
}
