import { ArrowLeftIcon } from "lucide-react";

export function CustomerStory() {
  return (
    <section className="bg-paper py-10 sm:py-14">
      <div className="marketing-shell">
        <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
          {/* big stat card */}
          <div className="relative flex flex-col justify-between overflow-hidden rounded-3xl border border-hairline bg-paper-soft p-7 transition-all duration-300 hover:shadow-[0_24px_60px_-24px_rgba(15,23,42,0.18)] sm:min-h-65">
            <div className="relative">
              <p className="text-[64px] font-semibold leading-none tracking-tight text-ink">
                ۳×
              </p>
              <p className="mt-2 flex items-center gap-1 text-[13px] font-semibold text-ink-soft">
                <ArrowLeftIcon className="size-3 -rotate-45" />
                رشد درآمد
              </p>
            </div>
          </div>

          {/* quote card */}
          <div className="flex flex-col rounded-3xl border border-hairline bg-paper-soft p-7 transition-all duration-300 hover:shadow-[0_24px_60px_-24px_rgba(15,23,42,0.18)] sm:p-9">
            <div className="flex items-center gap-2 text-[12px] font-semibold text-ink">
              <span className="grid size-7 place-items-center rounded-md bg-paper">
                <svg
                  viewBox="0 0 24 24"
                  className="size-4 text-ink"
                  aria-hidden
                >
                  <path
                    fill="currentColor"
                    d="M3 21V13l4-9h3l-3 9h3v8H3zm11 0V13l4-9h3l-3 9h3v8h-7z"
                  />
                </svg>
              </span>
              کِی‌مارک — برند مد
            </div>

            <p className="mt-4 text-[18px] leading-[1.55] font-medium text-ink">
              «از روزی که QR کی‌یو‌آر را روی برچسب لباس‌هایمان چاپ کردیم،
              اینستای ما از ۴۰ هزار به ۱۲۰ هزار دنبال‌کننده رسید — تنها در شش
              ماه.»
            </p>

            <div className="mt-auto pt-6 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="grid size-9 place-items-center rounded-full bg-rose-400 text-[12px] font-bold text-paper">
                  ت
                </span>
                <div>
                  <p className="text-[13px] font-semibold text-ink">
                    تینا کیانی
                  </p>
                  <p className="text-[11px] text-ink-soft">
                    بنیان‌گذار کِی‌مارک
                  </p>
                </div>
              </div>
              <a
                href="#"
                className="group/quote inline-flex items-center gap-1.5 text-[12px] font-semibold text-ink hover:opacity-70"
              >
                داستان مشتری
                <ArrowLeftIcon className="size-3.5 transition-transform group-hover/quote:-translate-x-0.5" />
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
