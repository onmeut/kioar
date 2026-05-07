"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2Icon, CircleXIcon, LoaderCircleIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type Status =
  | "idle"
  | "checking"
  | "available"
  | "taken"
  | "reserved"
  | "too_short"
  | "invalid";

interface SlugInputProps {
  name?: string;
  defaultValue?: string;
  autoFocus?: boolean;
  enterKeyHint?: React.InputHTMLAttributes<HTMLInputElement>["enterKeyHint"];
  /** Called whenever the normalized value changes */
  onChange?: (value: string) => void;
  /** Size variant */
  size?: "sm" | "md";
  /** Visual variant — "muted" matches the muted phone-input style */
  variant?: "default" | "muted";
  className?: string;
}

export function SlugInput({
  name = "handle",
  defaultValue = "",
  autoFocus,
  enterKeyHint,
  onChange,
  size = "md",
  variant = "default",
  className,
}: SlugInputProps) {
  const [value, setValue] = useState(defaultValue);
  const [status, setStatus] = useState<Status>("idle");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!value || value.length < 2) {
      setStatus(value.length === 0 ? "idle" : "too_short");
      return;
    }

    setStatus("checking");

    if (timerRef.current) clearTimeout(timerRef.current);
    if (abortRef.current) abortRef.current.abort();

    timerRef.current = setTimeout(async () => {
      const controller = new AbortController();
      abortRef.current = controller;
      try {
        const res = await fetch(
          `/api/slug/check?handle=${encodeURIComponent(value)}`,
          { signal: controller.signal },
        );
        const data = (await res.json()) as {
          available: boolean;
          reason?: string;
        };
        setStatus(
          data.available ? "available" : ((data.reason as Status) ?? "taken"),
        );
      } catch {
        // aborted — ignore
      }
    }, 400);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [value]);

  const icon = (() => {
    if (status === "checking")
      return (
        <LoaderCircleIcon className="size-6 animate-spin text-muted-foreground" />
      );
    if (status === "available")
      return <CheckCircle2Icon className="size-6 text-emerald-500" />;
    if (status === "taken" || status === "reserved")
      return <CircleXIcon className="size-6 text-destructive" />;
    return null;
  })();

  const inputHeight = size === "sm" ? "h-14" : "h-16";

  return (
    <div className={cn("grid gap-1", className)}>
      <div
        dir="ltr"
        className={cn(
          "relative flex w-full min-w-0 items-center rounded-full border",
          variant === "muted"
            ? "bg-muted border-transparent focus-within:ring-3 focus-within:ring-ring/20"
            : "bg-background ring-offset-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2",
          status === "available" &&
            "border-emerald-400 focus-within:ring-emerald-300",
          (status === "taken" || status === "reserved") &&
            "border-destructive/50 focus-within:ring-destructive/30",
        )}
      >
        <span className="ps-5 font-mono text-lg font-bold text-muted-foreground whitespace-nowrap">
          kioar.me/
        </span>
        <input
          name={name}
          type="text"
          inputMode="text"
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          placeholder="username"
          aria-label="نام کاربری"
          autoFocus={autoFocus}
          enterKeyHint={enterKeyHint}
          value={value}
          onChange={(e) => {
            const v = e.target.value;
            setValue(v);
            onChange?.(v);
          }}
          className={cn(
            "min-w-0 flex-1 bg-transparent px-4 pr-16 font-mono text-lg font-semibold focus:outline-none",
            inputHeight,
          )}
        />
        {icon && (
          <span className="absolute inset-e-4 top-1/2 -translate-y-1/2">
            {icon}
          </span>
        )}
      </div>
    </div>
  );
}
