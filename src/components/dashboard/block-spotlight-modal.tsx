"use client";

import { useEffect, useState, type ReactNode } from "react";
import {
  CheckIcon,
  CircleIcon,
  LockIcon,
  PinIcon,
  SparklesIcon,
  ZapIcon,
} from "lucide-react";
import Link from "next/link";

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  ANIMATION_LABELS,
  BLOCK_ANIMATION_STYLES,
  DEFAULT_ANIMATION_STYLE,
  spotlightAnimationClass,
  type BlockAnimationStyle,
  type BlockSpotlight,
} from "@/lib/block-spotlight";

export type BlockKind =
  | "link"
  | "form"
  | "booking"
  | "product"
  | "text"
  | "media";

export type SpotlightModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  blockKind: BlockKind;
  initialSpotlight: BlockSpotlight;
  initialAnimationStyle: BlockAnimationStyle | null;
  /** Whether the page has the `featured_links` entitlement (pin / auto-expand). */
  pinAllowed: boolean;
  /** Whether the page has the `link_animations` entitlement. */
  animateAllowed: boolean;
  onSubmit: (next: {
    spotlight: BlockSpotlight;
    animationStyle: BlockAnimationStyle | null;
  }) => Promise<void> | void;
};

/**
 * Modal that lets the creator set the Spotlight state for a single
 * link/form/booking block. The shape (Sheet on mobile, Dialog on
 * desktop) and copy match the rest of the dashboard.
 */
export function SpotlightModal(props: SpotlightModalProps) {
  const isMobile = useIsMobile();
  const Body = <SpotlightForm {...props} />;

  if (isMobile) {
    return (
      <Sheet open={props.open} onOpenChange={props.onOpenChange}>
        <SheetContent
          side="bottom"
          className="flex h-[90dvh] flex-col gap-0 rounded-t-3xl p-0"
        >
          <SheetTitle className="shrink-0 border-b px-4 py-3 text-center text-base font-bold">
            تمرکز
          </SheetTitle>
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-4">
            {Body}
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="flex max-h-[80dvh] w-full max-w-lg flex-col gap-0 overflow-hidden rounded-3xl p-0">
        <DialogTitle className="border-b px-4 py-3 text-center text-base font-bold">
          تمرکز
        </DialogTitle>
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-4">
          {Body}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SpotlightForm({
  blockKind,
  initialSpotlight,
  initialAnimationStyle,
  pinAllowed,
  animateAllowed,
  onSubmit,
  onOpenChange,
}: SpotlightModalProps) {
  const [spotlight, setSpotlight] = useState<BlockSpotlight>(initialSpotlight);
  const [animationStyle, setAnimationStyle] = useState<BlockAnimationStyle>(
    initialAnimationStyle ?? DEFAULT_ANIMATION_STYLE,
  );
  const [submitting, setSubmitting] = useState(false);

  // Reset local state whenever the modal is reopened with new props.
  useEffect(() => {
    setSpotlight(initialSpotlight);
    setAnimationStyle(initialAnimationStyle ?? DEFAULT_ANIMATION_STYLE);
  }, [initialSpotlight, initialAnimationStyle]);

  const pinCopy = blockKindCopy(blockKind);

  async function handleSubmit() {
    setSubmitting(true);
    try {
      await onSubmit({
        spotlight,
        animationStyle: spotlight === "animate" ? animationStyle : null,
      });
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-5">
      <header className="space-y-1">
        <h3 className="text-lg font-bold">تمرکز</h3>
        <p className="text-sm text-muted-foreground">
          یک لینک مهم دارید؟ آن را برجسته کنید تا وقتی بازدیدکننده روی صفحه شما
          می‌آید، بلافاصله توجه‌اش به آن جلب شود.
        </p>
      </header>

      <RadioRow
        title={pinCopy.pinTitle}
        description={pinCopy.pinDesc}
        icon={<PinIcon className="size-5" />}
        selected={spotlight === "pin"}
        locked={!pinAllowed}
        onSelect={() => setSpotlight(spotlight === "pin" ? "none" : "pin")}
      />
      <RadioRow
        title="انیمیشن"
        description="یک افکت حرکتی جذاب روی این لینک اعمال می‌شود."
        icon={<ZapIcon className="size-5" />}
        selected={spotlight === "animate"}
        locked={!animateAllowed}
        onSelect={() => setSpotlight(spotlight === "animate" ? "none" : "animate")}
      >
        {spotlight === "animate" && animateAllowed ? (
          <div className="grid grid-cols-2 gap-2 pt-3 sm:grid-cols-4">
            {BLOCK_ANIMATION_STYLES.map((style) => {
              const isActive = animationStyle === style;
              const animClass = spotlightAnimationClass("animate", style);
              return (
                <button
                  key={style}
                  type="button"
                  onClick={() => setAnimationStyle(style)}
                  className={cn(
                    "rounded-2xl border bg-background px-3 py-4 text-center text-xs font-boldr transition-colors",
                    isActive
                      ? "border-foreground text-foreground"
                      : "border-border text-muted-foreground hover:text-foreground",
                  )}
                >
                  <span className={cn("inline-block", animClass)}>
                    {ANIMATION_LABELS[style]}
                  </span>
                </button>
              );
            })}
          </div>
        ) : null}
      </RadioRow>
      <RadioRow
        title="بدون اولویت"
        description="این لینک هیچ تمرکز خاصی ندارد و در ترتیب عادی نمایش داده می‌شود."
        icon={<SparklesIcon className="size-5" />}
        selected={spotlight === "none"}
        onSelect={() => setSpotlight("none")}
      />

      <div className="mt-auto flex items-center justify-end gap-2 pt-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => onOpenChange(false)}
          disabled={submitting}
        >
          انصراف
        </Button>
        <Button
          type="button"
          onClick={handleSubmit}
          disabled={
            submitting ||
            (spotlight === "pin" && !pinAllowed) ||
            (spotlight === "animate" && !animateAllowed)
          }
        >
          ذخیره
        </Button>
      </div>
    </div>
  );
}

function RadioRow({
  title,
  description,
  icon,
  selected,
  locked,
  onSelect,
  children,
}: {
  title: string;
  description: string;
  icon: ReactNode;
  selected: boolean;
  locked?: boolean;
  onSelect: () => void;
  children?: ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border bg-background p-4 transition-colors",
        selected
          ? "border-foreground"
          : "border-border hover:border-foreground/40",
        locked && "opacity-70",
      )}
    >
      <button
        type="button"
        onClick={locked ? undefined : onSelect}
        disabled={locked}
        className="flex w-full items-start gap-3 text-start"
      >
        <span
          aria-hidden
          className={cn(
            "mt-0.5 grid size-6 place-items-center rounded-full border",
            selected
              ? "border-foreground bg-foreground text-background"
              : "border-muted-foreground/40 text-transparent",
          )}
        >
          {selected ? (
            <CheckIcon className="size-3.5" />
          ) : (
            <CircleIcon className="size-3 opacity-0" />
          )}
        </span>
        <span className="grid size-9 shrink-0 place-items-center rounded-2xl bg-muted text-foreground">
          {icon}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2 text-sm font-bold">
            {title}
            {locked ? (
              <Link
                href="/pro"
                className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-bold text-primary hover:bg-primary/20"
              >
                <LockIcon className="size-3" />
                <span className="mt-px">ارتقا</span>
              </Link>
            ) : null}
          </span>
          <span className="mt-0.5 block text-xs text-muted-foreground">
            {description}
          </span>
        </span>
      </button>
      {children}
    </div>
  );
}

function blockKindCopy(kind: BlockKind): {
  pinTitle: string;
  pinDesc: string;
} {
  switch (kind) {
    case "form":
      return {
        pinTitle: "باز شدن خودکار",
        pinDesc:
          "این فرم به بالای صفحه منتقل می‌شود و به‌محض ورود بازدیدکننده باز خواهد بود.",
      };
    case "booking":
      return {
        pinTitle: "باز شدن خودکار",
        pinDesc:
          "این هماهنگ به بالای صفحه منتقل می‌شود و به‌محض ورود بازدیدکننده باز خواهد بود.",
      };
    case "product":
      return {
        pinTitle: "سنجاق به بالا",
        pinDesc:
          "این بلوک محصولات همیشه بالای دیگر بلوک‌ها در صفحه عمومی نمایش داده می‌شود.",
      };
    case "text":
      return {
        pinTitle: "سنجاق به بالا",
        pinDesc:
          "این بلوک متن همیشه بالای دیگر بلوک‌ها در صفحه عمومی نمایش داده می‌شود.",
      };
    case "media":
      return {
        pinTitle: "سنجاق به بالا",
        pinDesc:
          "این بلوک مدیا همیشه بالای دیگر بلوک‌ها در صفحه عمومی نمایش داده می‌شود.",
      };
    case "link":
    default:
      return {
        pinTitle: "سنجاق به بالا",
        pinDesc:
          "این لینک همیشه بالای دیگر بلوک‌ها در صفحه عمومی نمایش داده می‌شود.",
      };
  }
}
