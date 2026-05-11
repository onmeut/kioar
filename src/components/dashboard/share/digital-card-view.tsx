"use client";

import { useState } from "react";
import { CheckIcon, ImageDownIcon, UserPlusIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { DEFAULT_QR_STYLE, type QrStyle } from "@/lib/qr/types";

import { QrRenderer, useQrSvg } from "./qr-renderer";

// ─────────────────────────────────────────────────────────────────────────────
// Kioar logo (public/brand/logo.svg — viewBox 0 0 200 227)
// ─────────────────────────────────────────────────────────────────────────────

const LOGO_PATH_D =
  "M151.4 117.169C153.455 118.534 160.108 128.1 161.962 130.701C182.272 158.864 195.335 191.593 200 226C190.636 226.157 180.978 226.051 171.591 226.065L164.667 226.08C159.156 202.028 149.878 176.984 136.9 155.886C132.386 148.547 127.575 142.923 122.404 136.206C134.84 130.037 140.664 125.587 151.4 117.169ZM53.288 141.321C63.3467 145.499 77.6899 145.997 88.4189 145.472C82.0609 167.317 72.7591 188.144 63.1484 208.716C60.7428 213.865 58.1322 218.928 55.4765 223.951L52.0986 224.034C40.0649 224.117 28.0307 224.118 15.997 224.036C19.3368 217.518 22.9646 210.894 26.1943 204.378C36.5304 183.944 45.5793 162.884 53.288 141.321ZM44.207 0.192552C47.5642 -0.27478 53.0934 0.188675 56.3818 0.729661C99.8926 7.88452 106.055 54.5237 99.8583 90.2707C87.453 95.0276 78.4732 96.51 65.4589 92.5304C65.7765 91.0444 66.0837 89.5558 66.3827 88.0656C68.954 75.1761 70.7105 52.53 63.2411 41.5246C60.4613 37.3427 56.1055 34.4653 51.1679 33.549C40.8436 31.6753 33.7738 36.7129 32.0956 47.0383C30.0676 59.5152 34.1573 73.5013 41.3866 83.6896C48.2645 93.5115 58.8339 100.122 70.6757 102.007C87.6437 104.827 101.915 99.886 115.645 90.2551C139.705 73.3788 150.339 52.1517 155.062 23.8049C155.871 18.3647 156.428 8.92095 156.111 3.50603C157.815 3.46948 159.749 3.50384 161.461 3.59392C171.168 4.1025 181.242 3.76221 190.91 4.39177C191.575 36.6049 181.456 71.14 160.629 95.9552C143.065 116.883 116.532 134.736 88.8349 137.278C66.5983 139.471 44.4113 132.653 27.2431 118.352C11.7783 105.244 2.12974 86.5485 0.405196 66.3498C-1.52727 44.5439 3.07413 20.4312 22.4384 7.69158C29.4877 3.05345 35.8722 0.901398 44.207 0.192552Z";

// ─────────────────────────────────────────────────────────────────────────────
// Swatches — colours live in globals.css as --card-color-N
// ─────────────────────────────────────────────────────────────────────────────

const SWATCHES = [
  { cssVar: "--card-color-1", label: "لیمویی", text: "#0a0a0a" },
  { cssVar: "--card-color-2", label: "زغالی", text: "#ffffff" },
  { cssVar: "--card-color-3", label: "صورتی", text: "#0a0a0a" },
  { cssVar: "--card-color-4", label: "آبی", text: "#ffffff" },
  { cssVar: "--card-color-5", label: "نارنجی", text: "#0a0a0a" },
  { cssVar: "--card-color-6", label: "سبز", text: "#0a0a0a" },
  { cssVar: "--card-color-7", label: "مشکی", text: "#ffffff" },
  { cssVar: "--card-color-8", label: "قرمز", text: "#ffffff" },
  { cssVar: "--card-color-9", label: "زرشکی", text: "#ffffff" },
] as const;

type Swatch = (typeof SWATCHES)[number];

function resolveCssVar(varName: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
}

// ─────────────────────────────────────────────────────────────────────────────
// Social-media export ratios
// ─────────────────────────────────────────────────────────────────────────────

const RATIOS = [
  { id: "square",    label: "۱:۱",  desc: "پست",    outputW: 1080, outputH: 1080 },
  { id: "portrait",  label: "۴:۵",  desc: "عمودی",  outputW: 1080, outputH: 1350 },
  { id: "story",     label: "۹:۱۶", desc: "استوری", outputW: 1080, outputH: 1920 },
  { id: "landscape", label: "۱۶:۹", desc: "افقی",   outputW: 1920, outputH: 1080 },
] as const;

type RatioId = (typeof RATIOS)[number]["id"];

// ─────────────────────────────────────────────────────────────────────────────
// Canvas helpers
// ─────────────────────────────────────────────────────────────────────────────

async function ensureFont(): Promise<void> {
  if (typeof window === "undefined") return;
  await document.fonts.ready;
  if (!document.fonts.check("16px IRANYekanXVF")) {
    const face = new FontFace(
      "IRANYekanXVF",
      'url(/fonts/IRANYekanXVF.woff2) format("woff2-variations")',
      { weight: "100 900", style: "normal" },
    );
    document.fonts.add(await face.load());
  }
}

async function loadSvgImage(svg: string): Promise<HTMLImageElement> {
  const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("svg-load-failed")); };
    img.src = url;
  });
}

function fillRoundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number,
) {
  ctx.beginPath();
  if (typeof ctx.roundRect === "function") {
    ctx.roundRect(x, y, w, h, r);
  } else {
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r);
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h);
    ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
  }
  ctx.fill();
}

function fitText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(t + "…").width > maxWidth) t = t.slice(0, -1);
  return t + "…";
}

/** Draw the Kioar logo mark at (x, y) scaled to `size` px wide. */
function drawLogo(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, size: number, color: string,
) {
  const scale = size / 200;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.fillStyle = color;
  ctx.fill(new Path2D(LOGO_PATH_D));
  ctx.restore();
}

async function renderCardToPng(opts: {
  name: string;
  publicUrl: string;
  qrSvg: string;
  bg: string;
  textColor: string;
  outputW: number;
  outputH: number;
}): Promise<void> {
  const { name, publicUrl, qrSvg, bg, textColor: tc, outputW: W, outputH: H } = opts;

  await ensureFont();
  const qrImg = await loadSvgImage(qrSvg);

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas-2d-unsupported");

  const isLandscape = W > H;
  const S = Math.min(W, H);
  const PAD = Math.round(S * 0.075);
  const F = `"IRANYekanXVF", Tahoma, sans-serif`;

  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  const urlDisplay = publicUrl.replace(/^https?:\/\//, "");

  if (isLandscape) {
    // ── Landscape: text on right half, QR on left half ───────────────────────
    const halfW = Math.round(W / 2);

    // Logo — top-right corner
    const logoW = Math.round(S * 0.1);
    const logoH = Math.round(logoW * (227 / 200));
    drawLogo(ctx, W - PAD - logoW, PAD, logoW, tc);

    // Text column (right half)
    const textRight = W - PAD;
    const colMaxW = halfW - 2 * PAD;
    const nameLabelSz = Math.round(S * 0.023);
    const nameSz = Math.round(S * (name.length > 12 ? 0.072 : 0.088));
    const urlLabelSz = Math.round(S * 0.023);
    const urlSz = Math.round(S * 0.040);

    const startY = Math.round(H * 0.30);
    const nameLabelY = startY;
    const nameY = nameLabelY + nameSz + Math.round(S * 0.018);
    const urlLabelY = nameY + Math.round(S * 0.075);
    const urlY = urlLabelY + urlSz + Math.round(S * 0.012);

    ctx.save(); ctx.direction = "rtl"; ctx.textAlign = "right";
    ctx.font = `600 ${nameLabelSz}px ${F}`; ctx.fillStyle = tc; ctx.globalAlpha = 0.55;
    ctx.fillText("نام", textRight, nameLabelY); ctx.globalAlpha = 1; ctx.restore();

    ctx.save(); ctx.direction = "rtl"; ctx.textAlign = "right";
    ctx.font = `800 ${nameSz}px ${F}`; ctx.fillStyle = tc;
    ctx.fillText(fitText(ctx, name || "—", colMaxW), textRight, nameY); ctx.restore();

    ctx.save(); ctx.direction = "ltr"; ctx.textAlign = "left";
    ctx.font = `600 ${urlLabelSz}px ${F}`; ctx.fillStyle = tc; ctx.globalAlpha = 0.55;
    ctx.fillText("URL", halfW + PAD, urlLabelY); ctx.globalAlpha = 1; ctx.restore();

    ctx.save(); ctx.direction = "ltr"; ctx.textAlign = "left";
    ctx.font = `600 ${urlSz}px ${F}`; ctx.fillStyle = tc;
    ctx.fillText(fitText(ctx, urlDisplay, colMaxW), halfW + PAD, urlY); ctx.restore();

    // QR — left half, centered
    const qrSize = Math.round(Math.min(halfW - 2 * PAD, H - 2 * PAD) * 0.82);
    const qrX = Math.round((halfW - qrSize) / 2);
    const qrY = Math.round((H - qrSize) / 2);
    const qrPad = Math.round(qrSize * 0.06);
    const qrR = Math.round(qrSize * 0.08);
    ctx.save(); ctx.fillStyle = "#ffffff";
    fillRoundRect(ctx, qrX - qrPad, qrY - qrPad, qrSize + 2 * qrPad, qrSize + 2 * qrPad, qrR + qrPad);
    ctx.restore();
    ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);

  } else {
    // ── Portrait / Square / Story ─────────────────────────────────────────────
    const logoW = Math.round(S * 0.11);
    const logoH = Math.round(logoW * (227 / 200));
    drawLogo(ctx, W - PAD - logoW, PAD, logoW, tc);

    const textRight = W - PAD;
    const textLeft = PAD;
    const colMaxW = W - 2 * PAD;

    const nameLabelSz = Math.round(S * 0.026);
    const nameSz = Math.round(S * (name.length > 14 ? 0.072 : 0.090));
    const urlLabelSz = Math.round(S * 0.026);
    const urlSz = Math.round(S * 0.044);

    const blockTop = PAD + logoH + Math.round(S * 0.048);
    const nameLabelY = blockTop;
    const nameY = nameLabelY + nameSz + Math.round(S * 0.018);
    const urlLabelY = nameY + Math.round(S * 0.062);
    const urlY = urlLabelY + urlSz + Math.round(S * 0.014);

    // NAME label — right-aligned
    ctx.save(); ctx.direction = "rtl"; ctx.textAlign = "right";
    ctx.font = `600 ${nameLabelSz}px ${F}`; ctx.fillStyle = tc; ctx.globalAlpha = 0.55;
    ctx.fillText("نام", textRight, nameLabelY); ctx.globalAlpha = 1; ctx.restore();

    // Name — right-aligned, heavy
    ctx.save(); ctx.direction = "rtl"; ctx.textAlign = "right";
    ctx.font = `800 ${nameSz}px ${F}`; ctx.fillStyle = tc;
    ctx.fillText(fitText(ctx, name || "—", colMaxW), textRight, nameY); ctx.restore();

    // URL label — left-aligned
    ctx.save(); ctx.direction = "ltr"; ctx.textAlign = "left";
    ctx.font = `600 ${urlLabelSz}px ${F}`; ctx.fillStyle = tc; ctx.globalAlpha = 0.55;
    ctx.fillText("URL", textLeft, urlLabelY); ctx.globalAlpha = 1; ctx.restore();

    // URL — left-aligned, LTR
    ctx.save(); ctx.direction = "ltr"; ctx.textAlign = "left";
    ctx.font = `600 ${urlSz}px ${F}`; ctx.fillStyle = tc;
    ctx.fillText(fitText(ctx, urlDisplay, colMaxW), textLeft, urlY); ctx.restore();

    // QR — centered, fills remaining vertical space
    const qrAreaTop = urlY + Math.round(S * 0.06);
    const qrAreaH = H - qrAreaTop - PAD;
    const qrSize = Math.round(Math.min(qrAreaH * 0.9, colMaxW * 0.72));
    const qrX = Math.round((W - qrSize) / 2);
    const qrY = qrAreaTop + Math.round((qrAreaH - qrSize) / 2);
    const qrPad = Math.round(qrSize * 0.06);
    const qrR = Math.round(qrSize * 0.08);
    ctx.save(); ctx.fillStyle = "#ffffff";
    fillRoundRect(ctx, qrX - qrPad, qrY - qrPad, qrSize + 2 * qrPad, qrSize + 2 * qrPad, qrR + qrPad);
    ctx.restore();
    ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);
  }

  await new Promise<void>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) { reject(new Error("toBlob-failed")); return; }
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `kioar-card-${Date.now()}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      resolve();
    }, "image/png");
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

type Props = {
  publicUrl: string;
  slug: string;
  displayName: string;
  qrStyle: QrStyle;
};

export function DigitalCardView({ publicUrl, slug, displayName, qrStyle }: Props) {
  const [swatch, setSwatch] = useState<Swatch>(SWATCHES[0]);
  const [ratioId, setRatioId] = useState<RatioId>("square");
  const [downloading, setDownloading] = useState(false);

  const cardQrStyle: QrStyle = { ...DEFAULT_QR_STYLE, showLogo: qrStyle.showLogo };
  const qrSvg = useQrSvg(publicUrl, cardQrStyle);

  const ratio = RATIOS.find((r) => r.id === ratioId)!;
  const isLandscape = ratio.outputW > ratio.outputH;
  const isStory = ratio.outputH / ratio.outputW > 1.4;

  const previewMaxW =
    ratioId === "story"      ? "max-w-[148px]"
    : ratioId === "portrait" ? "max-w-[200px]"
    : ratioId === "landscape" ? "w-full"
    : "max-w-[240px]";

  const displayUrl = publicUrl.replace(/^https?:\/\//, "");

  async function handleDownload() {
    setDownloading(true);
    try {
      const bg = resolveCssVar(swatch.cssVar);
      await renderCardToPng({
        name: displayName,
        publicUrl,
        qrSvg,
        bg,
        textColor: swatch.text,
        outputW: ratio.outputW,
        outputH: ratio.outputH,
      });
      toast.success("کارت دانلود شد.");
    } catch {
      toast.error("دانلود ممکن نشد، دوباره امتحان کنید.");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="space-y-3">
      {/* ── Card preview ──────────────────────────────────────────────────── */}
      <div className={cn("mx-auto transition-all duration-300", previewMaxW)}>
        <div
          className="@container relative overflow-hidden rounded-2xl"
          style={{
            aspectRatio: `${ratio.outputW} / ${ratio.outputH}`,
            backgroundColor: `var(${swatch.cssVar})`,
            color: swatch.text,
          }}
        >
          {/* Logo — top-right (RTL start) */}
          <div
            className="absolute top-0"
            style={{ insetInlineStart: "6cqw", paddingTop: "6cqw" }}
          >
            <svg
              viewBox="0 0 200 227"
              aria-hidden
              fill="currentColor"
              style={{ width: "11cqw", display: "block" }}
            >
              <path d={LOGO_PATH_D} />
            </svg>
          </div>

          {/* Main layout */}
          <div
            className={cn("absolute inset-0 flex", isLandscape ? "flex-row" : "flex-col")}
            style={{ padding: isLandscape ? "0" : "6cqw" }}
          >
            {isLandscape ? (
              <>
                {/* Text — right half (RTL, flex-row first child = right) */}
                <div
                  className="flex w-[52%] flex-col justify-center"
                  style={{ padding: "0 6cqw" }}
                >
                  <div style={{ marginBottom: "2.5cqw" }}>
                    <div
                      className="font-semibold uppercase text-right opacity-55"
                      style={{ fontSize: "3.2cqw", letterSpacing: "0.1em" }}
                    >
                      نام
                    </div>
                    <div
                      className="font-black leading-tight truncate text-right"
                      lang="fa"
                      style={{ fontSize: "min(9cqw, 8cqh)", marginTop: "0.8cqw" }}
                    >
                      {displayName || "—"}
                    </div>
                  </div>
                  <div>
                    <div
                      className="font-semibold uppercase opacity-55 text-left"
                      dir="ltr"
                      style={{ fontSize: "3.2cqw", letterSpacing: "0.1em" }}
                    >
                      URL
                    </div>
                    <div
                      dir="ltr"
                      className="font-semibold truncate opacity-80 text-left"
                      style={{ fontSize: "min(5cqw, 4.5cqh)", marginTop: "0.8cqw" }}
                    >
                      {displayUrl}
                    </div>
                  </div>
                </div>
                {/* QR — left half */}
                <div className="flex w-[48%] items-center justify-center">
                  <div
                    className="rounded-xl bg-white"
                    style={{ width: "64%", aspectRatio: "1", padding: "4.5%" }}
                  >
                    <QrRenderer text={publicUrl} style={cardQrStyle} />
                  </div>
                </div>
              </>
            ) : (
              <>
                {/* Text block — starts below logo */}
                <div style={{ paddingTop: isStory ? "19cqw" : "16cqw" }}>
                  <div style={{ marginBottom: "2cqw" }}>
                    <div
                      className="font-semibold uppercase text-right opacity-55"
                      style={{ fontSize: "3.6cqw", letterSpacing: "0.1em" }}
                    >
                      نام
                    </div>
                    <div
                      className="font-black leading-tight truncate text-right"
                      lang="fa"
                      style={{
                        fontSize: `min(${displayName.length > 10 ? "11" : "14"}cqw, ${displayName.length > 10 ? "10" : "13"}cqh)`,
                        marginTop: "1cqw",
                      }}
                    >
                      {displayName || "—"}
                    </div>
                  </div>
                  <div>
                    <div
                      className="font-semibold uppercase text-left opacity-55"
                      dir="ltr"
                      style={{ fontSize: "3.6cqw", letterSpacing: "0.1em" }}
                    >
                      URL
                    </div>
                    <div
                      dir="ltr"
                      className="font-semibold truncate opacity-80 text-left"
                      style={{ fontSize: "min(5.5cqw, 5cqh)", marginTop: "1cqw" }}
                    >
                      {displayUrl}
                    </div>
                  </div>
                </div>
                {/* QR — centered in remaining space */}
                <div
                  className="flex flex-1 items-center justify-center"
                  style={{ padding: "3cqw 0" }}
                >
                  <div
                    className="rounded-2xl bg-white"
                    style={{
                      width: isStory ? "54%" : "58%",
                      aspectRatio: "1",
                      padding: "5%",
                    }}
                  >
                    <QrRenderer text={publicUrl} style={cardQrStyle} />
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── Ratio picker ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-4 gap-2" role="radiogroup" aria-label="نسبت تصویر">
        {RATIOS.map((r) => (
          <button
            key={r.id}
            type="button"
            role="radio"
            aria-checked={ratioId === r.id}
            onClick={() => setRatioId(r.id)}
            className={cn(
              "rounded-xl py-3 text-center transition-colors",
              ratioId === r.id
                ? "bg-foreground text-background"
                : "bg-muted text-foreground hover:bg-muted/60",
            )}
          >
            <div className="text-sm font-black" dir="ltr">{r.label}</div>
            <div className="mt-0.5 text-[11px] font-medium opacity-60">{r.desc}</div>
          </button>
        ))}
      </div>

      {/* ── Color swatches — one row, fills width ─────────────────────────── */}
      <div
        className="grid gap-1.5"
        style={{ gridTemplateColumns: `repeat(${SWATCHES.length}, 1fr)` }}
        role="radiogroup"
        aria-label="رنگ پس‌زمینه"
      >
        {SWATCHES.map((s) => {
          const active = s.cssVar === swatch.cssVar;
          return (
            <button
              key={s.cssVar}
              type="button"
              role="radio"
              aria-checked={active}
              aria-label={s.label}
              onClick={() => setSwatch(s)}
              className={cn(
                "relative aspect-square rounded-full border-2 transition-transform",
                active
                  ? "border-foreground scale-110"
                  : "border-transparent hover:scale-105",
              )}
              style={{ backgroundColor: `var(${s.cssVar})` }}
            >
              {active ? (
                <CheckIcon
                  className="absolute inset-0 m-auto size-3"
                  style={{ color: s.text }}
                  aria-hidden
                />
              ) : null}
            </button>
          );
        })}
      </div>

      {/* ── Actions ───────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-2">
        <Button className="h-11" onClick={handleDownload} disabled={downloading}>
          <ImageDownIcon className="size-4" />
          {downloading ? "در حال آماده‌سازی…" : "دانلود PNG"}
        </Button>
        <Button
          render={
            <a href={`/${slug}/contact.vcf`} download>
              <UserPlusIcon className="size-4" />
              افزودن به مخاطبین
            </a>
          }
          variant="outline"
          className="h-11"
        />
      </div>

      <p className="text-[11px] leading-relaxed text-muted-foreground">
        تصویر را دانلود کنید و در استوری، پست یا هر شبکه‌ی اجتماعی آپلود کنید.
        «افزودن به مخاطبین» فایل vCard ذخیره می‌کند.
      </p>
    </div>
  );
}
