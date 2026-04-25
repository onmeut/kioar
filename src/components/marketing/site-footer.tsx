import Link from "next/link";

import { BrandMark } from "@/components/shared/brand-mark";

const footerColumns = [
  {
    title: "محصول",
    links: [
      { href: "/#features", label: "امکانات" },
      { href: "/#flow", label: "جریان کاربر" },
      { href: "/#nfc", label: "کارت NFC" },
      { href: "/events", label: "رویدادها" },
    ],
  },
  {
    title: "راهنما",
    links: [
      { href: "/#faq", label: "پرسش‌های متداول" },
      { href: "/auth", label: "ساخت حساب" },
      { href: "/#showcase", label: "نمونه پروفایل" },
      { href: "mailto:hello@kioar.app", label: "تماس با پشتیبانی" },
    ],
  },
  {
    title: "شرکت",
    links: [
      { href: "/#hero", label: "درباره کیوآر" },
      { href: "/#solutions", label: "موارد استفاده" },
      { href: "mailto:partners@kioar.app", label: "همکاری" },
      { href: "mailto:press@kioar.app", label: "رسانه" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-black/[0.06] bg-background">
      <div className="marketing-shell py-14">
        <div className="grid gap-10 md:grid-cols-[1.2fr_2fr]">
          <div>
            <BrandMark compact href="/" className="w-fit" />
            <p className="mt-4 max-w-xs text-[13px] leading-7 text-muted-foreground">
              کیوآر — کارت ویزیت دیجیتال، QR زنده و کارت NFC فارسی برای کسانی که
              ارتباط برایشان مهم است.
            </p>
            <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-black/[0.08] bg-white/60 px-3 py-1 text-[11px] font-semibold text-emerald-700">
              <span className="size-1.5 rounded-full bg-emerald-500" />
              همه سامانه‌ها عملیاتی
            </div>
          </div>

          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
            {footerColumns.map((column) => (
              <div key={column.title}>
                <h3 className="text-[12px] font-bold text-foreground uppercase">
                  {column.title}
                </h3>
                <ul className="mt-4 space-y-3">
                  {column.links.map((link) => (
                    <li key={link.label}>
                      <Link
                        href={link.href as never}
                        className="text-[13px] text-muted-foreground transition-colors hover:text-foreground"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-12 flex flex-col gap-3 border-t border-black/[0.06] pt-6 text-[12px] text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p dir="ltr">© ۲۰۲۶ Kioar. All rights reserved.</p>
          <div className="flex items-center gap-5">
            <a
              href="mailto:hello@kioar.app"
              className="transition-colors hover:text-foreground"
              dir="ltr"
            >
              hello@kioar.app
            </a>
            <Link href="/" className="transition-colors hover:text-foreground">
              حریم خصوصی
            </Link>
            <Link href="/" className="transition-colors hover:text-foreground">
              شرایط استفاده
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
