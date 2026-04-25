import Link from "next/link";
import { ZapIcon } from "lucide-react";

/**
 * Slim promo strip shown full-width above the authenticated shell.
 * Dark background so the content card below can sit on it with rounded-top corners.
 */
export function ProPromoBar() {
  return (
    <div
      dir="rtl"
      className="flex h-12 items-center justify-center gap-3 bg-zinc-950 px-4 text-xs font-semibold sm:text-sm"
    >
      <span className="text-zinc-400">
        ۵ روز تا پایان نسخه آزمایشی Pro
      </span>
      <Link
        href={"/dashboard" as const}
        className="inline-flex items-center gap-1.5 rounded-full border border-zinc-700 px-3.5 py-1.5 text-xs font-bold text-white shadow-sm transition-opacity hover:opacity-80 sm:text-xs"
      >
        <ZapIcon className="size-3 fill-white" aria-hidden />
        ادامه دسترسی Pro
      </Link>
    </div>
  );
}
