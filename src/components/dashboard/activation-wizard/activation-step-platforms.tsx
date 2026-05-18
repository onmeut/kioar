"use client";

import { resolveIconEntry } from "@/lib/link-icons";
import { cn } from "@/lib/utils";
import { WIZARD_PLATFORMS } from "./platforms";

type Props = {
  selected: string[];
  onToggle: (key: string) => void;
};

export function ActivationStepPlatforms({ selected, onToggle }: Props) {
  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
        {WIZARD_PLATFORMS.map((platform) => {
          const entry = resolveIconEntry(
            platform.key as Parameters<typeof resolveIconEntry>[0],
            platform.prefix,
          );
          const Icon = entry.Icon;
          const isSelected = selected.includes(platform.key);

          return (
            <button
              key={platform.key}
              type="button"
              onClick={() => onToggle(platform.key)}
              className={cn(
                "relative flex aspect-square flex-col items-center justify-center gap-2 rounded-2xl p-3 text-center transition-all duration-150",
                isSelected
                  ? "border border-foreground/70 bg-muted"
                  : "border border-border bg-card hover:border-foreground/30",
              )}
              aria-pressed={isSelected}
              aria-label={platform.label}
            >
              <span
                className="flex size-10 items-center justify-center rounded-xl text-white"
                style={{ backgroundColor: entry.color }}
              >
                <Icon size={20} />
              </span>
              <span className="text-xs font-medium leading-tight text-foreground">
                {platform.label}
              </span>
            </button>
          );
        })}
      </div>

      {selected.length === 0 && (
        <p className="text-center text-xs text-muted-foreground">
          لینک‌هایی که می‌خوای اضافه کنی رو انتخاب کن
        </p>
      )}
    </div>
  );
}
