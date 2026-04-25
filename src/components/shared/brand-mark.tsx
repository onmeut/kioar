import type { Route } from "next";
import Image from "next/image";
import Link from "next/link";

import { cn } from "@/lib/utils";

type BrandMarkProps = {
  href?: Route;
  compact?: boolean;
  /** "wordmark" shows text + logo; "mark" shows only the logo svg. */
  variant?: "wordmark" | "mark";
  className?: string;
};

export function BrandMark({
  href = "/",
  compact = false,
  variant = "wordmark",
  className,
}: BrandMarkProps) {
  if (variant === "mark") {
    return (
      <Link
        href={href}
        aria-label="کیوآر"
        className={cn(
          "inline-flex items-center justify-center text-foreground transition-opacity hover:opacity-80",
          className,
        )}
      >
        <Image
          src="/brand/logo.svg"
          alt=""
          width={32}
          height={39}
          className="h-7 w-auto"
          priority
        />
      </Link>
    );
  }

  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-end gap-2 text-foreground transition-opacity hover:opacity-80",
        className,
      )}
    >
      <Image
        src="/brand/logo.svg"
        alt=""
        width={28}
        height={34}
        className={cn("shrink-0", compact ? "h-6 w-auto" : "h-7 w-auto")}
      />
      <span
        className={cn(
          "font-bold leading-none",
          compact ? "text-xl sm:text-2xl" : "text-2xl sm:text-3xl",
        )}
      >
        کیوآر
      </span>
      {!compact ? (
        <span className="mb-1 hidden text-xs font-semibold text-muted-foreground sm:block">
          کارت دیجیتال
        </span>
      ) : null}
    </Link>
  );
}
