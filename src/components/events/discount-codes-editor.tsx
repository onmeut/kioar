"use client";

import { PlusIcon, Trash2Icon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type DraftDiscountCode = {
  id: string | null;
  code: string;
  type: "percentage" | "fixed";
  value: number;
  usageLimit: number | null;
  expiresAt: string | null;
  isActive: boolean;
};

/** Per-event discount codes editor. No money moves — codes only change the
 *  displayed/expected amount the host reconciles against the receipt. */
export function DiscountCodesEditor({
  codes,
  onChange,
}: {
  codes: DraftDiscountCode[];
  onChange: (next: DraftDiscountCode[]) => void;
}) {
  function update(index: number, patch: Partial<DraftDiscountCode>) {
    onChange(codes.map((c, i) => (i === index ? { ...c, ...patch } : c)));
  }

  return (
    <div className="space-y-3">
      {codes.length === 0 ? (
        <p className="rounded-3xl border border-dashed border-border/70 p-4 text-center text-sm text-muted-foreground">
هیچ کد تخفیفی ایجاد نشده.
        </p>
      ) : null}

      {codes.map((c, i) => (
        <div
          key={i}
          className="space-y-3 rounded-3xl border border-border bg-muted/20 p-3"
        >
          <div className="flex items-center gap-2">
            <Input
              value={c.code}
              onChange={(e) =>
                update(i, { code: e.target.value.toUpperCase() })
              }
              placeholder="EARLYBIRD"
              dir="ltr"
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              className="flex-1 font-mono"
            />
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="size-11 shrink-0 text-muted-foreground hover:text-rose-600"
              onClick={() => onChange(codes.filter((_, j) => j !== i))}
              aria-label="حذف کد"
            >
              <Trash2Icon className="size-4" />
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-full border border-border p-0.5">
              {(["percentage", "fixed"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => update(i, { type: t })}
                  className={cn(
                    "rounded-full px-3 py-1 text-xs font-semibold transition-colors",
                    c.type === t
                      ? "bg-foreground text-background"
                      : "text-muted-foreground",
                  )}
                >
                  {t === "percentage" ? "درصدی" : "مبلغ ثابت"}
                </button>
              ))}
            </div>
            <Input
              type="number"
              inputMode="numeric"
              value={Number.isFinite(c.value) ? String(c.value) : ""}
              onChange={(e) => update(i, { value: Number(e.target.value) })}
              placeholder={c.type === "percentage" ? "٪ ۱۰" : "تومان"}
              dir="ltr"
              className="w-32"
            />
            <Input
              type="number"
              inputMode="numeric"
              value={c.usageLimit != null ? String(c.usageLimit) : ""}
              onChange={(e) =>
                update(i, {
                  usageLimit: e.target.value ? Number(e.target.value) : null,
                })
              }
              placeholder="سقف استفاده"
              dir="ltr"
              className="w-32"
            />
          </div>
        </div>
      ))}

      <Button
        type="button"
        variant="outline"
        className="h-11 w-full rounded-2xl"
        onClick={() =>
          onChange([
            ...codes,
            {
              id: null,
              code: "",
              type: "percentage",
              value: 10,
              usageLimit: null,
              expiresAt: null,
              isActive: true,
            },
          ])
        }
      >
        <PlusIcon className="size-4" />
        افزودن کد تخفیف
      </Button>
    </div>
  );
}
