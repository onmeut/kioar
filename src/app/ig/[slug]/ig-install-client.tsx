"use client";

import { useState } from "react";
import { CheckIcon, CopyIcon } from "lucide-react";
import { motion } from "motion/react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { BrandMark } from "@/components/shared/brand-mark";

type Props = {
  publicUrl: string;
  /** Hostless display string, e.g. `kioar.com/ryan`. */
  displayHost: string;
};

/**
 * Single-purpose "Easy Install" client.
 *
 * Two states: idle → copying → "opening Instagram…". We avoid a full
 * page transition so the user can step back if the app launch fails.
 */
export function IgInstallClient({ publicUrl, displayHost }: Props) {
  const [stage, setStage] = useState<"idle" | "copied">("idle");

  async function copyAndOpen() {
    try {
      await navigator.clipboard.writeText(publicUrl);
      setStage("copied");
      toast.success("لینک کپی شد.");
      // iOS will open the app if installed; if not, we fall back to
      // instagram.com/accounts/edit (the closest web equivalent).
      window.setTimeout(() => {
        window.location.href = "https://www.instagram.com/accounts/edit/";
      }, 700);
      try {
        window.location.href = "instagram://user?username=";
      } catch {
        /* unsupported scheme — fallback above will fire */
      }
    } catch {
      toast.error("کپی ممکن نشد.");
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.2, 0.65, 0.3, 1] }}
      className="w-full max-w-sm space-y-6 text-center"
    >
      <div className="flex justify-center">
        <BrandMark variant="mark" className="size-10" />
      </div>

      {stage === "idle" ? (
        <>
          <div className="space-y-1.5">
            <h1 className="text-2xl font-bold leading-tight">
              نصب آسان در بیوی اینستاگرام
            </h1>
            <p className="text-sm text-muted-foreground">
              برای کپی لینک کیوآر تپ کنید
            </p>
          </div>

          <button
            type="button"
            onClick={copyAndOpen}
            dir="ltr"
            className="group flex w-full items-center gap-2 rounded-full border border-border bg-background ps-1 pe-1 py-1 text-sm transition-colors hover:bg-muted/40"
          >
            <span className="flex size-9 items-center justify-center rounded-full bg-foreground/5">
              <BrandMark variant="mark" className="size-5" />
            </span>
            <span className="flex-1 truncate font-semibold text-foreground">
              {displayHost}
            </span>
            <span className="inline-flex h-9 items-center gap-1.5 rounded-full bg-foreground px-4 text-xs font-bold text-background">
              <CopyIcon className="size-3.5" aria-hidden />
              Copy
            </span>
          </button>
        </>
      ) : (
        <>
          <div className="flex items-center justify-center gap-2 text-emerald-600">
            <CheckIcon className="size-5" aria-hidden />
            <span className="font-semibold">لینک کپی شد</span>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            در حال باز کردن اینستاگرام…
            <br />
            <span className="font-medium text-foreground">
              ویرایش پروفایل ← لینک‌ها
            </span>{" "}
            را باز کنید و لینک را پیست کنید.
          </p>
          <Button
            type="button"
            variant="outline"
            className="h-11 w-full"
            onClick={copyAndOpen}
          >
            <CopyIcon className="size-4" />
            دوباره کپی کن
          </Button>
        </>
      )}
    </motion.div>
  );
}
