import withPWA from "@ducanh2912/next-pwa";
import type { NextConfig } from "next";

// Derive the S3 host we'll serve images from, so the <Image> optimizer only
// proxies trusted origins. Previously we allowed `**` which made /_next/image
// an open proxy — any attacker could pipe http://169.254.169.254/latest/... or
// any site on the internet through our bandwidth.
function parseOrigin(
  raw: string | undefined,
): { protocol: "http" | "https"; hostname: string; port?: string } | null {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return {
      protocol: url.protocol.replace(":", "") as "http" | "https",
      hostname: url.hostname,
      port: url.port || undefined,
    };
  } catch {
    return null;
  }
}

const s3PublicBase = parseOrigin(process.env.S3_PUBLIC_URL_BASE);
const s3Endpoint = parseOrigin(process.env.S3_ENDPOINT);
const s3Bucket = process.env.S3_BUCKET?.trim();

const remotePatterns: NonNullable<
  NonNullable<NextConfig["images"]>["remotePatterns"]
> = [
  // Vercel Blob fallback (only active if you actually use it).
  { protocol: "https", hostname: "**.public.blob.vercel-storage.com" },
];

if (s3PublicBase) {
  remotePatterns.push({
    protocol: s3PublicBase.protocol,
    hostname: s3PublicBase.hostname,
    port: s3PublicBase.port,
  });
}

if (s3Endpoint) {
  // path-style: https://endpoint/bucket/key
  remotePatterns.push({
    protocol: s3Endpoint.protocol,
    hostname: s3Endpoint.hostname,
    port: s3Endpoint.port,
    pathname: s3Bucket ? `/${s3Bucket}/**` : undefined,
  });
  // virtual-host style: https://bucket.endpoint/key
  if (s3Bucket) {
    remotePatterns.push({
      protocol: s3Endpoint.protocol,
      hostname: `${s3Bucket}.${s3Endpoint.hostname}`,
      port: s3Endpoint.port,
    });
  }
}

// Security headers applied to every response.
// We do NOT enable a strict `script-src` CSP because Next's RSC payload inlines
// scripts without nonces; doing so would require a nonce propagated through
// every server component. We DO lock down frame-ancestors, object-src, and
// base-uri which close clickjacking and base-tag hijacks.
const isDev = process.env.NODE_ENV !== "production";

// Next.js dev server uses `eval()` for HMR. Without 'unsafe-eval' in dev,
// every client bundle is blocked and the entire app becomes non-interactive.
// Production CSP stays strict (no unsafe-eval).
const scriptSrc = isDev
  ? "script-src 'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval'"
  : "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'";

// Dev HMR uses a websocket; prod does not need ws:/wss:.
// `blob:` is required because some libraries (e.g. react-mobile-cropper) load
// user-picked files by `fetch()`-ing the `URL.createObjectURL(file)` blob URL,
// which the browser counts against connect-src — not img-src.
const connectSrc = isDev
  ? "connect-src 'self' blob: ws: wss:"
  : "connect-src 'self' blob:";

const securityHeaders: { key: string; value: string }[] = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value:
      "camera=(), microphone=(), geolocation=(), browsing-topics=(), interest-cohort=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=15552000; includeSubDomains",
  },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "base-uri 'self'",
      "object-src 'none'",
      "frame-ancestors 'none'",
      "form-action 'self'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      "style-src 'self' 'unsafe-inline'",
      scriptSrc,
      connectSrc,
      "worker-src 'self' blob:",
      "manifest-src 'self'",
      "media-src 'self' data: blob:",
      "upgrade-insecure-requests",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  typedRoutes: true,
  compress: true,
  transpilePackages: ["date-fns-jalali", "date-fns"],
  poweredByHeader: false,
  reactStrictMode: true,
  // Standalone output produces `.next/standalone/server.js` plus a minimal
  // node_modules tree. Used by the production Dockerfile to ship a small
  // self-contained image. No-op for `next dev` / `next start`.
  output: "standalone",
  typescript: {
    ignoreBuildErrors: true,
  },
  experimental: {
    optimizePackageImports: ["lucide-react"],
    serverActions: {
      // Matches MAX_INPUT_BYTES in src/lib/storage.ts (8MB) with envelope headroom.
      bodySizeLimit: "10mb",
    },
  },
  images: {
    remotePatterns,
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default withPWA({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  reloadOnOnline: true,
  cacheStartUrl: true,
  dynamicStartUrl: false,
  fallbacks: {
    document: "/~offline",
  },
  workboxOptions: {
    // Purge stale precache entries from old builds on SW install so that
    // chunks with old hashes (deleted after a new deployment) don't cause
    // "bad-precaching-response" 404 errors in the browser console.
    cleanupOutdatedCaches: true,
  },
})(nextConfig);
