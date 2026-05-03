"use client";

import { useRef, useState, useTransition } from "react";
import Image from "next/image";
import { Loader2Icon, Trash2Icon, UploadIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { BoringAvatar } from "@/components/shared/boring-avatar";

type ProfileAvatarModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentUrl: string | null;
  /** Seed used for the boring-avatar fallback when no photo is set. */
  avatarSeed: string | null;
  displayName: string;
  onUpload: (file: File) => Promise<{ ok: true } | { ok: false }>;
  onDelete?: () => Promise<{ ok: true } | { ok: false }>;
};

export function ProfileAvatarModal({
  open,
  onOpenChange,
  currentUrl,
  avatarSeed,
  displayName,
  onUpload,
  onDelete,
}: ProfileAvatarModalProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isDeleting, startDeleteTransition] = useTransition();

  async function handleFiles(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
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

  async function handleDelete() {
    if (!onDelete) return;
    startDeleteTransition(async () => {
      const result = await onDelete();
      if (result.ok) {
        onOpenChange(false);
      }
    });
  }

  const shown = preview ?? currentUrl;
  const busy = isPending || isDeleting;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>تصویر پروفایل</DialogTitle>
          <DialogDescription>
            تصویری مربعی و شفاف برای بهترین نتیجه انتخاب کنید.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4 py-2">
          <div className="relative size-32 overflow-hidden rounded-full border border-foreground/10 bg-card">
            {shown ? (
              <Image
                src={shown}
                alt=""
                fill
                className="object-cover"
                sizes="128px"
                unoptimized={Boolean(preview)}
              />
            ) : (
              <BoringAvatar seed={avatarSeed} size={128} />
            )}
            {busy ? (
              <span className="absolute inset-0 flex items-center justify-center bg-black/40">
                <Loader2Icon className="size-6 animate-spin text-white" />
              </span>
            ) : null}
          </div>

          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />

          <Button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            className="h-11 w-full rounded-full text-sm font-bold"
          >
            <UploadIcon className="size-4" />
            انتخاب تصویر
          </Button>

          {currentUrl && onDelete ? (
            <Button
              type="button"
              variant="ghost"
              onClick={handleDelete}
              disabled={busy}
              className="h-11 w-full rounded-full text-sm font-medium text-destructive hover:bg-destructive/10 hover:text-destructive"
            >
              <Trash2Icon className="size-4" />
              حذف تصویر
            </Button>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
