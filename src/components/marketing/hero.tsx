import Link from "next/link";
import { ArrowLeftIcon, PlayIcon, SparklesIcon, StarIcon } from "lucide-react";

import { ClaimUsernameForm } from "./claim-username-form";
import { ProfileMock } from "./profile-mock";

export function Hero() {
  return (
    <section id="hero" className="relative overflow-hidden bg-paper">
      <div className="marketing-shell relative pt-10 pb-14 sm:pt-14">
        {/* two-column layout */}
        <div className="grid items-center gap-10 lg:grid-cols-[1fr_460px] lg:gap-14">
          {/* LEFT */}
          <div>
            {/* what's new pill */}
            <Link
              href="/blog"
              className="inline-flex items-center gap-2 rounded-full border border-hairline bg-paper py-1.5 ps-1.5 pe-4 text-[12px] font-medium text-ink shadow-[0_1px_4px_rgba(0,0,0,0.06)] transition-all hover:shadow-[0_2px_8px_rgba(0,0,0,0.10)] hover:bg-paper-soft"
            >
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500 px-2.5 py-1 text-[10px] font-bold text-white">
                <SparklesIcon className="size-3" />
                جدید
              </span>
              <span className="text-ink">کارت NFC نسل جدید عرضه شد</span>
              <ArrowLeftIcon className="size-3.5 text-ink-mute" />
            </Link>

            <h1 className="mt-5 text-7xl leading-[1.1] font-bold tracking-tight text-ink">
              کی‌یو‌آر، هویت دیجیتالِ تو.
            </h1>

            {/* claim username form — replaces the old CTA buttons */}
            <ClaimUsernameForm />

            <p className="mt-5 inline-flex items-center gap-2 text-[13px] text-ink-soft">
              <span className="relative flex size-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
              </span>
              قابل‌ نصب بعنوان وب‌اپلیکیشن
            </p>

            {/* divider — full-width dotted rule */}
            <div className="mt-10 h-0 w-full border-t-2 border-dotted border-hairline/70" />

            {/* trust line */}
            <div className="mt-5 flex flex-col gap-2 text-[13px]">
              <p className="font-semibold text-ink">
                ساخته‌شده برای کسب‌وکار واقعی. اعتماد ۲۰۰هزار+ ایرانی.
              </p>
              <span className="flex items-center gap-1.5">
                <StarIcon className="size-3.5 fill-amber-400 text-amber-400" />
                <span className="font-semibold text-ink">۴٫۸</span>
                <span className="mx-0.5 text-hairline select-none">|</span>
                <span className="text-ink-mute">۷٬۴۰۰ نظر</span>
              </span>
            </div>
          </div>

          {/* RIGHT: phone in a frame */}
          <div className="relative">
            {/* intentional animated bg — requested by designer */}
            <div className="hero-mockup-bg rounded-[36px] border border-hairline/60 p-6 shadow-[0_30px_80px_-30px_rgba(15,23,42,0.18)] sm:p-7">
              <div className="flex justify-center">
                <ProfileMock />
              </div>

              {/* watch demo footer */}
              <div className="mt-5 flex items-center justify-between text-[13px] text-ink">
                <button
                  type="button"
                  className="group flex items-center gap-2 font-medium transition-opacity hover:opacity-80"
                >
                  <span className="grid size-7 place-items-center rounded-full bg-ink text-paper transition-transform group-hover:scale-105">
                    <PlayIcon className="size-3 fill-paper" />
                  </span>
                  تماشای دمو
                </button>
                <span className="rounded-full bg-paper/80 px-2 py-0.5 text-[11px] font-semibold text-ink-soft">
                  ۱:۲۴
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
