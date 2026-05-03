import type { MetadataRoute } from "next";
import { and, eq } from "drizzle-orm";

import { getDb } from "@/db";
import { events, profiles } from "@/db/schema";
import { profileShareUrl } from "@/lib/profile-domains";
import { getBaseUrl } from "@/lib/site";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const db = getDb();
  const base = getBaseUrl();

  const indexableProfiles = await db
    .select({
      slug: profiles.slug,
      domain: profiles.domain,
      updatedAt: profiles.updatedAt,
    })
    .from(profiles)
    .where(and(eq(profiles.isComplete, true), eq(profiles.indexEnabled, true)));

  const publishedEvents = await db
    .select({
      slug: events.slug,
      updatedAt: events.updatedAt,
    })
    .from(events)
    .where(eq(events.status, "published"));

  const staticEntries: MetadataRoute.Sitemap = [
    { url: `${base}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/events`, changeFrequency: "daily", priority: 0.7 },
  ];

  const profileEntries: MetadataRoute.Sitemap = indexableProfiles.map((p) => ({
    url: profileShareUrl(p.slug, p.domain),
    lastModified: p.updatedAt ?? undefined,
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  const eventEntries: MetadataRoute.Sitemap = publishedEvents.map((e) => ({
    url: `${base}/events/${e.slug}`,
    lastModified: e.updatedAt ?? undefined,
    changeFrequency: "weekly",
    priority: 0.6,
  }));

  return [...staticEntries, ...profileEntries, ...eventEntries];
}
