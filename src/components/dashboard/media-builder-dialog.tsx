"use client";

// Add/edit sheet for the "media" block ("مدیا"). One engine, three content
// modes (photos / video / file) reused by every variant card (gallery / video
// / resume / download). The variant card sets the initial
// `mode` + `preset` + panel `copy`; the editor auto-detects the type from what
// the user adds (image → photos, pasted URL → video embed, video/PDF → that
// mode). A single block holds EITHER many photos, OR one video, OR one file.
//
// Controlled + dumb (like text-block-dialog): owns the local draft and calls
// `onSubmit(draft)`; the parent owns the server-action wiring so the same
// dialog serves both add and edit. Mobile = bottom Sheet, desktop = Dialog.

import { useEffect, useRef, useState } from "react";
import {
  ArrowRightIcon,
  FileTextIcon,
  ImageIcon,
  Loader2Icon,
  LinkIcon,
  PlusIcon,
  TrashIcon,
  VideoIcon,
  XIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { isSupportedVideoUrl } from "@/lib/media-embed";
import {
  type MediaBlockMode,
  type MediaBlockPreset,
} from "@/lib/validations";
import { cn } from "@/lib/utils";

export type MediaItemDraft = {
  id?: string;
  kind: "image" | "video" | "file";
  url: string;
  byteSize: number;
  mime: string | null;
  displayName: string | null;
  thumbnailUrl: string | null;
};

export type MediaBlockDraft = {
  /** Present when editing; absent for a new block. */
  id?: string;
  mode: MediaBlockMode;
  preset: MediaBlockPreset | null;
  name: string | null;
  caption: string | null;
  videoUrl: string | null;
  items: MediaItemDraft[];
};

/** Variant-specific panel strings set by the add-link card. */
export type MediaPanelCopy = {
  heading: string;
  /** Short helper under the heading. */
  hint?: string;
  /** Placeholder for the empty add affordance. */
  addLabel: string;
};

const DEFAULT_COPY: MediaPanelCopy = {
  heading: "افزودن مدیا",
  addLabel: "افزودن فایل",
};

export type MediaBuilderDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pre-set mode/preset/copy for the chosen variant card (new block). */
  mode?: MediaBlockMode;
  preset?: MediaBlockPreset | null;
  copy?: MediaPanelCopy;
  /** Pre-fills all fields when editing an existing block. */
  initial?: MediaBlockDraft | null;
  onSubmit: (draft: MediaBlockDraft) => Promise<void> | void;
  /** Uploads a photo, returning { url, byteSize }. */
  onUploadImage?: (
    file: File,
  ) => Promise<{ url: string; byteSize: number } | null>;
  /** Uploads a video/PDF file, returning { url, byteSize, mime }. */
  onUploadFile?: (
    file: File,
    kind: "video" | "file",
  ) => Promise<{ url: string; byteSize: number; mime: string | null } | null>;
  submitting?: boolean;
  /** Surfaced inline (e.g. a quota error returned from the save action). */
  errorMessage?: string | null;
};

function makeDefaultDraft(
  mode: MediaBlockMode,
  preset: MediaBlockPreset | null,
): MediaBlockDraft {
  return {
    mode,
    preset,
    name: null,
    caption: null,
    videoUrl: null,
    items: [],
  };
}

export function MediaBuilderDialog({
  open,
  onOpenChange,
  mode = "photos",
  preset = null,
  copy = DEFAULT_COPY,
  initial,
  onSubmit,
  onUploadImage,
  onUploadFile,
  submitting,
  errorMessage,
}: MediaBuilderDialogProps) {
  const isMobile = useIsMobile();
  const [draft, setDraft] = useState<MediaBlockDraft>(
    () => initial ?? makeDefaultDraft(mode, preset),
  );
  const [uploading, setUploading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setDraft(initial ?? makeDefaultDraft(mode, preset));
      setLocalError(null);
    }
  }, [open, initial, mode, preset]);

  const Container = isMobile ? Sheet : Dialog;
  const Content = isMobile ? SheetContent : DialogContent;
  const Title = isMobile ? SheetTitle : DialogTitle;

  const contentProps = isMobile
    ? {
        side: "bottom" as const,
        className:
          "max-h-[92dvh] rounded-t-3xl p-0 flex flex-col gap-0 bg-background",
        showCloseButton: false,
      }
    : {
        className:
          "p-0 sm:max-w-[480px] max-h-[92vh] flex flex-col gap-0 overflow-hidden",
        showCloseButton: false,
      };

  const isEditing = Boolean(initial?.id);
  const effectiveMode = draft.mode;

  // A block is submittable when it has at least one source for its mode.
  const hasContent =
    (effectiveMode === "photos" && draft.items.length > 0) ||
    (effectiveMode === "video" &&
      (Boolean(draft.videoUrl) ||
        draft.items.some((it) => it.kind === "video"))) ||
    (effectiveMode === "file" && draft.items.some((it) => it.kind === "file"));
  const canSubmit = hasContent && !submitting && !uploading;

  function setError(msg: string | null) {
    setLocalError(msg);
  }

  // ---- photo handlers -------------------------------------------------
  async function addPhotos(files: FileList | null) {
    if (!files || !onUploadImage) return;
    setError(null);
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const res = await onUploadImage(file);
        if (!res) {
          setError("آپلود تصویر ناموفق بود.");
          continue;
        }
        setDraft((d) => ({
          ...d,
          mode: "photos",
          items: [
            ...d.items,
            {
              kind: "image",
              url: res.url,
              byteSize: res.byteSize,
              mime: null,
              displayName: null,
              thumbnailUrl: null,
            },
          ],
        }));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "آپلود تصویر با خطا مواجه شد.");
    } finally {
      setUploading(false);
    }
  }

  // ---- video file handler ---------------------------------------------
  async function setVideoFile(files: FileList | null) {
    const file = files?.[0];
    if (!file || !onUploadFile) return;
    setError(null);
    setUploading(true);
    try {
      const res = await onUploadFile(file, "video");
      if (!res) {
        setError("آپلود ویدئو ناموفق بود.");
        return;
      }
      setDraft((d) => ({
        ...d,
        mode: "video",
        videoUrl: null,
        items: [
          {
            kind: "video",
            url: res.url,
            byteSize: res.byteSize,
            mime: res.mime,
            displayName: null,
            thumbnailUrl: null,
          },
        ],
      }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "آپلود ویدئو با خطا مواجه شد.");
    } finally {
      setUploading(false);
    }
  }

  // ---- file (PDF) handler ---------------------------------------------
  async function setDocFile(files: FileList | null) {
    const file = files?.[0];
    if (!file || !onUploadFile) return;
    setError(null);
    setUploading(true);
    try {
      const res = await onUploadFile(file, "file");
      if (!res) {
        setError("آپلود فایل ناموفق بود.");
        return;
      }
      setDraft((d) => ({
        ...d,
        mode: "file",
        videoUrl: null,
        items: [
          {
            kind: "file",
            url: res.url,
            byteSize: res.byteSize,
            mime: res.mime,
            // Default the display name to the original file name (minus ext).
            displayName: file.name.replace(/\.[^.]+$/, ""),
            thumbnailUrl: null,
          },
        ],
      }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "آپلود فایل با خطا مواجه شد.");
    } finally {
      setUploading(false);
    }
  }

  function applyVideoUrl(value: string) {
    const trimmed = value.trim();
    setDraft((d) => ({
      ...d,
      mode: "video",
      videoUrl: trimmed || null,
      // Pasting an embed clears any uploaded video item (mutually exclusive).
      items: trimmed ? d.items.filter((it) => it.kind !== "video") : d.items,
    }));
  }

  async function handleSave() {
    if (!canSubmit) return;
    if (
      effectiveMode === "video" &&
      draft.videoUrl &&
      !isSupportedVideoUrl(draft.videoUrl)
    ) {
      setError("فقط لینک یوتیوب یا آپارات پشتیبانی می‌شود.");
      return;
    }
    await onSubmit({
      ...draft,
      name: draft.name?.trim() ? draft.name.trim() : null,
      caption: draft.caption?.trim() ? draft.caption.trim() : null,
    });
  }

  const shownError = localError ?? errorMessage ?? null;

  return (
    <Container open={open} onOpenChange={onOpenChange}>
      <Content {...contentProps}>
        <Title className="sr-only">{copy.heading}</Title>

        {/* Header */}
        <div className="grid shrink-0 grid-cols-[40px_1fr_40px] items-center border-b px-4 py-3 sm:px-5 sm:py-4">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            aria-label="بازگشت"
            className="tap-target inline-flex size-10 items-center justify-center rounded-2xl border border-border bg-background text-foreground transition-colors hover:bg-muted"
          >
            <ArrowRightIcon className="size-5" />
          </button>
          <h2 className="text-center text-lg font-bold">{copy.heading}</h2>
          <div className="flex justify-end">
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              className="rounded-full"
              onClick={() => onOpenChange(false)}
              aria-label="بستن"
            >
              <XIcon className="size-5" />
            </Button>
          </div>
        </div>

        {/* Body */}
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 sm:p-5">
          {copy.hint ? (
            <p className="text-[13px] leading-6 text-muted-foreground">
              {copy.hint}
            </p>
          ) : null}

          {effectiveMode === "photos" ? (
            <PhotosEditor
              items={draft.items}
              addLabel={copy.addLabel}
              uploading={uploading}
              canUpload={Boolean(onUploadImage)}
              onAdd={addPhotos}
              onRemove={(idx) =>
                setDraft((d) => ({
                  ...d,
                  items: d.items.filter((_, i) => i !== idx),
                }))
              }
            />
          ) : null}

          {effectiveMode === "video" ? (
            <VideoEditor
              videoUrl={draft.videoUrl}
              videoItem={draft.items.find((it) => it.kind === "video") ?? null}
              uploading={uploading}
              canUpload={Boolean(onUploadFile)}
              onUrlChange={applyVideoUrl}
              onPickFile={setVideoFile}
              onClear={() =>
                setDraft((d) => ({ ...d, videoUrl: null, items: [] }))
              }
            />
          ) : null}

          {effectiveMode === "file" ? (
            <FileEditor
              fileItem={draft.items.find((it) => it.kind === "file") ?? null}
              addLabel={copy.addLabel}
              uploading={uploading}
              canUpload={Boolean(onUploadFile)}
              onPickFile={setDocFile}
              onNameChange={(name) =>
                setDraft((d) => ({
                  ...d,
                  items: d.items.map((it) =>
                    it.kind === "file" ? { ...it, displayName: name } : it,
                  ),
                }))
              }
              onClear={() => setDraft((d) => ({ ...d, items: [] }))}
            />
          ) : null}

          {/* Caption — shared across modes */}
          <div className="space-y-1.5">
            <Label htmlFor="media-caption">توضیح (اختیاری)</Label>
            <Input
              id="media-caption"
              value={draft.caption ?? ""}
              onChange={(e) =>
                setDraft((d) => ({ ...d, caption: e.target.value }))
              }
              enterKeyHint="done"
              maxLength={280}
              placeholder="یک توضیح کوتاه"
            />
          </div>

          {shownError ? (
            <p className="rounded-lg bg-destructive/10 px-3 py-2 text-[13px] font-semibold text-destructive">
              {shownError}
            </p>
          ) : null}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t p-4 sm:p-5">
          <Button
            type="button"
            variant="outline"
            className="h-11"
            onClick={() => onOpenChange(false)}
          >
            انصراف
          </Button>
          <Button
            type="button"
            className="h-11 px-6"
            disabled={!canSubmit}
            onClick={handleSave}
          >
            {submitting ? <Loader2Icon className="size-4 animate-spin" /> : null}
            {isEditing ? "ذخیره تغییرات" : "افزودن"}
          </Button>
        </div>
      </Content>
    </Container>
  );
}

// ---------------------------------------------------------------------------
// Photos editor — multi-add grid with remove.
// ---------------------------------------------------------------------------
function PhotosEditor({
  items,
  addLabel,
  uploading,
  canUpload,
  onAdd,
  onRemove,
}: {
  items: MediaItemDraft[];
  addLabel: string;
  uploading: boolean;
  canUpload: boolean;
  onAdd: (files: FileList | null) => void;
  onRemove: (idx: number) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const photos = items.filter((it) => it.kind === "image");
  return (
    <div className="space-y-2">
      <Label>عکس‌ها</Label>
      <div className="grid grid-cols-3 gap-2">
        {photos.map((p, idx) => (
          <div
            key={p.url}
            className="relative aspect-square overflow-hidden rounded-xl border bg-muted"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.url} alt="" className="size-full object-cover" />
            <button
              type="button"
              onClick={() => onRemove(idx)}
              aria-label="حذف عکس"
              className="absolute end-1 top-1 grid size-7 place-items-center rounded-full bg-black/55 text-white backdrop-blur hover:bg-black/75"
            >
              <TrashIcon className="size-3.5" />
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={!canUpload || uploading}
          className={cn(
            "flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed text-muted-foreground transition-colors",
            "hover:border-primary hover:bg-primary/5 hover:text-primary disabled:opacity-50",
          )}
        >
          {uploading ? (
            <Loader2Icon className="size-5 animate-spin" />
          ) : (
            <>
              <PlusIcon className="size-5" />
              <span className="px-1 text-center text-[11px] font-bold leading-tight">
                {addLabel}
              </span>
            </>
          )}
        </button>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        multiple
        className="hidden"
        onChange={(e) => {
          onAdd(e.target.files);
          if (inputRef.current) inputRef.current.value = "";
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Video editor — paste an embed URL OR upload a file (mutually exclusive).
// ---------------------------------------------------------------------------
function VideoEditor({
  videoUrl,
  videoItem,
  uploading,
  canUpload,
  onUrlChange,
  onPickFile,
  onClear,
}: {
  videoUrl: string | null;
  videoItem: MediaItemDraft | null;
  uploading: boolean;
  canUpload: boolean;
  onUrlChange: (value: string) => void;
  onPickFile: (files: FileList | null) => void;
  onClear: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const hasFile = Boolean(videoItem);
  return (
    <div className="space-y-3">
      {/* Paste link */}
      <div className="space-y-1.5">
        <Label htmlFor="media-video-url">لینک ویدئو (یوتیوب یا آپارات)</Label>
        <div className="relative">
          <LinkIcon className="pointer-events-none absolute inset-s-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="media-video-url"
            dir="ltr"
            value={videoUrl ?? ""}
            onChange={(e) => onUrlChange(e.target.value)}
            disabled={hasFile}
            inputMode="url"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="done"
            placeholder="https://aparat.com/v/…"
            className="ps-9"
          />
        </div>
      </div>

      <div className="flex items-center gap-3 text-[12px] text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        یا
        <span className="h-px flex-1 bg-border" />
      </div>

      {/* Upload file */}
      {hasFile ? (
        <div className="flex items-center justify-between gap-3 rounded-2xl border bg-muted/40 px-4 py-3">
          <span className="flex items-center gap-2 text-sm font-bold">
            <VideoIcon className="size-5 text-primary" />
            فایل ویدئو بارگذاری شد
          </span>
          <button
            type="button"
            onClick={onClear}
            aria-label="حذف ویدئو"
            className="grid size-8 place-items-center rounded-full bg-foreground/5 hover:bg-foreground/10"
          >
            <TrashIcon className="size-4" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={!canUpload || uploading || Boolean(videoUrl)}
          className={cn(
            "flex h-24 w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed text-muted-foreground transition-colors",
            "hover:border-primary hover:bg-primary/5 hover:text-primary disabled:opacity-50",
          )}
        >
          {uploading ? (
            <Loader2Icon className="size-6 animate-spin" />
          ) : (
            <>
              <VideoIcon className="size-6" />
              <span className="text-sm font-bold">آپلود ویدئو (mp4، mov)</span>
            </>
          )}
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="video/mp4,video/quicktime,.mp4,.mov"
        className="hidden"
        onChange={(e) => {
          onPickFile(e.target.files);
          if (inputRef.current) inputRef.current.value = "";
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// File editor — a single PDF with an editable display name.
// ---------------------------------------------------------------------------
function FileEditor({
  fileItem,
  addLabel,
  uploading,
  canUpload,
  onPickFile,
  onNameChange,
  onClear,
}: {
  fileItem: MediaItemDraft | null;
  addLabel: string;
  uploading: boolean;
  canUpload: boolean;
  onPickFile: (files: FileList | null) => void;
  onNameChange: (name: string) => void;
  onClear: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div className="space-y-3">
      <Label>فایل (PDF)</Label>
      {fileItem ? (
        <>
          <div className="flex items-center justify-between gap-3 rounded-2xl border bg-muted/40 px-4 py-3">
            <span className="flex items-center gap-2 text-sm font-bold">
              <FileTextIcon className="size-5 text-primary" />
              فایل بارگذاری شد
            </span>
            <button
              type="button"
              onClick={onClear}
              aria-label="حذف فایل"
              className="grid size-8 place-items-center rounded-full bg-foreground/5 hover:bg-foreground/10"
            >
              <TrashIcon className="size-4" />
            </button>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="media-file-name">نام نمایشی</Label>
            <Input
              id="media-file-name"
              value={fileItem.displayName ?? ""}
              onChange={(e) => onNameChange(e.target.value)}
              enterKeyHint="done"
              maxLength={120}
              placeholder="مثلاً منوی کامل"
            />
            <p className="text-[11px] text-muted-foreground">
              نامی که روی کارت دانلود به بازدیدکننده نشان داده می‌شود.
            </p>
          </div>
        </>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={!canUpload || uploading}
          className={cn(
            "flex h-28 w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed text-muted-foreground transition-colors",
            "hover:border-primary hover:bg-primary/5 hover:text-primary disabled:opacity-50",
          )}
        >
          {uploading ? (
            <Loader2Icon className="size-6 animate-spin" />
          ) : (
            <>
              <ImageIcon className="size-6" />
              <span className="text-sm font-bold">{addLabel}</span>
            </>
          )}
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        className="hidden"
        onChange={(e) => {
          onPickFile(e.target.files);
          if (inputRef.current) inputRef.current.value = "";
        }}
      />
    </div>
  );
}
