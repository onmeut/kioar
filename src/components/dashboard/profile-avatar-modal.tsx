"use client";

import { useRef, useState, useTransition } from "react";
import Image from "next/image";
import { Loader2Icon, UploadIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type ProfileAvatarModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentUrl: string | null;
  displayName: string;
  onUpload: (file: File) => Promise<{ ok: true } | { ok: false }>;
};

function getInitials(name: string | null | undefined) {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "·";
  if (parts.length === 1) return parts[0].slice(0, 2);
  return (parts[0][0] + parts[parts.length - 1][0]).slice(0, 2);
}

export function ProfileAvatarModal({
  open,
  onOpenChange,
  currentUrl,
  displayName,
  onUpload,
}: ProfileAvatarModalProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

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

  const shown = preview ?? currentUrl;

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
          <div className="relative size-32 overflow-hidden rounded-full bg-primary text-primary-foreground ring-4 ring-primary/30">
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
              <span className="flex h-full w-full items-center justify-center text-xl font-bold">
                {getInitials(displayName)}
              </span>
            )}
            {isPending ? (
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
            disabled={isPending}
            className="h-11 w-full rounded-full text-sm font-bold"
          >
            <UploadIcon className="size-4" />
            انتخاب تصویر
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
