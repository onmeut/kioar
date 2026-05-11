import {
  buildQrMatrix,
  finderOrigins,
  isFinderModule,
  type QrMatrix,
} from "./matrix";
import type { QrMarkerBorder, QrMarkerCenter, QrStyle } from "./types";

/**
 * Render a styled QR code as an SVG string.
 *
 * Everything below operates in "module units" — one unit = one QR
 * module. The viewBox is `(size + 2*quietZone)` square so the caller
 * can scale freely (CSS, `<img width>`, `canvas.drawImage`).
 *
 * The render pipeline:
 *   1. Build the matrix (ECC=H so the logo cutout is recoverable).
 *   2. Draw data modules in the chosen dot style, skipping finder
 *      cells and any cell whose centre falls inside the logo box.
 *   3. Draw the three finder markers (border + centre) with the
 *      chosen marker shapes.
 *   4. Draw the brand-mark logo over a white rounded square.
 *
 * The brand mark is embedded as a path so the SVG is fully
 * self-contained — no external image fetch on the consumer side.
 */

const QUIET_ZONE = 2;
/** Logo footprint as a fraction of the QR's module-side length. */
const LOGO_RATIO = 0.27;
/** Padding inside the white logo backdrop, in module units. */
const LOGO_PAD = 1.3;

const BRAND_MARK_PATH =
  "M151.4 117.169C153.455 118.534 160.108 128.1 161.962 130.701C182.272 158.864 195.335 191.593 200 226C190.636 226.157 180.978 226.051 171.591 226.065L164.667 226.08C159.156 202.028 149.878 176.984 136.9 155.886C132.386 148.547 127.575 142.923 122.404 136.206C134.84 130.037 140.664 125.587 151.4 117.169ZM53.288 141.321C63.3467 145.499 77.6899 145.997 88.4189 145.472C82.0609 167.317 72.7591 188.144 63.1484 208.716C60.7428 213.865 58.1322 218.928 55.4765 223.951L52.0986 224.034C40.0649 224.117 28.0307 224.118 15.997 224.036C19.3368 217.518 22.9646 210.894 26.1943 204.378C36.5304 183.944 45.5793 162.884 53.288 141.321ZM44.207 0.192552C47.5642 -0.27478 53.0934 0.188675 56.3818 0.729661C99.8926 7.88452 106.055 54.5237 99.8583 90.2707C87.453 95.0276 78.4732 96.51 65.4589 92.5304C65.7765 91.0444 66.0837 89.5558 66.3827 88.0656C68.954 75.1761 70.7105 52.53 63.2411 41.5246C60.4613 37.3427 56.1055 34.4653 51.1679 33.549C40.8436 31.6753 33.7738 36.7129 32.0956 47.0383C30.0676 59.5152 34.1573 73.5013 41.3866 83.6896C48.2645 93.5115 58.8339 100.122 70.6757 102.007C87.6437 104.827 101.915 99.886 115.645 90.2551C139.705 73.3788 150.339 52.1517 155.062 23.8049C155.871 18.3647 156.428 8.92095 156.111 3.50603C157.815 3.46948 159.749 3.50384 161.461 3.59392C171.168 4.1025 181.242 3.76221 190.91 4.39177C191.575 36.6049 181.456 71.14 160.629 95.9552C143.065 116.883 116.532 134.736 88.8349 137.278C66.5983 139.471 44.4113 132.653 27.2431 118.352C11.7783 105.244 2.12974 86.5485 0.405196 66.3498C-1.52727 44.5439 3.07413 20.4312 22.4384 7.69158C29.4877 3.05345 35.8722 0.901398 44.207 0.192552Z";

/** Brand mark viewBox (from `public/brand/logo.svg`). */
const BRAND_MARK_VIEWBOX_W = 200;
const BRAND_MARK_VIEWBOX_H = 227;

export type RenderQrOptions = {
  /** Encoded URL/text. */
  text: string;
  style: QrStyle;
  /** Background fill (defaults to transparent). */
  background?: string;
};

export function renderQrSvg({
  text,
  style,
  background,
}: RenderQrOptions): string {
  const matrix = buildQrMatrix(text);
  return renderMatrix(matrix, style, background);
}

/** Cheap wrapper used by the React component to avoid re-encoding when */
/** only the *style* changes. */
export function renderQrSvgFromMatrix(
  matrix: QrMatrix,
  style: QrStyle,
  background?: string,
): string {
  return renderMatrix(matrix, style, background);
}

function renderMatrix(
  matrix: QrMatrix,
  style: QrStyle,
  background: string | undefined,
): string {
  const { size } = matrix;
  const total = size + QUIET_ZONE * 2;
  const logo = style.showLogo ? computeLogoBox(size) : null;

  const dots = renderDataModules(matrix, style, logo);
  const markers = renderFinderMarkers(size, style);
  const bg = background
    ? `<rect width="${total}" height="${total}" fill="${escAttr(background)}"/>`
    : "";
  const logoSvg = logo ? renderLogo(logo, style.dotColor) : "";

  // `shape-rendering="geometricPrecision"` keeps round dots from
  // turning into squares at small raster sizes.
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" shape-rendering="geometricPrecision">${bg}<g transform="translate(${QUIET_ZONE} ${QUIET_ZONE})">${dots}${markers}${logoSvg}</g></svg>`;
}

// ---------------------------------------------------------------------------
// Logo geometry
// ---------------------------------------------------------------------------

type LogoBox = {
  /** Centre x in module units. */
  cx: number;
  cy: number;
  /** White backdrop square side in module units. */
  side: number;
  /** Inner padding for the brand mark itself. */
  pad: number;
};

function computeLogoBox(size: number): LogoBox {
  // Round to integer-ish modules so the backdrop edges land on grid
  // lines — cleaner anti-aliasing when the SVG is rasterised.
  const side = Math.round(size * LOGO_RATIO);
  return {
    cx: size / 2,
    cy: size / 2,
    side,
    pad: LOGO_PAD,
  };
}

function isInsideLogo(row: number, col: number, logo: LogoBox): boolean {
  const x = col + 0.5;
  const y = row + 0.5;
  const half = logo.side / 2;
  return (
    x >= logo.cx - half &&
    x <= logo.cx + half &&
    y >= logo.cy - half &&
    y <= logo.cy + half
  );
}

function renderLogo(logo: LogoBox, color: string): string {
  const half = logo.side / 2;
  const x = logo.cx - half;
  const y = logo.cy - half;
  const radius = logo.side * 0.18;
  const inner = logo.side - logo.pad * 2;
  const innerX = x + logo.pad;
  const innerY = y + logo.pad;

  // Aspect-fit the brand mark inside the inner square.
  const markScale =
    inner / Math.max(BRAND_MARK_VIEWBOX_W, BRAND_MARK_VIEWBOX_H);
  const markW = BRAND_MARK_VIEWBOX_W * markScale;
  const markH = BRAND_MARK_VIEWBOX_H * markScale;
  const markX = innerX + (inner - markW) / 2;
  const markY = innerY + (inner - markH) / 2;

  return (
    `<rect x="${x}" y="${y}" width="${logo.side}" height="${logo.side}" rx="${radius}" ry="${radius}" fill="#ffffff"/>` +
    `<g transform="translate(${markX} ${markY}) scale(${markScale})"><path d="${BRAND_MARK_PATH}" fill="${escAttr(color)}"/></g>`
  );
}

// ---------------------------------------------------------------------------
// Data modules
// ---------------------------------------------------------------------------

function renderDataModules(
  matrix: QrMatrix,
  style: QrStyle,
  logo: LogoBox | null,
): string {
  const { size, modules } = matrix;
  const parts: string[] = [];
  const color = escAttr(style.dotColor);

  if (style.dotStyle === "dots") {
    // Isolated circles, r = 0.42 to leave a hairline gap that reads
    // crisp on screens and printers alike.
    parts.push(`<g fill="${color}">`);
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (!modules[r][c]) continue;
        if (isFinderModule(r, c, size)) continue;
        if (logo && isInsideLogo(r, c, logo)) continue;
        parts.push(`<circle cx="${c + 0.5}" cy="${r + 0.5}" r="0.42"/>`);
      }
    }
    parts.push(`</g>`);
    return parts.join("");
  }

  // `square` and `rounded` share rect geometry; only `rx` changes.
  const rx = style.dotStyle === "rounded" ? 0.35 : 0;
  parts.push(`<g fill="${color}">`);
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (!modules[r][c]) continue;
      if (isFinderModule(r, c, size)) continue;
      if (logo && isInsideLogo(r, c, logo)) continue;
      if (rx) {
        parts.push(
          `<rect x="${c}" y="${r}" width="1" height="1" rx="${rx}" ry="${rx}"/>`,
        );
      } else {
        parts.push(`<rect x="${c}" y="${r}" width="1" height="1"/>`);
      }
    }
  }
  parts.push(`</g>`);
  return parts.join("");
}

// ---------------------------------------------------------------------------
// Finder markers
// ---------------------------------------------------------------------------

function renderFinderMarkers(size: number, style: QrStyle): string {
  const color = escAttr(style.markerColor);
  return finderOrigins(size)
    .map(([row, col]) =>
      renderMarker(col, row, style.markerBorder, style.markerCenter, color),
    )
    .join("");
}

function renderMarker(
  x: number,
  y: number,
  border: QrMarkerBorder,
  center: QrMarkerCenter,
  color: string,
): string {
  // Finder pattern is 7×7. Border ring is 1 module thick; centre is
  // a 3×3 block sitting in the middle of an inner 5×5 clear area.
  const cx = x + 3.5;
  const cy = y + 3.5;

  let borderSvg = "";
  if (border === "circle") {
    // Ring: stroked circle. radius = 3 → outer reaches 3.5 (full 7
    // module footprint), inner reaches 2.5 (leaves the 5×5 clear).
    borderSvg = `<circle cx="${cx}" cy="${cy}" r="3" fill="none" stroke="${color}" stroke-width="1"/>`;
  } else {
    const rx = border === "rounded" ? 1.75 : 0;
    // Use an even-odd path so we can carve out the inner 5×5 hole in
    // one element — keeps the marker as a single fill and avoids any
    // anti-aliasing seam between two stacked rects.
    const outer = roundedRectPath(x, y, 7, 7, rx);
    const inner = roundedRectPath(x + 1, y + 1, 5, 5, Math.max(0, rx - 1));
    borderSvg = `<path d="${outer} ${inner}" fill="${color}" fill-rule="evenodd"/>`;
  }

  const centerSvg =
    center === "dot"
      ? `<circle cx="${cx}" cy="${cy}" r="1.5" fill="${color}"/>`
      : `<rect x="${x + 2}" y="${y + 2}" width="3" height="3" fill="${color}"/>`;

  return borderSvg + centerSvg;
}

function roundedRectPath(
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): string {
  if (r <= 0) {
    return `M${x} ${y}h${w}v${h}h${-w}z`;
  }
  return (
    `M${x + r} ${y}` +
    `h${w - 2 * r}` +
    `a${r} ${r} 0 0 1 ${r} ${r}` +
    `v${h - 2 * r}` +
    `a${r} ${r} 0 0 1 ${-r} ${r}` +
    `h${-(w - 2 * r)}` +
    `a${r} ${r} 0 0 1 ${-r} ${-r}` +
    `v${-(h - 2 * r)}` +
    `a${r} ${r} 0 0 1 ${r} ${-r}` +
    `z`
  );
}

function escAttr(value: string): string {
  return value.replace(/[<>"'&]/g, (ch) => {
    switch (ch) {
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      case "'":
        return "&#39;";
      case "&":
        return "&amp;";
      default:
        return ch;
    }
  });
}
