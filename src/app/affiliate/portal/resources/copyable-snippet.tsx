"use client";

import { useState } from "react";

import { CheckIcon, CopyIcon } from "lucide-react";

export function CopyableSnippet({
  title,
  text,
}: {
  title: string;
  text: string;
}) {
  const [copied, setCopied] = useState(false);
  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  };

  return (
    <div className="flex flex-col rounded-2xl border border-hairline bg-paper p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[12px] font-bold text-ink">{title}</p>
        <button
          type="button"
          onClick={onCopy}
          className="flex h-8 items-center gap-1.5 rounded-full bg-ink px-3 text-[11px] font-bold text-paper hover:bg-ink/90"
        >
          {copied ? (
            <CheckIcon className="size-3.5" />
          ) : (
            <CopyIcon className="size-3.5" />
          )}
          {copied ? "کپی شد" : "کپی"}
        </button>
      </div>
      <p className="mt-3 whitespace-pre-line text-[12px] leading-7 text-ink-soft">
        {text}
      </p>
    </div>
  );
}
