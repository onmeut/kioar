import type { Metadata, Viewport } from "next";

import { AppProviders } from "@/components/app/providers";
import { absoluteUrl, siteConfig } from "@/lib/site";

import "./globals.css";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  metadataBase: new URL(absoluteUrl("/")),
  applicationName: siteConfig.name,
  title: {
    default: `${siteConfig.name} | هویت دیجیتالِ تو`,
    template: `%s | ${siteConfig.name}`,
  },
  description: siteConfig.description,
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Kioar",
    // Per-device splash screens (physical px PNGs, matched by CSS-px media query).
    // Regenerate with: npm run generate:splash
    startupImage: [
      // ── iPhones ────────────────────────────────────────────────────────────
      {
        url: "/splashscreens/iphone-16-pro-max.png",
        media:
          "(device-width: 440px) and (device-height: 956px) and (-webkit-device-pixel-ratio: 3)",
      },
      {
        url: "/splashscreens/iphone-16.png",
        media:
          "(device-width: 430px) and (device-height: 932px) and (-webkit-device-pixel-ratio: 3)",
      },
      {
        url: "/splashscreens/iphone-15-pro.png",
        media:
          "(device-width: 393px) and (device-height: 852px) and (-webkit-device-pixel-ratio: 3)",
      },
      {
        url: "/splashscreens/iphone-14-pro-max.png",
        media:
          "(device-width: 428px) and (device-height: 926px) and (-webkit-device-pixel-ratio: 3)",
      },
      {
        url: "/splashscreens/iphone-13.png",
        media:
          "(device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3)",
      },
      {
        url: "/splashscreens/iphone-se.png",
        media:
          "(device-width: 375px) and (device-height: 667px) and (-webkit-device-pixel-ratio: 2)",
      },
      // ── iPads ──────────────────────────────────────────────────────────────
      {
        url: "/splashscreens/ipad-pro-12.png",
        media:
          "(device-width: 1024px) and (device-height: 1366px) and (-webkit-device-pixel-ratio: 2)",
      },
      {
        url: "/splashscreens/ipad-pro-11.png",
        media:
          "(device-width: 834px) and (device-height: 1194px) and (-webkit-device-pixel-ratio: 2)",
      },
      {
        url: "/splashscreens/ipad-air.png",
        media:
          "(device-width: 820px) and (device-height: 1180px) and (-webkit-device-pixel-ratio: 2)",
      },
      {
        url: "/splashscreens/ipad-mini.png",
        media:
          "(device-width: 744px) and (device-height: 1133px) and (-webkit-device-pixel-ratio: 2)",
      },
    ],
  },
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  other: {
    "mobile-web-app-capable": "yes",
    "apple-mobile-web-app-capable": "yes",
    "apple-mobile-web-app-status-bar-style": "default",
    "apple-mobile-web-app-title": "Kioar",
    "msapplication-config": "/browserconfig.xml",
    "msapplication-TileColor": "#1ED760",
    "msapplication-TileImage": "/icons/mstile-150x150.png",
  },
  // favicon.ico, icon.png (512), apple-icon.png (180), opengraph-image.png
  // are handled via Next.js file conventions in src/app/ — they get content-
  // hashed at build time and served with immutable Cache-Control headers.
  // Only declare the supplemental sizes that file conventions don't cover.
  icons: {
    icon: [
      { url: "/favicon-16x16.png", type: "image/png", sizes: "16x16" },
      { url: "/favicon-32x32.png", type: "image/png", sizes: "32x32" },
      { url: "/icons/icon-192x192.png", type: "image/png", sizes: "192x192" },
    ],
    apple: [
      { url: "/icons/apple-touch-icon-120x120.png", sizes: "120x120" },
      { url: "/icons/apple-touch-icon-152x152.png", sizes: "152x152" },
      { url: "/icons/apple-touch-icon-167x167.png", sizes: "167x167" },
      { url: "/icons/apple-touch-icon-180x180.png", sizes: "180x180" },
    ],
    other: [
      { rel: "mask-icon", url: "/brand/brand-avatar.svg", color: "#1ED760" },
    ],
  },
  openGraph: {
    title: `${siteConfig.name} | هویت دیجیتالِ تو`,
    description: siteConfig.description,
    type: "website",
    url: absoluteUrl("/"),
    siteName: siteConfig.name,
    locale: "fa_IR",
  },
  twitter: {
    card: "summary_large_image",
    title: `${siteConfig.name} | هویت دیجیتالِ تو`,
    description: siteConfig.description,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  minimumScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
  themeColor: "#ffffff",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="fa"
      dir="rtl"
      suppressHydrationWarning
      data-scroll-behavior="smooth"
      className={cn("h-full scroll-smooth")}
    >
      <body className="min-h-dvh bg-background font-sans text-foreground antialiased overscroll-y-none [-webkit-tap-highlight-color:transparent]">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
