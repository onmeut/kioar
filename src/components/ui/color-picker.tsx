"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { PipetteIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

/**
 * In-house color picker. No new dependency — HSV math is a few lines and
 * the popover/input primitives already exist in this repo.
 *
 * Accepted input formats (loose, because users may paste anything):
 *   - "#rgb" / "#rrggbb"
 *   - "rgb(r, g, b)"
 *   - "var(--token)" — preserved on submit; for the swatch we resolve via
 *     `getComputedStyle` against an offscreen element so the picker still
 *     shows the real colour.
 *
 * On any change from inside the picker we emit a hex string. If the field
 * was previously a `var(--…)` token, the hex overwrites it — that's the
 * desired behaviour: the user is opting in to a custom colour.
 */

export type ColorPickerProps = {
  value: string;
  onChange: (next: string) => void;
  label?: string;
  /** Optional swatches surfaced under a "Suggested" row. Token strings ok. */
  suggested?: string[];
  className?: string;
};

export function ColorPicker({
  value,
  onChange,
  label,
  suggested,
  className,
}: ColorPickerProps) {
  const resolvedHex = useResolvedHex(value);
  const displayLabel = formatDisplayLabel(value, resolvedHex);

  return (
    <div className={cn("space-y-1.5", className)}>
      {label ? (
        <Label className="text-xs text-muted-foreground">{label}</Label>
      ) : null}
      <Popover>
        <PopoverTrigger
          render={
            <button
              type="button"
              className="flex h-11 w-full items-center gap-3 rounded-xl border border-border bg-background px-3 text-sm text-foreground transition-colors hover:bg-muted"
            >
              <span
                className="size-6 shrink-0 rounded-full border border-border shadow-inner"
                style={{ background: resolvedHex || value }}
                aria-hidden
              />
              <span className="truncate text-start" dir="ltr">
                {displayLabel}
              </span>
            </button>
          }
        />
        <PopoverContent className="w-72 p-3" align="start">
          <ColorPickerBody
            value={resolvedHex}
            onChange={onChange}
            suggested={suggested}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────── */

function ColorPickerBody({
  value,
  onChange,
  suggested,
}: {
  value: string;
  onChange: (next: string) => void;
  suggested?: string[];
}) {
  const hex = sanitizeHex(value) ?? "#ffffff";
  const [h, s, v] = useMemo(() => hexToHsv(hex), [hex]);
  const [hexDraft, setHexDraft] = useState(hex.toUpperCase());

  // Keep the local text draft in sync when the canonical hex changes
  // (e.g. user picks a swatch).
  useEffect(() => {
    setHexDraft(hex.toUpperCase());
  }, [hex]);

  const emit = useCallback(
    (next: [number, number, number]) => {
      const out = hsvToHex(next[0], next[1], next[2]);
      onChange(out);
    },
    [onChange],
  );

  const onSv = useCallback(
    (nextS: number, nextV: number) => emit([h, nextS, nextV]),
    [emit, h],
  );
  const onHue = useCallback(
    (nextH: number) => emit([nextH, s, v]),
    [emit, s, v],
  );

  const onHexChange = useCallback(
    (raw: string) => {
      setHexDraft(raw);
      const cleaned = sanitizeHex(raw);
      if (cleaned) onChange(cleaned);
    },
    [onChange],
  );

  const onEyedropper = useCallback(async () => {
    // EyeDropper API ships in Chrome/Edge but not Safari/Firefox; gracefully
    // hide the button when unsupported.
    const Win = window as unknown as {
      EyeDropper?: new () => { open: () => Promise<{ sRGBHex: string }> };
    };
    if (!Win.EyeDropper) return;
    try {
      const dropper = new Win.EyeDropper();
      const result = await dropper.open();
      const cleaned = sanitizeHex(result.sRGBHex);
      if (cleaned) onChange(cleaned);
    } catch {
      // User cancelled — silent.
    }
  }, [onChange]);

  const eyedropperSupported =
    typeof window !== "undefined" && "EyeDropper" in window;

  return (
    <div className="space-y-3" dir="ltr">
      <SaturationValueSquare hue={h} s={s} v={v} onChange={onSv} />
      <HueSlider hue={h} onChange={onHue} />
      <div className="flex items-center gap-2">
        <Input
          value={hexDraft}
          onChange={(e) => onHexChange(e.target.value)}
          dir="ltr"
          inputMode="text"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          className="h-9 flex-1 font-mono text-sm uppercase"
          maxLength={9}
        />
        {eyedropperSupported ? (
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={onEyedropper}
            className="h-9 w-9 shrink-0"
            aria-label="انتخاب رنگ از صفحه"
          >
            <PipetteIcon className="size-4" aria-hidden />
          </Button>
        ) : null}
      </div>
      {suggested && suggested.length > 0 ? (
        <div className="space-y-1.5">
          <p className="text-[11px] font-bold text-muted-foreground">
            پیشنهادی
          </p>
          <div className="flex flex-wrap gap-1.5">
            {suggested.map((swatch) => {
              const swatchHex = resolveCssColorToHex(swatch) ?? swatch;
              return (
                <button
                  key={swatch}
                  type="button"
                  onClick={() => onChange(swatchHex)}
                  className="size-6 rounded-full border border-border shadow-inner transition-transform hover:scale-110"
                  style={{ background: swatch }}
                  aria-label={swatch}
                />
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────── */

function SaturationValueSquare({
  hue,
  s,
  v,
  onChange,
}: {
  hue: number;
  s: number;
  v: number;
  onChange: (s: number, v: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);

  const update = useCallback(
    (clientX: number, clientY: number) => {
      const el = ref.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const x = clamp01((clientX - r.left) / r.width);
      const y = clamp01((clientY - r.top) / r.height);
      onChange(x, 1 - y);
    },
    [onChange],
  );

  const onDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    draggingRef.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    update(e.clientX, e.clientY);
  };
  const onMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    update(e.clientX, e.clientY);
  };
  const onUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    draggingRef.current = false;
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  const hueHex = hsvToHex(hue, 1, 1);

  return (
    <div
      ref={ref}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      className="relative h-36 w-full cursor-crosshair touch-none overflow-hidden rounded-lg border border-border"
      style={{
        background: `
          linear-gradient(to top, #000, transparent),
          linear-gradient(to right, #fff, ${hueHex})
        `,
      }}
    >
      <div
        className="pointer-events-none absolute size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.5)]"
        style={{
          left: `${s * 100}%`,
          top: `${(1 - v) * 100}%`,
          background: hsvToHex(hue, s, v),
        }}
        aria-hidden
      />
    </div>
  );
}

function HueSlider({
  hue,
  onChange,
}: {
  hue: number;
  onChange: (next: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);

  const update = useCallback(
    (clientX: number) => {
      const el = ref.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const x = clamp01((clientX - r.left) / r.width);
      onChange(x * 360);
    },
    [onChange],
  );

  const onDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    draggingRef.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    update(e.clientX);
  };
  const onMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    update(e.clientX);
  };
  const onUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    draggingRef.current = false;
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  return (
    <div
      ref={ref}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      className="relative h-3 w-full cursor-pointer touch-none overflow-hidden rounded-full"
      style={{
        background:
          "linear-gradient(to right, #f00 0%, #ff0 17%, #0f0 33%, #0ff 50%, #00f 67%, #f0f 83%, #f00 100%)",
      }}
    >
      <div
        className="pointer-events-none absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.5)]"
        style={{
          left: `${(hue / 360) * 100}%`,
          background: hsvToHex(hue, 1, 1),
        }}
        aria-hidden
      />
    </div>
  );
}

/* ───────────────────────── helpers ───────────────────────── */

function formatDisplayLabel(value: string, resolvedHex: string): string {
  // Always show hex — covers var() tokens, oklch(), rgb(), and anything
  // else the browser resolved. Falls back to raw value only if truly
  // unresolvable (e.g. first SSR pass before paint).
  if (resolvedHex) return resolvedHex.toUpperCase();
  if (/^#[0-9a-fA-F]{3,8}$/.test(value.trim())) return value.trim().toUpperCase();
  return "انتخاب رنگ";
}

/**
 * Try hard to map any colour-ish string to a `#rrggbb` hex. Returns "" if
 * we can't resolve it (e.g. var() outside the DOM, or `oklch()` pre-paint
 * on first SSR pass). Resolution happens via a hidden element + canvas
 * round-trip — the most compatible way to ask the browser "what RGB is
 * this CSS value?".
 */
function useResolvedHex(value: string): string {
  const [hex, setHex] = useState<string>(() => sanitizeHex(value) ?? "");

  useEffect(() => {
    const direct = sanitizeHex(value);
    if (direct) {
      setHex(direct);
      return;
    }
    setHex(resolveCssColorToHex(value) ?? "");
  }, [value]);

  return hex;
}

function resolveCssColorToHex(value: string): string | null {
  if (typeof document === "undefined") return null;
  const el = document.createElement("div");
  el.style.color = value;
  el.style.display = "none";
  document.body.appendChild(el);
  const rgb = getComputedStyle(el).color;
  document.body.removeChild(el);
  // getComputedStyle returns "rgb(r, g, b)" or "rgba(r, g, b, a)".
  const m = rgb.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (!m) return null;
  return rgbToHex(Number(m[1]), Number(m[2]), Number(m[3]));
}

function sanitizeHex(input: string): string | null {
  if (!input) return null;
  let v = input.trim();
  if (!v) return null;
  if (!v.startsWith("#")) v = `#${v}`;
  if (/^#[0-9a-fA-F]{3}$/.test(v)) {
    return `#${v[1]}${v[1]}${v[2]}${v[2]}${v[3]}${v[3]}`.toLowerCase();
  }
  if (/^#[0-9a-fA-F]{6}$/.test(v)) return v.toLowerCase();
  if (/^#[0-9a-fA-F]{8}$/.test(v)) return v.slice(0, 7).toLowerCase();
  return null;
}

function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) =>
    Math.round(clamp(n, 0, 255)).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function hexToHsv(hex: string): [number, number, number] {
  const clean = sanitizeHex(hex) ?? "#000000";
  const r = parseInt(clean.slice(1, 3), 16) / 255;
  const g = parseInt(clean.slice(3, 5), 16) / 255;
  const b = parseInt(clean.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  const s = max === 0 ? 0 : d / max;
  const v = max;
  if (d !== 0) {
    switch (max) {
      case r:
        h = ((g - b) / d) % 6;
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      default:
        h = (r - g) / d + 4;
    }
    h *= 60;
    if (h < 0) h += 360;
  }
  return [h, s, v];
}

function hsvToHex(h: number, s: number, v: number): string {
  const c = v * s;
  const hh = (h % 360) / 60;
  const x = c * (1 - Math.abs((hh % 2) - 1));
  let r = 0;
  let g = 0;
  let b = 0;
  if (0 <= hh && hh < 1) [r, g, b] = [c, x, 0];
  else if (1 <= hh && hh < 2) [r, g, b] = [x, c, 0];
  else if (2 <= hh && hh < 3) [r, g, b] = [0, c, x];
  else if (3 <= hh && hh < 4) [r, g, b] = [0, x, c];
  else if (4 <= hh && hh < 5) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const m = v - c;
  return rgbToHex((r + m) * 255, (g + m) * 255, (b + m) * 255);
}

function clamp01(n: number): number {
  return clamp(n, 0, 1);
}

function clamp(n: number, min: number, max: number): number {
  if (n < min) return min;
  if (n > max) return max;
  return n;
}
