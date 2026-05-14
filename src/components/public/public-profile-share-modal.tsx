"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckIcon, LinkIcon } from "lucide-react";
import {
  IconBrandFacebook,
  IconBrandLinkedin,
  IconBrandTelegram,
  IconBrandWhatsapp,
  IconBrandX,
} from "@tabler/icons-react";
import { toast } from "sonner";

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { QrRenderer } from "@/components/dashboard/share/qr-renderer";
import { useIsMobile } from "@/hooks/use-mobile";
import { DEFAULT_QR_STYLE, type QrStyle } from "@/lib/qr/types";
import { cn } from "@/lib/utils";

type ShareOption = {
  id: string;
  label: string;
  icon: React.ReactNode;
  bgClass: string;
  href?: (url: string, title: string) => string;
  action?: "copy";
};

const SHARE_OPTIONS: ShareOption[] = [
  {
    id: "copy",
    label: "کپی لینک",
    icon: <LinkIcon className="size-5 text-foreground" />,
    bgClass: "bg-muted",
    action: "copy",
  },
  {
    id: "whatsapp",
    label: "واتس‌اپ",
    icon: <IconBrandWhatsapp className="size-5 text-white" />,
    bgClass: "bg-[#25D366]",
    href: (url) => `https://wa.me/?text=${encodeURIComponent(url)}`,
  },
  {
    id: "telegram",
    label: "تلگرام",
    icon: <IconBrandTelegram className="size-5 text-white" />,
    bgClass: "bg-[#2AABEE]",
    href: (url, title) =>
      `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`,
  },
  {
    id: "x",
    label: "ایکس",
    icon: <IconBrandX className="size-5 text-white" />,
    bgClass: "bg-[#000000]",
    href: (url, title) =>
      `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`,
  },
  {
    id: "linkedin",
    label: "لینکدین",
    icon: <IconBrandLinkedin className="size-5 text-white" />,
    bgClass: "bg-[#0A66C2]",
    href: (url) =>
      `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`,
  },
  {
    id: "facebook",
    label: "فیسبوک",
    icon: <IconBrandFacebook className="size-5 text-white" />,
    bgClass: "bg-[#1877F2]",
    href: (url) =>
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
  },
];

function ShareOptionButton({
  option,
  url,
  title,
  onCopied,
  copied,
}: {
  option: ShareOption;
  url: string;
  title: string;
  onCopied: () => void;
  copied: boolean;
}) {
  if (option.action === "copy") {
    return (
      <button
        type="button"
        onClick={onCopied}
        className="flex flex-col items-center gap-2"
      >
        <span
          className={cn(
            "flex size-14 items-center justify-center rounded-full transition-opacity active:opacity-70",
            option.bgClass,
          )}
        >
          {copied ? (
            <CheckIcon className="size-5 text-foreground" />
          ) : (
            option.icon
          )}
        </span>
        <span className="text-xs text-muted-foreground">
          {copied ? "کپی شد" : option.label}
        </span>
      </button>
    );
  }

  return (
    <a
      href={option.href!(url, title)}
      target="_blank"
      rel="noopener noreferrer"
      className="flex flex-col items-center gap-2"
    >
      <span
        className={cn(
          "flex size-14 items-center justify-center rounded-full transition-opacity active:opacity-70",
          option.bgClass,
        )}
      >
        {option.icon}
      </span>
      <span className="text-xs text-muted-foreground">{option.label}</span>
    </a>
  );
}

function ShareModalContent({
  url,
  title,
  avatarUrl: _avatarUrl,
  avatarSeed: _avatarSeed,
  qrStyle,
}: {
  url: string;
  title: string;
  avatarUrl: string | null | undefined;
  avatarSeed: string | null | undefined;
  qrStyle: QrStyle | null | undefined;
}) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("لینک کارت کپی شد.");
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("کپی لینک ممکن نشد.");
    }
  }

  const resolvedQrStyle = qrStyle ?? DEFAULT_QR_STYLE;

  return (
    <div className="flex flex-col gap-5 px-4 pb-6 pt-2" dir="rtl">
      {/* QR code */}
      <div
        className="relative flex items-center justify-center rounded-2xl border border-border p-4"
        style={{
          backgroundImage:
            "radial-gradient(circle, #d1d5db 1px, transparent 1px)",
          backgroundSize: "16px 16px",
        }}
      >
        <div className="w-full rounded-2xl bg-white p-2 shadow-sm">
          <QrRenderer
            text={url}
            style={resolvedQrStyle}
            className="size-full"
          />
        </div>
      </div>

      {/* Share options */}
      <div className="flex items-start justify-around gap-1 overflow-x-auto pb-1 no-scrollbar">
        {SHARE_OPTIONS.map((option) => (
          <ShareOptionButton
            key={option.id}
            option={option}
            url={url}
            title={title}
            onCopied={handleCopy}
            copied={copied && option.id === "copy"}
          />
        ))}
      </div>

      {/* Divider + CTA */}
      <div className="flex flex-col gap-3">
        <div className="h-px bg-border" />
        <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">
              با {title} در کیوآر باش
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              لینک‌ها، فرم‌ها و رزرو وقت — رایگان.
            </p>
          </div>
          <Link
            href="https://kioar.com/auth/register?ref=share-modal"
            className="flex h-11 w-full shrink-0 items-center justify-center rounded-full bg-foreground px-5 text-sm font-semibold text-background transition-opacity hover:opacity-80 sm:w-auto"
          >
            ثبت‌نام رایگان
          </Link>
        </div>
      </div>
    </div>
  );
}

export function PublicProfileShareModal({
  open,
  onClose,
  url,
  title,
  slug,
  avatarUrl,
  avatarSeed,
  qrStyle,
}: {
  open: boolean;
  onClose: () => void;
  url: string;
  title: string;
  slug: string;
  avatarUrl: string | null | undefined;
  avatarSeed: string | null | undefined;
  qrStyle: QrStyle | null | undefined;
}) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
        <SheetContent side="bottom" className="flex flex-col rounded-t-2xl p-0">
          <SheetTitle className="shrink-0 border-b px-4 py-3 text-center text-base font-semibold">
            اشتراک‌گذاری پروفایل
          </SheetTitle>
          <div className="min-h-0 flex-1 overflow-y-auto px-0 pb-safe-or-6">
            <ShareModalContent
              url={url}
              title={title}
              avatarUrl={avatarUrl}
              avatarSeed={avatarSeed}
              qrStyle={qrStyle}
            />
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm gap-0 p-0">
        <DialogTitle className="px-4 py-4 text-center text-base font-semibold">
          اشتراک‌گذاری پروفایل
        </DialogTitle>
        <ShareModalContent
          url={url}
          title={title}
          avatarUrl={avatarUrl}
          avatarSeed={avatarSeed}
          qrStyle={qrStyle}
        />
      </DialogContent>
    </Dialog>
  );
}
