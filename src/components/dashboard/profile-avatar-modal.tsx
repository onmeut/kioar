"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import {
  CheckIcon,
  Loader2Icon,
  ShuffleIcon,
  Trash2Icon,
  UploadIcon,
} from "lucide-react";
import { CircleStencil, Cropper, type CropperRef } from "react-mobile-cropper";
import "react-mobile-cropper/dist/style.css";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { KioarAvatar } from "@/components/shared/kioar-avatar";
import { cn } from "@/lib/utils";

/**
 * Detect HEIC/HEIF by extension or MIME. iOS still hands these out from the
 * camera roll, and Chrome/Firefox/Edge can't decode them in <img>, so the
 * cropper would just spin on a black screen. We convert client-side to JPEG
 * before showing it.
 */
function isHeic(file: File): boolean {
  const name = file.name.toLowerCase();
  const type = file.type.toLowerCase();
  return (
    type === "image/heic" ||
    type === "image/heif" ||
    type === "image/heic-sequence" ||
    type === "image/heif-sequence" ||
    name.endsWith(".heic") ||
    name.endsWith(".heif")
  );
}

function isSvg(file: File): boolean {
  return (
    file.type === "image/svg+xml" || file.name.toLowerCase().endsWith(".svg")
  );
}

async function maybeConvertHeic(file: File): Promise<File> {
  if (!isHeic(file)) return file;
  try {
    const mod = await import("heic2any");
    const heic2any = mod.default;
    const out = await heic2any({
      blob: file,
      toType: "image/jpeg",
      quality: 0.85,
    });
    const blob = Array.isArray(out) ? out[0] : out;
    const baseName = file.name.replace(/\.[^.]+$/, "") || "avatar";
    return new File([blob], `${baseName}.jpg`, { type: "image/jpeg" });
  } catch {
    return file;
  }
}

function readImageSize(
  file: File,
): Promise<{ width: number; height: number; src: string }> {
  return new Promise((resolve, reject) => {
    const src = URL.createObjectURL(file);
    const img = new window.Image();
    img.onload = () =>
      resolve({ width: img.naturalWidth, height: img.naturalHeight, src });
    img.onerror = () => {
      URL.revokeObjectURL(src);
      reject(new Error("invalid image"));
    };
    img.src = src;
  });
}

/**
 * Generate `count` random hex seeds for the avatar grid. Uses
 * `crypto.getRandomValues` so each tile is unbiased; `Math.random` would
 * cluster on iOS WebKit. Format matches the server-side `generateAvatarSeed`
 * (8 bytes = 16 hex chars), so the server's regex validation passes.
 */
function generateSeeds(count: number): string[] {
  const out: string[] = [];
  const buf = new Uint8Array(8);
  for (let i = 0; i < count; i++) {
    crypto.getRandomValues(buf);
    out.push(
      Array.from(buf)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join(""),
    );
  }
  return out;
}

const SEED_GRID_COUNT = 18;

type ProfileAvatarModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentUrl: string | null;
  /** Seed used for the DiceBear fallback when no photo is set. */
  avatarSeed: string | null;
  displayName: string;
  onUpload: (file: File) => Promise<{ ok: true } | { ok: false }>;
  onDelete?: () => Promise<{ ok: true } | { ok: false }>;
  /** Persist a user-picked seed (also clears any uploaded photo). */
  onPickSeed: (seed: string) => Promise<{ ok: true } | { ok: false }>;
};

export function ProfileAvatarModal({
  open,
  onOpenChange,
  currentUrl,
  avatarSeed,
  // displayName kept for API compatibility with existing callers; not rendered.
  displayName: _displayName,
  onUpload,
  onDelete,
  onPickSeed,
}: ProfileAvatarModalProps) {
  void _displayName;
  const inputRef = useRef<HTMLInputElement>(null);
  const cropperRef = useRef<CropperRef>(null);
  const [preview, setPreview] = useState<string | null>(null);
  // Source for the cropper. Set when the picked file isn't square; cleared
  // after the cropped File is handed off to onUpload (or on cancel).
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [cropFileName, setCropFileName] = useState<string>("avatar.png");
  const [isPreparing, setIsPreparing] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [isDeleting, startDeleteTransition] = useTransition();
  const [isPickingSeed, startSeedTransition] = useTransition();
  const [pickedSeed, setPickedSeed] = useState<string | null>(null);

  // Initial pool generated once; reshuffled on dialog open and via the
  // shuffle button. Keeps tiles stable while the user is browsing.
  const [seedPool, setSeedPool] = useState<string[]>(() =>
    generateSeeds(SEED_GRID_COUNT),
  );

  // Reshuffle the pool every time the dialog reopens so the user doesn't
  // see the same 18 faces twice in a row, but DON'T reshuffle while it's
  // open (would re-render mid-tap and feel broken). Done in render via
  // the "store previous prop" pattern so the new seeds are visible on the
  // first paint of the dialog opening — and to avoid the
  // `react-hooks/set-state-in-effect` rule (effects are for external
  // systems, this is pure derived state).
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setSeedPool(generateSeeds(SEED_GRID_COUNT));
      setPickedSeed(null);
    }
  }

  useEffect(() => {
    return () => {
      if (cropSrc) URL.revokeObjectURL(cropSrc);
    };
  }, [cropSrc]);

  const currentSeed = avatarSeed ?? "kioar";
  // If the user has no uploaded photo, surface the *current* seed as the
  // first tile so they can see at-a-glance which one is theirs.
  const seeds = useMemo(() => {
    if (currentUrl) return seedPool;
    if (seedPool.includes(currentSeed)) return seedPool;
    return [currentSeed, ...seedPool.slice(0, SEED_GRID_COUNT - 1)];
  }, [seedPool, currentSeed, currentUrl]);

  function uploadFile(file: File) {
    const url = URL.createObjectURL(file);
    setPreview(url);
    startTransition(async () => {
      const result = await onUpload(file);
      URL.revokeObjectURL(url);
      setPreview(null);
      if (result.ok) {
        onOpenChange(false);
      }
    });
  }

  async function handleFiles(files: FileList | null) {
    const picked = files?.[0];
    if (!picked) return;

    if (isSvg(picked)) {
      uploadFile(picked);
      return;
    }

    setIsPreparing(true);
    let file = picked;
    try {
      file = await maybeConvertHeic(picked);
    } catch {
      // fall through with original file
    }

    let dims: { width: number; height: number; src: string };
    try {
      dims = await readImageSize(file);
    } catch {
      setIsPreparing(false);
      toast.error("این فایل تصویری معتبر نیست.");
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    setIsPreparing(false);

    if (dims.width === dims.height) {
      URL.revokeObjectURL(dims.src);
      uploadFile(file);
      return;
    }
    setCropFileName(file.name || "avatar.png");
    setCropSrc(dims.src);
    onOpenChange(false);
  }

  function handleCropCancel() {
    if (cropSrc) URL.revokeObjectURL(cropSrc);
    setCropSrc(null);
    if (inputRef.current) inputRef.current.value = "";
    onOpenChange(true);
  }

  function handleCropSave() {
    const canvas = cropperRef.current?.getCanvas();
    if (!canvas) return;
    canvas.toBlob((blob) => {
      if (!blob) return;
      const baseName = cropFileName.replace(/\.[^.]+$/, "") || "avatar";
      const file = new File([blob], `${baseName}.png`, { type: "image/png" });
      if (cropSrc) URL.revokeObjectURL(cropSrc);
      setCropSrc(null);
      if (inputRef.current) inputRef.current.value = "";
      uploadFile(file);
    }, "image/png");
  }

  async function handleDelete() {
    if (!onDelete) return;
    startDeleteTransition(async () => {
      const result = await onDelete();
      if (result.ok) {
        onOpenChange(false);
      }
    });
  }

  function handlePickSeed(seed: string) {
    if (isPickingSeed || isPending || isDeleting) return;
    setPickedSeed(seed);
    startSeedTransition(async () => {
      const result = await onPickSeed(seed);
      if (result.ok) {
        toast.success("آواتار تغییر کرد.");
      } else {
        setPickedSeed(null);
      }
    });
  }

  const shown = preview ?? currentUrl;
  const busy = isPending || isDeleting || isPickingSeed;

  // The crop overlay must be portalled directly to document.body so it is
  // never inside a parent with `transform` / `isolation: isolate`. Any such
  // ancestor would cap the overlay's z-index and let the nav/header paint
  // on top of it.
  const cropOverlay = cropSrc
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
              stencilComponent={CircleStencil}
              stencilProps={{ aspectRatio: 1, grid: true }}
              style={{ width: "100%", height: "100%" }}
              className="size-full"
            />
          </div>

          <div className="flex flex-col gap-2 bg-black px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
            <Button
              type="button"
              variant="outline"
              onClick={handleCropSave}
              disabled={busy}
              className="h-11 w-full rounded-full border-white/20 bg-white text-sm font-bold text-black hover:bg-white/90"
            >
              {busy ? <Loader2Icon className="size-4 animate-spin" /> : null}
              ذخیره
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={handleCropCancel}
              disabled={busy}
              className="h-11 w-full rounded-full text-sm font-medium text-white hover:bg-white/10 hover:text-white"
            >
              انصراف
            </Button>
          </div>

          <input
            ref={inputRef}
            type="file"
            accept="image/*,image/heic,image/heif,.heic,.heif,.svg"
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
        </div>,
        document.body,
      )
    : null;

  return (
    <>
      {cropOverlay}

      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[92dvh] overflow-y-auto p-0 sm:max-w-md">
          <div className="flex flex-col">
            {/* Header — current avatar centred, title underneath */}
            <DialogHeader className="px-5 pt-6 pb-4 text-center sm:text-center">
              <div className="relative mx-auto my-3 size-28 overflow-hidden rounded-full">
                {shown ? (
                  <img
                    src={shown}
                    alt=""
                    className="absolute inset-0 size-full object-cover"
                  />
                ) : (
                  <KioarAvatar seed={currentSeed} size={112} />
                )}
                {busy || isPreparing ? (
                  <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40">
                    <Loader2Icon className="size-6 animate-spin text-white" />
                  </span>
                ) : null}
              </div>
            </DialogHeader>

            {/* Upload button — sits right under the header */}
            <div className="px-5 pb-4">
              <input
                ref={inputRef}
                type="file"
                accept="image/*,image/heic,image/heif,.heic,.heif,.svg"
                className="hidden"
                onChange={(e) => handleFiles(e.target.files)}
              />
              <Button
                type="button"
                onClick={() => inputRef.current?.click()}
                disabled={busy || isPreparing}
                variant="default"
                className="h-12 w-full rounded-full text-sm font-medium"
              >
                {isPreparing ? (
                  <Loader2Icon className="size-4 animate-spin" />
                ) : (
                  <UploadIcon className="size-4" />
                )}
                {isPreparing ? "در حال آماده‌سازی…" : "انتخاب از گالری"}
              </Button>
            </div>

            {/* Avatar grid */}
            <section className="border-t border-border/60 px-5 py-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h3 className="text-xs font-bold text-foreground">
                  انتخاب آواتار آماده
                </h3>
                <button
                  type="button"
                  onClick={() => {
                    if (busy) return;
                    setSeedPool(generateSeeds(SEED_GRID_COUNT));
                    setPickedSeed(null);
                  }}
                  disabled={busy}
                  className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
                >
                  <ShuffleIcon className="size-3" />
                  گزینه‌های جدید
                </button>
              </div>

              <ul
                className="grid grid-cols-6 gap-2"
                role="radiogroup"
                aria-label="انتخاب آواتار"
              >
                {seeds.map((seed) => {
                  const isCurrent =
                    !currentUrl && !pickedSeed && seed === currentSeed;
                  const isPicked = seed === pickedSeed;
                  const showRing = isCurrent || isPicked;
                  return (
                    <li key={seed}>
                      <button
                        type="button"
                        role="radio"
                        aria-checked={showRing}
                        aria-label={`آواتار ${seed.slice(0, 4)}`}
                        onClick={() => handlePickSeed(seed)}
                        disabled={busy}
                        className={cn(
                          "tap-target relative aspect-square w-full overflow-hidden rounded-full border bg-card transition-all",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                          showRing
                            ? "border-primary ring-2 ring-primary ring-offset-2 ring-offset-background"
                            : "border-foreground/10 hover:border-foreground/30 active:scale-95",
                          busy && !isPicked ? "opacity-50" : "opacity-100",
                        )}
                      >
                        <KioarAvatar seed={seed} size={64} />
                        {isPicked && isPickingSeed ? (
                          <span className="absolute inset-0 flex items-center justify-center bg-black/40">
                            <Loader2Icon className="size-4 animate-spin text-white" />
                          </span>
                        ) : showRing ? (
                          <span className="absolute -bottom-0.5 -inset-e-0.5 flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                            <CheckIcon className="size-3" strokeWidth={3} />
                          </span>
                        ) : null}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>

            {/* Delete uploaded photo */}
            {currentUrl && onDelete ? (
              <div className="border-t border-border/60 px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={handleDelete}
                  disabled={busy}
                  className="h-10 w-full rounded-full text-sm font-medium text-destructive hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2Icon className="size-4" />
                  حذف تصویر بارگذاری‌شده
                </Button>
              </div>
            ) : (
              <div className="pb-[max(0.5rem,env(safe-area-inset-bottom))]" />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
