"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect, type ReactNode } from "react";

import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

type Props = {
  children: ReactNode;
  title?: string;
  description?: string;
  className?: string;
};

/**
 * Wraps an intercepted-route page inside a wide right-side Sheet.
 * Closing or pressing Escape navigates back so the underlying list page is restored.
 */
export function RouteModalSheet({
  children,
  title,
  description,
  className,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(true);

  // Defensive: if state ever desyncs we guarantee a back navigation.
  useEffect(() => {
    if (!open) {
      const id = setTimeout(() => router.back(), 180);
      return () => clearTimeout(id);
    }
  }, [open, router]);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent
        side="left"
        className={cn(
          // Use !important to win over data-[side=left]:sm:max-w-sm (attribute
          // selector has higher specificity than a plain class selector).
          "w-full! overflow-y-auto p-0 sm:max-w-3xl! lg:max-w-5xl!",
          className,
        )}
        showCloseButton
      >
        <SheetTitle className="sr-only">{title ?? "جزئیات"}</SheetTitle>
        {description ? (
          <SheetDescription className="sr-only">{description}</SheetDescription>
        ) : (
          <SheetDescription className="sr-only">
            پنل جزئیات در مدال
          </SheetDescription>
        )}
        <div className="min-h-full">{children}</div>
      </SheetContent>
    </Sheet>
  );
}
