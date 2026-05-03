import Link from "next/link";
import { ArrowLeftIcon, CheckIcon } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { ProfileMock } from "./profile-mock";

const bullets = [
  "ساخت پروفایل در کمتر از ۲ دقیقه",
  "بدون نیاز به کارت اعتباری",
  "QR زنده و دانلود vCard",
  "آپدیت لحظه‌ای روی کارت NFC",
];

export function FinalCta() {
  return (
    <section className="relative overflow-hidden bg-paper py-16 sm:py-24">
      <div className="marketing-shell relative">
        <div className="grid items-center gap-10 lg:grid-cols-[1fr_360px] lg:gap-14">
          {/* LEFT */}
          <div>
            <h2 className="text-[clamp(28px,4.5vw,48px)] leading-[1.1] font-semibold tracking-[-0.02em] text-ink">
              کی‌یو‌آر را رایگان امتحان کن
            </h2>
            <p className="mt-4 max-w-md text-[15px] leading-[1.7] text-ink-soft">
              یک نشانی کوتاه برای تمام راه‌هایی که مردم به تو می‌رسند. در دو
              دقیقه پروفایل، QR و کارت دیجیتالت آماده است.
            </p>

            <div className="mt-7 flex flex-wrap items-center gap-2.5">
              <Link
                href="/auth"
                className={cn(
                  buttonVariants({ size: "lg" }),
                  "group h-11 rounded-full bg-ink px-6 text-[14px] font-medium text-paper shadow-[0_8px_24px_-12px_rgba(0,0,0,0.45)] transition-all hover:bg-ink/90 hover:shadow-[0_14px_30px_-12px_rgba(0,0,0,0.5)] active:translate-y-px",
                )}
              >
                رایگان امتحان کن
                <ArrowLeftIcon className="ms-1 size-3.5 transition-transform group-hover:-translate-x-0.5" />
              </Link>
              <Link
                href="/contact"
                className={cn(
                  buttonVariants({ variant: "ghost", size: "lg" }),
                  "h-11 rounded-full border border-hairline bg-paper px-6 text-[14px] font-medium text-ink transition-colors hover:bg-paper-soft",
                )}
              >
                تماس با فروش
              </Link>
            </div>

            <ul className="mt-7 grid gap-2.5 sm:grid-cols-2">
              {bullets.map((b) => (
                <li
                  key={b}
                  className="flex items-start gap-2 text-[13px] text-ink"
                >
                  <span className="mt-0.5 grid size-4 shrink-0 place-items-center rounded-full bg-emerald-500 text-paper">
                    <CheckIcon className="size-2.5" strokeWidth={3} />
                  </span>
                  {b}
                </li>
              ))}
            </ul>
          </div>

          {/* RIGHT */}
          <div className="relative">
            <div className="rounded-3xl border border-hairline bg-paper-soft p-6 shadow-[0_30px_80px_-30px_rgba(15,23,42,0.25)]">
              <div className="flex justify-center">
                <ProfileMock className="scale-90 origin-top" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
