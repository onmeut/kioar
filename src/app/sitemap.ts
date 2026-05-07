import type { MetadataRoute } from "next";
import { and, eq } from "drizzle-orm";

import { getDb } from "@/db";
import { events, profiles } from "@/db/schema";
import { profileShareUrl } from "@/lib/profile-domains";
import { getBaseUrl } from "@/lib/site";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = getBaseUrl();

  const staticEntries: MetadataRoute.Sitemap = [
    { url: `${base}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/events`, changeFrequency: "daily", priority: 0.7 },
  ];

  // DATABASE_URL may not be available at build time (Docker build stage).
  // Return only static entries in that case; the full sitemap is served at runtime.
  if (!process.env.DATABASE_URL) {
    return staticEntries;
  }

  try {
    const db = getDb();

    const [indexableProfiles, publishedEvents] = await Promise.all([
      db
        .select({
          slug: profiles.slug,
          domain: profiles.domain,
          updatedAt: profiles.updatedAt,
        })
        .from(profiles)
        .where(
          and(eq(profiles.isComplete, true), eq(profiles.indexEnabled, true)),
        ),
      db
        .select({
          slug: events.slug,
          updatedAt: events.updatedAt,
        })
        .from(events)
        .where(eq(events.status, "published")),
    ]);

    const profileEntries: MetadataRoute.Sitemap = indexableProfiles.map(
      (p) => ({
        url: profileShareUrl(p.slug, p.domain),
        lastModified: p.updatedAt ?? undefined,
        changeFrequency: "weekly",
        priority: 0.8,
      }),
    );

    const eventEntries: MetadataRoute.Sitemap = publishedEvents.map((e) => ({
      url: `${base}/events/${e.slug}`,
      lastModified: e.updatedAt ?? undefined,
      changeFrequency: "weekly",
      priority: 0.6,
    }));

    return [...staticEntries, ...profileEntries, ...eventEntries];
  } catch {
    // DB unavailable — return static entries only.
    return staticEntries;
  }
}
