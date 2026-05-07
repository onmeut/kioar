import { renderProfileIcon } from "@/lib/profile-icon-render";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  // PWA "any" icon: rounded square with avatar on the user's brand bg.
  // Used by the manifest for Android home-screen install. Different from
  // `/icon.png` and `/icon-512.png`, which are plain favicons (no chrome).
  return renderProfileIcon(slug, 512, "any");
}
