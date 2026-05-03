import { renderProfileIcon } from "@/lib/profile-icon-render";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  return renderProfileIcon(slug, 192, "any");
}
