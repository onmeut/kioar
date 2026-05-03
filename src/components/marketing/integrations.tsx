import { ArrowLeftIcon } from "lucide-react";

import { cn } from "@/lib/utils";

type Tool = {
  name: string;
  domain: string;
  description: string;
  /** Tailwind classes describing the colored logo tile */
  logo: { bg: string; mark: React.ReactNode };
};

const tools: Tool[] = [
  {
    name: "Google Calendar",
    domain: "calendar.google.com",
    description: "همه‌ی نوبت‌های کی‌یو‌آر مستقیم در تقویم گوگل تو ثبت می‌شوند.",
    logo: {
      bg: "bg-white border border-hairline",
      mark: (
        <span className="grid size-full place-items-center text-[18px] font-bold text-blue-500">
          ۳۱
        </span>
      ),
    },
  },
  {
    name: "Zoom",
    domain: "zoom.us",
    description:
      "هر رزرو نوبت یک لینک Zoom اختصاصی تولید می‌کند — بدون کپی‌پیست.",
    logo: {
      bg: "bg-blue-500",
      mark: (
        <span className="grid size-full place-items-center text-[14px] font-bold text-paper">
          Z
        </span>
      ),
    },
  },
  {
    name: "اسکای‌روم",
    domain: "skyroom.online",
    description: "برای جلسه‌های فارسی، اسکای‌روم را به‌جای Zoom انتخاب کن.",
    logo: {
      bg: "bg-emerald-500",
      mark: (
        <svg viewBox="0 0 24 24" className="size-5 text-paper" aria-hidden>
          <path
            fill="currentColor"
            d="M12 2L2 7v10l10 5 10-5V7L12 2zm0 2.2L19.5 8 12 11.8 4.5 8 12 4.2zM4 9.5l7 3.5v7L4 16.5v-7zm9 10.5v-7l7-3.5v7L13 20z"
          />
        </svg>
      ),
    },
  },
];

export function Integrations() {
  return (
    <section className="bg-paper py-16 sm:py-24">
      <div className="marketing-shell">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-[clamp(24px,3.6vw,36px)] leading-[1.1] font-semibold tracking-[-0.02em] text-ink">
            با ابزارهای تو یکپارچه می‌شود
          </h2>
          <a
            href="#"
            className="group/all inline-flex items-center gap-1.5 text-[13px] font-semibold text-ink hover:opacity-70"
          >
            همه‌ی یکپارچه‌سازی‌ها
            <ArrowLeftIcon className="size-3.5 transition-transform group-hover/all:-translate-x-0.5" />
          </a>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {tools.map((t) => (
            <div
              key={t.name}
              className="group/int relative flex flex-col rounded-3xl border border-hairline bg-paper-soft p-6 transition-all duration-300 hover:-translate-y-1 hover:border-ink/15 hover:shadow-[0_24px_60px_-24px_rgba(15,23,42,0.18)]"
            >
              <div className="flex items-center gap-3">
                <span
                  className={cn(
                    "grid size-10 shrink-0 place-items-center overflow-hidden rounded-xl",
                    t.logo.bg,
                  )}
                >
                  {t.logo.mark}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-semibold text-ink">
                    {t.name}
                  </p>
                  <p className="truncate text-[11px] text-ink-soft" dir="ltr">
                    {t.domain}
                  </p>
                </div>
                <ArrowLeftIcon className="size-4 text-ink-soft opacity-0 transition-all duration-300 group-hover/int:-translate-x-1 group-hover/int:opacity-100" />
              </div>
              <p className="mt-4 text-[13px] leading-[1.7] text-ink-soft">
                {t.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
