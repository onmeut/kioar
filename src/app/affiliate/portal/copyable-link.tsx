"use client";

/**
 * Affiliate hero share component.
 *
 * Renders the affiliate's `/r/<code>` link with two primary actions:
 *  - Copy to clipboard.
 *  - Open a bottom sheet with influencer-tone Persian share variants
 *    for Telegram, Instagram (bio + caption), Twitter/X, and a
 *    generic copy-the-message option.
 *
 * Each variant is a separate copyable text block — the affiliate
 * picks the one that fits the platform they're posting on.
 */
import { useState } from "react";

import {
  CheckIcon,
  CopyIcon,
  CameraIcon,
  MessageCircleIcon,
  Share2Icon,
  SparklesIcon,
  AtSignIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

type Variant = {
  key: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  text: string;
};

function buildVariants(href: string): Variant[] {
  return [
    {
      key: "telegram",
      label: "تلگرام",
      icon: MessageCircleIcon,
      text: `🚀 یه ابزار تازه پیدا کردم به اسم کی‌یو‌آر — یه کارت ویزیت دیجیتال که توش لینک، رزرو نوبت، فرم و QR زنده داری.

اگه با لینک من ثبت‌نام کنی و پلن سالانه‌ی پرو رو فعال کنی، ۳ ماه پروی رایگان رو هدیه می‌گیری.

ثبت‌نام: ${href}`,
    },
    {
      key: "instagram_caption",
      label: "اینستاگرام — کپشن",
      icon: CameraIcon,
      text: `از کارت ویزیت کاغذی خسته شدی؟ کی‌یو‌آر یه صفحه‌ی هوشمنده — لینک، نوبت‌دهی، فرم، همه یه‌جا 📱

با لینک تو بایو ثبت‌نام کن و پلن سالانه بگیر تا ۳ ماه پروی رایگان روی صفحه‌ت فعال بشه. هدیه‌ی من به تو 🎁

#کی‌یو‌آر #دیجیتال_مارکتینگ`,
    },
    {
      key: "instagram_bio",
      label: "اینستاگرام — بایو/استوری",
      icon: CameraIcon,
      text: `🎁 ۳ ماه پروی رایگان روی پلن سالانه‌ی کی‌یو‌آر — فقط با لینک من:
${href}`,
    },
    {
      key: "twitter",
      label: "توییتر / X",
      icon: AtSignIcon,
      text: `کی‌یو‌آر — کارت ویزیت دیجیتال ایرانی. لینک، نوبت‌دهی، فرم، QR.

با لینک من ثبت‌نام کن، پلن سالانه فعال کن، ۳ ماه پروی رایگان مهمون من باش 🎁

${href}`,
    },
    {
      key: "generic",
      label: "پیام معمولی",
      icon: Share2Icon,
      text: `سلام 👋
یه ابزار خوب پیدا کردم به اسم کی‌یو‌آر — کارت ویزیت دیجیتال با نوبت‌دهی، فرم و لینک‌های هوشمند. اگه با لینک من ثبت‌نام کنی و پلن سالانه‌ی پرو رو فعال کنی، ۳ ماه پروی رایگان مهمون من هستی.

${href}`,
    },
  ];
}

export function CopyableLink({ href }: { href: string }) {
  const [copiedHref, setCopiedHref] = useState(false);

  const onCopyHref = async () => {
    try {
      await navigator.clipboard.writeText(href);
      setCopiedHref(true);
      setTimeout(() => setCopiedHref(false), 1500);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <div
        className="flex min-w-0 flex-1 items-center gap-2 rounded-2xl border border-hairline bg-paper px-4 py-3"
        dir="ltr"
      >
        <span className="truncate font-mono text-[13px] font-bold text-ink">
          {href}
        </span>
      </div>
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={onCopyHref}
          className="h-11 rounded-2xl px-4 text-[13px] font-bold"
        >
          {copiedHref ? (
            <CheckIcon className="size-4 text-emerald-600" />
          ) : (
            <CopyIcon className="size-4" />
          )}
          {copiedHref ? "کپی شد" : "کپی"}
        </Button>
        <ShareSheet href={href} />
      </div>
    </div>
  );
}

function ShareSheet({ href }: { href: string }) {
  const variants = buildVariants(href);
  return (
    <Sheet>
      <SheetTrigger
        render={
          <Button
            type="button"
            className="h-11 rounded-2xl px-4 text-[13px] font-bold"
          >
            <Share2Icon className="size-4" />
            اشتراک‌گذاری
          </Button>
        }
      />
      <SheetContent
        side="bottom"
        className="flex flex-col max-h-[90dvh] rounded-t-3xl p-0"
      >
        <SheetHeader className="shrink-0 border-b px-4 pt-4 pb-3 text-start">
          <SheetTitle className="flex items-center gap-2 text-[16px]">
            <SparklesIcon className="size-4 text-violet-600" />
            متن آماده برای پست
          </SheetTitle>
          <SheetDescription className="text-[12px] leading-7">
            هر متن رو متناسب با پلتفرمت کپی کن. لینک معرفی توش جاسازی شده.
          </SheetDescription>
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto space-y-3 px-4 py-4 pb-6">
          {variants.map((v) => (
            <VariantCard key={v.key} variant={v} />
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function VariantCard({ variant }: { variant: Variant }) {
  const [copied, setCopied] = useState(false);
  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(variant.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  };
  const Icon = variant.icon;
  return (
    <div className="rounded-2xl border border-hairline bg-paper p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-[12px] font-bold text-ink">
          <Icon className="size-4 text-ink-soft" />
          {variant.label}
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onCopy}
          className="h-8 rounded-full px-3 text-[11px] font-bold"
        >
          {copied ? (
            <CheckIcon className="size-3.5 text-emerald-600" />
          ) : (
            <CopyIcon className="size-3.5" />
          )}
          {copied ? "کپی شد" : "کپی متن"}
        </Button>
      </div>
      <pre className="mt-2 whitespace-pre-wrap break-words font-sans text-[12px] leading-7 text-ink-soft">
        {variant.text}
      </pre>
    </div>
  );
}
