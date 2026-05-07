"use client";

/**
 * Phase 12+ — unified checkout code entry.
 *
 * Single field that accepts a referral code, an affiliate code, OR an
 * admin-issued discount code. Calls `/api/billing/code/resolve` to
 * classify the code and render type-specific feedback:
 *
 *   - Referral  → "یک ماه پرو رایگان روی این صفحه — به‌مهمان [نام]"
 *   - Affiliate → "۳ ماه پرو رایگان با خرید سالانه — به‌مهمان [نام]"
 *                 + monthly-cycle warning when applicable
 *   - Discount  → "[X]% تخفیف اعمال شد" + price preview
 *   - Error     → Persian message from the server
 *
 * Collapsed by default to keep the upgrade card visually quiet for
 * users who aren't redeeming a code. Once applied, the chip stays
 * visible above the price summary with an × to remove and try a
 * different one. Stacking is blocked: entering a different code while
 * one is applied prompts a confirm before swapping.
 *
 * The applied code is reported back to the parent via `onChange` so
 * the price summary + upgrade button can include it in the
 * `/api/billing/change-plan` POST.
 */

import { useEffect, useRef, useState, useTransition } from "react";
import { CheckCircle2Icon, Loader2Icon, TagIcon, XIcon } from "lucide-react";

import { KioarAvatar } from "@/components/shared/kioar-avatar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatPersianNumber, toPersianDigits } from "@/lib/persian";
import { cn } from "@/lib/utils";

const DEBOUNCE_MS = 400;

export type AppliedCheckoutCode = {
  raw: string;
  kind: "discount" | "referral" | "affiliate";
  /** Persian summary the parent can show in the price bar / chip. */
  summary: string;
  inviterName?: string;
  inviterAvatarUrl?: string | null;
  monthlyCycleWarning?: boolean;
  eligible?: boolean;
  /** Discount preview, only when kind === "discount". */
  preview?: {
    subtotalToman: number;
    discountAmountToman: number;
    vatToman: number;
    totalToman: number;
    freeMonths: number;
    discountType: "percent" | "fixed_amount" | "free_months";
  };
};

type ResolveResponse =
  | {
      ok: true;
      kind: "discount";
      code: string;
      nameFa: string;
      discountType: "percent" | "fixed_amount" | "free_months";
      freeMonths: number;
      subtotalToman: number;
      discountAmountToman: number;
      vatToman: number;
      totalToman: number;
    }
  | {
      ok: true;
      kind: "referral";
      code: string;
      inviter: {
        name: string;
        channelKind?: string | null;
        avatarUrl?: string | null;
      };
      eligible: boolean;
      ineligibleReason?: string;
      rewardSummaryFa: string;
    }
  | {
      ok: true;
      kind: "affiliate";
      code: string;
      inviter: {
        name: string;
        channelKind?: string | null;
        avatarUrl?: string | null;
      };
      eligible: boolean;
      ineligibleReason?: string;
      monthlyCycleWarning: boolean;
      rewardSummaryFa: string;
    }
  | { ok: false; errorCode: string; message: string }
  | { error: string };

type Props = {
  pageId: string;
  /**
   * The plan the user is currently leaning toward — used to compute
   * the discount preview. The parent owns this state via the cycle
   * tabs. We default to "pro" + "monthly" if not provided.
   */
  planKey?: "pro" | "business";
  billingCycle: "monthly" | "annual";
  /** Reports applied/cleared code up to the parent. */
  onChange: (applied: AppliedCheckoutCode | null) => void;
  applied: AppliedCheckoutCode | null;
};

export function CheckoutCodeField({
  pageId,
  planKey = "pro",
  billingCycle,
  onChange,
  applied,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [pendingCode, setPendingCode] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reqIdRef = useRef(0);

  const resolveAndApply = async (
    raw: string,
    opts?: { silent?: boolean; replaceConfirmed?: boolean },
  ) => {
    const trimmed = raw.trim();
    if (!trimmed) return;
    if (
      applied &&
      applied.raw.toLowerCase() !== trimmed.toLowerCase() &&
      !opts?.replaceConfirmed
    ) {
      const ok = window.confirm(
        `کد فعلی «${applied.raw}» حذف و کد جدید اعمال شود؟`,
      );
      if (!ok) return;
    }
    if (!opts?.silent) setError(null);
    const myReq = ++reqIdRef.current;
    setPendingCode(trimmed);
    startTransition(async () => {
      try {
        const res = await fetch("/api/billing/code/resolve", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            pageId,
            planKey,
            billingCycle,
            code: trimmed,
          }),
        });
        if (myReq !== reqIdRef.current) return; // stale
        const data = (await res
          .json()
          .catch(() => null)) as ResolveResponse | null;
        if (!res.ok || !data) {
          setError("ارتباط با سرور برقرار نشد.");
          setPendingCode(null);
          return;
        }
        if ("error" in data) {
          setError("درخواست نامعتبر است.");
          setPendingCode(null);
          return;
        }
        if (data.ok === false) {
          if (!opts?.silent) {
            setError(data.message ?? "کد یافت نشد.");
            onChange(null);
          }
          setPendingCode(null);
          return;
        }
        // OK
        const next: AppliedCheckoutCode =
          data.kind === "discount"
            ? {
                raw: trimmed,
                kind: "discount",
                summary: discountSummary(data),
                preview: {
                  subtotalToman: data.subtotalToman,
                  discountAmountToman: data.discountAmountToman,
                  vatToman: data.vatToman,
                  totalToman: data.totalToman,
                  freeMonths: data.freeMonths,
                  discountType: data.discountType,
                },
              }
            : data.kind === "referral"
              ? {
                  raw: trimmed,
                  kind: "referral",
                  summary: data.rewardSummaryFa,
                  inviterName: data.inviter.name,
                  inviterAvatarUrl: data.inviter.avatarUrl,
                  eligible: data.eligible,
                }
              : {
                  raw: trimmed,
                  kind: "affiliate",
                  summary: data.rewardSummaryFa,
                  inviterName: data.inviter.name,
                  inviterAvatarUrl: data.inviter.avatarUrl,
                  eligible: data.eligible,
                  monthlyCycleWarning: data.monthlyCycleWarning,
                };
        setError(null);
        onChange(next);
        setPendingCode(null);
      } catch (e) {
        if (myReq !== reqIdRef.current) return;
        setError(`ارتباط با سرور برقرار نشد: ${(e as Error).message}`);
        setPendingCode(null);
      }
    });
  };

  // Re-resolve when the cycle/plan changes — the affiliate monthly
  // warning and the discount preview both depend on it. This is a
  // genuine external sync (server resolution), not a derived-state
  // anti-pattern, so we silence the hooks lint here.
  useEffect(() => {
    if (!applied) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void resolveAndApply(applied.raw, { silent: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [billingCycle, planKey]);

  const handleChange = (raw: string) => {
    setCode(raw);
    setError(null);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!raw.trim()) return;
    debounceRef.current = setTimeout(() => {
      void resolveAndApply(raw);
    }, DEBOUNCE_MS);
  };

  const handleRemove = () => {
    onChange(null);
    setCode("");
    setError(null);
  };

  // ----- Render -----
  if (applied) {
    return <AppliedChip applied={applied} onRemove={handleRemove} />;
  }

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="tap-target inline-flex w-full items-center justify-between rounded-xl border border-dashed border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700 transition hover:border-zinc-300 hover:bg-zinc-50"
      >
        <span className="flex items-center gap-2">
          <TagIcon className="size-4 text-zinc-400" />
          کد دعوت یا تخفیف دارید؟
        </span>
        <span className="text-xs text-zinc-400">اعمال</span>
      </button>
    );
  }

  return (
    <div className="space-y-2 rounded-xl border bg-white p-3">
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor="checkout-code" className="text-xs text-zinc-600">
          کد دعوت یا تخفیف
        </Label>
        <button
          type="button"
          onClick={() => {
            setExpanded(false);
            setCode("");
            setError(null);
          }}
          className="text-xs text-zinc-500 hover:text-zinc-700"
        >
          بستن
        </button>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          id="checkout-code"
          dir="ltr"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          autoComplete="off"
          enterKeyHint="go"
          value={code}
          onChange={(e) => handleChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              if (debounceRef.current) clearTimeout(debounceRef.current);
              void resolveAndApply(code);
            }
          }}
          placeholder="مثلاً xqfm یا WELCOME20"
          className="h-11 flex-1"
          autoFocus
        />
        <Button
          type="button"
          variant="outline"
          className="h-11 sm:w-auto"
          disabled={!code.trim() || (isPending && pendingCode === code.trim())}
          onClick={() => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
            void resolveAndApply(code);
          }}
        >
          {isPending && pendingCode === code.trim() ? (
            <Loader2Icon className="size-4 animate-spin" />
          ) : (
            "اعمال"
          )}
        </Button>
      </div>
      {error ? (
        <p className="text-xs text-red-600" role="alert">
          ❌ {error}
        </p>
      ) : (
        <p className="text-[11px] text-zinc-500">
          کد را وارد کنید — به‌صورت خودکار بررسی می‌شود.
        </p>
      )}
    </div>
  );
}

function AppliedChip({
  applied,
  onRemove,
}: {
  applied: AppliedCheckoutCode;
  onRemove: () => void;
}) {
  const tone = applied.eligible === false ? "amber" : "emerald";
  const toneClasses =
    tone === "amber"
      ? "border-amber-200 bg-amber-50"
      : "border-emerald-200 bg-emerald-50";
  const headingTone = tone === "amber" ? "text-amber-900" : "text-emerald-900";
  const bodyTone = tone === "amber" ? "text-amber-800" : "text-emerald-800";

  return (
    <div className={cn("space-y-2 rounded-xl border p-3 text-sm", toneClasses)}>
      <div className="flex items-start gap-3">
        {applied.kind === "discount" ? (
          <div
            className={cn(
              "flex size-10 shrink-0 items-center justify-center rounded-full",
              tone === "amber" ? "bg-amber-100" : "bg-emerald-100",
            )}
          >
            <TagIcon
              className={cn(
                "size-5",
                tone === "amber" ? "text-amber-700" : "text-emerald-700",
              )}
            />
          </div>
        ) : (
          <Avatar className="size-10 shrink-0 ring-2 ring-white [&_svg]:size-full!">
            {applied.inviterAvatarUrl ? (
              <AvatarImage
                src={applied.inviterAvatarUrl}
                alt={applied.inviterName ?? ""}
              />
            ) : (
              <AvatarFallback className="bg-transparent p-0">
                <KioarAvatar
                  seed={applied.inviterName ?? applied.raw}
                  size={40}
                />
              </AvatarFallback>
            )}
          </Avatar>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            {applied.eligible !== false ? (
              <CheckCircle2Icon
                className={cn(
                  "size-4 shrink-0",
                  tone === "amber" ? "text-amber-700" : "text-emerald-700",
                )}
              />
            ) : null}
            <p className={cn("text-sm font-semibold", headingTone)}>
              {applied.summary}
            </p>
          </div>
          <p
            className={cn("mt-0.5 truncate text-xs font-mono", bodyTone)}
            dir="ltr"
          >
            کد: {applied.raw}
          </p>
        </div>
        <button
          type="button"
          onClick={onRemove}
          aria-label="حذف کد"
          className={cn(
            "tap-target -m-1 flex size-9 shrink-0 items-center justify-center rounded-full transition",
            tone === "amber"
              ? "text-amber-700 hover:bg-amber-100"
              : "text-emerald-700 hover:bg-emerald-100",
          )}
        >
          <XIcon className="size-4" />
        </button>
      </div>

      {applied.kind === "affiliate" && applied.monthlyCycleWarning ? (
        <p className="rounded-lg border border-amber-200 bg-amber-100/60 p-2 text-[12px] leading-5 text-amber-900">
          این کد فقط با پلن سالانه فعال می‌شود — برای ۳ ماه رایگان، پلن سالانه
          را انتخاب کنید.
        </p>
      ) : null}

      {applied.eligible === false ? (
        <p className="rounded-lg border border-amber-200 bg-amber-100/60 p-2 text-[12px] leading-5 text-amber-900">
          این کد فقط برای اولین خرید کاربران جدید است. می‌توانید پرداخت را ادامه
          دهید، اما هدیه‌ی این کد اعمال نخواهد شد.
        </p>
      ) : null}

      {applied.kind === "discount" && applied.preview ? (
        <div className="space-y-1 rounded-lg bg-white/60 p-2 text-[12px] text-emerald-900">
          <Row
            label="مبلغ پلن"
            value={`${formatToman(applied.preview.subtotalToman)} تومان`}
          />
          <Row
            label="تخفیف"
            value={`- ${formatToman(applied.preview.discountAmountToman)} تومان`}
          />
          {applied.preview.vatToman > 0 ? (
            <Row
              label="مالیات"
              value={`${formatToman(applied.preview.vatToman)} تومان`}
            />
          ) : null}
          {applied.preview.discountType === "free_months" &&
          applied.preview.freeMonths > 0 ? (
            <Row
              label="ماه رایگان"
              value={`${toPersianDigits(applied.preview.freeMonths)} ماه`}
            />
          ) : null}
          <div className="mt-1 flex items-center justify-between border-t border-emerald-200 pt-1 text-[13px] font-semibold">
            <span>قابل پرداخت با این کد</span>
            <span dir="ltr">
              {formatToman(applied.preview.totalToman)} تومان
            </span>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-emerald-700/90">{label}</span>
      <span dir="ltr" className="font-medium">
        {value}
      </span>
    </div>
  );
}

function formatToman(value: number) {
  return toPersianDigits(formatPersianNumber(value));
}

function discountSummary(data: {
  nameFa: string;
  discountType: "percent" | "fixed_amount" | "free_months";
  freeMonths: number;
  discountAmountToman: number;
}): string {
  if (data.discountType === "free_months" && data.freeMonths > 0) {
    return `${toPersianDigits(data.freeMonths)} ماه پرو رایگان — ${data.nameFa}`;
  }
  if (data.discountType === "fixed_amount") {
    return `${formatPersianNumber(data.discountAmountToman)} تومان تخفیف اعمال شد`;
  }
  // percent
  return `${data.nameFa} — تخفیف اعمال شد`;
}
