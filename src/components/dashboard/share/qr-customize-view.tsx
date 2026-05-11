"use client";

import { useState } from "react";
import {
  CheckIcon,
  CrownIcon,
  DownloadIcon,
  EyeIcon,
  EyeOffIcon,
  ImageIcon,
  LockIcon,
  SparklesIcon,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { UpgradePlanModal } from "@/components/dashboard/upgrade-plan-modal";
import { cn } from "@/lib/utils";
import {
  DEFAULT_QR_STYLE,
  QR_COLOR_SWATCHES,
  type QrDotStyle,
  type QrMarkerBorder,
  type QrMarkerCenter,
  type QrStyle,
} from "@/lib/qr/types";
import { downloadQrPng, downloadQrSvg } from "@/lib/qr/export";

import { QrRenderer, useQrSvg } from "./qr-renderer";

type Props = {
  publicUrl: string;
  displayName: string;
  initialStyle: QrStyle;
  /** When false, Save is replaced with an upgrade CTA. */
  canCustomize: boolean;
  onSave: (style: QrStyle) => void;
  onCancel: () => void;
};

/**
 * Full QR customisation surface.
 *
 * The renderer re-rasterises on every style change because the encode
 * step is memoised against `publicUrl` only — so interactive sliders
 * stay snappy even on low-end mobiles.
 *
 * Free-plan users can fiddle freely (encourages discovery + upgrade
 * intent) but the Save button is swapped for an upgrade CTA. They
 * can still download the default QR via the PNG/SVG buttons, which
 * are part of the always-on `qr_code_basic` feature.
 */
export function QrCustomizeView({
  publicUrl,
  displayName,
  initialStyle,
  canCustomize,
  onSave,
  onCancel,
}: Props) {
  const [style, setStyle] = useState<QrStyle>(initialStyle);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const isDirty = JSON.stringify(style) !== JSON.stringify(initialStyle);

  // Always export with the user's *currently visible* style. Free
  // users see exactly the QR they're previewing, even if they can't
  // persist it — that matches Linktree's pattern and lets the locked
  // preview act as a soft upsell.
  const exportSvg = useQrSvg(publicUrl, style);
  const baseFilename =
    "kioar-qr-" +
    (displayName || "code")
      .replace(/\s+/g, "-")
      .replace(/[^\w-]+/g, "")
      .toLowerCase();

  function update<K extends keyof QrStyle>(key: K, value: QrStyle[K]) {
    setStyle((prev) => ({ ...prev, [key]: value }));
  }

  function handleSave() {
    if (!canCustomize) {
      setUpgradeOpen(true);
      return;
    }
    onSave(style);
  }

  async function handlePng() {
    try {
      await downloadQrPng(exportSvg, `${baseFilename}.png`);
    } catch {
      toast.error("ساخت PNG با خطا مواجه شد.");
    }
  }

  function handleSvg() {
    try {
      downloadQrSvg(exportSvg, `${baseFilename}.svg`);
    } catch {
      toast.error("دانلود SVG با خطا مواجه شد.");
    }
  }

  function handleReset() {
    setStyle(DEFAULT_QR_STYLE);
  }

  return (
    <div className="space-y-5">
      {/* Pro/Business badge */}
      {!canCustomize ? (
        <div className="flex items-center gap-2 rounded-2xl border border-border bg-muted/40 px-3 py-2 text-xs">
          <CrownIcon className="size-4 shrink-0 text-amber-500" aria-hidden />
          <span className="text-foreground/80">
            شخصی‌سازی رنگ و استایل ویژه پلن حرفه‌ای و کسب‌وکار است.
          </span>
        </div>
      ) : null}

      {/* Preview — QR takes half, download buttons the other half */}
      <div className="flex items-stretch gap-3 rounded-2xl border border-border bg-white p-3">
        <div className="flex flex-1 flex-col justify-center gap-1.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handlePng}
            className="h-8 w-full justify-start rounded-lg text-xs"
          >
            <DownloadIcon className="size-3.5" />
            دانلود PNG
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleSvg}
            className="h-8 w-full justify-start rounded-lg text-xs"
          >
            <ImageIcon className="size-3.5" />
            دانلود SVG
          </Button>
        </div>
        <div className="aspect-square w-1/2 shrink-0">
          <QrRenderer text={publicUrl} style={style} />
        </div>
      </div>

      {/* Controls — 2-col paired layout so everything fits on screen */}
      <div className="space-y-4">
        {/* Row 1: Logo + Dot style */}
        <div className="grid grid-cols-2 gap-3">
          <ControlRow label="لوگو">
            <SegmentedControl
              value={style.showLogo ? "show" : "hide"}
              onChange={(v) => update("showLogo", v === "show")}
              options={[
                {
                  value: "show",
                  label: "نمایش",
                  icon: <EyeIcon className="size-4" aria-hidden />,
                },
                {
                  value: "hide",
                  label: "مخفی",
                  icon: <EyeOffIcon className="size-4" aria-hidden />,
                },
              ]}
            />
          </ControlRow>

          <ControlRow label="استایل پیکسل‌ها">
            <SegmentedControl<QrDotStyle>
              value={style.dotStyle}
              onChange={(v) => update("dotStyle", v)}
              options={[
                { value: "square", label: "مربع", icon: <DotIconSquare /> },
                { value: "dots", label: "دایره", icon: <DotIconDots /> },
                { value: "rounded", label: "نرم", icon: <DotIconRounded /> },
              ]}
            />
          </ControlRow>
        </div>

        {/* Row 2: Marker center + Marker border */}
        <div className="grid grid-cols-2 gap-3">
          <ControlRow label="مرکز نشانگرها">
            <SegmentedControl<QrMarkerCenter>
              value={style.markerCenter}
              onChange={(v) => update("markerCenter", v)}
              options={[
                {
                  value: "square",
                  label: "مربع",
                  icon: <MarkerCenterIcon variant="square" />,
                },
                {
                  value: "dot",
                  label: "دایره",
                  icon: <MarkerCenterIcon variant="dot" />,
                },
              ]}
            />
          </ControlRow>

          <ControlRow label="قاب نشانگرها">
            <SegmentedControl<QrMarkerBorder>
              value={style.markerBorder}
              onChange={(v) => update("markerBorder", v)}
              options={[
                {
                  value: "square",
                  label: "مربع",
                  icon: <MarkerBorderIcon variant="square" />,
                },
                {
                  value: "rounded",
                  label: "نرم",
                  icon: <MarkerBorderIcon variant="rounded" />,
                },
                {
                  value: "circle",
                  label: "دایره",
                  icon: <MarkerBorderIcon variant="circle" />,
                },
              ]}
            />
          </ControlRow>
        </div>

        {/* Dot colour */}
        <ControlRow label="رنگ پیکسل‌ها">
          <SwatchRow
            value={style.dotColor}
            onChange={(c) => update("dotColor", c)}
          />
        </ControlRow>

        {/* Marker colour */}
        <ControlRow label="رنگ نشانگرها">
          <SwatchRow
            value={style.markerColor}
            onChange={(c) => update("markerColor", c)}
          />
        </ControlRow>
      </div>

      {/* Footer actions */}
      <div className="sticky bottom-0 -mx-5 mt-2 flex items-center gap-2 border-t border-border bg-background/95 px-5 py-3 backdrop-blur">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-10"
          onClick={isDirty ? handleReset : onCancel}
        >
          {isDirty ? "بازنشانی" : "انصراف"}
        </Button>
        <div className="flex-1" />
        {canCustomize ? (
          <Button
            type="button"
            className="h-10"
            onClick={handleSave}
            disabled={!isDirty}
          >
            <CheckIcon className="size-4" />
            ذخیره
          </Button>
        ) : (
          <Button
            type="button"
            className="h-10"
            onClick={() => setUpgradeOpen(true)}
          >
            <SparklesIcon className="size-4" />
            ارتقا برای ذخیره
          </Button>
        )}
      </div>

      <UpgradePlanModal
        open={upgradeOpen}
        onClose={() => setUpgradeOpen(false)}
        plan="pro"
        featureName="شخصی‌سازی کیو‌آر‌کد"
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Generic control primitives
// ---------------------------------------------------------------------------

function ControlRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      {children}
    </div>
  );
}

type SegOption<T extends string> = {
  value: T;
  label: string;
  icon: React.ReactNode;
};

function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: SegOption<T>[];
}) {
  return (
    <div className="grid auto-cols-fr grid-flow-col gap-1.5">
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            aria-pressed={active}
            aria-label={opt.label}
            className={cn(
              "flex items-center justify-center rounded-xl border px-2 py-3 transition-colors",
              active
                ? "border-foreground bg-foreground/5 text-foreground"
                : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            {opt.icon}
          </button>
        );
      })}
    </div>
  );
}

function SwatchRow({
  value,
  onChange,
}: {
  value: string;
  onChange: (c: string) => void;
}) {
  return (
    <div className="flex items-center gap-3">
      {/* Hex pill — first in DOM = rightmost in RTL */}
      <label className="inline-flex h-7 shrink-0 cursor-pointer items-center gap-1.5 rounded-full border border-border px-2.5 text-[11px] font-medium hover:bg-muted/60">
        <span
          aria-hidden
          className="size-3 rounded-full border border-black/10"
          style={{ backgroundColor: value }}
        />
        <span dir="ltr" className="font-mono uppercase">
          {value}
        </span>
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="sr-only"
        />
      </label>
      {/* Swatches — fill remaining width evenly */}
      <div
        className="flex flex-1 items-center justify-between"
        role="radiogroup"
        aria-label="پالت رنگ"
      >
        {QR_COLOR_SWATCHES.map((c) => {
          const active = c.toLowerCase() === value.toLowerCase();
          return (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={active}
              aria-label={c}
              onClick={() => onChange(c)}
              className={cn(
                "relative size-6 shrink-0 rounded-full transition-transform",
                active
                  ? "ring-2 ring-foreground ring-offset-2 scale-110"
                  : "hover:scale-105",
              )}
              style={{ backgroundColor: c }}
            >
              {active ? (
                <CheckIcon
                  className="absolute inset-0 m-auto size-3.5"
                  style={{
                    color: shouldUseLightCheck(c) ? "#ffffff" : "#000000",
                  }}
                  aria-hidden
                />
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * White-on-dark check is illegible on yellow/pink. Use a luminance
 * threshold (sRGB-perceptual) so the indicator stays readable on any
 * swatch a future designer adds.
 */
function shouldUseLightCheck(hex: string): boolean {
  const v = hex.replace("#", "");
  if (v.length !== 6) return true;
  const r = parseInt(v.slice(0, 2), 16);
  const g = parseInt(v.slice(2, 4), 16);
  const b = parseInt(v.slice(4, 6), 16);
  // Relative luminance (Rec. 709 coefficients).
  const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return lum < 0.55;
}

// ---------------------------------------------------------------------------
// Mini preview icons (inline SVG — match the style they describe)
// ---------------------------------------------------------------------------

function DotIconSquare() {
  return (
    <svg viewBox="0 0 16 16" width={18} height={18} aria-hidden>
      <g fill="currentColor">
        <rect x="2" y="2" width="3" height="3" />
        <rect x="6" y="2" width="3" height="3" />
        <rect x="2" y="6" width="3" height="3" />
        <rect x="11" y="11" width="3" height="3" />
        <rect x="6" y="11" width="3" height="3" />
      </g>
    </svg>
  );
}
function DotIconDots() {
  return (
    <svg viewBox="0 0 16 16" width={18} height={18} aria-hidden>
      <g fill="currentColor">
        <circle cx="3.5" cy="3.5" r="1.4" />
        <circle cx="7.5" cy="3.5" r="1.4" />
        <circle cx="3.5" cy="7.5" r="1.4" />
        <circle cx="12.5" cy="12.5" r="1.4" />
        <circle cx="7.5" cy="12.5" r="1.4" />
      </g>
    </svg>
  );
}
function DotIconRounded() {
  return (
    <svg viewBox="0 0 16 16" width={18} height={18} aria-hidden>
      <g fill="currentColor">
        <rect x="2" y="2" width="3" height="3" rx="1" />
        <rect x="6" y="2" width="3" height="3" rx="1" />
        <rect x="2" y="6" width="3" height="3" rx="1" />
        <rect x="11" y="11" width="3" height="3" rx="1" />
        <rect x="6" y="11" width="3" height="3" rx="1" />
      </g>
    </svg>
  );
}

function MarkerCenterIcon({ variant }: { variant: "square" | "dot" }) {
  return (
    <svg viewBox="0 0 16 16" width={18} height={18} aria-hidden>
      <rect
        x="1.5"
        y="1.5"
        width="13"
        height="13"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      />
      {variant === "square" ? (
        <rect x="5" y="5" width="6" height="6" fill="currentColor" />
      ) : (
        <circle cx="8" cy="8" r="3" fill="currentColor" />
      )}
    </svg>
  );
}

function MarkerBorderIcon({
  variant,
}: {
  variant: "square" | "rounded" | "circle";
}) {
  return (
    <svg viewBox="0 0 16 16" width={18} height={18} aria-hidden>
      {variant === "circle" ? (
        <circle
          cx="8"
          cy="8"
          r="6.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        />
      ) : (
        <rect
          x="1.5"
          y="1.5"
          width="13"
          height="13"
          rx={variant === "rounded" ? 4 : 0}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        />
      )}
    </svg>
  );
}
