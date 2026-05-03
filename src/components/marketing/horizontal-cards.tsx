"use client";

import {
  useRef,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import {
  ArrowLeftIcon,
  CalendarCheckIcon,
  CheckIcon,
  ContactIcon,
  CreditCardIcon,
  FileTextIcon,
  MailIcon,
  PaintbrushIcon,
  PhoneIcon,
  QrCodeIcon,
  RadioTowerIcon,
  ShareIcon,
  SmartphoneIcon,
  SparklesIcon,
  TimerIcon,
  TrendingUpIcon,
  UsersIcon,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";

/* =================================================================
 *  Drag-to-scroll horizontal card slider
 *  - No auto-animation. User scrolls or drags.
 *  - dir="rtl" so CARDS[0] appears on the right.
 *  - Pointer-drag works on desktop; native scroll works on touch.
 * ================================================================= */

export function HorizontalCards() {
  const trackRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const startX = useRef(0);
  const startScroll = useRef(0);

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    dragging.current = true;
    startX.current = e.clientX;
    startScroll.current = trackRef.current?.scrollLeft ?? 0;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragging.current || !trackRef.current) return;
    const dx = e.clientX - startX.current;
    // RTL: drag left increases scrollLeft, drag right decreases it.
    trackRef.current.scrollLeft = startScroll.current - dx;
  };

  const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragging.current) return;
    dragging.current = false;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* already released */
    }
  };

  return (
    <section className="bg-paper py-16 sm:py-24" dir="rtl">
      <div className="marketing-shell">
        <SectionHead
          title="هر کار کسب‌وکارت — در یک پروفایل."
          body="کیوآر یک صفحهٔ تمیز با بلاک‌های هدف‌دار است. لینک می‌گذاری، نوبت می‌گیری، فرم پر می‌کنی، می‌فروشی — بدون رفتن به صفحهٔ دیگر."
        />
      </div>

      {/* full-bleed scrollable track */}
      <div
        ref={trackRef}
        className="no-scrollbar mt-12 flex gap-4 overflow-x-auto px-5 cursor-grab active:cursor-grabbing sm:px-6"
        style={{ touchAction: "pan-x" }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {CARDS.map((card) => (
          <FeatureCard key={card.id} {...card} />
        ))}
        {/* trailing padding so last card isn't flush against the edge */}
        <div className="w-5 shrink-0 sm:w-6" aria-hidden />
      </div>
    </section>
  );
}

/* =================================================================
 *  SectionHead (also imported by FeatureGrid)
 * ================================================================= */
export function SectionHead({ title, body }: { title: string; body: string }) {
  return (
    <div className="grid items-end gap-6 md:grid-cols-[1.6fr_1fr]">
      <h2 className="text-[clamp(28px,4.2vw,46px)] leading-[1.1] font-semibold tracking-[-0.02em] text-ink">
        {title}
      </h2>
      <p className="text-[15px] leading-[1.7] text-ink-soft">{body}</p>
    </div>
  );
}

/* =================================================================
 *  Card primitive — Beside-style
 * ================================================================= */
type Tone = "light" | "dark" | "blue";

type CardData = {
  id: string;
  tone: Tone;
  icon: LucideIcon;
  label: string;
  title: string;
  cta?: string;
  visual: ReactNode;
};

function FeatureCard({
  tone,
  icon: Icon,
  label,
  title,
  cta,
  visual,
}: CardData) {
  return (
    <article
      dir="rtl"
      className={cn(
        "relative flex w-75 shrink-0 flex-col overflow-hidden rounded-3xl border p-6 transition-shadow duration-300 sm:w-85",
        "min-h-110 sm:min-h-120",
        tone === "light" &&
          "border-hairline bg-paper hover:shadow-[0_24px_60px_-24px_rgba(15,23,42,0.18)]",
        tone === "dark" &&
          "border-ink/15 bg-ink hover:shadow-[0_24px_60px_-24px_rgba(0,0,0,0.45)]",
        tone === "blue" &&
          "border-blue-700 bg-blue-600 hover:shadow-[0_24px_60px_-24px_rgba(37,99,235,0.55)]",
      )}
    >
      {(tone === "dark" || tone === "blue") && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-paper/20"
        />
      )}

      <div
        className={cn(
          "flex items-center gap-2 text-[12px] font-semibold",
          tone === "light" && "text-ink",
          (tone === "dark" || tone === "blue") && "text-paper",
        )}
      >
        <Icon
          className={cn(
            "size-4",
            tone === "light" && "text-ink",
            (tone === "dark" || tone === "blue") && "text-paper",
          )}
        />
        {label}
      </div>

      <h3
        className={cn(
          "mt-4 text-[22px] leading-tight font-semibold tracking-[-0.01em]",
          tone === "light" && "text-ink",
          (tone === "dark" || tone === "blue") && "text-paper",
        )}
      >
        {title}
      </h3>

      {cta && (
        <a
          href="#"
          onClick={(e) => e.preventDefault()}
          className={cn(
            "mt-3 inline-flex w-fit items-center gap-1.5 text-[13px] font-medium transition-opacity hover:opacity-70",
            tone === "light" && "text-ink-soft",
            tone === "dark" && "text-paper/70",
            tone === "blue" && "text-paper/85",
          )}
        >
          {cta}
          <ArrowLeftIcon className="size-3.5" />
        </a>
      )}

      <div className="mt-auto pt-6">{visual}</div>
    </article>
  );
}

/* =================================================================
 *  Visuals — no gradients (hard rule)
 * ================================================================= */
const fa = (n: number) => n.toString().replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[+d]);

function BookingCalendarVisual() {
  const days = Array.from({ length: 30 }, (_, i) => i + 1);
  return (
    <div className="space-y-2">
      <div className="rounded-2xl border border-paper/10 bg-paper/6 p-3">
        <div className="mb-2 flex items-center justify-between text-[10px] text-paper/60">
          <span>آبان ۱۴۰۴</span>
          <span className="text-paper/50">۳۰ روز</span>
        </div>
        <div className="grid grid-cols-7 gap-1">
          {days.map((d) => {
            const active = d === 18;
            const dim = d > 26;
            return (
              <span
                key={d}
                className={cn(
                  "rounded-md py-1 text-center text-[10px]",
                  active && "bg-emerald-500 font-bold text-white",
                  !active && !dim && "bg-paper/6 text-paper/75",
                  dim && "text-paper/30",
                )}
              >
                {fa(d)}
              </span>
            );
          })}
        </div>
      </div>
      <div className="flex items-center gap-2 rounded-2xl bg-emerald-500 px-3 py-2.5">
        <span className="grid size-7 place-items-center rounded-full bg-white/20 text-white">
          <CheckIcon className="size-3.5" strokeWidth={3} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[12px] font-bold text-white">
            نوبت تأیید شد
          </p>
          <p className="truncate text-[10px] text-white/80">
            چهارشنبه ۱۸:۳۰ — Google Meet
          </p>
        </div>
      </div>
    </div>
  );
}

function MultiProfileVisual() {
  const rows = [
    {
      tone: "bg-fuchsia-500",
      initial: "ج",
      title: "پروفایل جف",
      sub: "kioar.app/jeff",
    },
    {
      tone: "bg-stone-300",
      initial: "ب",
      title: "پروفایل بابی",
      sub: "kioar.app/bobby",
    },
    {
      tone: "bg-amber-300",
      initial: "ه",
      title: "پروفایل هلنه",
      sub: "kioar.app/helene",
    },
  ];
  return (
    <div className="rounded-2xl border border-hairline bg-paper-soft p-2">
      {rows.map((n, i) => (
        <div
          key={n.title}
          className={cn(
            "flex items-center gap-3 rounded-xl bg-paper px-3 py-2.5",
            i !== rows.length - 1 && "mb-1.5",
          )}
        >
          <span
            className={cn(
              "grid size-8 shrink-0 place-items-center rounded-full text-[11px] font-bold text-paper",
              n.tone,
            )}
          >
            {n.initial}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[12px] font-semibold text-ink">
              {n.title}
            </p>
            <p className="truncate text-[10px] text-ink-soft" dir="ltr">
              {n.sub}
            </p>
          </div>
          <div className="flex -space-x-1.5 -space-x-reverse">
            {["bg-amber-300", "bg-stone-300", "bg-rose-300"].map((t, j) => (
              <span
                key={j}
                className={cn(
                  "block size-5 rounded-full border-2 border-paper",
                  t,
                )}
              />
            ))}
            <span className="grid size-5 place-items-center rounded-full border-2 border-paper bg-ink text-[8px] font-bold text-paper">
              ۲
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

function AnalyticsVisual() {
  return (
    <div className="relative rounded-2xl border border-hairline bg-paper-soft p-3">
      <div className="flex items-center justify-between text-[10px]">
        <span className="text-ink-soft">۷ روز گذشته</span>
        <span className="rounded-full bg-emerald-500 px-2 py-0.5 font-bold text-white">
          ۲۴٪ ↑
        </span>
      </div>
      <div className="relative mt-2 h-32 w-full">
        <svg
          viewBox="0 0 240 100"
          className="h-full w-full"
          preserveAspectRatio="none"
        >
          <path
            d="M0 75 L30 70 L60 60 L90 50 L120 55 L150 35 L180 28 L210 22 L240 8 L240 100 L0 100 Z"
            fill="rgba(99,102,241,0.10)"
          />
          <path
            d="M0 75 L30 70 L60 60 L90 50 L120 55 L150 35 L180 28 L210 22 L240 8"
            stroke="currentColor"
            className="text-indigo-500"
            strokeWidth="2.5"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle
            cx="180"
            cy="28"
            r="4"
            className="fill-paper stroke-indigo-500"
            strokeWidth="2.5"
          />
        </svg>
        <div
          dir="rtl"
          className="absolute left-[24%] top-1 inline-flex items-center gap-2 rounded-full border border-hairline bg-paper px-2.5 py-1 shadow-[0_4px_12px_rgba(15,23,42,0.08)]"
        >
          <span className="grid size-4 place-items-center rounded-full bg-indigo-500 text-[8px] font-bold text-white">
            ک
          </span>
          <span className="text-[10px] font-semibold text-ink">
            ۱٬۲۳۸ بازدید
          </span>
        </div>
      </div>
      <div className="mt-2 flex items-center justify-between text-[10px] text-ink-soft">
        <span>اصفهان</span>
        <span>تهران</span>
        <span>مشهد</span>
        <span>شیراز</span>
      </div>
    </div>
  );
}

function QrCardVisual() {
  const cells = Array.from({ length: 81 }, (_, i) => {
    const r = Math.floor(i / 9);
    const c = i % 9;
    const finder = (r < 3 && c < 3) || (r < 3 && c > 5) || (r > 5 && c < 3);
    if (finder) {
      const inFrame =
        r === 0 ||
        r === 2 ||
        c === 0 ||
        c === 2 ||
        (r > 5 && (r === 6 || r === 8)) ||
        (c > 5 && (c === 6 || c === 8));
      const inDot =
        (r === 1 && c === 1) || (r === 1 && c === 7) || (r === 7 && c === 1);
      return inFrame || inDot;
    }
    return (i * 13 + r * 5 + c * 7) % 5 < 2;
  });
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3 rounded-2xl bg-white p-3">
        <div className="grid size-28 shrink-0 grid-cols-9 gap-px rounded-xl bg-white p-2">
          {cells.map((on, i) => (
            <span
              key={i}
              className={cn(
                "aspect-square rounded-[1px]",
                on ? "bg-ink" : "bg-white",
              )}
            />
          ))}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] text-ink-soft">آدرس کوتاه</p>
          <p dir="ltr" className="truncate text-[14px] font-bold text-ink">
            kioar.app/clinic
          </p>
          <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-ink px-2 py-0.5 text-[10px] font-semibold text-paper">
            <RadioTowerIcon className="size-3" /> NFC فعال
          </span>
        </div>
      </div>
      <div className="flex items-center justify-between rounded-2xl bg-paper/6 px-3 py-2 text-[10px] text-paper/70">
        <span>اسکن این هفته</span>
        <span className="font-bold text-paper">۴۸۲ بار</span>
      </div>
    </div>
  );
}

function LeadFormVisual() {
  return (
    <div className="rounded-2xl border border-hairline bg-paper-soft p-3">
      <div className="rounded-xl bg-paper p-3">
        <p className="text-[11px] font-bold text-ink">درخواست مشاوره</p>
        <div className="mt-2 space-y-1.5">
          <div className="flex h-8 items-center rounded-lg border border-hairline bg-paper-soft px-2.5 text-[10px] text-ink">
            علی رستمی
          </div>
          <div
            className="flex h-8 items-center rounded-lg border border-hairline bg-paper-soft px-2.5 text-[10px] text-ink"
            dir="ltr"
          >
            0912 345 6789
          </div>
          <div className="flex h-8 items-center rounded-lg border border-hairline bg-paper-soft px-2.5 text-[10px] text-ink-soft">
            توضیح کوتاه
          </div>
        </div>
        <div className="mt-2 flex h-9 items-center justify-center rounded-lg bg-ink text-[11px] font-bold text-paper">
          ارسال درخواست
        </div>
      </div>
      <div className="mt-2 flex items-center justify-between rounded-xl bg-paper px-3 py-2 text-[10px]">
        <span className="text-ink-soft">پاسخ‌های جدید این هفته</span>
        <span className="font-bold text-emerald-600">۱۲ مورد</span>
      </div>
    </div>
  );
}

function VCardVisual() {
  return (
    <div className="rounded-2xl border border-hairline bg-paper-soft p-3">
      <div className="rounded-xl bg-paper p-3">
        <div className="flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-full bg-violet-500 text-[15px] font-bold text-paper">
            آ
          </span>
          <div className="min-w-0">
            <p className="truncate text-[13px] font-bold text-ink">علی رستمی</p>
            <p className="truncate text-[10px] text-ink-soft">
              مدیر مارکتینگ — دیجی‌کالا
            </p>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <span className="grid size-7 place-items-center rounded-full bg-paper-soft text-ink-soft">
            <PhoneIcon className="size-3" />
          </span>
          <span className="grid size-7 place-items-center rounded-full bg-paper-soft text-ink-soft">
            <MailIcon className="size-3" />
          </span>
          <span className="grid size-7 place-items-center rounded-full bg-paper-soft text-ink-soft">
            <ContactIcon className="size-3" />
          </span>
        </div>
      </div>
      <div className="mt-2 flex h-9 w-full items-center justify-center gap-2 rounded-xl bg-ink text-[11px] font-bold text-paper">
        <ContactIcon className="size-3.5" />
        ذخیره در مخاطبین (.vcf)
      </div>
    </div>
  );
}

function SmsVisual() {
  return (
    <div className="space-y-2">
      <div className="me-auto w-fit max-w-[88%] rounded-2xl rounded-bl-md bg-paper px-3 py-2 text-[12px] text-ink shadow-sm">
        کیو‌آر — نوبتت چهارشنبه ۱۸:۳۰ ثبت شد. لغو: ۱
      </div>
      <div className="ms-auto w-fit max-w-[60%] rounded-2xl rounded-br-md bg-paper/15 px-3 py-2 text-[12px] text-paper">
        ممنون، می‌بینمت.
      </div>
      <div className="me-auto w-fit max-w-[88%] rounded-2xl rounded-bl-md bg-paper px-3 py-2 text-[12px] text-ink shadow-sm">
        یادآوری: یک ساعت تا نوبت
      </div>
      <div className="me-auto inline-flex items-center gap-1 ps-1 text-[10px] text-paper/80">
        <span className="grid size-3 place-items-center rounded-full bg-paper/30">
          <CheckIcon className="size-2" strokeWidth={4} />
        </span>
        تحویل به مخاطب
      </div>
    </div>
  );
}

function ShamsiCalendarVisual() {
  const days = Array.from({ length: 21 }, (_, i) => i + 5);
  const headers = ["ش", "ی", "د", "س", "چ", "پ", "ج"];
  return (
    <div className="rounded-2xl border border-hairline bg-paper-soft p-3">
      <div className="flex items-center justify-between rounded-xl bg-paper px-3 py-2">
        <p className="text-[11px] font-bold text-ink">آبان ۱۴۰۴</p>
        <div className="flex items-center gap-1">
          <span className="size-2 rounded-full bg-emerald-500" />
          <span className="text-[10px] text-ink-soft">شمسی، اول هفته شنبه</span>
        </div>
      </div>
      <div className="mt-2 grid grid-cols-7 gap-1">
        {headers.map((h) => (
          <span
            key={h}
            className="text-center text-[9px] font-bold text-ink-soft"
          >
            {h}
          </span>
        ))}
        {days.map((d) => {
          const active = d === 18;
          const isFriday = (d - 5) % 7 === 6;
          return (
            <span
              key={d}
              className={cn(
                "rounded-md py-1 text-center text-[10px]",
                active && "bg-ink font-bold text-paper",
                !active && isFriday && "bg-rose-50 text-rose-600",
                !active && !isFriday && "bg-paper text-ink",
              )}
            >
              {fa(d)}
            </span>
          );
        })}
      </div>
    </div>
  );
}

function ZarinpalVisual() {
  return (
    <div className="space-y-2">
      <div className="rounded-2xl bg-paper/6 p-4">
        <div className="flex items-center justify-between">
          <p className="text-[10px] text-paper/60">پرداخت با</p>
          <span className="grid size-7 place-items-center rounded-full bg-emerald-500/15 text-emerald-300">
            <CheckIcon className="size-3.5" strokeWidth={3} />
          </span>
        </div>
        <div className="mt-2 flex items-center gap-2">
          <span className="grid size-9 place-items-center rounded-xl bg-yellow-400 text-[13px] font-bold text-ink">
            ز
          </span>
          <p className="text-[16px] font-bold text-paper">زرین‌پال</p>
        </div>
        <p className="mt-1 text-[10px] text-paper/60">درگاه پرداخت ایرانی</p>
      </div>
      <div className="rounded-2xl bg-paper/6 p-3">
        <div className="flex items-baseline justify-between">
          <span className="text-[11px] text-paper/65">جمع پرداخت</span>
          <span className="text-[18px] font-bold text-paper">۲٬۴۰۰٬۰۰۰</span>
        </div>
        <p className="text-end text-[10px] text-paper/50">تومان</p>
      </div>
    </div>
  );
}

function MarketingPixelVisual() {
  const tiles = [
    { name: "Meta", initial: "f", tone: "bg-blue-600 text-white" },
    {
      name: "Google",
      initial: "G",
      tone: "bg-paper border border-hairline text-ink",
    },
    { name: "TikTok", initial: "♪", tone: "bg-ink text-paper" },
    { name: "GA4", initial: "GA", tone: "bg-amber-400 text-ink" },
  ];
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-4 gap-2">
        {tiles.map((t) => (
          <div
            key={t.name}
            className={cn(
              "flex aspect-square flex-col items-center justify-center rounded-2xl",
              t.tone,
            )}
          >
            <span className="text-[14px] font-bold leading-none">
              {t.initial}
            </span>
            <span className="mt-1 text-[9px] font-medium opacity-80">
              {t.name}
            </span>
          </div>
        ))}
      </div>
      <div className="rounded-2xl border border-hairline bg-paper-soft p-3">
        <p className="text-[10px] text-ink-soft">UTM خودکار روی هر لینک</p>
        <div
          className="mt-1.5 inline-flex flex-wrap items-center gap-1 rounded-lg bg-paper px-2 py-1.5 text-[10px]"
          dir="ltr"
        >
          <span className="text-ink-soft">?utm_source=</span>
          <span className="rounded bg-emerald-50 px-1.5 py-0.5 font-bold text-emerald-700">
            instagram
          </span>
          <span className="text-ink-soft">&utm_campaign=</span>
          <span className="rounded bg-violet-50 px-1.5 py-0.5 font-bold text-violet-700">
            paeez
          </span>
        </div>
      </div>
    </div>
  );
}

function BrandingVisual() {
  const swatches = [
    { c: "bg-violet-600", active: true },
    { c: "bg-emerald-500" },
    { c: "bg-rose-500" },
    { c: "bg-amber-500" },
    { c: "bg-ink" },
  ];
  return (
    <div className="space-y-2">
      <div className="rounded-2xl border border-hairline bg-paper-soft p-3">
        <div className="mx-auto size-10 rounded-full bg-violet-600" />
        <p
          className="mt-2 text-center text-[11px] font-bold text-ink"
          dir="ltr"
        >
          @parsa
        </p>
        <div className="mt-2 space-y-1.5">
          <div className="h-7 rounded-lg bg-violet-600" />
          <div className="h-7 rounded-lg border border-hairline bg-paper" />
          <div className="h-7 rounded-lg border border-hairline bg-paper" />
        </div>
      </div>
      <div className="flex items-center justify-between rounded-xl border border-hairline bg-paper-soft px-3 py-2">
        <div className="flex gap-1.5">
          {swatches.map((s, i) => (
            <span
              key={i}
              className={cn(
                "block size-5 rounded-full ring-2",
                s.c,
                s.active ? "ring-ink/30" : "ring-transparent",
              )}
            />
          ))}
        </div>
        <span dir="ltr" className="font-mono text-[10px] text-ink-soft">
          #7C3AED
        </span>
      </div>
    </div>
  );
}

function ScheduledLinkVisual() {
  return (
    <div className="space-y-2">
      <div className="rounded-2xl border border-hairline bg-paper-soft p-3">
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
            <span className="size-1.5 rounded-full bg-emerald-500" /> فعال
          </span>
          <span className="text-[10px] text-ink-soft">۲ آذر — ۲۳:۵۹</span>
        </div>
        <div className="mt-2 rounded-xl bg-paper p-2.5">
          <p className="text-[12px] font-bold text-ink">جشنوارهٔ پاییز</p>
          <p className="text-[10px] text-ink-soft" dir="ltr">
            kioar.app/sale
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 rounded-xl border border-hairline bg-paper px-3 py-2 text-[10px]">
        <TimerIcon className="size-3.5 text-ink" />
        <span className="text-ink-soft">پایان خودکار، بدون فراموشی</span>
      </div>
    </div>
  );
}

function ReferralVisual() {
  return (
    <div className="space-y-2">
      <div className="rounded-2xl bg-paper/6 p-3">
        <p className="text-[10px] text-paper/60">کد دعوت</p>
        <p
          className="mt-1 rounded-xl border border-dashed border-paper/30 bg-paper/4 py-2 text-center text-[20px] font-bold tracking-[0.4em] text-paper"
          dir="ltr"
        >
          ALI20
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-2xl bg-paper/6 p-3">
          <p className="text-[10px] text-paper/60">دعوت‌شده</p>
          <p className="mt-1 text-[18px] font-bold text-paper">۲۴ نفر</p>
        </div>
        <div className="rounded-2xl bg-paper/6 p-3">
          <p className="text-[10px] text-paper/60">پاداش</p>
          <p className="mt-1 text-[18px] font-bold text-paper">
            ۸۸۰ <span className="text-[11px] text-paper/60">هزار</span>
          </p>
        </div>
      </div>
    </div>
  );
}

function ConversionStatVisual() {
  return (
    <div className="space-y-2">
      <div className="rounded-2xl bg-paper/15 p-4 text-paper">
        <p className="text-[11px] text-paper/80">رشد ماهانهٔ نرخ رزرو</p>
        <p className="mt-1 text-[44px] font-bold leading-none">۳۸٪</p>
        <p className="mt-1 text-[11px] text-paper/70">میانگین در پلن حرفه‌ای</p>
      </div>
      <div className="space-y-1.5">
        {[
          { label: "بازدید", w: 100 },
          { label: "کلیک رزرو", w: 72 },
          { label: "تأیید", w: 38 },
        ].map((b) => (
          <div key={b.label} className="flex items-center gap-2">
            <span className="w-16 text-[10px] text-paper/75">{b.label}</span>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-paper/15">
              <div
                className="h-full rounded-full bg-paper"
                style={{ width: `${b.w}%` }}
              />
            </div>
            <span className="w-8 text-end text-[10px] font-bold text-paper">
              {fa(b.w)}٪
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function PwaInstallVisual() {
  const apps = [
    { c: "bg-emerald-500", l: "" },
    { c: "bg-rose-500", l: "" },
    { c: "bg-amber-400", l: "" },
    { c: "bg-paper ring-2 ring-paper", l: "ک", highlight: true },
    { c: "bg-paper/15", l: "" },
    { c: "bg-paper/15", l: "" },
    { c: "bg-paper/15", l: "" },
    { c: "bg-paper/15", l: "" },
  ];
  return (
    <div className="space-y-2">
      <div className="rounded-2xl bg-paper/8 p-4">
        <div className="grid grid-cols-4 gap-2">
          {apps.map((a, i) => (
            <div key={i} className="relative">
              <div
                className={cn(
                  "grid aspect-square place-items-center rounded-xl text-[14px] font-bold",
                  a.c,
                  a.highlight ? "text-ink" : "text-paper",
                )}
              >
                {a.l}
              </div>
              {a.highlight && (
                <p className="mt-1 text-center text-[9px] font-medium text-paper">
                  کیو‌آر
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
      <div className="rounded-xl bg-paper/6 px-3 py-2 text-center text-[11px] text-paper/85">
        روی صفحهٔ خانه نصب شد
      </div>
    </div>
  );
}

/* =================================================================
 *  Card definitions (copy follows docs/copywriting.md)
 * ================================================================= */
const CARDS: CardData[] = [
  {
    id: "bookings",
    tone: "dark",
    icon: CalendarCheckIcon,
    label: "رزرو نوبت",
    title: "نوبت بگیر، بدون پیام رد و بدل.",
    cta: "دیدن دمو",
    visual: <BookingCalendarVisual />,
  },
  {
    id: "multi_profile",
    tone: "light",
    icon: UsersIcon,
    label: "تیم و آژانس",
    title: "چند پروفایل، یک تیم.",
    cta: "داستان مشتری",
    visual: <MultiProfileVisual />,
  },
  {
    id: "analytics",
    tone: "light",
    icon: TrendingUpIcon,
    label: "آمار زنده",
    title: "بفهم مخاطب از کجا می‌رسد.",
    cta: "دیدن نمونه",
    visual: <AnalyticsVisual />,
  },
  {
    id: "qr_nfc",
    tone: "dark",
    icon: QrCodeIcon,
    label: "کارت فیزیکی",
    title: "QR و کارت NFC اختصاصی.",
    cta: "سفارش کارت",
    visual: <QrCardVisual />,
  },
  {
    id: "sms_confirmation",
    tone: "blue",
    icon: MailIcon,
    label: "پیامک فارسی",
    title: "تأیید پیامکی، خودکار.",
    visual: <SmsVisual />,
  },
  {
    id: "lead_forms",
    tone: "light",
    icon: FileTextIcon,
    label: "جذب سرنخ",
    title: "فرم بساز، پاسخ‌ها را جمع کن.",
    cta: "ساخت فرم",
    visual: <LeadFormVisual />,
  },
  {
    id: "vcard",
    tone: "light",
    icon: ContactIcon,
    label: "ارتباط ماندگار",
    title: "vCard — همیشه دستِ مخاطب.",
    cta: "نمونه پروفایل",
    visual: <VCardVisual />,
  },
  {
    id: "zarinpal",
    tone: "dark",
    icon: CreditCardIcon,
    label: "پرداخت ریالی",
    title: "تسویه با زرین‌پال، حساب ایرانی.",
    visual: <ZarinpalVisual />,
  },
  {
    id: "shamsi_calendar",
    tone: "light",
    icon: CalendarCheckIcon,
    label: "بومی‌سازی ایران",
    title: "تقویم شمسی، از پایه.",
    visual: <ShamsiCalendarVisual />,
  },
  {
    id: "marketing_pixels",
    tone: "light",
    icon: ShareIcon,
    label: "بازاریابی",
    title: "پیکسل و UTM، خودکار.",
    cta: "دیدن دمو",
    visual: <MarketingPixelVisual />,
  },
  {
    id: "branding",
    tone: "light",
    icon: PaintbrushIcon,
    label: "برندینگ",
    title: "رنگ، فونت، فاو‌آیکون — همه‌اش تو.",
    visual: <BrandingVisual />,
  },
  {
    id: "conversion",
    tone: "blue",
    icon: TrendingUpIcon,
    label: "نرخ تبدیل",
    title: "بازدیدکننده در همان صفحه اقدام می‌کند.",
    visual: <ConversionStatVisual />,
  },
  {
    id: "pwa_install",
    tone: "dark",
    icon: SmartphoneIcon,
    label: "وب‌اپ",
    title: "نصب مثل اپلیکیشن، بدون استور.",
    visual: <PwaInstallVisual />,
  },
  {
    id: "scheduled_links",
    tone: "light",
    icon: TimerIcon,
    label: "کمپین",
    title: "لینک زمان‌بندی‌شده، روشن و خاموش خودکار.",
    visual: <ScheduledLinkVisual />,
  },
  {
    id: "referral",
    tone: "dark",
    icon: SparklesIcon,
    label: "دعوت دوستان",
    title: "دعوت کن، درآمد افیلیت بگیر.",
    cta: "ورود به برنامه",
    visual: <ReferralVisual />,
  },
];
