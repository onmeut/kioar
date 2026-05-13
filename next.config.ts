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
  // Production CDN — hardcoded because S3_PUBLIC_URL_BASE is not available
  // at Docker build time (env file is gitignored), so the dynamic derivation
  // below never fires in CI/prod builds.
  { protocol: "https", hostname: "cdn.kioar.com" },
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
// The service worker (Workbox) caches images via the Fetch API, which is also
// governed by connect-src (not img-src), so we must allow the S3/CDN origin.
// NOTE: S3_PUBLIC_URL_BASE is not available at Docker build time (gitignored
// env file), so we also hardcode the production CDN host as a reliable fallback.
const s3ConnectOrigin = s3PublicBase
  ? `${s3PublicBase.protocol}://${s3PublicBase.hostname}${s3PublicBase.port ? `:${s3PublicBase.port}` : ""}`
  : null;
// Always include the production CDN; deduplicate if s3ConnectOrigin matches.
const cdnOrigin = "https://cdn.kioar.com";
const extraConnectOrigins = [
  cdnOrigin,
  ...(s3ConnectOrigin && s3ConnectOrigin !== cdnOrigin
    ? [s3ConnectOrigin]
    : []),
].join(" ");
const connectSrc = isDev
  ? "connect-src 'self' blob: ws: wss:"
  : `connect-src 'self' blob: ${extraConnectOrigins}`;

const securityHeaders: { key: string; value: string }[] = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
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

// IMPORTANT — PWA caching policy
// ----------------------------------------------------------------------------
// We deliberately keep the service worker as small and conservative as
// possible. The default ducanh/next-pwa runtime caching uses NetworkFirst
// for *every* same-origin HTML and RSC response (`pages`, `pages-rsc`,
// `pages-rsc-prefetch`). On a multi-tenant, cookie-driven app like Kioar
// that's catastrophic:
//
//   1. The dashboard, /me, /admin, etc. all vary by the `kioar_session` and
//      `kioar_page_id` cookies. NetworkFirst stores the response keyed only
//      by URL, so when the user switches pages (page-switcher) or signs in
//      as a different account the SW happily serves the previous user's
//      cached RSC payload. React then bails out with hydration error #418
//      and Next.js falls back to a hard navigation to "/", which is itself
//      cached as the *public* landing page → user is silently logged out.
//
//   2. `cacheOnFrontEndNav` + `aggressiveFrontEndNavCaching` patches every
//      `<Link>` prefetch into the same poisoned cache, multiplying the bug.
//
//   3. `cacheStartUrl` precaches "/", which for an authed user redirects to
//      "/me". The cached body is the unauth landing page, so the SW serves
//      a logged-out shell to a logged-in user.
//
//   4. The precache manifest also pinned per-build chunk hashes for
//      authenticated routes (e.g. /admin). After a deploy the old SW kept
//      requesting the old chunk URLs which 404 on the new server →
//      `ChunkLoadError: Loading chunk … failed` (exactly what users hit on
//      kioar.com/admin).
//
// Fix: register an empty `runtimeCaching` array so workbox does NOT install
// any of those NetworkFirst route handlers, exclude the entire `app/`
// build output (server components, RSC, route handlers) from precache so
// only truly immutable static assets (`/_next/static/*` JS/CSS, fonts,
// images in `public/`) are precached, and disable `cacheStartUrl` /
// front-end-nav caching. Documents always go to the network. Offline page
// is still wired through `fallbacks.document`.
export default withPWA({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
  reloadOnOnline: true,
  // Do NOT precache or runtime-cache the start URL — it varies by auth.
  cacheStartUrl: false,
  dynamicStartUrl: true,
  // Do NOT intercept client-side navigation; it caches RSC payloads keyed
  // only by URL, leaking auth state across users / pages.
  cacheOnFrontEndNav: false,
  aggressiveFrontEndNavCaching: false,
  fallbacks: {
    document: "/~offline",
  },
  workboxOptions: {
    // Purge stale precache entries from old builds on SW install so that
    // chunks with old hashes (deleted after a new deployment) don't cause
    // "bad-precaching-response" 404 errors in the browser console.
    cleanupOutdatedCaches: true,
    // Empty runtime caching = no NetworkFirst handler for HTML/RSC. The
    // browser's normal HTTP cache still applies; we just stop the SW from
    // serving stale auth-bound responses.
    runtimeCaching: [],
    // Strip everything route-shaped (server components, RSC, routes,
    // middleware) from the precache manifest. Only truly static immutable
    // chunks under /_next/static remain. This single-handedly fixes the
    // "Loading chunk … failed" errors that appear after a deploy because
    // the old SW manifest no longer points at routes that have since been
    // rebuilt with new hashes.
    exclude: [
      /\/app\//,
      /chunks\/app\//,
      /^app\//,
      // Source maps and HMR partials should never be in the precache.
      /\.map$/,
      /^manifest.*\.js$/,
      // /uploads is user-content — varies in size and is not part of the
      // app shell. Don't ship a multi-MB precache to every user.
      /^\/?uploads\//,
    ],
  },
})(nextConfig);
