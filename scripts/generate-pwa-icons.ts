import { mkdir } from "node:fs/promises"
import path from "node:path"

import sharp from "sharp"

const root = process.cwd()
const publicDir = path.join(root, "public")
const iconsDir = path.join(publicDir, "icons")

type IconSpec = {
  filename: string
  size: number
  maskable?: boolean
}

const icons: IconSpec[] = [
  { filename: "icon-192.png", size: 192 },
  { filename: "icon-512.png", size: 512 },
  { filename: "maskable-512.png", size: 512, maskable: true },
]

function createSvg(size: number, maskable = false) {
  const frameInset = Math.round(size * (maskable ? 0.15 : 0.08))
  const cardSize = size - frameInset * 2
  const cardRadius = Math.round(cardSize * 0.29)
  const haloInset = Math.round(size * 0.055)
  const symbolSize = Math.round(cardSize * 0.5)
  const symbolRadius = Math.round(symbolSize * 0.3)
  const symbolX = Math.round((size - symbolSize) / 2)
  const symbolY = Math.round((size - symbolSize) / 2)
  const innerBarWidth = Math.round(symbolSize * 0.44)
  const innerBarHeight = Math.round(symbolSize * 0.12)
  const innerBarX = Math.round((size - innerBarWidth) / 2)
  const topBarY = Math.round(symbolY + symbolSize * 0.24)
  const bottomBarY = Math.round(symbolY + symbolSize * 0.64)
  const dotSize = Math.round(symbolSize * 0.16)
  const dotX = Math.round(symbolX + symbolSize * 0.2)
  const dotY = Math.round(symbolY + symbolSize * 0.62)
  const glyphY = Math.round(symbolY + symbolSize * 0.63)
  const glyphSize = Math.round(symbolSize * 0.55)
  const glowRadius = Math.round(size * 0.42)

  return `
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#195c54" />
          <stop offset="56%" stop-color="#b7e4d3" />
          <stop offset="100%" stop-color="#f5e5c7" />
        </linearGradient>
        <radialGradient id="glow" cx="0.22" cy="0.18" r="0.9">
          <stop offset="0%" stop-color="rgba(255,255,255,0.6)" />
          <stop offset="100%" stop-color="rgba(255,255,255,0)" />
        </radialGradient>
      </defs>

      <rect width="${size}" height="${size}" rx="${Math.round(size * 0.24)}" fill="url(#bg)" />
      <circle cx="${Math.round(size * 0.2)}" cy="${Math.round(size * 0.16)}" r="${glowRadius}" fill="url(#glow)" />

      <rect
        x="${haloInset}"
        y="${haloInset}"
        width="${size - haloInset * 2}"
        height="${size - haloInset * 2}"
        rx="${Math.round(size * 0.2)}"
        fill="rgba(255,255,255,0.15)"
        stroke="rgba(255,255,255,0.32)"
        stroke-width="${Math.max(2, Math.round(size * 0.008))}"
      />

      <rect
        x="${frameInset}"
        y="${frameInset}"
        width="${cardSize}"
        height="${cardSize}"
        rx="${cardRadius}"
        fill="#0d2c2a"
        fill-opacity="0.92"
      />

      <rect
        x="${innerBarX}"
        y="${topBarY}"
        width="${innerBarWidth}"
        height="${innerBarHeight}"
        rx="${Math.round(innerBarHeight / 2)}"
        fill="#f8efe0"
        fill-opacity="0.98"
      />
      <rect
        x="${innerBarX}"
        y="${bottomBarY}"
        width="${Math.round(innerBarWidth * 0.7)}"
        height="${innerBarHeight}"
        rx="${Math.round(innerBarHeight / 2)}"
        fill="#b7e4d3"
        fill-opacity="0.98"
      />
      <rect
        x="${dotX}"
        y="${dotY}"
        width="${dotSize}"
        height="${dotSize}"
        rx="${Math.round(dotSize / 2)}"
        fill="#b7e4d3"
      />

      <rect
        x="${symbolX}"
        y="${symbolY}"
        width="${symbolSize}"
        height="${symbolSize}"
        rx="${symbolRadius}"
        fill="rgba(255,255,255,0.04)"
        stroke="rgba(255,255,255,0.08)"
        stroke-width="${Math.max(1, Math.round(size * 0.006))}"
      />

      <text
        x="50%"
        y="${glyphY}"
        text-anchor="middle"
        direction="rtl"
        font-size="${glyphSize}"
        font-weight="800"
        font-family="'Vazirmatn', 'Noto Sans Arabic', 'Tahoma', sans-serif"
        fill="#ffffff"
      >ک</text>
    </svg>
  `
}

async function writeIcon({ filename, size, maskable = false }: IconSpec) {
  const outputPath = path.join(iconsDir, filename)
  const svg = createSvg(size, maskable)

  await sharp(Buffer.from(svg))
    .png({ compressionLevel: 9, quality: 100 })
    .toFile(outputPath)
}

async function main() {
  await mkdir(iconsDir, { recursive: true })

  await Promise.all(icons.map((icon) => writeIcon(icon)))

  await sharp(Buffer.from(createSvg(180)))
    .png({ compressionLevel: 9, quality: 100 })
    .toFile(path.join(publicDir, "apple-touch-icon.png"))
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
