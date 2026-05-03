"use client";

import * as React from "react";
import { CheckIcon, CopyIcon } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";

/**
 * Click-to-copy invite URL pill. Big, monospaced, dir="ltr". Falls back
 * to a `window.prompt` if the clipboard API is blocked.
 */
export function CopyableInviteLink({
  inviteUrl,
  className,
}: {
  inviteUrl: string;
  className?: string;
}) {
  const [copied, setCopied] = React.useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      toast.success("لینک کپی شد");
      setTimeout(() => setCopied(false), 1800);
    } catch {
      window.prompt("کپی کنید:", inviteUrl);
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      className={cn(
        "group flex w-full items-center gap-3 rounded-2xl border border-violet-200 bg-violet-50 px-4 py-3 text-start transition hover:border-violet-300 hover:shadow-sm",
        className,
      )}
    >
      <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-white text-violet-600 ring-1 ring-violet-200">
        {copied ? (
          <CheckIcon className="size-4" />
        ) : (
          <CopyIcon className="size-4" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-violet-700">
          لینک دعوت
        </div>
        <div
          dir="ltr"
          className="mt-0.5 truncate font-mono text-sm font-bold text-zinc-900"
        >
          {inviteUrl}
        </div>
      </div>
      <span className="hidden shrink-0 rounded-full bg-white px-2 py-1 text-[10px] font-bold text-violet-700 ring-1 ring-violet-200 sm:inline-block">
        {copied ? "کپی شد ✓" : "کلیک = کپی"}
      </span>
    </button>
  );
}

/**
 * Click-to-copy short referral code, displayed large and prominent so
 * users can read it aloud or paste into content. Distinct visual
 * treatment from the link pill so the two read as "one card with two
 * copyable artifacts".
 */
export function CopyableInviteCode({
  code,
  className,
}: {
  code: string;
  className?: string;
}) {
  const [copied, setCopied] = React.useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      toast.success("کد کپی شد");
      setTimeout(() => setCopied(false), 1800);
    } catch {
      window.prompt("کپی کنید:", code);
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={`کپی کد دعوت ${code}`}
      className={cn(
        "group flex w-full items-center gap-3 rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-start transition hover:border-violet-300 hover:bg-violet-50/40 hover:shadow-sm",
        className,
      )}
    >
      <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-600 ring-1 ring-violet-200">
        {copied ? (
          <CheckIcon className="size-4" />
        ) : (
          <CopyIcon className="size-4" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
          کد دعوت
        </div>
        <div
          dir="ltr"
          className="mt-0.5 truncate font-mono text-3xl font-extrabold uppercase tracking-[0.35em] text-zinc-950 sm:text-4xl"
        >
          {code}
        </div>
      </div>
      <span className="hidden shrink-0 rounded-full bg-violet-50 px-2 py-1 text-[10px] font-bold text-violet-700 ring-1 ring-violet-200 sm:inline-block">
        {copied ? "کپی شد ✓" : "کلیک = کپی"}
      </span>
    </button>
  );
}
