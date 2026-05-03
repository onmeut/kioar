"use client";

import { useState } from "react";
import { PencilIcon, XIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import {
  LinkIconBubble,
  LinkIconPicker,
  type LinkIconPickerValue,
} from "@/components/dashboard/link-icon-picker";
import type { IconKey } from "@/lib/link-icons";

type Props = {
  url: string;
  iconKey: IconKey | null;
  iconUrl: string | null;
  imageUrl: string | null;
  size?: number;
  onChange: (next: LinkIconPickerValue) => void;
  /**
   * Called when the user picks "auto". The host can re-fetch website
   * metadata so the cover image reappears.
   */
  onRefetch?: () => void;
  className?: string;
};

/**
 * Avatar-sized button that opens a compact icon picker popup.
 * - Hover/focus reveals a pencil affordance overlay.
 * - Desktop: small centered Dialog (Notion/Linktree-style).
 * - Mobile: bottom Sheet.
 */
export function LinkIconPickerButton({
  url,
  iconKey,
  iconUrl,
  imageUrl,
  size = 40,
  onChange,
  onRefetch,
  className,
}: Props) {
  const [open, setOpen] = useState(false);
  const isMobile = useIsMobile();

  const handleChange = (next: LinkIconPickerValue) => {
    onChange(next);
    setOpen(false);
  };

  const trigger = (
    <button
      type="button"
      aria-label="انتخاب آیکون"
      onClick={() => setOpen(true)}
      className={cn(
        "group relative shrink-0 rounded-2xl outline-none ring-foreground/40 transition-shadow focus-visible:ring-2",
        className,
      )}
      style={{ width: size, height: size }}
    >
      <LinkIconBubble
        iconKey={iconKey}
        iconUrl={iconUrl}
        imageUrl={imageUrl}
        url={url}
        size={size}
        className="rounded-2xl"
      />
      <span
        className={cn(
          "pointer-events-none absolute inset-0 flex items-center justify-center rounded-2xl bg-black/55 text-white opacity-0 transition-opacity",
          "group-hover:opacity-100 group-focus-visible:opacity-100",
        )}
        aria-hidden
      >
        <PencilIcon style={{ width: size * 0.4, height: size * 0.4 }} />
      </span>
    </button>
  );

  const body = (
    <LinkIconPicker
      url={url}
      value={{ iconKey, iconUrl, imageUrl }}
      onChange={handleChange}
      onRefetch={onRefetch}
    />
  );

  if (isMobile) {
    return (
      <>
        {trigger}
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent
            side="bottom"
            className="flex h-[80dvh] flex-col gap-0 rounded-t-3xl p-0"
          >
            <div className="grid grid-cols-[40px_1fr_40px] items-center border-b px-4 py-3">
              <div />
              <SheetTitle className="text-center text-base font-bold">
                انتخاب آیکون
              </SheetTitle>
              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="rounded-full"
                  onClick={() => setOpen(false)}
                  aria-label="بستن"
                >
                  <XIcon className="size-5" />
                </Button>
              </div>
            </div>
            <div className="flex min-h-0 flex-1 flex-col p-3">{body}</div>
          </SheetContent>
        </Sheet>
      </>
    );
  }

  return (
    <>
      {trigger}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="flex h-[min(70dvh,560px)] w-full max-w-md flex-col gap-0 overflow-hidden rounded-3xl p-0 sm:max-w-md"
          showCloseButton={false}
        >
          <div className="grid grid-cols-[40px_1fr_40px] items-center border-b px-4 py-3">
            <div />
            <DialogTitle className="text-center text-base font-bold">
              انتخاب آیکون
            </DialogTitle>
            <div className="flex justify-end">
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="rounded-full"
                onClick={() => setOpen(false)}
                aria-label="بستن"
              >
                <XIcon className="size-5" />
              </Button>
            </div>
          </div>
          <div className="flex min-h-0 flex-1 flex-col p-3">{body}</div>
        </DialogContent>
      </Dialog>
    </>
  );
}
