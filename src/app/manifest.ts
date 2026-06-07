import type { MetadataRoute } from "next";

import { siteConfig } from "@/lib/site";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/?source=pwa",
    name: "Kioar",
    short_name: "Kioar",
    description: siteConfig.description,
    lang: "fa-IR",
    dir: "rtl",
    start_url: "/?source=pwa",
    scope: "/",
    display: "standalone",
    display_override: ["standalone", "minimal-ui", "browser"],
    orientation: "portrait",
    // Splash screen on Android uses background_color + the largest
    // available `any` icon, centered. We want a fully brand-green
    // splash with the brand mark in the middle — so the background
    // matches the avatar SVG's green and the icon visually dissolves
    // into a single solid surface (no visible "box" around the K).
    // theme_color stays white so the in-app status bar remains white.
    background_color: "#1ED760",
    theme_color: "#ffffff",
    categories: ["business", "productivity", "social", "lifestyle"],
    prefer_related_applications: false,
    icons: [
      {
        src: "/icons/icon-72x72.png",
        sizes: "72x72",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-96x96.png",
        sizes: "96x96",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-128x128.png",
        sizes: "128x128",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-144x144.png",
        sizes: "144x144",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-152x152.png",
        sizes: "152x152",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-192x192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-384x384.png",
        sizes: "384x384",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512x512.png",
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
        url: "/me?source=pwa-shortcut",
        icons: [
          {
            src: "/icons/icon-192x192.png",
            sizes: "192x192",
            type: "image/png",
          },
        ],
      },
      {
        name: "لینک من",
        short_name: "صفحه",
        description: "مدیریت بلاک‌ها و پیش‌نمایش پروفایل",
        url: "/me?source=pwa-shortcut",
        icons: [
          {
            src: "/icons/icon-192x192.png",
            sizes: "192x192",
            type: "image/png",
          },
        ],
      },
      {
        name: "کشف صفحات",
        short_name: "صفحات",
        description: "ساخت و مدیریت صفحه‌های عمومی کی‌یو‌آر",
        url: "/me?source=pwa-shortcut-pages",
        icons: [
          {
            src: "/icons/icon-192x192.png",
            sizes: "192x192",
            type: "image/png",
          },
        ],
      },
      {
        name: "رویدادهای من",
        short_name: "رویدادها",
        description: "رویدادهای شرکت‌کرده و نمایش کد QR ورود",
        url: "/my-events?source=pwa-shortcut",
        icons: [
          {
            src: "/icons/icon-192x192.png",
            sizes: "192x192",
            type: "image/png",
          },
        ],
      },
    ],
    related_applications: [],
  } satisfies MetadataRoute.Manifest;
}
