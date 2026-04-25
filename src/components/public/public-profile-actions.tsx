"use client";

import { CheckIcon, CopyIcon, Share2Icon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";

export function PublicProfileShareButton({
  url,
  title,
  className,
}: {
  url: string;
  title: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function share() {
    if (
      typeof navigator !== "undefined" &&
      typeof navigator.share === "function"
    ) {
      try {
        await navigator.share({ title, url });
        return;
      } catch {
        // user dismissed — fall through to copy
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("لینک کارت کپی شد.");
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("کپی لینک ممکن نشد.");
    }
  }

  return (
    <button
      type="button"
      onClick={share}
      aria-label="اشتراک کارت"
      className={cn(
        "tap-target inline-flex size-10 items-center justify-center rounded-full bg-foreground/[0.07] text-foreground transition-colors hover:bg-foreground/[0.12] focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none",
        className,
      )}
    >
      {copied ? (
        <CheckIcon className="size-4.5" />
      ) : (
        <Share2Icon className="size-4.5" />
      )}
    </button>
  );
}

export function PublicProfileCopyPill({
  url,
  className,
}: {
  url: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("لینک کارت کپی شد.");
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("کپی لینک ممکن نشد.");
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      dir="ltr"
      className={cn(
        "inline-flex max-w-full items-center gap-2 rounded-full border border-black/8 bg-white/70 px-3 py-1.5 text-xs font-semibold text-muted-foreground shadow-sm backdrop-blur transition-colors hover:text-foreground",
        className,
      )}
    >
      {copied ? (
        <CheckIcon className="size-3.5 shrink-0" />
      ) : (
        <CopyIcon className="size-3.5 shrink-0" />
      )}
      <span className="truncate">{url.replace(/^https?:\/\//, "")}</span>
    </button>
  );
}
