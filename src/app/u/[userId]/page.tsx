import { notFound, redirect } from "next/navigation";

import { getDb } from "@/db";
import { profiles } from "@/db/schema";
import { eq } from "drizzle-orm";

// Stable, immutable per-user URL printed on physical / NFC cards.
// `userId` is the user's UUID and never changes; this route resolves the
// user's CURRENT public profile slug at request time and 308-redirects there.
// If the user later changes their slug, every printed card / programmed NFC
// chip keeps working with no re-print needed.
export const dynamic = "force-dynamic";

export default async function ResolveUserShortUrl({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;

  // Cheap UUID shape check — avoids hammering the DB on garbage URLs.
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      userId,
    )
  ) {
    notFound();
  }

  const db = getDb();
  const profile = await db.query.profiles.findFirst({
    where: eq(profiles.userId, userId),
    columns: { slug: true },
  });

  if (!profile?.slug) {
    notFound();
  }

  redirect(`/${profile.slug}`);
}
