import type { MetadataRoute } from "next";

import { siteConfig } from "@/lib/site";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/?source=pwa",
    name: siteConfig.name,
    short_name: siteConfig.shortName,
    description: siteConfig.description,
    lang: "fa-IR",
    dir: "rtl",
    start_url: "/?source=pwa",
    scope: "/",
    display: "standalone",
    display_override: ["standalone", "minimal-ui", "browser"],
    orientation: "portrait",
    background_color: "#f7f4ee",
    theme_color: "#195c54",
    categories: ["business", "productivity", "social", "lifestyle"],
    prefer_related_applications: false,
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      {
        name: "داشبورد من",
        short_name: "داشبورد",
        description: "دسترسی سریع به پروفایل و کارت دیجیتال",
        url: "/dashboard?source=pwa-shortcut",
        icons: [
          { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
        ],
      },
      {
        name: "صفحه‌ی من",
        short_name: "صفحه",
        description: "مدیریت بلاک‌ها و پیش‌نمایش پروفایل",
        url: "/page?source=pwa-shortcut",
        icons: [
          { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
        ],
      },
      {
        name: "رویدادها",
        short_name: "رویدادها",
        description: "مرور و ثبت‌نام در رویدادهای کی‌یو‌آر",
        url: "/events?source=pwa-shortcut",
        icons: [
          { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
        ],
      },
      {
        name: "کارت هوشمند",
        short_name: "کارت هوشمند",
        description: "کارت هوشمند فیزیکی یا NFC",
        url: "/premium?source=pwa-shortcut",
        icons: [
          { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
        ],
      },
    ],
    related_applications: [],
  } satisfies MetadataRoute.Manifest;
}
