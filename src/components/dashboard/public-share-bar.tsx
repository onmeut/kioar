"use client";

import { useState } from "react";
import { CheckIcon, CopyIcon, ShareIcon } from "lucide-react";
import { toast } from "sonner";

import { QrCard } from "@/components/dashboard/qr-card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type PublicShareBarProps = {
  publicUrl: string;
  slug: string;
  displayName: string;
  /** "{domain}/{slug}" — controls the host shown in the pill. */
  host?: string;
  /** When set, overrides the pill label text and switches to RTL layout. */
  label?: string;
  className?: string;
  /**
   * `pill` (default) renders the host/label pill. `icon` renders a
   * compact circular share button — used inside the mobile dashboard
   * header where we only have room for an affordance.
   */
  variant?: "pill" | "icon";
};

export function PublicShareBar({
  publicUrl,
  slug,
  displayName,
  host,
  label,
  className,
  variant = "pill",
}: PublicShareBarProps) {
  const [open, setOpen] = useState(false);
  const displayHost = host ?? `kioar.com/${slug}`;

  if (variant === "icon") {
    return (
      <>
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="اشتراک‌گذاری"
          className={cn(
            "tap-target inline-flex size-11 items-center justify-center rounded-full text-foreground transition-colors hover:bg-muted",
            className,
          )}
        >
          <ShareIcon className="size-5" aria-hidden />
        </button>
        <ShareDialog
          open={open}
          onOpenChange={setOpen}
          publicUrl={publicUrl}
          displayHost={displayHost}
          displayName={displayName}
        />
      </>
    );
  }

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        onClick={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") setOpen(true);
        }}
        className={cn(
          "flex w-full max-w-62.5 cursor-pointer items-center justify-center gap-2 rounded-full border border-border bg-background/90 px-4 py-2.5 text-sm backdrop-blur transition-colors hover:bg-muted/60",
          className,
        )}
        dir={label ? "rtl" : "ltr"}
      >
        <ShareIcon className="size-4 shrink-0 text-foreground" />
        <span
          className="truncate font-semibold text-foreground/80"
          title={publicUrl}
        >
          {label ?? displayHost}
        </span>
      </div>

      <ShareDialog
        open={open}
        onOpenChange={setOpen}
        publicUrl={publicUrl}
        displayHost={displayHost}
        displayName={displayName}
      />
    </>
  );
}

function ShareDialog({
  open,
  onOpenChange,
  publicUrl,
  displayHost,
  displayName,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  publicUrl: string;
  displayHost: string;
  displayName: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      toast.success("لینک کپی شد.");
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error("کپی ممکن نشد.");
    }
  }

  async function nativeShare() {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: displayName, url: publicUrl });
      } catch {
        /* user cancelled */
      }
    } else {
      copy();
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>اشتراک‌گذاری</DialogTitle>
          <DialogDescription className="sr-only">
            لینک عمومی و کد QR شما برای اشتراک‌گذاری
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div
            dir="ltr"
            className="flex items-center gap-2 rounded-3xl border bg-muted/40 px-3 py-2"
          >
            <span className="flex-1 truncate text-sm font-semibold">
              {displayHost}
            </span>
            <Button type="button" size="sm" onClick={copy} className="h-8 px-3">
              {copied ? (
                <CheckIcon className="size-3.5" />
              ) : (
                <CopyIcon className="size-3.5" />
              )}
              {copied ? "کپی شد" : "کپی"}
            </Button>
          </div>

          <QrCard url={publicUrl} title={displayName} />

          <Button
            type="button"
            variant="outline"
            className="h-11 w-full"
            onClick={nativeShare}
          >
            <ShareIcon className="size-4" />
            اشتراک‌گذاری سیستمی
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
