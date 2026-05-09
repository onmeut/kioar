/**
 * PublicHeader — floating pill navigation used on public marketing-adjacent
 * pages (e.g. /invited, /affiliate/apply, etc.).
 *
 * Mirrors the navbar style from /discover: sticky pill, logo on the
 * right (RTL), auth CTA on the left. Extracted into a shared component
 * so the design stays in sync.
 */
import Image from "next/image";
import Link from "next/link";

export function PublicHeader() {
  return (
    <div className="sticky top-4 z-30 mx-auto w-full max-w-3xl px-4">
      <header className="flex h-16 items-center justify-between rounded-full bg-card px-5 ring-1 ring-border">
        <Link
          href="/"
          aria-label="کی‌یو‌آر"
          className="flex items-center gap-2 transition-opacity hover:opacity-80"
        >
          <Image
            src="/brand/logo.svg"
            alt=""
            width={20}
            height={26}
            className="h-6 w-auto"
            priority
          />
        </Link>
        <Link
          href="/auth"
          className="inline-flex h-11 items-center justify-center rounded-full bg-foreground px-5 text-sm font-bold text-background transition-colors hover:bg-foreground/90"
        >
          ورود به حساب
        </Link>
      </header>
    </div>
  );
}
