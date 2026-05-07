/**
 * Generates iOS PWA splash screen PNGs for all required Apple devices.
 *
 * Design: brand green (#1ED760) background + centered white Kioar K mark.
 *
 * Source: /public/brand/logo-white.svg (200×227 viewBox, transparent bg)
 *
 * Outputs: /public/splashscreens/<device-name>.png
 *
 * Android note: Android Chrome auto-generates the splash from the manifest's
 * background_color (#1ED760) + largest icon — no extra PNGs needed there.
 *
 * Run: npx tsx scripts/generate-splash-screens.ts
 *      (or: npm run generate:splash)
 */
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";

import sharp from "sharp";

const root = process.cwd();
const publicDir = path.join(root, "public");
const splashDir = path.join(publicDir, "splashscreens");
const logoSvgPath = path.join(publicDir, "brand", "logo.svg");

// Must match the brand-avatar background and the manifest background_color.
const BRAND_GREEN = "#1ED760";

// logo-white.svg natural viewBox dimensions (used to calculate aspect ratio).
const LOGO_NATURAL_W = 200;
const LOGO_NATURAL_H = 227;

type Device = {
  /** Output filename (without extension). */
  name: string;
  /** Physical pixel width. */
  width: number;
  /** Physical pixel height. */
  height: number;
};

/**
 * iOS device list — physical pixel dimensions.
 * CSS pixel dimensions (= physical / dpr) are used only in layout.tsx meta tags.
 */
const devices: Device[] = [
  // ── iPhones ──────────────────────────────────────────────────────────────
  { name: "iphone-16-pro-max", width: 1320, height: 2868 }, // 440×956 @3x
  { name: "iphone-16", width: 1290, height: 2796 }, // 430×932 @3x
  { name: "iphone-15-pro", width: 1179, height: 2556 }, // 393×852 @3x
  { name: "iphone-14-pro-max", width: 1284, height: 2778 }, // 428×926 @3x
  { name: "iphone-13", width: 1170, height: 2532 }, // 390×844 @3x
  { name: "iphone-se", width: 750, height: 1334 }, // 375×667 @2x
  // ── iPads ─────────────────────────────────────────────────────────────────
  { name: "ipad-pro-12", width: 2048, height: 2732 }, // 1024×1366 @2x
  { name: "ipad-pro-11", width: 1668, height: 2388 }, //  834×1194 @2x
  { name: "ipad-air", width: 1640, height: 2360 }, //  820×1180 @2x
  { name: "ipad-mini", width: 1488, height: 2266 }, //  744×1133 @2x
];

async function generateSplash(device: Device, logoSvg: Buffer): Promise<void> {
  const { width, height, name } = device;

  // Logo width: ~18% of the shorter dimension, clamped 200–360 px.
  const logoWidth = Math.min(
    360,
    Math.max(200, Math.round(Math.min(width, height) * 0.18)),
  );
  const logoHeight = Math.round((logoWidth * LOGO_NATURAL_H) / LOGO_NATURAL_W);

  // Rasterise at a density that maps the 200px-wide SVG viewBox to logoWidth.
  const density = Math.max(72, Math.ceil((logoWidth / LOGO_NATURAL_W) * 96));

  const logoPng = await sharp(logoSvg, { density })
    .resize(logoWidth, logoHeight, { fit: "fill" })
    .png()
    .toBuffer();

  const left = Math.round((width - logoWidth) / 2);
  const top = Math.round((height - logoHeight) / 2);

  const outFile = path.join(splashDir, `${name}.png`);

  await sharp({
    create: {
      width,
      height,
      channels: 3,
      background: BRAND_GREEN,
    },
  })
    .composite([{ input: logoPng, left, top }])
    .png({ compressionLevel: 9 })
    .toFile(outFile);

  // eslint-disable-next-line no-console
  console.log(
    `  ✔ ${name}.png  (${width}×${height}, logo ${logoWidth}×${logoHeight}px)`,
  );
}

async function main() {
  await mkdir(splashDir, { recursive: true });
  const logoSvg = await readFile(logoSvgPath);

  // eslint-disable-next-line no-console
  console.log("Generating iOS PWA splash screens…\n");

  // Generate sequentially to keep memory usage low on the large iPad sizes.
  for (const device of devices) {
    await generateSplash(device, logoSvg);
  }

  // eslint-disable-next-line no-console
  console.log(`\n✔ ${devices.length} splash screens → public/splashscreens/`);
  // eslint-disable-next-line no-console
  console.log(
    "ℹ  Android: auto-generated from manifest background_color + icon — no extra files needed.",
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
