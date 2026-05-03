import {
  CalendarCheckIcon,
  CheckIcon,
  ContactIcon,
  FileTextIcon,
  MailIcon,
  PhoneIcon,
  TrendingUpIcon,
  UserIcon,
  UsersIcon,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";

import { SectionHead } from "./horizontal-cards";

/**
 * Outcome grid — three small cards on top, two wide cards below.
 * Mirrors the Beside-style layout: bold title, eyebrow + icon, short
 * supporting body, sophisticated visual anchored at the bottom.
 *
 * Hard rule: NO gradients anywhere. Solid colors only.
 * Copy follows docs/copywriting.md.
 */
export function FeatureGrid() {
  return (
    <section
      id="features"
      aria-labelledby="features-heading"
      className="bg-paper py-16 sm:py-24"
    >
      <div className="marketing-shell">
        <SectionHead
          title="نتیجه‌ای که روی کسب‌وکارت تأثیر می‌گذارد."
          body="بلاک‌های هدف‌دار کیوآر هر بازدیدکننده را به قدم بعدی می‌رسانند: ذخیرهٔ مخاطب، گرفتن نوبت، پر کردن فرم. نتیجه قابل اندازه‌گیری است."
        />

        {/* Top row — 3 outcome cards */}
        <div className="mt-12 grid gap-4 md:grid-cols-3">
          <OutcomeCard
            icon={TrendingUpIcon}
            label="رشد فروش"
            title="بازدید بیشتری به مشتری تبدیل کن."
            body="بلاک‌های CTA و فرم درست بالای پروفایل می‌نشینند، با آمار زنده می‌فهمی کدام بهتر کار می‌کند."
            visual={<RevenueChartVisual />}
          />
          <OutcomeCard
            icon={CalendarCheckIcon}
            label="رزرو خودکار"
            title="نوبت ثبت کن، بدون پیام رد و بدل."
            body="مشتری در پروفایل ساعت آزاد را می‌بیند، رزرو می‌کند، تأیید پیامکی می‌گیرد و در تقویمت می‌نشیند."
            visual={<BookingStepperVisual />}
          />
          <OutcomeCard
            icon={UsersIcon}
            label="ارتباط ماندگار"
            title="مخاطبت همیشه دستش است."
            body="با یک کارت NFC یا QR، اطلاعات تماست — تماس، فرم، شبکهٔ اجتماعی — در گوشی مخاطب ذخیره می‌شود."
            visual={<ContactCardVisual />}
          />
        </div>

        {/* Bottom row — 2 wide cards */}
        <div className="mt-4 grid gap-4 lg:grid-cols-[1.05fr_1fr]">
          <PowerfulResponderCard />
          <OperateLinesCard />
        </div>
      </div>
    </section>
  );
}

/* =================================================================
 *  Card primitive
 * ================================================================= */
function OutcomeCard({
  icon: Icon,
  label,
  title,
  body,
  visual,
}: {
  icon: LucideIcon;
  label: string;
  title: string;
  body: string;
  visual: React.ReactNode;
}) {
  return (
    <div className="group/feature flex flex-col rounded-3xl border border-hairline bg-paper p-6 transition-all duration-300 hover:-translate-y-1 hover:border-ink/15 hover:shadow-[0_24px_60px_-24px_rgba(15,23,42,0.18)] sm:min-h-120">
      <div className="flex items-center gap-2 text-[12px] font-semibold text-ink">
        <Icon className="size-4" />
        {label}
      </div>
      <h3 className="mt-4 text-[22px] leading-tight font-semibold tracking-[-0.01em] text-ink">
        {title}
      </h3>
      <p className="mt-2 text-[13px] leading-relaxed text-ink-soft">{body}</p>
      <div className="mt-auto pt-6">{visual}</div>
    </div>
  );
}

/* =================================================================
 *  Visuals
 * ================================================================= */

/* ── Revenue chart with floating tooltip (à la Beside) ───────────── */
function RevenueChartVisual() {
  return (
    <div className="relative rounded-2xl border border-hairline bg-paper-soft p-3">
      <div className="flex items-center justify-between text-[10px]">
        <span className="text-ink-soft">۳۰ روز گذشته</span>
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
          <line x1="0" y1="80" x2="240" y2="80" stroke="rgba(15,23,42,0.06)" />
          <line x1="0" y1="50" x2="240" y2="50" stroke="rgba(15,23,42,0.06)" />
          <line x1="0" y1="20" x2="240" y2="20" stroke="rgba(15,23,42,0.06)" />
          <path
            d="M0 78 L24 70 L48 64 L72 56 L96 60 L120 48 L144 36 L168 28 L192 22 L216 14 L240 6 L240 100 L0 100 Z"
            fill="rgba(124,58,237,0.10)"
          />
          <path
            d="M0 78 L24 70 L48 64 L72 56 L96 60 L120 48 L144 36 L168 28 L192 22 L216 14 L240 6"
            stroke="currentColor"
            className="text-violet-600"
            strokeWidth="2.5"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle
            cx="168"
            cy="28"
            r="4"
            className="fill-paper stroke-violet-600"
            strokeWidth="2.5"
          />
        </svg>
        <div
          dir="rtl"
          className="absolute right-[18%] top-1 inline-flex items-center gap-2 rounded-full border border-hairline bg-paper px-2.5 py-1 shadow-[0_4px_12px_rgba(15,23,42,0.10)]"
        >
          <span className="grid size-4 place-items-center rounded-full bg-violet-600 text-[8px] font-bold text-white">
            ک
          </span>
          <span className="text-[10px] font-semibold text-ink">+۲۸٪ تبدیل</span>
        </div>
      </div>
      <div className="mt-2 flex items-center justify-between text-[10px] text-ink-soft">
        <span>هفتهٔ ۱</span>
        <span>هفتهٔ ۲</span>
        <span>هفتهٔ ۳</span>
        <span>هفتهٔ ۴</span>
      </div>
    </div>
  );
}

/* ── Booking stepper: AI handling → Job booked ──────────────────── */
function BookingStepperVisual() {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3 rounded-2xl border border-hairline bg-paper-soft px-3 py-2.5">
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-paper text-ink">
          <CalendarCheckIcon className="size-3.5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold text-ink">انتخاب ساعت آزاد</p>
          <p className="text-[10px] text-ink-soft">۱۸:۳۰ — چهارشنبه</p>
        </div>
        <span className="grid size-5 place-items-center rounded-full bg-paper text-[9px] text-ink-soft">
          ۱
        </span>
      </div>
      <div className="flex items-center gap-3 rounded-2xl bg-violet-600 px-3 py-2.5 shadow-[0_8px_24px_-12px_rgba(124,58,237,0.6)]">
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-white/20 text-white">
          <CheckIcon className="size-4" strokeWidth={3} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold text-white">نوبت ثبت شد</p>
          <p className="text-[10px] text-white/80">
            ICS به Google Calendar اضافه شد
          </p>
        </div>
        <span className="grid size-5 place-items-center rounded-full bg-white/20 text-[9px] font-bold text-white">
          ۲
        </span>
      </div>
      <div className="flex items-center gap-3 rounded-2xl border border-hairline bg-paper-soft px-3 py-2.5">
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-paper text-ink">
          <MailIcon className="size-3.5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold text-ink">پیامک تأیید رفت</p>
          <p className="text-[10px] text-ink-soft">
            {"<"} ۹۰ ثانیه — کاوه‌نگار
          </p>
        </div>
        <span className="grid size-5 place-items-center rounded-full bg-paper text-[9px] text-ink-soft">
          ۳
        </span>
      </div>
    </div>
  );
}

/* ── Contact card: avatar + Call/Text/Form actions ──────────────── */
function ContactCardVisual() {
  return (
    <div className="rounded-2xl border border-hairline bg-paper-soft p-4">
      <div className="mx-auto grid size-20 place-items-center rounded-full bg-violet-600 text-[28px] font-bold text-white">
        آ
      </div>
      <p className="mt-3 text-center text-[13px] font-bold text-ink">
        علی رستمی
      </p>
      <p className="mt-0.5 text-center text-[10px] text-ink-soft">
        مدیر مارکتینگ
      </p>
      <div className="mt-3 flex items-center justify-center gap-2">
        <ActionButton icon={PhoneIcon} label="تماس" />
        <ActionButton icon={MailIcon} label="پیام" />
        <ActionButton icon={FileTextIcon} label="فرم" />
      </div>
    </div>
  );
}
function ActionButton({
  icon: Icon,
  label,
}: {
  icon: LucideIcon;
  label: string;
}) {
  return (
    <div className="flex flex-1 flex-col items-center gap-1 rounded-xl bg-paper py-2">
      <span className="grid size-7 place-items-center rounded-full bg-paper-soft text-ink">
        <Icon className="size-3.5" />
      </span>
      <span className="text-[10px] font-bold text-ink">{label}</span>
    </div>
  );
}

/* =================================================================
 *  Wide card 1 — bullets + huge stat
 * ================================================================= */
function PowerfulResponderCard() {
  const bullets = [
    "تأیید پیامکی فارسی روی هر رزرو، با لینک لغو خودکار.",
    "ICS به Google Calendar / Outlook، بدون کانفیگ دستی.",
    "حذف هماهنگی در دایرکت و واتساپ — همه چیز روی پروفایل.",
  ];
  return (
    <div className="flex flex-col rounded-3xl border border-hairline bg-paper p-6 transition-shadow duration-300 hover:shadow-[0_24px_60px_-24px_rgba(15,23,42,0.18)] sm:p-8">
      <div className="flex items-center gap-2 text-[12px] font-semibold text-ink">
        <CheckIcon className="size-4" />
        پاسخ‌گوی قدرتمند
      </div>
      <h3 className="mt-4 text-[22px] leading-tight font-semibold tracking-[-0.01em] text-ink">
        رزرو، تأیید و یادآوری — همه‌اش خودکار.
      </h3>
      <p className="mt-2 text-[13px] leading-relaxed text-ink-soft">
        ساعات کاری را تعیین می‌کنی، بقیه‌اش با کیوآر است.
      </p>

      <ul className="mt-5 space-y-2">
        {bullets.map((b) => (
          <li
            key={b}
            className="flex items-start gap-2 rounded-xl border border-hairline bg-paper-soft px-3 py-2.5"
          >
            <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-ink text-paper">
              <CheckIcon className="size-3" strokeWidth={3} />
            </span>
            <span className="text-[12px] leading-relaxed text-ink">{b}</span>
          </li>
        ))}
      </ul>

      <div className="mt-auto pt-8">
        <div className="rounded-2xl bg-violet-600 p-5 text-paper">
          <p className="text-[11px] text-paper/80">میانگین نرخ تبدیل</p>
          <p className="mt-1 text-[56px] font-bold leading-none tracking-tight">
            ۳۸٪
          </p>
          <p className="mt-2 text-[11px] text-paper/75">
            بازدیدکنندهٔ پروفایل که در همان جلسه فرم پر کرد یا نوبت گرفت.
          </p>
        </div>
      </div>
    </div>
  );
}

/* =================================================================
 *  Wide card 2 — phone-line list with avatar stack
 * ================================================================= */
function OperateLinesCard() {
  const lines: { name: string; sub: string; tone: string; initial: string }[] =
    [
      {
        name: "کلینیک پوست رهام",
        sub: "rooyesh.kioar.app",
        tone: "bg-violet-500",
        initial: "ر",
      },
      {
        name: "آرایشگاه پارسا",
        sub: "parsa.kioar.app",
        tone: "bg-emerald-500",
        initial: "پ",
      },
      {
        name: "استودیو نوا",
        sub: "nova.kioar.app",
        tone: "bg-rose-500",
        initial: "ن",
      },
      {
        name: "آژانس مارکتینگ آرشام",
        sub: "arsham.kioar.app",
        tone: "bg-amber-500",
        initial: "آ",
      },
    ];

  return (
    <div className="relative flex flex-col rounded-3xl border border-ink/10 bg-ink p-6 transition-shadow duration-300 hover:shadow-[0_24px_60px_-24px_rgba(0,0,0,0.45)] sm:p-8">
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-paper/20"
      />
      <div className="flex items-center gap-2 text-[12px] font-semibold text-paper">
        <UsersIcon className="size-4" />
        تیم و آژانس
      </div>
      <h3 className="mt-4 text-[22px] leading-tight font-semibold tracking-[-0.01em] text-paper">
        چند پروفایل، یک تیم.
      </h3>
      <p className="mt-2 text-[13px] leading-relaxed text-paper/65">
        هر برند، شعبه یا کارمند یک پروفایل مستقل، با دسترسی متمرکز.
      </p>

      <ul className="mt-5 space-y-1.5">
        {lines.map((l) => (
          <li
            key={l.name}
            className="flex items-center gap-3 rounded-xl bg-paper/5 px-3 py-2.5"
          >
            <span
              className={cn(
                "grid size-9 shrink-0 place-items-center rounded-full text-[13px] font-bold text-paper",
                l.tone,
              )}
            >
              {l.initial}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[12px] font-bold text-paper">
                {l.name}
              </p>
              <p className="truncate text-[10px] text-paper/55" dir="ltr">
                {l.sub}
              </p>
            </div>
            <div className="flex -space-x-1.5 -space-x-reverse">
              <span className="grid size-6 place-items-center rounded-full border-2 border-ink bg-amber-300 text-[9px] font-bold text-ink">
                ا
              </span>
              <span className="grid size-6 place-items-center rounded-full border-2 border-ink bg-stone-300 text-[9px] font-bold text-ink">
                س
              </span>
              <span className="grid size-6 place-items-center rounded-full border-2 border-ink bg-paper/15 text-[9px] font-bold text-paper">
                ۲
              </span>
            </div>
          </li>
        ))}
      </ul>

      <div className="mt-5 flex items-center justify-between rounded-xl bg-paper/5 px-3 py-2.5">
        <div className="flex items-center gap-2">
          <span className="grid size-7 place-items-center rounded-full bg-paper/10 text-paper">
            <ContactIcon className="size-3.5" />
          </span>
          <span className="text-[11px] text-paper/75">
            دسترسی مرکزی، صورتحساب واحد
          </span>
        </div>
        <span className="grid size-7 place-items-center rounded-full bg-paper text-ink">
          <UserIcon className="size-3.5" />
        </span>
      </div>
    </div>
  );
}
