"use client";

import type { Route } from "next";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import {
  ArrowRightIcon,
  CheckIcon,
  ImageIcon,
  MonitorIcon,
  PaletteIcon,
  RotateCcwIcon,
  SmartphoneIcon,
  UploadCloudIcon,
  XIcon,
  type LucideIcon,
} from "lucide-react";
import {
  RectangleStencil,
  Cropper,
  type CropperRef,
} from "react-mobile-cropper";
import "react-mobile-cropper/dist/style.css";

import { Button } from "@/components/ui/button";
import { ColorPicker } from "@/components/ui/color-picker";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { HalftoneFilter } from "@/components/public-page/halftone-filter";
import {
  PublicProfileCard,
  type PublicProfileCardData,
} from "@/components/public/public-profile-card";
import {
  gradientFromBase,
  SUGGESTED_BASE_COLORS,
  SUGGESTED_GRADIENT_BASES,
} from "@/lib/appearance/color";
import { PAGE_THEMES, getTheme, themeToCssVars } from "@/lib/appearance/themes";
import {
  DEFAULT_APPEARANCE,
  type PageAppearance,
  type Wallpaper,
} from "@/lib/appearance/types";
import {
  isCustomWallpaper,
  tintOverlayStyle,
  wallpaperLayerStyle,
} from "@/lib/appearance/wallpaper";
import { cn } from "@/lib/utils";

/**
 * Sections currently shipped. Locked/coming-soon entries removed —
 * empty rails feel broken, so only show what works today.
 */
type SectionId = "theme" | "wallpaper";

const DEFAULT_CROP_ASPECT = 16 / 9;

type CropAspect = { label: string; value: number };
const CROP_ASPECTS: CropAspect[] = [
  { label: "۱۶:۹", value: 16 / 9 },
  { label: "۴:۳", value: 4 / 3 },
  { label: "۱:۱", value: 1 },
  { label: "۹:۱۶", value: 9 / 16 },
];

type DesignEditorProps = {
  initial: PageAppearance;
  previewProfile: PublicProfileCardData;
  saveAction: (
    appearance: PageAppearance,
  ) => Promise<{ status: string; message?: string }>;
  uploadWallpaperAction: (
    formData: FormData,
  ) => Promise<{ status: string; message?: string; url?: string | null }>;
};

export function DesignEditor({
  initial,
  previewProfile,
  saveAction,
  uploadWallpaperAction,
}: DesignEditorProps) {
  const router = useRouter();
  const [section, setSection] = useState<SectionId>("theme");
  const [draft, setDraft] = useState<PageAppearance>(initial);
  const [savedSnapshot, setSavedSnapshot] = useState<PageAppearance>(initial);
  const [saving, setSaving] = useState(false);
  const [viewport, setViewport] = useState<"phone" | "desktop">("phone");

  const isDirty = useMemo(
    () => JSON.stringify(draft) !== JSON.stringify(savedSnapshot),
    [draft, savedSnapshot],
  );

  const handleSave = useCallback(() => {
    setSaving(true);
    startTransition(async () => {
      try {
        const result = await saveAction(draft);
        if (result.status === "success") {
          setSavedSnapshot(draft);
          toast.success(result.message ?? "ذخیره شد");
          router.refresh();
        } else {
          toast.error(result.message ?? "ذخیره با خطا مواجه شد.");
        }
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "ذخیره با خطا مواجه شد.",
        );
      } finally {
        setSaving(false);
      }
    });
  }, [draft, router, saveAction]);

  const handleReset = useCallback(() => {
    setDraft(DEFAULT_APPEARANCE);
  }, []);

  return (
    <>
      <DesignHeader
        isDirty={isDirty}
        saving={saving}
        onSave={handleSave}
        onReset={handleReset}
      />

      {/* ───────── Desktop layout (md+) ─────────
          3-column: left rail (visual menu) | center preview | right controls */}
      <div className="hidden min-h-0 flex-1 md:flex">
        <SectionsRail
          active={section}
          onChange={setSection}
          draft={draft}
        />
        <div className="flex min-w-0 flex-1 flex-col items-center justify-start gap-4 overflow-y-auto bg-muted/30 px-6 py-6">
          <ViewportToggle value={viewport} onChange={setViewport} />
          <DesktopPreviewArea
            draft={draft}
            profile={previewProfile}
            viewport={viewport}
          />
        </div>
        <aside className="hidden w-[400px] shrink-0 flex-col overflow-y-auto border-s bg-background lg:flex">
          <div className="px-6 py-6">
            <SectionBody
              id={section}
              draft={draft}
              onChange={setDraft}
              uploadAction={uploadWallpaperAction}
            />
          </div>
        </aside>
      </div>

      {/* ───────── Mobile layout ─────────
          Preview fills the available area; bottom sheet hosts the controls
          with sticky tab bar pinned to the very bottom (above iOS inset). */}
      <div className="flex min-h-0 flex-1 flex-col md:hidden">
        <div className="flex shrink-0 items-center justify-center bg-muted/30 px-3 py-1">
          <ViewportToggle value={viewport} onChange={setViewport} compact />
        </div>
        <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-muted/30 px-2 py-1">
          <MobilePreviewArea
            draft={draft}
            profile={previewProfile}
            viewport={viewport}
          />
        </div>
        <MobileControlsSheet
          section={section}
          onSection={setSection}
          draft={draft}
          onChange={setDraft}
          uploadAction={uploadWallpaperAction}
        />
      </div>
    </>
  );
}

/* ─────────────────────────── Header ─────────────────────────── */

function DesignHeader({
  isDirty,
  saving,
  onSave,
  onReset,
}: {
  isDirty: boolean;
  saving: boolean;
  onSave: () => void;
  onReset: () => void;
}) {
  return (
    <header className="sticky top-0 z-30 flex shrink-0 items-center justify-between gap-2 border-b bg-background px-2 py-1.5 pt-[max(env(safe-area-inset-top),0.375rem)] md:px-6 md:py-4 md:pt-4">
      <div className="flex items-center gap-1.5 md:gap-2">
        <Link
          href={"/me" as Route}
          aria-label="بازگشت"
          className="inline-flex size-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground md:size-11"
        >
          <ArrowRightIcon className="size-5" aria-hidden />
        </Link>
        <h1 className="text-base font-bold md:text-xl">طراحی</h1>
      </div>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          onClick={onReset}
          disabled={saving}
          className="tap-target hidden h-11 items-center gap-2 md:inline-flex"
        >
          <RotateCcwIcon className="size-4" aria-hidden />
          پیش‌فرض
        </Button>
        <Button
          type="button"
          onClick={onSave}
          disabled={saving || !isDirty}
          className="h-9 min-w-20 rounded-full text-sm font-bold md:h-11 md:min-w-24 md:text-base"
        >
          {saving ? "در حال ذخیره…" : "ذخیره"}
        </Button>
      </div>
    </header>
  );
}

/* ─────────────────────────── Desktop sections rail ───────────────────────────
 *
 * Visual menu — each item shows a rendered thumbnail of *what it controls*
 * (current theme swatch, current wallpaper) rather than a generic icon.
 * Mirrors the Linktree IA the user referenced.
 */
function SectionsRail({
  active,
  onChange,
  draft,
}: {
  active: SectionId;
  onChange: (s: SectionId) => void;
  draft: PageAppearance;
}) {
  const items: Array<{
    id: SectionId;
    label: string;
    thumb: ReactNode;
  }> = [
    {
      id: "theme",
      label: "تم",
      thumb: <ThemeThumb themeId={draft.theme} />,
    },
    {
      id: "wallpaper",
      label: "پس‌زمینه",
      thumb: <WallpaperThumb wallpaper={draft.wallpaper} themeId={draft.theme} />,
    },
  ];

  return (
    <nav
      aria-label="بخش‌های طراحی"
      className="hidden w-[220px] shrink-0 border-e bg-background px-3 py-5 md:block"
    >
      <div className="mb-3 px-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
        طراحی
      </div>
      <ul className="space-y-1">
        {items.map((it) => {
          const selected = active === it.id;
          return (
            <li key={it.id}>
              <button
                type="button"
                onClick={() => onChange(it.id)}
                aria-current={selected ? "page" : undefined}
                className={cn(
                  "flex w-full items-center gap-3 rounded-2xl p-2 text-start text-sm font-bold transition-colors",
                  selected
                    ? "bg-muted text-foreground"
                    : "text-foreground hover:bg-muted/60",
                )}
              >
                <span className="size-11 shrink-0 overflow-hidden rounded-xl border border-border bg-background">
                  {it.thumb}
                </span>
                <span className="flex-1">{it.label}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function ThemeThumb({ themeId }: { themeId: PageAppearance["theme"] }) {
  const style = themeToCssVars(themeId) as CSSProperties;
  return (
    <div
      className="relative size-full"
      style={{ ...style, background: "var(--background)" }}
    >
      <div className="absolute inset-1 rounded-md border border-[color:var(--border)] bg-[color:var(--card)]" />
      <div className="absolute bottom-1.5 left-1.5 right-1.5 h-1.5 rounded-full bg-[color:var(--primary)]" />
    </div>
  );
}

function WallpaperThumb({
  wallpaper,
  themeId,
}: {
  wallpaper: Wallpaper;
  themeId: PageAppearance["theme"];
}) {
  const themeBg = getTheme(themeId).tokens.background;
  const custom = isCustomWallpaper(wallpaper, themeBg);
  const layer = wallpaperLayerStyle(wallpaper);
  return (
    <div
      className="relative size-full"
      style={{ background: themeBg }}
      data-wallpaper-kind={wallpaper.type}
      data-custom-wallpaper={custom ? "1" : undefined}
    >
      <div className="absolute inset-0" style={layer} />
    </div>
  );
}

/* ─────────────────────────── Mobile controls sheet ─────────────────────────── */

function MobileControlsSheet({
  section,
  onSection,
  draft,
  onChange,
  uploadAction,
}: {
  section: SectionId;
  onSection: (s: SectionId) => void;
  draft: PageAppearance;
  onChange: (next: PageAppearance) => void;
  uploadAction: (
    formData: FormData,
  ) => Promise<{ status: string; message?: string; url?: string | null }>;
}) {
  const [open, setOpen] = useState(false);

  // Lock body scroll when sheet is open so swipes inside the sheet don't
  // bleed through to the preview area underneath.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const items: Array<{
    id: SectionId;
    label: string;
    thumb: ReactNode;
  }> = [
    {
      id: "theme",
      label: "تم",
      thumb: <ThemeThumb themeId={draft.theme} />,
    },
    {
      id: "wallpaper",
      label: "پس‌زمینه",
      thumb: <WallpaperThumb wallpaper={draft.wallpaper} themeId={draft.theme} />,
    },
  ];

  return (
    <>
      {/* Bottom tab bar — always visible, sticky to viewport bottom, safe-area aware.
          Each tab is a card with a live thumbnail of what it controls (mirrors
          the desktop sidebar rail). Tapping opens the controls sheet. */}
      <nav
        className="z-20 flex shrink-0 items-stretch gap-2 border-t bg-background px-2 pt-2 pb-[max(env(safe-area-inset-bottom),1rem)]"
        aria-label="بخش‌های طراحی"
      >
        {items.map((it) => {
          const active = open && section === it.id;
          return (
            <button
              key={it.id}
              type="button"
              onClick={() => {
                onSection(it.id);
                setOpen(true);
              }}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex flex-1 items-center gap-2 rounded-2xl border p-1.5 text-start text-sm font-bold transition-colors",
                active
                  ? "border-foreground bg-muted text-foreground"
                  : "border-border bg-background text-foreground hover:bg-muted/60",
              )}
            >
              <span className="size-10 shrink-0 overflow-hidden rounded-lg border border-border bg-background">
                {it.thumb}
              </span>
              <span className="flex-1 truncate">{it.label}</span>
            </button>
          );
        })}
      </nav>

      {open
        ? createPortal(
            <div
              className="fixed inset-0 z-40 flex flex-col bg-black/40"
              role="dialog"
              aria-modal="true"
              onClick={() => setOpen(false)}
            >
              <div className="flex-1" aria-hidden />
              <div
                className="flex max-h-[80dvh] flex-col rounded-t-3xl bg-background shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="relative flex shrink-0 items-center justify-center border-b px-4 py-4">
                  <div className="absolute left-1/2 top-1.5 h-1 w-10 -translate-x-1/2 rounded-full bg-muted-foreground/30" />
                  <h2 className="text-base font-bold">
                    {items.find((i) => i.id === section)?.label}
                  </h2>
                  <button
                    type="button"
                    aria-label="بستن"
                    onClick={() => setOpen(false)}
                    className="tap-target absolute end-3 inline-flex size-10 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    <XIcon className="size-5" aria-hidden />
                  </button>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto px-4 pt-4 pb-[max(env(safe-area-inset-bottom),1rem)]">
                  <SectionBody
                    id={section}
                    draft={draft}
                    onChange={onChange}
                    uploadAction={uploadAction}
                  />
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

/* ─────────────────────────── Section bodies ─────────────────────────── */

function SectionBody({
  id,
  draft,
  onChange,
  uploadAction,
}: {
  id: SectionId;
  draft: PageAppearance;
  onChange: (next: PageAppearance) => void;
  uploadAction: (
    formData: FormData,
  ) => Promise<{ status: string; message?: string; url?: string | null }>;
}) {
  if (id === "theme") {
    return (
      <ThemeSection
        value={draft.theme}
        onChange={(theme) => onChange({ ...draft, theme })}
      />
    );
  }
  return (
    <WallpaperSection
      value={draft.wallpaper}
      themeId={draft.theme}
      onChange={(wallpaper) => onChange({ ...draft, wallpaper })}
      uploadAction={uploadAction}
    />
  );
}

/* ─────────────────────────── Theme section ─────────────────────────── */

function ThemeSection({
  value,
  onChange,
}: {
  value: PageAppearance["theme"];
  onChange: (id: PageAppearance["theme"]) => void;
}) {
  const neutral = PAGE_THEMES.filter((t) => t.category === "neutral");
  const colors = PAGE_THEMES.filter((t) => t.category === "color");

  return (
    <div className="space-y-6">
      <Section title="پایه">
        <ThemeGrid items={neutral} value={value} onChange={onChange} />
      </Section>
      <Section title="رنگ‌ها">
        <ThemeGrid items={colors} value={value} onChange={onChange} />
      </Section>
    </div>
  );
}

function ThemeGrid({
  items,
  value,
  onChange,
}: {
  items: typeof PAGE_THEMES;
  value: PageAppearance["theme"];
  onChange: (id: PageAppearance["theme"]) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {items.map((preset) => {
        const selected = value === preset.id;
        const swatchStyle = themeToCssVars(preset.id) as CSSProperties;
        return (
          <button
            key={preset.id}
            type="button"
            onClick={() => onChange(preset.id)}
            aria-pressed={selected}
            aria-label={`انتخاب تم ${preset.nameFa}`}
            className={cn(
              "group relative flex flex-col items-stretch gap-2 rounded-2xl border bg-background p-2 text-start transition-colors",
              selected
                ? "border-foreground ring-2 ring-foreground/15"
                : "border-border hover:border-foreground/30",
            )}
          >
            <div
              className="relative h-24 w-full overflow-hidden rounded-xl border border-border"
              style={swatchStyle}
            >
              <div className="absolute inset-0 bg-[var(--background)]" />
              <div className="absolute bottom-3 start-3 h-3 w-12 rounded-full bg-[var(--primary)]" />
              <div className="absolute top-3 start-3 end-3 h-6 rounded-lg border border-[var(--border)] bg-[var(--card)]" />
              <div className="absolute bottom-3 end-3 size-3 rounded-full bg-[var(--foreground)]" />
              {selected ? (
                <div className="absolute end-2 top-2 inline-flex size-6 items-center justify-center rounded-full bg-foreground text-background">
                  <CheckIcon className="size-3.5" aria-hidden />
                </div>
              ) : null}
            </div>
            <div className="px-1 text-sm font-bold text-foreground">
              {preset.nameFa}
            </div>
          </button>
        );
      })}
    </div>
  );
}

/* ─────────────────────────── Wallpaper section ─────────────────────────── */

function WallpaperSection({
  value,
  themeId,
  onChange,
  uploadAction,
}: {
  value: Wallpaper;
  themeId: PageAppearance["theme"];
  onChange: (w: Wallpaper) => void;
  uploadAction: (
    formData: FormData,
  ) => Promise<{ status: string; message?: string; url?: string | null }>;
}) {
  // Track which panel is *shown* independently of the saved draft so that
  // switching tabs doesn't immediately overwrite the current wallpaper.
  // Only controls inside each panel call onChange.
  const [activeTab, setActiveTab] = useState<Wallpaper["type"]>(value.type);

  // Keep activeTab in sync when the parent draft changes externally (e.g. Reset).
  useEffect(() => {
    setActiveTab(value.type);
  }, [value.type]);

  // Build a placeholder wallpaper for the active tab when the draft type
  // doesn't match — shown in the preview but NOT written to draft until
  // the user actually interacts with a control inside that panel.
  const previewWallpaper: Wallpaper = (() => {
    if (activeTab === value.type) return value;
    if (activeTab === "fill") {
      return { type: "fill", color: getTheme(themeId).tokens.background };
    }
    if (activeTab === "gradient") {
      const base =
        value.type === "fill"
          ? value.color
          : SUGGESTED_BASE_COLORS[4].hex;
      const shade = gradientFromBase(base);
      return { type: "gradient", from: shade.from, to: shade.to, direction: "linear-down" };
    }
    return { type: "image", imageUrl: "", effect: "none", tint: 50 };
  })();

  return (
    <div className="space-y-6">
      <Section title="نوع پس‌زمینه">
        <div className="grid grid-cols-3 gap-2">
          <WallpaperTypeChip
            label="یک‌رنگ"
            active={activeTab === "fill"}
            onClick={() => setActiveTab("fill")}
          />
          <WallpaperTypeChip
            label="گرادینت"
            active={activeTab === "gradient"}
            onClick={() => setActiveTab("gradient")}
          />
          <WallpaperTypeChip
            label="تصویر"
            active={activeTab === "image"}
            onClick={() => setActiveTab("image")}
          />
        </div>
      </Section>

      {activeTab === "fill" ? (
        <FillControls
          value={previewWallpaper as Extract<Wallpaper, { type: "fill" }>}
          themeId={themeId}
          onChange={onChange}
          isSaved={activeTab === value.type}
        />
      ) : null}
      {activeTab === "gradient" ? (
        <GradientControls
          value={previewWallpaper as Extract<Wallpaper, { type: "gradient" }>}
          onChange={onChange}
          isSaved={activeTab === value.type}
        />
      ) : null}
      {activeTab === "image" ? (
        <ImageControls
          value={previewWallpaper as Extract<Wallpaper, { type: "image" }>}
          onChange={onChange}
          uploadAction={uploadAction}
        />
      ) : null}
    </div>
  );
}

function WallpaperTypeChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "tap-target rounded-xl border px-3 py-2 text-sm font-bold transition-colors",
        active
          ? "border-foreground bg-foreground text-background"
          : "border-border text-foreground hover:bg-muted",
      )}
    >
      {label}
    </button>
  );
}

function FillControls({
  value,
  themeId,
  onChange,
  isSaved,
}: {
  value: Extract<Wallpaper, { type: "fill" }>;
  themeId: PageAppearance["theme"];
  onChange: (w: Wallpaper) => void;
  isSaved: boolean;
}) {
  const themeBg = getTheme(themeId).tokens.background;
  const isCustom = value.color !== themeBg;
  return (
    <>
      <Section title="رنگ">
        <div className="flex items-end gap-2">
          <ColorPicker
            value={value.color}
            onChange={(color) => onChange({ type: "fill", color })}
            label="رنگ پس‌زمینه"
            className="flex-1"
          />
          {isCustom ? (
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => onChange({ type: "fill", color: themeBg })}
              className="h-11 w-11 shrink-0"
              aria-label="حذف رنگ پس‌زمینه"
            >
              <XIcon className="size-4" aria-hidden />
            </Button>
          ) : null}
        </div>
      </Section>
      <Section title="رنگ‌های پیشنهادی">
        <NamedSwatchGrid
          items={SUGGESTED_BASE_COLORS}
          selectedHex={isSaved ? value.color : ""}
          onPick={(hex) => onChange({ type: "fill", color: hex })}
        />
      </Section>
    </>
  );
}

function GradientControls({
  value,
  onChange,
  isSaved,
}: {
  value: Extract<Wallpaper, { type: "gradient" }>;
  onChange: (w: Wallpaper) => void;
  isSaved: boolean;
}) {
  const applyBase = useCallback(
    (hex: string) => {
      const shade = gradientFromBase(hex);
      onChange({ type: "gradient", from: shade.from, to: shade.to, direction: value.direction ?? "linear-down" });
    },
    [onChange, value.direction],
  );
  return (
    <>
      <Section title="رنگ پایه">
        <ColorPicker
          value={value.from}
          onChange={applyBase}
          label="رنگ گرادینت"
        />
        <p className="text-xs text-muted-foreground">
          سایهٔ دوم به صورت خودکار از روی رنگ پایه ساخته می‌شود.
        </p>
      </Section>
      <Section title="گرادینت‌های پیشنهادی">
        <NamedGradientGrid
          items={SUGGESTED_GRADIENT_BASES}
          selected={isSaved ? { from: value.from, to: value.to } : { from: "", to: "" }}
          onPick={applyBase}
        />
      </Section>
      <Section title="جهت">
        <div className="grid grid-cols-3 gap-2">
          {(["linear-up", "linear-down", "radial"] as const).map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => onChange({ ...value, direction: d })}
              aria-pressed={value.direction === d}
              className={cn(
                "tap-target rounded-xl border px-3 py-2 text-sm font-bold transition-colors",
                value.direction === d
                  ? "border-foreground bg-foreground text-background"
                  : "border-border text-foreground hover:bg-muted",
              )}
            >
              {d === "linear-up"
                ? "خطی بالا"
                : d === "linear-down"
                  ? "خطی پایین"
                  : "شعاعی"}
            </button>
          ))}
        </div>
      </Section>
      <Section title="افکت بافت">
        <label className="flex items-center justify-between rounded-xl border border-border bg-background p-3">
          <div>
            <div className="text-sm font-bold text-foreground">دانه‌دانه</div>
            <div className="text-xs text-muted-foreground">
              یک بافت ظریف روی گرادینت اضافه می‌کند.
            </div>
          </div>
          <Switch
            checked={Boolean(value.noise)}
            onCheckedChange={(noise) => onChange({ ...value, noise })}
          />
        </label>
      </Section>
    </>
  );
}

function NamedSwatchGrid({
  items,
  selectedHex,
  onPick,
}: {
  items: typeof SUGGESTED_BASE_COLORS;
  selectedHex: string;
  onPick: (hex: string) => void;
}) {
  return (
    <div className="grid grid-cols-4 gap-2.5 sm:grid-cols-5">
      {items.map((sw) => {
        const selected = selectedHex.toLowerCase() === sw.hex.toLowerCase();
        return (
          <button
            key={sw.hex}
            type="button"
            onClick={() => onPick(sw.hex)}
            aria-pressed={selected}
            aria-label={`انتخاب رنگ ${sw.nameFa}`}
            className={cn(
              "group flex flex-col items-center gap-1.5 rounded-xl border bg-background p-2 transition-colors",
              selected
                ? "border-foreground"
                : "border-border hover:border-foreground/30",
            )}
          >
            <span
              className="relative size-10 overflow-hidden rounded-full border border-border shadow-inner"
              style={{ backgroundColor: sw.hex }}
              aria-hidden
            >
              {selected ? (
                <span className="absolute inset-0 inline-flex items-center justify-center text-background">
                  <CheckIcon className="size-4 text-white drop-shadow" aria-hidden />
                </span>
              ) : null}
            </span>
            <span className="truncate text-[11px] font-bold text-foreground">
              {sw.nameFa}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function NamedGradientGrid({
  items,
  selected,
  onPick,
}: {
  items: typeof SUGGESTED_GRADIENT_BASES;
  selected: { from: string; to: string };
  onPick: (hex: string) => void;
}) {
  const norm = (h: string) => h.toLowerCase();
  return (
    <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-5">
      {items.map((sw) => {
        const derived = gradientFromBase(sw.hex);
        const active =
          norm(derived.from) === norm(selected.from) &&
          norm(derived.to) === norm(selected.to);
        return (
          <button
            key={sw.hex}
            type="button"
            onClick={() => onPick(sw.hex)}
            aria-pressed={active}
            aria-label={`انتخاب گرادینت ${sw.nameFa}`}
            className={cn(
              "group flex flex-col items-stretch gap-1.5 rounded-xl border bg-background p-2 transition-colors",
              active
                ? "border-foreground"
                : "border-border hover:border-foreground/30",
            )}
          >
            <span
              className="relative h-14 w-full overflow-hidden rounded-lg border border-border"
              style={{
                background: `linear-gradient(180deg, ${derived.from} 0%, ${derived.to} 100%)`,
              }}
              aria-hidden
            >
              {active ? (
                <span className="absolute inset-0 inline-flex items-center justify-center">
                  <CheckIcon
                    className="size-4 text-white drop-shadow"
                    aria-hidden
                  />
                </span>
              ) : null}
            </span>
            <span className="truncate text-center text-[11px] font-bold text-foreground">
              {sw.nameFa}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function ImageControls({
  value,
  onChange,
  uploadAction,
}: {
  value: Extract<Wallpaper, { type: "image" }>;
  onChange: (w: Wallpaper) => void;
  uploadAction: (
    formData: FormData,
  ) => Promise<{ status: string; message?: string; url?: string | null }>;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cropperRef = useRef<CropperRef>(null);
  const [uploading, setUploading] = useState(false);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [cropAspect, setCropAspect] = useState(DEFAULT_CROP_ASPECT);

  useEffect(() => {
    if (!cropSrc) return;
    return () => {
      if (cropSrc.startsWith("blob:")) URL.revokeObjectURL(cropSrc);
    };
  }, [cropSrc]);

  const onPickFile = () => fileInputRef.current?.click();

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setCropSrc(URL.createObjectURL(file));
  };

  const handleCropCancel = () => setCropSrc(null);

  const handleCropSave = async () => {
    const c = cropperRef.current;
    if (!c) return;
    const canvas = c.getCanvas();
    if (!canvas) return;
    setUploading(true);
    try {
      const blob: Blob | null = await new Promise((resolve) =>
        canvas.toBlob((b) => resolve(b), "image/jpeg", 0.92),
      );
      if (!blob) {
        toast.error("برش تصویر ناموفق بود.");
        return;
      }
      const fd = new FormData();
      fd.set("file", blob, "wallpaper.jpg");
      const res = await uploadAction(fd);
      if (res.status === "success" && res.url) {
        onChange({ ...value, imageUrl: res.url });
        toast.success(res.message ?? "تصویر آپلود شد.");
        setCropSrc(null);
      } else {
        toast.error(res.message ?? "آپلود ناموفق بود.");
      }
    } finally {
      setUploading(false);
    }
  };

  const cropOverlay =
    cropSrc && typeof document !== "undefined"
      ? createPortal(
          <div
            className="fixed inset-0 flex flex-col bg-black"
            style={{ zIndex: 9999 }}
            dir="ltr"
          >
            <div className="relative min-h-0 flex-1">
              <Cropper
                ref={cropperRef}
                src={cropSrc}
                stencilComponent={RectangleStencil}
                stencilProps={{ aspectRatio: cropAspect, grid: true }}
                style={{ width: "100%", height: "100%" }}
                className="size-full"
              />
            </div>
            {/* Ratio chips above action buttons */}
            <div className="flex shrink-0 items-center justify-center gap-2 border-t border-white/10 bg-black px-4 py-2">
              {CROP_ASPECTS.map((a) => (
                <button
                  key={a.value}
                  type="button"
                  onClick={() => setCropAspect(a.value)}
                  className={cn(
                    "rounded-full px-3 py-1 text-xs font-bold transition-colors",
                    cropAspect === a.value
                      ? "bg-white text-black"
                      : "border border-white/30 text-white hover:bg-white/10",
                  )}
                >
                  {a.label}
                </button>
              ))}
            </div>
            <div className="safe-pb flex shrink-0 items-center justify-between gap-2 border-t border-white/10 bg-black px-4 py-3">
              <Button
                type="button"
                variant="ghost"
                onClick={handleCropCancel}
                disabled={uploading}
                className="h-11 text-white hover:bg-white/10 hover:text-white"
              >
                انصراف
              </Button>
              <Button
                type="button"
                onClick={handleCropSave}
                disabled={uploading}
                className="h-11 bg-white text-black hover:bg-white/90"
              >
                {uploading ? "در حال آپلود…" : "تأیید و آپلود"}
              </Button>
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <Section title="تصویر">
        <div className="flex items-center gap-3">
          <div className="size-20 shrink-0 overflow-hidden rounded-xl border border-border bg-muted">
            {value.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={value.imageUrl}
                alt=""
                className="size-full object-cover"
              />
            ) : (
              <div className="flex size-full items-center justify-center text-muted-foreground">
                <ImageIcon className="size-6" aria-hidden />
              </div>
            )}
          </div>
          <div className="flex flex-1 flex-col gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={onFileChange}
            />
            <Button
              type="button"
              variant="outline"
              onClick={onPickFile}
              disabled={uploading}
              className="h-11 w-full justify-center gap-2"
            >
              <UploadCloudIcon className="size-4" aria-hidden />
              {value.imageUrl ? "تغییر تصویر" : "آپلود تصویر"}
            </Button>
            {value.imageUrl ? (
              <Button
                type="button"
                variant="ghost"
                onClick={() => onChange({ ...value, imageUrl: "" })}
                disabled={uploading}
                className="h-9 w-full justify-center gap-2 text-destructive hover:text-destructive"
              >
                <XIcon className="size-4" aria-hidden />
                حذف تصویر
              </Button>
            ) : null}
          </div>
        </div>
      </Section>

      <Section title="افکت">
        <div className="grid grid-cols-4 gap-2">
          {(["none", "mono", "blur", "halftone"] as const).map((effect) => (
            <button
              key={effect}
              type="button"
              onClick={() => onChange({ ...value, effect })}
              aria-pressed={value.effect === effect}
              className={cn(
                "tap-target rounded-xl border px-2 py-2 text-sm font-bold transition-colors",
                value.effect === effect
                  ? "border-foreground bg-foreground text-background"
                  : "border-border text-foreground hover:bg-muted",
              )}
            >
              {effect === "none"
                ? "بدون"
                : effect === "mono"
                  ? "تک‌رنگ"
                  : effect === "blur"
                    ? "محو"
                    : "هاف‌تن"}
            </button>
          ))}
        </div>
      </Section>

      <Section title="شفافیت">
        <div className="space-y-2">
          <Slider
            value={[value.tint]}
            min={0}
            max={100}
            step={1}
            onValueChange={(v) => {
              const next = Array.isArray(v) ? (v[0] ?? value.tint) : v;
              onChange({ ...value, tint: next });
            }}
          />
          <p className="text-xs text-muted-foreground">
            خوانایی متن روی عکس را بهتر می‌کند. مقدار فعلی: {value.tint}٪
          </p>
        </div>
      </Section>
      {cropOverlay}
    </>
  );
}

/* ─────────────────────────── Helpers ─────────────────────────── */

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h3 className="text-xs font-bold tracking-tight text-muted-foreground">
        {title}
      </h3>
      {children}
    </section>
  );
}

/* ─────────────────────────── Viewport toggle ─────────────────────────── */

function ViewportToggle({
  value,
  onChange,
  compact = false,
}: {
  value: "phone" | "desktop";
  onChange: (v: "phone" | "desktop") => void;
  compact?: boolean;
}) {
  return (
    <div
      role="tablist"
      aria-label="نمای پیش‌نمایش"
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-border bg-background p-1",
        compact ? "" : "shadow-sm",
      )}
    >
      <ViewportChip
        active={value === "phone"}
        onClick={() => onChange("phone")}
        icon={SmartphoneIcon}
        label="موبایل"
      />
      <ViewportChip
        active={value === "desktop"}
        onClick={() => onChange("desktop")}
        icon={MonitorIcon}
        label="دسکتاپ"
      />
    </div>
  );
}

function ViewportChip({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: LucideIcon;
  label: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition-colors",
        active
          ? "bg-foreground text-background"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      <Icon className="size-3.5" aria-hidden />
      {label}
    </button>
  );
}

/* ─────────────────────────── Preview ─────────────────────────── */

/**
 * Phone preview that matches the /me page mockup chrome exactly:
 * `rounded-[44px]` + `border-2 border-foreground/15`, ~340×690 frame, with
 * the user's theme + wallpaper applied via `PreviewSurface`.
 *
 * Mobile uses `clamp()` widths so the frame scales with viewport without
 * ever growing taller than the available space (`100dvh - chrome`).
 */
function PhonePreview({
  draft,
  profile,
  className,
}: {
  draft: PageAppearance;
  profile: PublicProfileCardData;
  className?: string;
}) {
  const cssVars = themeToCssVars(draft.theme) as CSSProperties;
  const layer = wallpaperLayerStyle(draft.wallpaper);
  const tint = tintOverlayStyle(draft.wallpaper);
  const themeBg = getTheme(draft.theme).tokens.background;
  const custom = isCustomWallpaper(draft.wallpaper, themeBg);

  return (
    <div
      className={cn(
        "relative flex aspect-[340/690] max-h-full min-h-0 shrink-0 flex-col overflow-hidden rounded-[44px] border-2 border-foreground/15 shadow-2xl",
        className,
      )}
      style={{ ...cssVars, transform: "translateZ(0)" } as CSSProperties}
      aria-label="پیش‌نمایش موبایل"
    >
      <div className="relative h-full w-full overflow-hidden">
        <PreviewSurface
          cssVars={cssVars}
          themeId={draft.theme}
          wallpaperKind={draft.wallpaper.type}
          custom={custom}
          layer={layer}
          tint={tint}
          profile={profile}
          density="mobile"
        />
      </div>
    </div>
  );
}

function MobilePreviewArea({
  draft,
  profile,
  viewport,
}: {
  draft: PageAppearance;
  profile: PublicProfileCardData;
  viewport: "phone" | "desktop";
}) {
  if (viewport === "phone") {
    return (
      <PhonePreview
        draft={draft}
        profile={profile}
        className="h-full max-h-full w-auto max-w-full"
      />
    );
  }
  return (
    <DesktopFrame draft={draft} profile={profile} className="w-full max-w-full" />
  );
}

function DesktopPreviewArea({
  draft,
  profile,
  viewport,
}: {
  draft: PageAppearance;
  profile: PublicProfileCardData;
  viewport: "phone" | "desktop";
}) {
  if (viewport === "phone") {
    // Phone preview at fixed size — same dimensions as the /me mockup
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center">
        <PhonePreview
          draft={draft}
          profile={profile}
          className="h-[640px] w-auto"
        />
      </div>
    );
  }
  return (
    <div className="flex w-full max-w-[960px] flex-col items-center">
      <DesktopFrame draft={draft} profile={profile} />
    </div>
  );
}

/**
 * Laptop frame for the desktop viewport. We render a realistic-feeling
 * MacBook silhouette: black bezel + screen (16:10), then a chin and
 * base below. The inner screen is wide enough that visitors can actually
 * read the rendered page — the earlier version was a tiny rectangle.
 */
function DesktopFrame({
  draft,
  profile,
  className,
}: {
  draft: PageAppearance;
  profile: PublicProfileCardData;
  className?: string;
}) {
  const cssVars = themeToCssVars(draft.theme) as CSSProperties;
  const layer = wallpaperLayerStyle(draft.wallpaper);
  const tint = tintOverlayStyle(draft.wallpaper);
  const themeBg = getTheme(draft.theme).tokens.background;
  const custom = isCustomWallpaper(draft.wallpaper, themeBg);

  return (
    <div className={cn("flex w-full flex-col items-center", className)} style={cssVars as CSSProperties}>
      <div
        className="relative w-full overflow-hidden rounded-t-2xl border-[10px] border-b-0 border-neutral-900 bg-neutral-900 shadow-2xl"
        style={{ aspectRatio: "16 / 10" }}
        aria-label="پیش‌نمایش دسکتاپ"
      >
        <PreviewSurface
          cssVars={cssVars}
          themeId={draft.theme}
          wallpaperKind={draft.wallpaper.type}
          custom={custom}
          layer={layer}
          tint={tint}
          profile={profile}
          density="desktop"
        />
      </div>
      {/* Laptop chin + base — decorative MacBook-ish silhouette */}
      <div className="h-3 w-[104%] rounded-b-xl bg-neutral-800 shadow-md" />
      <div className="h-1.5 w-[40%] rounded-b-md bg-neutral-700" />
    </div>
  );
}

/**
 * Inner themed surface — identical structure to `PageThemeProvider` on the
 * real page so the preview matches /[slug] 1:1.
 *
 * `density="mobile"` flushes the card to the wallpaper-inset rule from
 * globals.css. `density="desktop"` centres a narrower card on the wallpaper
 * canvas, mirroring the real /[slug] desktop layout.
 */
function PreviewSurface({
  cssVars,
  themeId,
  wallpaperKind,
  custom,
  layer,
  tint,
  profile,
  density,
}: {
  cssVars: CSSProperties;
  themeId: PageAppearance["theme"];
  wallpaperKind: "fill" | "gradient" | "image";
  custom: boolean;
  layer: CSSProperties;
  tint: CSSProperties | null;
  profile: PublicProfileCardData;
  density: "mobile" | "desktop";
}) {
  return (
    <div
      className="page-theme-root relative min-h-full w-full overflow-hidden"
      style={cssVars}
      data-page-theme={themeId}
      data-wallpaper-kind={wallpaperKind}
      data-custom-wallpaper={custom ? "1" : undefined}
      data-preview
    >
      <div className="page-wallpaper absolute inset-0" style={layer} aria-hidden />
      {tint ? (
        <div
          className="page-wallpaper-tint absolute inset-0"
          style={tint}
          aria-hidden
        />
      ) : null}
      <HalftoneFilter />

      <div className="page-theme-content no-scrollbar relative z-[2] h-full w-full overflow-y-auto">
        {density === "mobile" ? (
          <div className="relative flex min-h-full w-full flex-col">
            <PublicProfileCard
              profile={profile}
              interactive={false}
              className="flex-1 !rounded-none !shadow-none"
              flushBottom
            />
          </div>
        ) : (
          <div className="mx-auto flex min-h-full w-full max-w-[460px] flex-col px-6 py-8">
            <PublicProfileCard
              profile={profile}
              interactive={false}
              className="!rounded-3xl !p-6 shadow-card"
            />
          </div>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────── Re-exports ─────────────────────────── */

/** Replaces the old modal-launching button — now just a link to the
 *  dedicated /me/design route. Kept as a named export so the dashboard
 *  call site can swap the import without changing JSX shape. */
export function CustomizeButton({ className }: { className?: string }) {
  return (
    <Link
      href={"/me/design" as Route}
      aria-label="شخصی‌سازی صفحه"
      className={cn(
        "inline-flex size-12 items-center justify-center rounded-full border border-border bg-background text-foreground transition-colors hover:bg-muted",
        className,
      )}
    >
      <PaletteIcon className="size-5" aria-hidden />
    </Link>
  );
}
