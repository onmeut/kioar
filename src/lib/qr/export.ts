/**
 * Browser-side helpers for downloading the rendered QR as SVG or PNG.
 *
 * - SVG export is trivial: blob the markup, click an anchor.
 * - PNG rasterisation uses `<canvas>` so the user gets a pixel-perfect
 *   image at whatever resolution they pick — no server roundtrip.
 *
 * All functions are no-ops outside the browser; callers in client
 * components don't need to guard.
 */

export function downloadQrSvg(svg: string, filename: string): void {
  if (typeof window === "undefined") return;
  const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  triggerDownload(URL.createObjectURL(blob), filename, true);
}

export async function downloadQrPng(
  svg: string,
  filename: string,
  pixelSize = 1024,
): Promise<void> {
  if (typeof window === "undefined") return;
  const pngUrl = await rasteriseSvgToPng(svg, pixelSize);
  triggerDownload(pngUrl, filename, true);
}

export async function copyQrPng(svg: string, pixelSize = 1024): Promise<void> {
  if (typeof window === "undefined") return;
  const pngUrl = await rasteriseSvgToPng(svg, pixelSize);
  const res = await fetch(pngUrl);
  const blob = await res.blob();
  URL.revokeObjectURL(pngUrl);
  // ClipboardItem is supported in all modern browsers; older browsers
  // fall back to copying the share URL, handled by the caller.
  if (typeof ClipboardItem === "undefined" || !navigator.clipboard?.write) {
    throw new Error("clipboard-unsupported");
  }
  await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
}

async function rasteriseSvgToPng(
  svg: string,
  pixelSize: number,
): Promise<string> {
  const svgBlob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  const svgUrl = URL.createObjectURL(svgBlob);
  try {
    const img = await loadImage(svgUrl);
    const canvas = document.createElement("canvas");
    canvas.width = pixelSize;
    canvas.height = pixelSize;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas-2d-unsupported");
    // White background — most users expect a printable PNG, not an
    // alpha-channel sticker.
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, pixelSize, pixelSize);
    ctx.drawImage(img, 0, 0, pixelSize, pixelSize);
    return await new Promise<string>((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error("canvas-toblob-failed"));
          return;
        }
        resolve(URL.createObjectURL(blob));
      }, "image/png");
    });
  } finally {
    URL.revokeObjectURL(svgUrl);
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("image-load-failed"));
    img.src = src;
  });
}

function triggerDownload(url: string, filename: string, revoke = false): void {
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  if (revoke) {
    // Delay so the browser actually starts the download before we
    // tear the blob URL down.
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
