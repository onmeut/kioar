"use client";

import { useState } from "react";

export function ClaimUsernameForm() {
  const [slug, setSlug] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = slug.trim();
    if (!trimmed) return;
    window.location.assign(`/auth?handle=${encodeURIComponent(trimmed)}`);
  };

  return (
    <form onSubmit={handleSubmit} className="mt-8 w-full max-w-105">
      {/* dir="ltr" so visual order is: [kioar.com/] [input] [button] left→right */}
      <div
        dir="ltr"
        className="claim-form-border flex h-16 items-center overflow-hidden rounded-2xl border border-hairline bg-paper shadow-[0_6px_20px_-8px_rgba(0,0,0,0.12)] transition-shadow"
      >
        <span className="shrink-0 select-none ps-5 text-[14px] font-semibold text-ink-soft whitespace-nowrap">
          kioar.com/
        </span>
        <span className="mx-3 h-5 w-px shrink-0 bg-hairline" />
        <input
          dir="ltr"
          type="text"
          inputMode="text"
          autoCapitalize="none"
          autoCorrect="off"
          autoComplete="username"
          spellCheck={false}
          enterKeyHint="go"
          placeholder="yourname"
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          className="h-full min-w-0 flex-1 bg-transparent text-[15px] font-semibold text-ink placeholder:font-normal placeholder:text-ink-mute outline-none"
        />
        <button
          type="submit"
          className="m-2 flex h-12 shrink-0 items-center rounded-xl bg-ink px-6 text-[14px] font-bold text-paper transition-all hover:bg-ink/85 active:scale-[0.97]"
        >
          بگیر
        </button>
      </div>
    </form>
  );
}
