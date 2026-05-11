"use client";

import { useMemo } from "react";

import { buildQrMatrix } from "@/lib/qr/matrix";
import { renderQrSvgFromMatrix } from "@/lib/qr/render-svg";
import { DEFAULT_QR_STYLE, type QrStyle } from "@/lib/qr/types";
import { cn } from "@/lib/utils";

type QrRendererProps = {
  /** URL/text encoded into the QR. */
  text: string;
  /** Visual style; defaults to plain black with logo. */
  style?: QrStyle;
  className?: string;
};

/**
 * Renders a styled QR code inline as SVG.
 *
 * The matrix encode (`buildQrMatrix`) is cached against the `text`
 * input, and the SVG string is cached against the combined inputs.
 * This means colour/style fiddling in the customisation UI never
 * re-runs the (expensive) ECC math — only the cheap render pass.
 *
 * We dangerouslySetInnerHTML the SVG string instead of building it as
 * JSX because the renderer composes thousands of `<rect>`s. Going via
 * a single innerHTML write is ~10× faster than React reconciliation
 * during interactive style edits.
 */
export function QrRenderer({
  text,
  style = DEFAULT_QR_STYLE,
  className,
}: QrRendererProps) {
  const matrix = useMemo(() => buildQrMatrix(text), [text]);
  const svg = useMemo(
    () => renderQrSvgFromMatrix(matrix, style),
    [matrix, style],
  );
  return (
    <div
      className={cn("[&>svg]:block [&>svg]:size-full", className)}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

/** Hook variant — returns the current SVG string for export. */
export function useQrSvg(text: string, style: QrStyle): string {
  const matrix = useMemo(() => buildQrMatrix(text), [text]);
  return useMemo(() => renderQrSvgFromMatrix(matrix, style), [matrix, style]);
}
