"use client";

import { resolveIconEntry } from "@/lib/link-icons";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";
import { WIZARD_PLATFORMS } from "./platforms";

type Props = {
  selectedKeys: string[];
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
  onRemove: (key: string) => void;
  errors: Record<string, string | null>;
};

export function ActivationStepLinks({ selectedKeys, values, onChange, onRemove, errors }: Props) {
  const platforms = WIZARD_PLATFORMS.filter((p) => selectedKeys.includes(p.key));

  return (
    <div className="flex flex-col gap-3">
      {platforms.map((platform, idx) => {
        const entry = resolveIconEntry(
          platform.key as Parameters<typeof resolveIconEntry>[0],
          platform.prefix,
        );
        const Icon = entry.Icon;
        const val = values[platform.key] ?? "";
        const error = errors[platform.key] ?? null;
        const showAtPrefix = platform.usernameOnly && !platform.inputPrefix;
        const showUrlPrefix = !!platform.inputPrefix;

        return (
          <div key={platform.key}>
            {/* Outer row: card + remove button side by side */}
            <div className="flex items-center gap-3 -me-2" dir="rtl">
              {/* Remove button — outside the card, on the visual right (RTL start) */}
              <button
                type="button"
                onClick={() => onRemove(platform.key)}
                className="flex size-7 shrink-0 items-center justify-center rounded-full border bg-background text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label={`حذف ${platform.label}`}
              >
                <X size={13} />
              </button>

              {/* Card */}
              <div
                className={cn(
                  "flex flex-1 items-center gap-3 rounded-2xl border bg-background px-3 py-3 transition-colors focus-within:border-foreground/40 focus-within:ring-2 focus-within:ring-foreground/10",
                  error && "border-destructive focus-within:border-destructive focus-within:ring-destructive/20",
                )}
              >
                {/* Platform icon */}
                <div
                  className="flex size-11 shrink-0 items-center justify-center rounded-xl text-white"
                  style={{ backgroundColor: entry.color }}
                >
                  <Icon size={22} />
                </div>

                {/* Input area — always LTR */}
                <div className="flex min-w-0 flex-1 flex-col gap-0.5" dir="ltr">
                  <span className="text-[11px] font-medium text-muted-foreground leading-none select-none">
                    {platform.label}
                  </span>

                  <div className="flex items-baseline gap-0">
                    {showAtPrefix && (
                      <span className="text-[15px] text-muted-foreground select-none leading-none">@</span>
                    )}
                    {showUrlPrefix && (
                      <span className="text-[13px] text-muted-foreground select-none leading-none whitespace-nowrap">
                        {platform.inputPrefix}
                      </span>
                    )}
                    <input
                      type={platform.key === "email" ? "email" : platform.key === "whatsapp" || platform.key === "phone" ? "tel" : "text"}
                      inputMode={platform.key === "whatsapp" || platform.key === "phone" ? "tel" : platform.key === "email" ? "email" : "url"}
                      autoComplete={platform.key === "email" ? "email" : platform.key === "whatsapp" || platform.key === "phone" ? "tel" : "off"}
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                      enterKeyHint={idx < platforms.length - 1 ? "next" : "done"}
                      dir="ltr"
                      placeholder={platform.placeholder}
                      value={val}
                      onChange={(e) => onChange(platform.key, e.target.value)}
                      className={cn(
                        "min-w-0 flex-1 bg-transparent text-[15px] leading-none outline-none placeholder:text-muted-foreground/50",
                        (showAtPrefix || showUrlPrefix) && "ps-0.5",
                      )}
                    />
                  </div>
                </div>
              </div>
            </div>

            {error && (
              <p className="mt-1 px-1 text-xs text-destructive" dir="rtl">{error}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
