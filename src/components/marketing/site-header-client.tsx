"use client";

import { useEffect, useState } from "react";
import type { Route } from "next";
import Link from "next/link";
import { MenuIcon, XIcon } from "lucide-react";

import { BrandMark } from "@/components/shared/brand-mark";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const navigation = [
  { href: "/#pricing", label: "قیمت" },
  { href: "/blog", label: "بلاگ" },
  { href: "/download", label: "دانلود" },
  { href: "/#customers", label: "مشتری‌ها" },
  { href: "/contact", label: "تماس" },
];

type Props = {
  isAuthed: boolean;
  isComplete: boolean;
  displayInitial: string;
  dashboardHref: Route;
};

export function SiteHeaderClient({
  isAuthed,
  isComplete,
  displayInitial,
  dashboardHref,
}: Props) {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const closeMobile = () => setMobileOpen(false);

  return (
    <>
      <header
        className={cn(
          "sticky top-0 z-40 bg-paper/85 backdrop-blur-xl backdrop-saturate-150 supports-backdrop-filter:bg-paper/70 transition-[border-color] duration-300",
          scrolled
            ? "border-b border-hairline/60"
            : "border-b border-transparent",
        )}
      >
        <div className="marketing-shell flex h-16 items-center justify-between gap-4">
          <div className="flex items-center gap-10">
            <BrandMark compact href="/" />
            <nav className="hidden items-center gap-7 text-[14px] text-ink/80 md:flex">
              {navigation.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  className="transition-colors hover:text-ink"
                >
                  {item.label}
                </a>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-2">
            {isAuthed ? (
              <Link
                href={dashboardHref}
                className={cn(
                  buttonVariants({ size: "sm" }),
                  "h-9 gap-2 rounded-full bg-ink px-3 text-[13px] font-medium text-paper hover:bg-ink/90",
                )}
              >
                <span className="grid size-6 place-items-center rounded-full bg-paper/15 text-[11px] font-bold text-paper">
                  {displayInitial}
                </span>
                <span>{isComplete ? "داشبورد" : "ادامه ثبت‌نام"}</span>
              </Link>
            ) : (
              <>
                <Link
                  href="/auth"
                  className={cn(
                    buttonVariants({ variant: "secondary", size: "sm" }),
                    // Visible on every viewport — login is a primary action
                    // on mobile too.
                    "h-9 rounded-full px-3 text-[13px] font-medium sm:px-4",
                  )}
                >
                  ورود
                </Link>
                <Link
                  href="/start"
                  className={cn(
                    buttonVariants({ size: "sm" }),
                    "h-9 rounded-full bg-ink px-3 text-[13px] font-medium text-paper hover:bg-ink/90 sm:px-4",
                  )}
                >
                  شروع رایگان
                </Link>
              </>
            )}

            {/* mobile hamburger */}
            <button
              type="button"
              onClick={() => setMobileOpen((v) => !v)}
              className="grid size-9 place-items-center rounded-full text-ink transition-colors hover:bg-paper-soft md:hidden"
              aria-label={mobileOpen ? "بستن منو" : "باز کردن منو"}
              aria-expanded={mobileOpen}
            >
              {mobileOpen ? (
                <XIcon className="size-4" />
              ) : (
                <MenuIcon className="size-4" />
              )}
            </button>
          </div>
        </div>
      </header>

      {/* mobile menu backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-38 md:hidden"
          aria-hidden
          onClick={closeMobile}
        />
      )}

      {/* mobile menu panel */}
      <div
        className={cn(
          "fixed inset-x-0 top-16 z-39 overflow-hidden border-b border-hairline/60 bg-paper/97 backdrop-blur-xl transition-all duration-200 md:hidden",
          mobileOpen
            ? "max-h-120 opacity-100"
            : "max-h-0 opacity-0 pointer-events-none",
        )}
      >
        <nav className="marketing-shell flex flex-col pb-2">
          {navigation.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="border-b border-hairline/50 py-3.5 text-[15px] font-medium text-ink transition-colors last:border-0 hover:text-ink/60"
              onClick={closeMobile}
            >
              {item.label}
            </a>
          ))}

          {!isAuthed && (
            <div className="flex items-center gap-2.5 pb-1 pt-4">
              <Link
                href="/start"
                className={cn(
                  buttonVariants({ size: "default" }),
                  "h-11 flex-1 rounded-full bg-ink text-[14px] font-medium text-paper hover:bg-ink/90",
                )}
                onClick={closeMobile}
              >
                شروع رایگان
              </Link>
              <Link
                href="/auth"
                className="flex h-11 flex-1 items-center justify-center rounded-full border border-hairline bg-paper text-[14px] font-medium text-ink transition-colors hover:bg-paper-soft"
                onClick={closeMobile}
              >
                ورود
              </Link>
            </div>
          )}
        </nav>
      </div>
    </>
  );
}
