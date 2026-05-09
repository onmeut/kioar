"use client";

import { CheckIcon, LockIcon, SparklesIcon } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export type UpgradePlanTier = "pro" | "business";

const PLAN_COPY: Record<
  UpgradePlanTier,
  {
    name: string;
    tagline: string;
    benefits: string[];
    cta: string;
    lockClass: string;
    badgeClass: string;
    ctaClass: string;
  }
> = {
  pro: {
    name: "حرفه‌ای",
    tagline: "برای سازندگان محتوا، فریلنسرها و کسب‌وکارهای نوپا",
    benefits: [
      "بلاک محصول با آیتم‌های نامحدود",
      "آمار پیشرفته لینک‌ها و بازدیدها",
      "حذف برند کیوآر از صفحه",
      "دامنه اختصاصی",
      "همه امکانات پلن رایگان",
    ],
    cta: "ارتقا به حرفه‌ای",
    lockClass: "bg-emerald-50 text-emerald-600",
    badgeClass: "bg-emerald-100 text-emerald-700",
    ctaClass:
      "bg-emerald-600 text-white hover:bg-emerald-700 focus-visible:ring-emerald-500",
  },
  business: {
    name: "کسب‌وکار",
    tagline: "برای تیم‌ها، برندها و کسب‌وکارهای جدی",
    benefits: [
      "بلاک رزرو و هماهنگی آنلاین",
      "فرم‌های سفارشی برای جذب سرنخ",
      "تمام امکانات پلن حرفه‌ای",
      "پشتیبانی اولویت‌دار",
      "مدیریت کامل کسب‌وکار از یک صفحه",
    ],
    cta: "ارتقا به کسب‌وکار",
    lockClass: "bg-purple-50 text-purple-600",
    badgeClass: "bg-purple-100 text-purple-700",
    ctaClass:
      "bg-purple-600 text-white hover:bg-purple-700 focus-visible:ring-purple-500",
  },
};

type UpgradePlanModalProps = {
  open: boolean;
  onClose: () => void;
  plan: UpgradePlanTier;
  /**
   * Optional name of the specific locked feature, e.g. "بلاک هماهنگ".
   * When provided, the heading is more contextual:
   * "«بلاک هماهنگ» در پلن کسب‌وکار است"
   */
  featureName?: string;
};

export function UpgradePlanModal({
  open,
  onClose,
  plan,
  featureName,
}: UpgradePlanModalProps) {
  const copy = PLAN_COPY[plan];

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        className="w-full max-w-sm gap-0 overflow-hidden rounded-3xl p-0"
        showCloseButton={false}
      >
        {/* Coloured header band */}
        <div
          className={cn(
            "flex flex-col items-center gap-3 px-6 pt-7 pb-6",
            plan === "pro" ? "bg-emerald-50" : "bg-purple-50",
          )}
        >
          <span
            className={cn(
              "inline-flex size-14 items-center justify-center rounded-full",
              copy.lockClass,
            )}
          >
            <LockIcon className="size-6" />
          </span>

          <div className="text-center">
            <span
              className={cn(
                "mb-2 inline-flex items-center gap-1.5 rounded-full px-3 py-0.5 text-xs font-bold",
                copy.badgeClass,
              )}
            >
              <SparklesIcon className="size-3" />
              پلن {copy.name}
            </span>
            <h2 className="mt-2 text-lg font-extrabold leading-snug text-foreground">
              {featureName ? (
                <>
                  «{featureName}»<br />
                  در پلن {copy.name} فعال می‌شود
                </>
              ) : (
                <>
                  این قابلیت در پلن {copy.name}
                  <br />
                  فعال می‌شود
                </>
              )}
            </h2>
            <p className="mt-1.5 text-sm text-muted-foreground">
              {copy.tagline}
            </p>
          </div>
        </div>

        {/* Benefits list */}
        <div className="px-6 pt-5 pb-2">
          <ul className="space-y-2.5">
            {copy.benefits.map((benefit) => (
              <li key={benefit} className="flex items-start gap-2.5">
                <CheckIcon
                  className={cn(
                    "mt-0.5 size-4 shrink-0",
                    plan === "pro" ? "text-emerald-600" : "text-purple-600",
                  )}
                />
                <span className="text-sm text-foreground">{benefit}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2 px-6 pt-5 pb-6">
          <Link
            href="/pro"
            onClick={onClose}
            className={cn(
              "inline-flex h-12 w-full items-center justify-center rounded-2xl text-base font-bold ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
              copy.ctaClass,
            )}
          >
            {copy.cta}
          </Link>
          <Button
            type="button"
            variant="ghost"
            className="h-11 w-full rounded-2xl text-sm text-muted-foreground"
            onClick={onClose}
          >
            شاید بعداً
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
