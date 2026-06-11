"use client";

// Add/edit sheet for the "text" block. Notion-style: an optional icon + title
// on one row, a borderless RTL textarea for the body, and an optional
// full-width photo. Mobile uses a bottom Sheet, desktop a centered Dialog
// (matches the form/booking builders). The dialog is controlled + dumb: it
// owns the local draft and calls `onSubmit(draft)`; the parent owns the
// server-action wiring so the same dialog serves both add and edit.

import { useEffect, useRef, useState } from "react";
import {
  ArrowRightIcon,
  ImageIcon,
  Loader2Icon,
  PencilIcon,
  TrashIcon,
  UploadIcon,
  XIcon,
} from "lucide-react";

import { LinkIconPickerButton } from "@/components/dashboard/link-icon-picker-button";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import type { IconKey } from "@/lib/link-icons";
import { TEXT_BLOCK_BODY_MAX } from "@/lib/validations";
import { toPersianDigits } from "@/lib/date/persian";
import { cn } from "@/lib/utils";

export type TextBlockDraft = {
  /** Present when editing; absent for a new block. */
  id?: string;
  title: string | null;
  iconKey: IconKey | null;
  iconUrl: string | null;
  body: string;
  photoUrl: string | null;
};

const DEFAULT_DRAFT: TextBlockDraft = {
  title: null,
  iconKey: null,
  iconUrl: null,
  body: "",
  photoUrl: null,
};

export type TextBlockDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pre-fills all fields when editing an existing block. */
  initial?: TextBlockDraft | null;
  onSubmit: (draft: TextBlockDraft) => Promise<void> | void;
  /** Uploads the optional photo, returning its public URL. */
  onUploadImage?: (file: File) => Promise<string | null>;
  submitting?: boolean;
  /** If provided, the back button navigates back instead of closing. */
  onBack?: () => void;
};

export function TextBlockDialog({
  open,
  onOpenChange,
  initial,
  onSubmit,
  onUploadImage,
  submitting,
  onBack,
}: TextBlockDialogProps) {
  const isMobile = useIsMobile();
  const [draft, setDraft] = useState<TextBlockDraft>(
    () => initial ?? DEFAULT_DRAFT,
  );

  useEffect(() => {
    if (open) setDraft(initial ?? DEFAULT_DRAFT);
  }, [open, initial]);

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
  const canSubmit = draft.body.trim().length > 0 && !submitting;

  async function handleSave() {
    if (!canSubmit) return;
    await onSubmit({
      ...draft,
      title: draft.title?.trim() ? draft.title.trim() : null,
      body: draft.body.trim(),
    });
  }

  return (
    <Container open={open} onOpenChange={onOpenChange}>
      <Content {...contentProps}>
        <Title className="sr-only">
          {isEditing ? "ویرایش بلوک متن" : "افزودن بلوک متن"}
        </Title>

        {/* Header */}
        <div className="grid shrink-0 grid-cols-[40px_1fr_40px] items-center border-b px-4 py-3 sm:px-5 sm:py-4">
          <div className="flex">
            <button
              type="button"
              onClick={() => onBack ? onBack() : onOpenChange(false)}
              aria-label="بازگشت"
              className="tap-target inline-flex size-10 items-center justify-center rounded-2xl border border-border bg-background text-foreground transition-colors hover:bg-muted"
            >
              <ArrowRightIcon className="size-5" />
            </button>
          </div>
          <h2 className="text-center text-lg font-bold">
            {isEditing ? "ویرایش بلوک متن" : "افزودن بلوک متن"}
          </h2>
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
          {/* Icon + title row */}
          <div className="flex items-center gap-3">
            <LinkIconPickerButton
              url=""
              iconKey={draft.iconKey}
              iconUrl={draft.iconUrl}
              imageUrl={null}
              size={48}
              onChange={(next) =>
                setDraft((d) => ({
                  ...d,
                  iconKey: next.iconKey,
                  iconUrl: next.iconUrl,
                }))
              }
            />
            <div className="min-w-0 flex-1 space-y-1.5">
              <Label htmlFor="text-block-title">عنوان (اختیاری)</Label>
              <Input
                id="text-block-title"
                value={draft.title ?? ""}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, title: e.target.value }))
                }
                enterKeyHint="next"
                maxLength={80}
                placeholder="یک عنوان کوتاه"
              />
            </div>
          </div>

          {/* Body — bordered RTL textarea, matches the other fields */}
          <div className="space-y-1.5">
            <Label htmlFor="text-block-body">متن</Label>
            <textarea
              id="text-block-body"
              value={draft.body}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  body: e.target.value.slice(0, TEXT_BLOCK_BODY_MAX),
                }))
              }
              dir="rtl"
              autoFocus
              enterKeyHint="enter"
              placeholder="متن خود را بنویسید…"
              className="min-h-32 w-full resize-none rounded-lg border border-border bg-transparent px-3 py-2.5 text-base leading-7 text-foreground outline-none transition-colors duration-200 placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/20"
            />
            <p className="text-xs text-muted-foreground">
              {toPersianDigits(draft.body.length)}/
              {toPersianDigits(TEXT_BLOCK_BODY_MAX)}
            </p>
          </div>

          {/* Photo */}
          <TextBlockPhotoField
            photoUrl={draft.photoUrl}
            onChange={(url) => setDraft((d) => ({ ...d, photoUrl: url }))}
            onUploadImage={onUploadImage}
          />
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
// Full-width photo field (no cropping — the block renders the photo at the
// full width of the block, any aspect ratio).
// ---------------------------------------------------------------------------

function TextBlockPhotoField({
  photoUrl,
  onChange,
  onUploadImage,
}: {
  photoUrl: string | null;
  onChange: (url: string | null) => void;
  onUploadImage?: (file: File) => Promise<string | null>;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function handleFiles(files: FileList | null) {
    const file = files?.[0];
    if (!file || !onUploadImage) return;
    setUploading(true);
    try {
      const url = await onUploadImage(file);
      if (url) onChange(url);
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="grid gap-1.5">
      <Label>عکس (اختیاری)</Label>
      {photoUrl ? (
        <div className="relative w-full overflow-hidden rounded-2xl border bg-muted">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photoUrl}
            alt=""
            className="max-h-64 w-full object-cover"
          />
          <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-black/55 px-3 py-2 text-white">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={uploading || !onUploadImage}
              className="inline-flex items-center gap-1 rounded-full bg-white/15 px-3 py-1.5 text-xs font-bold backdrop-blur hover:bg-white/25"
            >
              <PencilIcon className="size-3.5" />
              تغییر
            </button>
            <button
              type="button"
              onClick={() => onChange(null)}
              disabled={uploading}
              className="grid size-7 place-items-center rounded-full bg-white/15 backdrop-blur hover:bg-white/25"
              aria-label="حذف عکس"
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
          disabled={!onUploadImage || uploading}
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
              <span className="text-sm font-bold">افزودن عکس</span>
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
      {!photoUrl ? (
        <p className="text-[11px] text-muted-foreground">
          <UploadIcon className="me-1 inline size-3" />
          عکس به‌صورت تمام‌عرض زیر متن نمایش داده می‌شود.
        </p>
      ) : null}
    </div>
  );
}
