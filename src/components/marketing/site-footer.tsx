import Link from "next/link";

import { BrandMark } from "@/components/shared/brand-mark";
import { TrustBadgesModal } from "@/components/marketing/trust-badges-modal";

const footerColumns = [
  {
    title: "محصول",
    links: [
      { href: "/#features", label: "امکانات" },
      { href: "/#customers", label: "مشتری‌ها" },
      { href: "/#pricing", label: "قیمت‌گذاری" },
      { href: "/download", label: "دانلود" },
      { href: "/changelog", label: "تغییرات" },
    ],
  },
  {
    title: "شرکت",
    links: [
      { href: "/about", label: "درباره ما" },
      { href: "/blog", label: "بلاگ" },
      { href: "/contact", label: "تماس" },
      { href: "mailto:careers@kioar.app", label: "فرصت شغلی" },
    ],
  },
  {
    title: "منابع",
    links: [
      { href: "/help", label: "راهنما" },
      { href: "/api", label: "مستندات API" },
      { href: "mailto:partners@kioar.app", label: "همکاری" },
      { href: "/status", label: "وضعیت سرویس" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="bg-paper">
      <div className="marketing-shell border-t border-hairline py-14">
        <div className="grid gap-10 md:grid-cols-[1.4fr_2.6fr]">
          <div>
            <BrandMark compact href="/" className="w-fit" />
            <p className="mt-4 max-w-xs text-[13px] leading-7 text-ink-soft">
              کارت ویزیت دیجیتال، QR زنده و کارت NFC فارسی برای کسانی که ارتباط
              برایشان مهم است.
            </p>
            <div className="flex justify-end">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <a
                referrerPolicy="origin"
                target="_blank"
                href="https://trustseal.enamad.ir/?id=724719&Code=XXjmUO742uWN3DdXHYA0akCPqwErlcEm"
              >
                <img
                  referrerPolicy="origin"
                  src="https://trustseal.enamad.ir/logo.aspx?id=724719&Code=XXjmUO742uWN3DdXHYA0akCPqwErlcEm"
                  alt=""
                  style={{ cursor: "pointer" }}
                  {...({ code: "XXjmUO742uWN3DdXHYA0akCPqwErlcEm" } as Record<
                    string,
                    unknown
                  >)}
                />
              </a>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
            {footerColumns.map((column) => (
              <div key={column.title}>
                <h3 className="text-[12px] font-semibold text-ink">
                  {column.title}
                </h3>
                <ul className="mt-4 space-y-3">
                  {column.links.map((link) => (
                    <li key={link.label}>
                      <Link
                        href={link.href as never}
                        className="text-[13px] text-ink-soft transition-colors hover:text-ink"
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

        <div className="mt-12 flex flex-col gap-4 border-t border-hairline pt-6 text-[12px] text-ink-soft">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p dir="ltr">© ۲۰۲۶ Kioar. All rights reserved.</p>
            <div className="flex items-center gap-5">
              <a
                href="mailto:hello@kioar.app"
                className="transition-colors hover:text-ink"
                dir="ltr"
              >
                hello@kioar.app
              </a>
              <Link
                href="/privacy"
                className="transition-colors hover:text-ink"
              >
                حریم خصوصی
              </Link>
              <Link href="/terms" className="transition-colors hover:text-ink">
                شرایط استفاده
              </Link>
              <TrustBadgesModal />
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
