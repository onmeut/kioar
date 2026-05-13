import type { MetadataRoute } from "next";

import { getBaseUrl } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  const base = getBaseUrl();
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/auth",
          "/auth/",
          "/admin",
          "/admin/",
          "/insights",
          "/insights/",
          "/page",
          "/page/",
          "/onboarding",
          "/onboarding/",
          "/bookings",
          "/bookings/",
          "/forms",
          "/forms/",
          "/requests",
          "/requests/",
          "/my-events",
          "/my-events/",
        ],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
