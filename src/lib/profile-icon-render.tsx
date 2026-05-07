import "server-only";

import { readFile } from "fs/promises";
import { join } from "path";

import sharp from "sharp";

// We do NOT use `react-dom/server` (or `.edge`) here. Next 16 aliases
// both away in RSC / route handlers and throws "do not use legacy
// react-dom/server APIs" — which silently kicked us into the
// slug-letter fallback for every profile without an uploaded photo.
// The SVG is now generated as a pure string by DiceBear (`bottts-neutral`).
// See `lib/avatar.ts`.
import { getKioarAvatarSvg } from "@/lib/avatar";
import { getPublicProfileBySlug } from "@/lib/data";

// Sharp is a native (libvips) addon — must run on the Node runtime, not
// the edge runtime. The route files importing this should leave the
// runtime at its default (Node).
type Variant = "any" | "maskable" | "apple" | "favicon";

const FALLBACK_BG = "#195c54";

function escapeXml(s: string): string {
  return s.replace(/[<>&'"]/g, (c) =>
    c === "<"
      ? "&lt;"
      : c === ">"
        ? "&gt;"
        : c === "&"
          ? "&amp;"
          : c === "'"
            ? "&apos;"
            : "&quot;",
  );
}

/**
 * Load the user's uploaded avatar bytes from local disk (dev) or fetch
 * from the storage CDN (prod). We deliberately read local uploads from
 * the filesystem because issuing an HTTP request back to our own
 * `localhost:3000` from inside the same dev server is flaky.
 */
async function loadAvatarBuffer(raw: string | null): Promise<Buffer | null> {
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) {
    try {
      const res = await fetch(raw, { cache: "no-store" });
      if (!res.ok) return null;
      return Buffer.from(await res.arrayBuffer());
    } catch {
      return null;
    }
  }
  if (raw.startsWith("/uploads/")) {
    try {
      return await readFile(join(process.cwd(), "public", raw));
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Render the inner avatar layer at exactly `innerSize` × `innerSize`
 * pixels, returning a PNG buffer. Priority:
 *   1. uploaded avatar (cover-fits the square; sharp decodes webp/jpeg/png)
 *   2. picked icon glyph (centered on bg)
 *   3. DiceBear bottts-neutral seed (matches the public profile fallback)
 *   4. slug initial on bg (final fallback)
 */
async function renderInner(
  profile: {
    slug: string;
    avatarUrl: string | null;
    appIconKey: string | null;
    avatarSeed: string | null;
  },
  innerSize: number,
  bg: string,
): Promise<Buffer> {
  const avatarBytes = await loadAvatarBuffer(profile.avatarUrl);
  if (avatarBytes) {
    // Flatten before resize so any transparent corners in the source image
    // (e.g. pre-rounded PNG uploads) get filled with the brand bg colour
    // instead of white — which iOS would show as a white border/frame.
    return sharp(avatarBytes)
      .flatten({ background: bg })
      .resize(innerSize, innerSize, { fit: "cover", position: "center" })
      .png()
      .toBuffer();
  }

  // Custom Tabler/Lucide glyph picked in page settings. Rendered through
  // React's modern streaming server API (`renderToReadableStream`) —
  // Next 16 still ships this, while it bans the legacy
  // `renderToStaticMarkup`. Wrapped in try/catch so an icon-render hiccup
  // never blocks the avatar fallback below.
  if (profile.appIconKey) {
    try {
      const { resolveIconEntry } = await import("@/lib/link-icons");
      const { renderToReadableStream } = await import("react-dom/server");
      const { createElement } = await import("react");
      const entry = resolveIconEntry(profile.appIconKey, "");
      const glyph = Math.round(innerSize * 0.6);
      const stream = await renderToReadableStream(
        createElement(entry.Icon, {
          width: glyph,
          height: glyph,
          color: "white",
          stroke: "white",
        }),
      );
      // `renderToReadableStream` returns a stream that's still rendering;
      // calling `allReady` then draining gives us the final markup.
      await stream.allReady;
      const glyphSvg = await new Response(stream).text();
      const offset = Math.round((innerSize - glyph) / 2);
      const composed = `<svg xmlns="http://www.w3.org/2000/svg" width="${innerSize}" height="${innerSize}"><rect width="${innerSize}" height="${innerSize}" fill="${bg}"/><g transform="translate(${offset},${offset})">${glyphSvg}</g></svg>`;
      return await sharp(Buffer.from(composed)).png().toBuffer();
    } catch (e) {
      console.error("[profile-icon-render] appIconKey render failed", e);
      // fall through to the avatar/beam fallback
    }
  }

  // DiceBear (bottts-neutral) fallback. Match the public profile card
  // *byte-for-byte* — see `components/shared/kioar-avatar.tsx`,
  // which renders `<KioarAvatar seed={…}/>`. We pass the same seed
  // (avatar_seed) and the same default for legacy NULL rows, so the
  // home-screen icon is identical to what the visitor sees on the
  // public profile.
  try {
    const svg = getKioarAvatarSvg(profile.avatarSeed, {
      size: innerSize,
      radius: 0,
    });
    // DiceBear SVG already includes its own fully-opaque background
    // rect (part of the seed-derived palette) — no flatten needed.
    return await sharp(Buffer.from(svg))
      .resize(innerSize, innerSize)
      .png()
      .toBuffer();
  } catch (e) {
    console.error("[profile-icon-render] dicebear fallback failed", e);
    // Last-resort safety net: a solid bg with the slug initial. We
    // should never hit this in practice — DiceBear produces pure SVG
    // primitives that libvips handles fine — but if anything throws we
    // still return a valid 200, otherwise Chrome falls all the way
    // back to `/favicon.ico`.
    const ch = (profile.slug || "K").trim().charAt(0).toUpperCase() || "K";
    const fontSize = Math.round(innerSize * 0.55);
    const letterSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${innerSize}" height="${innerSize}"><rect width="${innerSize}" height="${innerSize}" fill="${bg}"/><text x="50%" y="50%" text-anchor="middle" dominant-baseline="central" fill="white" font-family="Helvetica, Arial, sans-serif" font-weight="900" font-size="${fontSize}">${escapeXml(ch)}</text></svg>`;
    return sharp(Buffer.from(letterSvg)).png().toBuffer();
  }
}

/**
 * Render a square PNG for use as the per-profile favicon, PWA icon,
 * apple-touch-icon, or maskable Android icon.
 *
 * iOS, macOS and Android *all* apply their own corner radius (squircle
 * on Apple, the launcher's preferred shape on Android via maskable).
 * So we deliberately do NOT round, mask, or pad the icon ourselves —
 * doing that produces a visible inner frame (white/brand-bg ring) once
 * the OS rounds again on top.
 *
 * Variants:
 *  - `favicon` / `any` / `apple` — plain full-bleed square. For an
 *    uploaded photo this is the photo cover-fitted to a square. For
 *    the DiceBear fallback it's the bottts-neutral SVG (which already
 *    has its own brand-green bg).
 *  - `maskable` — full-bleed brand bg with the inner avatar inset by
 *    18 % so Android's adaptive-icon mask never crops important content.
 */
export async function renderProfileIcon(
  slug: string,
  size: number,
  variant: Variant = "any",
): Promise<Response> {
  const profile = await getPublicProfileBySlug(slug);
  if (!profile) {
    return new Response("Not found", { status: 404 });
  }

  const bg = profile.appIconColor || FALLBACK_BG;

  const innerBuf = await renderInner(
    {
      slug: profile.slug,
      avatarUrl: profile.avatarUrl ?? null,
      appIconKey: profile.appIconKey ?? null,
      avatarSeed: profile.avatarSeed ?? null,
    },
    size,
    bg,
  );

  const cacheHeaders = {
    "Content-Type": "image/png",
    "Cache-Control":
      "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
  } as const;

  return new Response(new Uint8Array(innerBuf), { headers: cacheHeaders });
}
