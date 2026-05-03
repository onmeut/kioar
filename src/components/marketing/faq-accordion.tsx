"use client";

import { useState } from "react";
import { PlusIcon } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

import { cn } from "@/lib/utils";

export type FaqItem = { q: string; a: string };

const defaultItems: FaqItem[] = [
  {
    q: "کی‌یو‌آر واقعاً رایگان است یا فقط شروع رایگان؟",
    a: "پلن رایگان کی‌یو‌آر بدون محدودیت زمانی است — می‌توانی برای همیشه با همان پلن کار کنی. پلن حرفه‌ای برای کسانی است که به رزرو نوبت، دامنه‌ی اختصاصی، و کارت NFC هدیه نیاز دارند.",
  },
  {
    q: "آیا کاربری که QR را اسکن می‌کند به اپ نیاز دارد؟",
    a: "خیر. پروفایل کی‌یو‌آر یک صفحه‌ی وب سبک است که در هر مرورگر و هر گوشی — حتی گوشی‌های قدیمی — باز می‌شود. هیچ نصبی لازم نیست.",
  },
  {
    q: "اگر آدرس پروفایلم را عوض کنم، QR قبلی بی‌اعتبار می‌شود؟",
    a: "هرگز. هر کاربر یک شناسه‌ی همیشگی روی کارت NFC و QR چاپ‌شده دارد (kioar.app/u/...) — این شناسه ثابت است و حتی اگر slug را عوض کنی، کارت‌ها همچنان به پروفایل تو می‌رسانند.",
  },
  {
    q: "کارت NFC چقدر طول می‌کشد تا برسد؟",
    a: "بعد از تأیید سفارش و واریز، کارت طی ۳ تا ۷ روز کاری به آدرس‌ت می‌رسد. ارسال به همه‌ی شهرهای ایران با پست پیشتاز انجام می‌شود.",
  },
  {
    q: "آیا اطلاعات مشتری‌هایم در کی‌یو‌آر امن است؟",
    a: "توکن‌های Google و Zoom با AES-256-GCM رمزنگاری شده‌اند. اطلاعات بیمار و رزرو نوبت روی سرورهای داخل کشور نگهداری می‌شوند و دسترسی فقط برای خودت و اعضای تیمت ممکن است.",
  },
  {
    q: "می‌توانم کی‌یو‌آر را برای تیم یا برند خودم استفاده کنم؟",
    a: "بله. در پلن حرفه‌ای می‌توانی دامنه‌ی اختصاصی متصل کنی، برند کی‌یو‌آر را از پروفایل برداری، و چندین پروفایل را زیر یک حساب مدیریت کنی — مناسب کسب‌وکارها، آژانس‌ها و کلینیک‌ها.",
  },
];

export function FaqAccordion({ items }: { items?: FaqItem[] } = {}) {
  const data = items ?? defaultItems;
  const [open, setOpen] = useState<number | null>(0);

  return (
    <ul className="divide-y divide-ink/10 border-y border-ink/10">
      {data.map((item, i) => {
        const isOpen = open === i;
        return (
          <li key={i}>
            <button
              type="button"
              onClick={() => setOpen(isOpen ? null : i)}
              className="flex w-full items-center justify-between gap-6 py-5 text-start tap-target transition-opacity hover:opacity-70"
              aria-expanded={isOpen}
            >
              <span className="text-[15px] font-extrabold text-ink sm:text-[17px]">
                {item.q}
              </span>
              <span
                className={cn(
                  "grid size-9 shrink-0 place-items-center rounded-full border border-ink/15 bg-paper-soft transition-transform duration-300",
                  isOpen && "rotate-45 bg-ink text-paper",
                )}
              >
                <PlusIcon className="size-4" />
              </span>
            </button>
            <AnimatePresence initial={false}>
              {isOpen ? (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.25, ease: [0.2, 0.65, 0.3, 1] }}
                  className="overflow-hidden"
                >
                  <p className="max-w-2xl pb-6 text-[14px] leading-[1.95] text-ink-soft text-pretty">
                    {item.a}
                  </p>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </li>
        );
      })}
    </ul>
  );
}
