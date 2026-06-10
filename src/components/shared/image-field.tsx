"use client";

import { useRef, useState } from "react";
import { Loader2Icon, PencilIcon, TrashIcon, UploadIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";

/**
 * Two upload modes:
 *
 * - "immediate" — fires `onUploadImage(file)` on file pick, stores the
 *   returned URL. Used by product/item editors that auto-save.
 *
 * - "deferred" — calls `onFileSelected(file)` and shows a local preview
 *   via createObjectURL. The file is sent later as FormData. Used by
 *   event / booking forms that submit everything together.
 */
type ImmediateMode = {
  mode: "immediate";
  onUploadImage: (file: File) => Promise<string | null>;
  onFileSelected?: never;
};

type DeferredMode = {
  mode: "deferred";
  onFileSelected: (file: File | null) => void;
  onUploadImage?: never;
};

type ImageFieldProps = (ImmediateMode | DeferredMode) & {
  imageUrl: string | null;
  label?: string;
  emptyLabel?: string;
  /** Free ratio (default) or 1:1 square. */
  aspectRatio?: "free" | "square";
  onChange: (url: string | null) => void;
  className?: string;
};

export function ImageField({
  imageUrl,
  label,
  emptyLabel = "افزودن تصویر",
  aspectRatio = "free",
  onChange,
  className,
  ...modeProps
}: ImageFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [localPreview, setLocalPreview] = useState<string | null>(null);

  const displayUrl = localPreview ?? imageUrl;

  function handleFiles(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    if (inputRef.current) inputRef.current.value = "";

    if (modeProps.mode === "deferred") {
      if (localPreview) URL.revokeObjectURL(localPreview);
      const preview = URL.createObjectURL(file);
      setLocalPreview(preview);
      modeProps.onFileSelected(file);
      return;
    }

    setUploading(true);
    modeProps
      .onUploadImage(file)
      .then((url) => {
        if (url) {
          if (localPreview) URL.revokeObjectURL(localPreview);
          setLocalPreview(null);
          onChange(url);
        }
      })
      .finally(() => setUploading(false));
  }

  function handleRemove() {
    if (localPreview) URL.revokeObjectURL(localPreview);
    setLocalPreview(null);
    onChange(null);
    if (modeProps.mode === "deferred") modeProps.onFileSelected(null);
  }

  const isSquare = aspectRatio === "square";

  return (
    <div className={cn("grid gap-1.5", className)}>
      {label ? <Label>{label}</Label> : null}

      {displayUrl ? (
        <div
          className={cn(
            "relative overflow-hidden rounded-2xl border bg-muted",
            isSquare ? "aspect-square w-full max-w-[180px]" : "w-full",
          )}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={displayUrl}
            alt=""
            className={cn(
              "w-full",
              isSquare ? "h-full object-cover" : "h-auto",
            )}
          />
          <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-black/55 px-3 py-2 text-white">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              className="inline-flex items-center gap-1 rounded-full bg-white/15 px-3 py-1.5 text-xs font-bold backdrop-blur hover:bg-white/25"
            >
              <PencilIcon className="size-3.5" />
              تغییر
            </button>
            <button
              type="button"
              onClick={handleRemove}
              disabled={uploading}
              className="grid size-7 place-items-center rounded-full bg-white/15 backdrop-blur hover:bg-white/25"
              aria-label="حذف تصویر"
            >
              <TrashIcon className="size-3.5" />
            </button>
          </div>
          {uploading ? (
            <div className="absolute inset-0 grid place-items-center bg-black/40">
              <Loader2Icon className="size-6 animate-spin text-white" />
            </div>
          ) : null}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className={cn(
            "flex w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed text-muted-foreground transition-colors",
            "hover:border-primary hover:bg-primary/5 hover:text-primary disabled:opacity-50",
            isSquare ? "aspect-square max-w-[180px]" : "h-28",
          )}
        >
          {uploading ? (
            <Loader2Icon className="size-6 animate-spin" />
          ) : (
            <>
              <UploadIcon className="size-6" />
              <span className="text-sm font-bold">{emptyLabel}</span>
            </>
          )}
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
    </div>
  );
}
