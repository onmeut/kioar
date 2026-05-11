/**
 * QR code styling types.
 *
 * The matrix itself is produced by `qrcode` (a tiny encoder that gives
 * us the boolean module grid + version + ECC level). The visual layer
 * — rounded dots, custom finder markers, logo cutout, PNG/SVG export
 * — is all custom and lives in this `src/lib/qr/*` folder.
 */

export type QrDotStyle = "square" | "dots" | "rounded";

export type QrMarkerCenter = "square" | "dot";

export type QrMarkerBorder = "square" | "rounded" | "circle";

export type QrStyle = {
  dotStyle: QrDotStyle;
  markerCenter: QrMarkerCenter;
  markerBorder: QrMarkerBorder;
  /** Hex color (e.g. `#000000`) for data modules. */
  dotColor: string;
  /** Hex color for finder-pattern markers. */
  markerColor: string;
  /** Show the Kioar brand mark in the centre. */
  showLogo: boolean;
};

export const DEFAULT_QR_STYLE: QrStyle = {
  dotStyle: "square",
  markerCenter: "square",
  markerBorder: "square",
  dotColor: "#000000",
  markerColor: "#000000",
  showLogo: true,
};

/**
 * Curated swatches used in the customisation UI.
 * Order matches the Linktree reference (black-first).
 */
export const QR_COLOR_SWATCHES = [
  "#000000",
  "#D14343",
  "#E36A2C",
  "#F1B5C7",
  "#F6CF54",
  "#3F9B6B",
  "#2D58D8",
  "#9B4FD0",
] as const;
