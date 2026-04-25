"use client";

import { useMemo, useRef, useState } from "react";
import { Loader2Icon, SparklesIcon, UploadIcon, XIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  CATEGORIES,
  ICON_CATEGORY_LABELS,
  ICON_REGISTRY,
  type IconCategory,
  type IconKey,
  resolveIconEntry,
} from "@/lib/link-icons";
import { cn } from "@/lib/utils";

export type LinkIconPickerValue = {
  iconKey: IconKey | null;
  iconUrl: string | null;
};

type Props = {
  url: string;
  value: LinkIconPickerValue;
  onChange: (next: LinkIconPickerValue) => void;
  /** Server action that uploads a custom icon to "link-icons" bucket. */
  uploadIcon: (file: File) => Promise<string | null>;
};

/**
 * Icon picker that renders:
 *   • "auto" tile (detects from URL)
 *   • "custom" tile (upload a 1:1 image)
 *   • Grouped brand/generic icons from ICON_REGISTRY
 */
export function LinkIconPicker({ url, value, onChange, uploadIcon }: Props) {
  const [category, setCategory] = useState<IconCategory>("general");
  const [isUploading, setIsUploading] = useState(false);
  const fileInput = useRef<HTMLInputElement | null>(null);

  const detected = useMemo(() => resolveIconEntry("auto", url), [url]);

  const items = useMemo(
    () =>
      Object.values(ICON_REGISTRY).filter(
        (entry) => entry.category === category && entry.key !== "auto",
      ),
    [category],
  );

  async function onFile(file: File) {
    setIsUploading(true);
    try {
      const uploadedUrl = await uploadIcon(file);
      if (uploadedUrl) {
        onChange({ iconKey: null, iconUrl: uploadedUrl });
      }
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <div className="space-y-3">
      {/* Row 1 — auto + custom + current preview */}
      <div className="flex items-center gap-2">
        {/* auto */}
        <button
          type="button"
          onClick={() => onChange({ iconKey: "auto", iconUrl: null })}
          className={cn(
            "inline-flex h-11 items-center gap-2 rounded-2xl border px-3 text-sm font-bold transition-colors",
            !value.iconUrl && (value.iconKey === "auto" || !value.iconKey)
              ? "border-foreground bg-foreground text-background"
              : "border-border bg-background hover:bg-muted",
          )}
        >
          <SparklesIcon className="size-4" />
          خودکار
          {!value.iconUrl &&
          (value.iconKey === "auto" || !value.iconKey) &&
          detected ? (
            <span
              className="inline-flex size-5 items-center justify-center rounded-xl text-white"
              style={{ backgroundColor: detected.color }}
              aria-hidden
            >
              <detected.Icon width={12} height={12} />
            </span>
          ) : null}
        </button>

        {/* custom upload */}
        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          disabled={isUploading}
          className={cn(
            "inline-flex h-11 items-center gap-2 rounded-2xl border px-3 text-sm font-bold transition-colors",
            value.iconUrl
              ? "border-foreground bg-foreground text-background"
              : "border-border bg-background hover:bg-muted",
          )}
        >
          {isUploading ? (
            <Loader2Icon className="size-4 animate-spin" />
          ) : (
            <UploadIcon className="size-4" />
          )}
          آیکون سفارشی
        </button>

        {value.iconUrl ? (
          <div className="relative inline-flex size-11 items-center justify-center overflow-hidden rounded-2xl bg-muted">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={value.iconUrl}
              alt=""
              className="size-full object-cover"
            />
            <button
              type="button"
              onClick={() => onChange({ iconKey: "auto", iconUrl: null })}
              className="absolute end-0.5 top-0.5 inline-flex size-4 items-center justify-center rounded-full bg-black/60 text-white"
              aria-label="حذف آیکون سفارشی"
            >
              <XIcon className="size-3" />
            </button>
          </div>
        ) : null}

        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(event) => {
            const f = event.target.files?.[0];
            event.target.value = "";
            if (f) onFile(f);
          }}
        />
      </div>

      {/* Category chips */}
      <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
        {CATEGORIES.map((cat) => {
          const active = category === cat;
          return (
            <button
              key={cat}
              type="button"
              onClick={() => setCategory(cat)}
              className={cn(
                "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
                active
                  ? "border-foreground bg-foreground text-background"
                  : "border-border bg-background text-muted-foreground hover:bg-muted",
              )}
            >
              {ICON_CATEGORY_LABELS[cat]}
            </button>
          );
        })}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-5 gap-2 sm:grid-cols-8">
        {items.map((entry) => {
          const selected =
            !value.iconUrl &&
            value.iconKey === entry.key &&
            value.iconKey !== "auto";
          return (
            <button
              key={entry.key}
              type="button"
              title={entry.label}
              onClick={() => onChange({ iconKey: entry.key, iconUrl: null })}
              className={cn(
                "tap-target group relative flex flex-col items-center justify-center gap-1 rounded-2xl border bg-background p-2 transition-colors hover:bg-muted",
                selected && "border-foreground ring-2 ring-foreground/20",
              )}
            >
              <span
                className="inline-flex size-8 items-center justify-center rounded-xl text-white"
                style={{ backgroundColor: entry.color }}
              >
                <entry.Icon width={18} height={18} />
              </span>
              <span className="line-clamp-1 text-[10px] font-semibold text-muted-foreground">
                {entry.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Small icon bubble used across editor & public card. */
export function LinkIconBubble({
  iconKey,
  iconUrl,
  imageUrl,
  url,
  size = 36,
  className,
}: {
  iconKey: IconKey | null;
  iconUrl: string | null;
  imageUrl: string | null;
  url: string;
  size?: number;
  className?: string;
}) {
  // Precedence: custom upload > cover image > built-in icon
  if (iconUrl) {
    return (
      <span
        className={cn(
          "inline-flex shrink-0 overflow-hidden rounded-2xl bg-muted",
          className,
        )}
        style={{ width: size, height: size }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={iconUrl} alt="" className="size-full object-cover" />
      </span>
    );
  }
  if (imageUrl) {
    return (
      <span
        className={cn(
          "inline-flex shrink-0 overflow-hidden rounded-2xl bg-muted",
          className,
        )}
        style={{ width: size, height: size }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={imageUrl} alt="" className="size-full object-cover" />
      </span>
    );
  }
  const entry = resolveIconEntry(iconKey, url);
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-2xl text-white",
        className,
      )}
      style={{ width: size, height: size, backgroundColor: entry.color }}
      aria-hidden
    >
      <entry.Icon
        width={Math.round(size * 0.55)}
        height={Math.round(size * 0.55)}
      />
    </span>
  );
}
