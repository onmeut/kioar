"use client";

import { useState } from "react";
import { CheckIcon, CopyIcon } from "lucide-react";
import { IconBrandInstagram as InstagramIcon } from "@tabler/icons-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

type Props = {
  publicUrl: string;
  slug: string;
};

/**
 * In-modal "Add to Instagram bio" view.
 *
 * Mirrors the public `/ig/<slug>` page but tuned for the page owner
 * (self-help). The shareable Easy-Install URL is shown at the bottom
 * so creators can hand it to clients or teammates who'll be doing the
 * actual paste-into-bio step on someone else's account.
 */
export function IgInstallView({ publicUrl, slug }: Props) {
  const [copied, setCopied] = useState(false);
  // We build the easy-install URL from the *current* host so dev and
  // staging environments produce sensible deep-links — never hardcode
  // kioar.com here.
  const easyInstallUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/ig/${slug}`
      : `/ig/${slug}`;

  async function copyAndOpen() {
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      toast.success("لینک کپی شد. اینستاگرام در حال باز شدن…");
      window.setTimeout(() => setCopied(false), 2000);
      // Try the native app first (works on iOS/Android when installed);
      // fall back to web after a short beat in case the scheme fails.
      openInstagram();
    } catch {
      toast.error("کپی ممکن نشد.");
    }
  }

  async function copyEasyInstall() {
    try {
      await navigator.clipboard.writeText(easyInstallUrl);
      toast.success("لینک نصب آسان کپی شد.");
    } catch {
      toast.error("کپی ممکن نشد.");
    }
  }

  return (
    <div className="space-y-5">
      <div className="rounded-3xl border border-border bg-muted/30 p-5">
        <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-white text-foreground shadow-sm">
          <InstagramIcon className="size-7" aria-hidden />
        </div>
        <div className="mt-4 space-y-2 text-center">
          <h3 className="text-base font-bold">
            افزودن لینک به بایو‌ی اینستاگرام
          </h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            با یک تپ، لینک شما کپی می‌شود و اینستاگرام باز خواهد شد. کافی است در
            «ویرایش پروفایل» در قسمت وب‌سایت پیست کنید.
          </p>
        </div>
      </div>

      <ol className="space-y-2 text-sm">
        {[
          "روی دکمه «کپی و باز کردن اینستاگرام» تپ کنید.",
          "در اینستاگرام، روی پروفایل خود → «ویرایش پروفایل» بروید.",
          "در فیلد «وب‌سایت» (یا «لینک‌ها»)، لینک را پیست کنید.",
          "تغییرات را ذخیره کنید.",
        ].map((step, i) => (
          <li key={i} className="flex items-start gap-2">
            <span className="mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-foreground text-[11px] font-bold text-background">
              {i + 1}
            </span>
            <span className="text-foreground/80 leading-relaxed">{step}</span>
          </li>
        ))}
      </ol>

      <Button type="button" className="h-12 w-full" onClick={copyAndOpen}>
        {copied ? (
          <CheckIcon className="size-4" />
        ) : (
          <CopyIcon className="size-4" />
        )}
        کپی و باز کردن اینستاگرام
      </Button>

      {/* Shareable easy-install link */}
      <div className="space-y-1.5 rounded-2xl border border-border bg-muted/30 p-3">
        <div className="text-[11px] font-medium text-muted-foreground">
          لینک «نصب آسان» — برای مشتری یا همکار:
        </div>
        <div
          dir="ltr"
          className="flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1"
        >
          <span className="flex-1 truncate text-xs font-mono">
            {easyInstallUrl.replace(/^https?:\/\//, "")}
          </span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 rounded-full"
            onClick={copyEasyInstall}
          >
            <CopyIcon className="size-3.5" />
            کپی
          </Button>
        </div>
      </div>
    </div>
  );
}

function openInstagram() {
  if (typeof window === "undefined") return;
  // Native scheme. iOS opens the app if installed; on web/desktop the
  // browser ignores it and we fall back to instagram.com.
  const t = window.setTimeout(() => {
    window.location.href = "https://www.instagram.com/accounts/edit/";
  }, 600);
  try {
    window.location.href = "instagram://user?username=";
  } catch {
    window.clearTimeout(t);
    window.location.href = "https://www.instagram.com/accounts/edit/";
  }
}
