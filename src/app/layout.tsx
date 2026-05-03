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
    statusBarStyle: "black-translucent",
    title: siteConfig.name,
    startupImage: [{ url: "/icons/icon-512.png" }],
  },
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  other: {
    "mobile-web-app-capable": "yes",
    "apple-mobile-web-app-capable": "yes",
    "apple-mobile-web-app-status-bar-style": "black-translucent",
    "apple-mobile-web-app-title": siteConfig.shortName,
  },
  icons: {
    apple: "/apple-touch-icon.png",
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icons/icon-192.png", type: "image/png", sizes: "192x192" },
      { url: "/icons/icon-512.png", type: "image/png", sizes: "512x512" },
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
  themeColor: "#195c54",
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
