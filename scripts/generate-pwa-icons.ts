/**
 * Generates all Kioar app icons from the canonical brand avatar SVG.
 *
 * Source: /public/brand/brand-avatar.svg (1024x1024, green bg + black "K")
 *
 * Outputs:
 *   /public/favicon.ico                      (16/32/48)
 *   /public/favicon-16x16.png
 *   /public/favicon-32x32.png
 *   /public/apple-touch-icon.png             (180x180)
 *   /public/og-image.png                     (1200x630, centered avatar)
 *   /public/icons/icon-{72,96,128,144,152,192,384,512}.png
 *   /public/icons/maskable-512.png           (with safe-area padding)
 *   /public/icons/apple-touch-icon-{120,152,167,180}.png
 *   /public/icons/mstile-150x150.png
 *
 *   Copies into /src/app/ for Next.js file-convention cache busting:
 *   src/app/favicon.ico
 *   src/app/icon.png          (512x512)
 *   src/app/apple-icon.png    (180x180)
 *   src/app/opengraph-image.png (1200x630)
 *
 * Run: npx tsx scripts/generate-pwa-icons.ts
 */
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import pngToIco from "png-to-ico";
import sharp from "sharp";

const root = process.cwd();
const publicDir = path.join(root, "public");
const iconsDir = path.join(publicDir, "icons");
const sourceSvgPath = path.join(publicDir, "brand", "brand-avatar.svg");

// Brand background — matches the avatar SVG.
const BRAND_GREEN = "#1ED760";

type SquareSpec = { file: string; size: number; dir: "public" | "icons" };

// Plain square renders straight from the source SVG.
const squareIcons: SquareSpec[] = [
  // PWA / web manifest
  { file: "icon-72x72.png", size: 72, dir: "icons" },
  { file: "icon-96x96.png", size: 96, dir: "icons" },
  { file: "icon-128x128.png", size: 128, dir: "icons" },
  { file: "icon-144x144.png", size: 144, dir: "icons" },
  { file: "icon-152x152.png", size: 152, dir: "icons" },
  { file: "icon-192x192.png", size: 192, dir: "icons" },
  { file: "icon-384x384.png", size: 384, dir: "icons" },
  { file: "icon-512x512.png", size: 512, dir: "icons" },
  // Legacy aliases used by manifest.ts and layout.tsx today.
  { file: "icon-192.png", size: 192, dir: "icons" },
  { file: "icon-512.png", size: 512, dir: "icons" },
  // Apple touch icons
  { file: "apple-touch-icon-120x120.png", size: 120, dir: "icons" },
  { file: "apple-touch-icon-152x152.png", size: 152, dir: "icons" },
  { file: "apple-touch-icon-167x167.png", size: 167, dir: "icons" },
  { file: "apple-touch-icon-180x180.png", size: 180, dir: "icons" },
  // Microsoft tile
  { file: "mstile-150x150.png", size: 150, dir: "icons" },
  // Favicons
  { file: "favicon-16x16.png", size: 16, dir: "public" },
  { file: "favicon-32x32.png", size: 32, dir: "public" },
];

function targetPath(spec: SquareSpec) {
  return path.join(spec.dir === "icons" ? iconsDir : publicDir, spec.file);
}

async function renderSquare(svg: Buffer, size: number, outFile: string) {
  await sharp(svg, { density: Math.max(72, Math.ceil((size / 1024) * 600)) })
    .resize(size, size, { fit: "cover" })
    .png({ compressionLevel: 9 })
    .toFile(outFile);
}

async function renderMaskable(svg: Buffer, size: number, outFile: string) {
  // Maskable icons need ~10–15% safe-area padding around the logo so platforms
  // can crop into circles/squircles without clipping the K.
  const inner = Math.round(size * 0.72);
  const inset = Math.round((size - inner) / 2);

  const innerPng = await sharp(svg, { density: 600 })
    .resize(inner, inner, { fit: "cover" })
    .png()
    .toBuffer();

  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: BRAND_GREEN,
    },
  })
    .composite([{ input: innerPng, left: inset, top: inset }])
    .png({ compressionLevel: 9 })
    .toFile(outFile);
}

async function renderOgImage(svg: Buffer, outFile: string) {
  const W = 1200;
  const H = 630;
  const avatarSize = 360;

  const avatar = await sharp(svg, { density: 600 })
    .resize(avatarSize, avatarSize, { fit: "cover" })
    .png()
    .toBuffer();

  // Rounded corners on the avatar tile.
  const radius = 64;
  const mask = Buffer.from(
    `<svg width="${avatarSize}" height="${avatarSize}" xmlns="http://www.w3.org/2000/svg"><rect width="${avatarSize}" height="${avatarSize}" rx="${radius}" ry="${radius}" fill="#fff"/></svg>`,
  );
  const roundedAvatar = await sharp(avatar)
    .composite([{ input: mask, blend: "dest-in" }])
    .png()
    .toBuffer();

  const left = Math.round((W - avatarSize) / 2);
  const top = Math.round((H - avatarSize) / 2);

  await sharp({
    create: { width: W, height: H, channels: 4, background: "#ffffff" },
  })
    .composite([{ input: roundedAvatar, left, top }])
    .png({ compressionLevel: 9 })
    .toFile(outFile);
}

async function renderFaviconIco(svg: Buffer) {
  // Build 16/32/48 PNG buffers from source SVG, then bundle as ICO.
  const buffers = await Promise.all(
    [16, 32, 48].map((s) =>
      sharp(svg, { density: 300 })
        .resize(s, s, { fit: "cover" })
        .png()
        .toBuffer(),
    ),
  );
  const ico = await pngToIco(buffers);
  await writeFile(path.join(publicDir, "favicon.ico"), ico);
}

async function main() {
  await mkdir(iconsDir, { recursive: true });
  const svg = await readFile(sourceSvgPath);

  await Promise.all(
    squareIcons.map((spec) => renderSquare(svg, spec.size, targetPath(spec))),
  );

  // Apple touch icon at the canonical /public path (referenced by layout).
  await renderSquare(svg, 180, path.join(publicDir, "apple-touch-icon.png"));

  // Maskable PWA icon.
  await renderMaskable(svg, 512, path.join(iconsDir, "maskable-512.png"));

  // Open Graph share image.
  await renderOgImage(svg, path.join(publicDir, "og-image.png"));

  // favicon.ico (multi-size).
  await renderFaviconIco(svg);

  // ── Next.js app/ file-convention copies (cache-busted at build time) ──────
  // These are what browsers and crawlers actually see in production.
  // ALWAYS regenerate these alongside the public/ copies.
  const appDir = path.join(root, "src", "app");
  await Promise.all([
    copyFile(
      path.join(publicDir, "favicon.ico"),
      path.join(appDir, "favicon.ico"),
    ),
    copyFile(
      path.join(iconsDir, "icon-512x512.png"),
      path.join(appDir, "icon.png"),
    ),
    copyFile(
      path.join(publicDir, "apple-touch-icon.png"),
      path.join(appDir, "apple-icon.png"),
    ),
    copyFile(
      path.join(publicDir, "og-image.png"),
      path.join(appDir, "opengraph-image.png"),
    ),
  ]);

  // eslint-disable-next-line no-console
  console.log("✔ Generated Kioar app icons from brand-avatar.svg");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
