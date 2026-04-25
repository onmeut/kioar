import type { Route } from "next";
import Link from "next/link";

import { BrandMark } from "@/components/shared/brand-mark";
import { buttonVariants } from "@/components/ui/button";
import { getCurrentViewer } from "@/lib/auth/session";
import { cn } from "@/lib/utils";

const navigation = [
  { href: "/#features", label: "امکانات" },
  { href: "/#flow", label: "جریان کاربر" },
  { href: "/#nfc", label: "کارت NFC" },
  { href: "/events", label: "رویدادها" },
  { href: "/#faq", label: "پرسش‌ها" },
];

export async function SiteHeader() {
  const viewer = await getCurrentViewer();
  const isAuthed = Boolean(viewer?.user);
  const isComplete = Boolean(viewer?.profile?.isComplete);
  const displayName =
    viewer?.profile?.fullName?.trim() ||
    viewer?.user?.phone?.slice(-4) ||
    "کاربر";
  const initial = displayName.trim().charAt(0) || "ک";
  const dashboardHref: Route = isComplete ? "/dashboard" : "/onboarding";

  return (
    <header className="sticky top-0 z-40 border-b border-black/[0.06] bg-background/80 backdrop-blur-xl">
      <div className="marketing-shell flex h-14 items-center justify-between gap-4 sm:h-16">
        <div className="flex items-center gap-8">
          <BrandMark compact href="/" />
          <nav className="hidden items-center gap-6 text-[13px] font-semibold text-foreground/70 md:flex">
            {navigation.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="transition-colors hover:text-foreground"
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
                "marketing-primary-button h-9 gap-2 rounded-full px-3 text-[13px] font-semibold",
              )}
            >
              <span className="grid size-6 place-items-center rounded-full bg-white/15 text-[11px] font-bold text-white">
                {initial}
              </span>
              <span>{isComplete ? "داشبورد" : "ادامه ثبت‌نام"}</span>
            </Link>
          ) : (
            <>
              <Link
                href="/auth"
                className="hidden px-3 text-[13px] font-semibold text-foreground/70 transition-colors hover:text-foreground sm:inline-flex"
              >
                ورود
              </Link>
              <Link
                href="/auth"
                className={cn(
                  buttonVariants({ size: "sm" }),
                  "marketing-primary-button h-9 rounded-full px-4 text-[13px] font-semibold",
                )}
              >
                شروع رایگان
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
