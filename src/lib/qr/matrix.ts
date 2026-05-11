import QRCode from "qrcode";

/**
 * Boolean QR module matrix.
 *
 * `qrcode` does the heavy maths — Reed–Solomon error correction, mask
 * selection, version sizing. We only consume the resulting bit grid
 * and render it ourselves so we can style every module freely without
 * giving up scan reliability.
 */
export type QrMatrix = {
  /** Side length in modules (e.g. 29 for version 3). */
  size: number;
  /** `size × size` booleans, row-major. */
  modules: boolean[][];
};

/**
 * Build a QR matrix for `text`.
 *
 * We force ECC level **H** (≈30% recovery) because we punch a logo
 * cutout in the middle — anything lower risks unscannable codes once
 * the brand mark covers ~9% of the surface.
 */
export function buildQrMatrix(text: string): QrMatrix {
  const qr = QRCode.create(text, { errorCorrectionLevel: "H" });
  const size = qr.modules.size;
  const data = qr.modules.data;
  const modules: boolean[][] = [];
  for (let r = 0; r < size; r++) {
    const row: boolean[] = [];
    for (let c = 0; c < size; c++) {
      row.push(data[r * size + c] === 1);
    }
    modules.push(row);
  }
  return { size, modules };
}

/**
 * Finder-pattern modules are the three 7×7 squares in the top-left,
 * top-right, and bottom-left corners. We render them with custom
 * markers, so the data-module renderer needs to skip these cells.
 */
export function isFinderModule(
  row: number,
  col: number,
  size: number,
): boolean {
  const inTopLeft = row < 7 && col < 7;
  const inTopRight = row < 7 && col >= size - 7;
  const inBottomLeft = row >= size - 7 && col < 7;
  return inTopLeft || inTopRight || inBottomLeft;
}

/** Top-left corner coordinate of each finder pattern. */
export function finderOrigins(size: number): Array<[number, number]> {
  return [
    [0, 0],
    [0, size - 7],
    [size - 7, 0],
  ];
}
