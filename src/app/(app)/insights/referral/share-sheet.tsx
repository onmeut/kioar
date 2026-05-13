"use client";

import * as React from "react";

import {
  CheckIcon,
  CopyIcon,
  LinkIcon,
  MessageCircleIcon,
  SendIcon,
  Share2Icon,
  ShareIcon,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

/**
 * Channel-aware share sheet.
 *
 * - Opens as a bottom sheet on mobile, side sheet on desktop (default
 *   shadcn `<Sheet />` resolves to `right`; on small screens we override
 *   to `bottom` for thumb-reach).
 * - Three Persian message variants + one English one. The user picks a
 *   tone, the channel button deep-links into Telegram / WhatsApp / X /
 *   Instagram with that tone pre-filled.
 * - Falls back to native share + clipboard when no specific channel is
 *   selected. Always shows a brand-tone "OG preview" card so the user
 *   sees what the unfurl will look like.
 *
 * The component is intentionally state-light: each render computes
 * deep-link URLs for the active variant, no debounce, no abort. The
 * parent owns `inviteUrl` and `inviterName` and they don't change at
 * runtime.
 */
type Variant = {
  id: string;
  tone: string; // FA label shown to user
  body: string;
  lang: "fa" | "en";
};

function buildVariants(inviteUrl: string, inviterName: string): Variant[] {
  return [
    {
      id: "warm",
      tone: "صمیمی",
      lang: "fa",
      body: `سلام 👋\nمن ${inviterName} هستم. کی‌یو‌آر یه کارت ویزیت دیجیتال خوشگله که همه‌ی لینک‌ها، رزرو نوبت و فرم‌ها رو یه جا جمع می‌کنه. با لینک من ثبت‌نام کنی، یک ماه پروی رایگان روی صفحه‌ت فعال می‌شه:\n${inviteUrl}`,
    },
    {
      id: "short",
      tone: "کوتاه",
      lang: "fa",
      body: `یه ماه پروی کی‌یو‌آر رایگان مهمون من 🎁\n${inviteUrl}`,
    },
    {
      id: "business",
      tone: "حرفه‌ای",
      lang: "fa",
      body: `کی‌یو‌آر رو امتحان کن — کارت ویزیت دیجیتال ایرانی برای کسب‌وکار. با این لینک یک ماه پرو رایگان می‌گیری:\n${inviteUrl}`,
    },
    {
      id: "english",
      tone: "English",
      lang: "en",
      body: `Hey — I'm using Kioar as my digital business card. Sign up with my link and you'll get one free month of Pro on me:\n${inviteUrl}`,
    },
  ];
}

type ChannelKey = "telegram" | "whatsapp" | "x" | "instagram" | "copy" | "more";

export function ShareSheet({
  inviteUrl,
  inviterName,
  trigger,
}: {
  inviteUrl: string;
  inviterName: string;
  trigger?: React.ReactElement;
}) {
  const [activeId, setActiveId] = React.useState("warm");
  const [copied, setCopied] = React.useState<ChannelKey | null>(null);
  const variants = React.useMemo(
    () => buildVariants(inviteUrl, inviterName),
    [inviteUrl, inviterName],
  );
  const active = variants.find((v) => v.id === activeId) ?? variants[0];

  const tg = `https://t.me/share/url?url=${encodeURIComponent(inviteUrl)}&text=${encodeURIComponent(active.body)}`;
  const wa = `https://wa.me/?text=${encodeURIComponent(active.body)}`;
  const x = `https://twitter.com/intent/tweet?text=${encodeURIComponent(active.body)}`;

  async function copyText(text: string, key: ChannelKey) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      toast.success("کپی شد", { description: "متن آماده‌ی پیست در هر اپ" });
      setTimeout(() => setCopied(null), 1800);
    } catch {
      window.prompt("کپی کنید:", text);
    }
  }

  async function nativeShare() {
    if (typeof navigator !== "undefined" && "share" in navigator) {
      try {
        await navigator.share({
          title: "دعوت کی‌یو‌آر",
          text: active.body,
          url: inviteUrl,
        });
        return;
      } catch {
        /* user cancelled */
      }
    }
    await copyText(active.body, "more");
  }

  return (
    <Sheet>
      <SheetTrigger
        render={
          trigger ?? (
            <Button className="h-11 gap-2">
              <Share2Icon className="size-4" />
              اشتراک‌گذاری دعوت
            </Button>
          )
        }
      />
      <SheetContent
        side="bottom"
        className="flex flex-col p-0 sm:max-w-lg! sm:mx-auto! sm:rounded-t-3xl max-h-[90dvh] overflow-hidden"
      >
        {/* Fixed header — never scrolls */}
        <SheetHeader className="shrink-0 border-b border-border px-5 pt-5 pb-4 text-start">
          <SheetTitle>اشتراک‌گذاری دعوت</SheetTitle>
          <SheetDescription>
            یکی از این متن‌ها رو انتخاب کن و توی هر کانالی که می‌خوای بفرست.
          </SheetDescription>
        </SheetHeader>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* OG-preview card */}
          <div className="rounded-2xl border border-border bg-muted/40 p-3">
            <div className="text-[10px] font-medium text-muted-foreground mb-2">
              پیش‌نمایش لینک در پیام‌رسان‌ها
            </div>
            <div className="overflow-hidden rounded-xl border border-border bg-card">
              <div className="flex aspect-[1200/630] w-full items-center justify-center bg-violet-500">
                <div className="text-center text-white">
                  <div className="text-xs font-medium opacity-80">
                    دعوت‌نامه‌ی کی‌یو‌آر
                  </div>
                  <div className="mt-1 text-xl font-extrabold">
                    {inviterName}
                  </div>
                  <div className="mt-3 inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-bold backdrop-blur">
                    🎁 یک ماه پرو رایگان
                  </div>
                </div>
              </div>
              <div className="border-t border-border px-3 py-2 text-[11px]">
                <div
                  className="truncate font-mono text-muted-foreground"
                  dir="ltr"
                >
                  kioar.com
                </div>
                <div className="mt-0.5 font-semibold text-foreground">
                  دعوت‌نامه‌ی {inviterName} برای کی‌یو‌آر
                </div>
              </div>
            </div>
          </div>

          {/* Variant chips */}
          <div className="flex flex-wrap gap-1.5" role="tablist">
            {variants.map((v) => (
              <button
                key={v.id}
                type="button"
                role="tab"
                aria-selected={v.id === activeId}
                onClick={() => setActiveId(v.id)}
                className={cn(
                  "h-9 rounded-full border px-3 text-xs font-semibold transition",
                  v.id === activeId
                    ? "border-foreground bg-foreground text-background"
                    : "border-border bg-card text-foreground hover:bg-muted/50",
                )}
              >
                {v.tone}
              </button>
            ))}
          </div>

          {/* Message body */}
          <div
            dir={active.lang === "en" ? "ltr" : "rtl"}
            className="rounded-2xl border border-border bg-card p-4 text-sm leading-7 text-foreground whitespace-pre-line"
          >
            {active.body}
          </div>

          {/* Channels — 2×2 grid, full-width buttons */}
          <div className="grid grid-cols-2 gap-2">
            <ChannelButton
              href={tg}
              icon={<SendIcon className="size-4" />}
              label="تلگرام"
              tone="bg-sky-500 text-white hover:bg-sky-600"
            />
            <ChannelButton
              href={wa}
              icon={<MessageCircleIcon className="size-4" />}
              label="واتس‌اپ"
              tone="bg-emerald-500 text-white hover:bg-emerald-600"
            />
            <ChannelButton
              href={x}
              icon={<ShareIcon className="size-4" />}
              label="X (توییتر)"
              tone="bg-zinc-900 text-white hover:bg-zinc-800"
            />
            <button
              type="button"
              onClick={() => copyText(inviteUrl, "copy")}
              className={cn(
                "tap-target inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-border bg-card text-sm font-semibold text-foreground transition hover:bg-muted/50",
              )}
            >
              {copied === "copy" ? (
                <>
                  <CheckIcon className="size-4 text-emerald-600" />
                  لینک کپی شد
                </>
              ) : (
                <>
                  <LinkIcon className="size-4" />
                  کپی فقط لینک
                </>
              )}
            </button>
          </div>

          {/* Secondary actions */}
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-11 gap-2"
              onClick={() => copyText(active.body, "more")}
            >
              {copied === "more" ? (
                <>
                  <CheckIcon className="size-4 text-emerald-600" />
                  متن کپی شد
                </>
              ) : (
                <>
                  <CopyIcon className="size-4" />
                  کپی کامل متن
                </>
              )}
            </Button>
            <Button type="button" className="h-11 gap-2" onClick={nativeShare}>
              <Share2Icon className="size-4" />
              اشتراک‌گذاری
            </Button>
          </div>
        </div>

        {/* Fixed footer */}
        <SheetFooter className="shrink-0 border-t border-border px-5 py-3 text-center">
          <p className="text-[11px] leading-5 text-muted-foreground">
            وقتی دوستت با لینک تو ثبت‌نام کنه و پروی رو فعال کنه، یک ماه پرو
            مهمون شماست — هر دو طرف.
          </p>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function ChannelButton({
  href,
  icon,
  label,
  tone,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  tone: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "tap-target inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold transition",
        tone,
      )}
    >
      {icon}
      <span>{label}</span>
    </a>
  );
}
