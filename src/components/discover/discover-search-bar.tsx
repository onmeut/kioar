"use client";

import { Search, X } from "lucide-react";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";

type Props = {
  /** Current `q` from the URL — server-rendered initial value. */
  initialQuery: string;
  /** URL query string (without `q` and without leading `?`) to preserve
   *  active tab / category / sort while typing. */
  preservedQuery: string;
};

/**
 * Debounced search bar. Writes `q` into the URL (replaceState during
 * typing so each keystroke isn't a history entry, then push on enter).
 * The server component on `/discover` reads `q` and switches into Meili
 * search mode — no client-side fetching here. Keeps the data path single.
 */
export function DiscoverSearchBar({ initialQuery, preservedQuery }: Props) {
  const router = useRouter();
  const [value, setValue] = useState(initialQuery);
  const [, startTransition] = useTransition();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastPushedRef = useRef(initialQuery);

  // Keep input in sync if the URL changes externally (e.g. tab switch).
  useEffect(() => {
    if (initialQuery !== lastPushedRef.current) {
      setValue(initialQuery);
      lastPushedRef.current = initialQuery;
    }
  }, [initialQuery]);

  const navigate = useCallback(
    (q: string) => {
      const params = new URLSearchParams(preservedQuery);
      const trimmed = q.trim().slice(0, 80);
      if (trimmed) {
        params.set("q", trimmed);
      } else {
        params.delete("q");
      }
      // Resetting pagination when search changes.
      params.delete("page");
      const qs = params.toString();
      const url = qs ? `/discover?${qs}` : "/discover";
      lastPushedRef.current = trimmed;
      startTransition(() => router.replace(url as Route));
    },
    [preservedQuery, router],
  );

  function onChange(next: string) {
    setValue(next);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => navigate(next), 250);
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (debounceRef.current) clearTimeout(debounceRef.current);
    navigate(value);
  }

  function onClear() {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setValue("");
    navigate("");
  }

  return (
    <form
      role="search"
      onSubmit={onSubmit}
      className="relative flex h-12 w-full items-center md:h-14"
    >
      <Search
        aria-hidden
        className="pointer-events-none absolute inset-e-4 size-5 text-muted-foreground"
      />
      <input
        type="search"
        inputMode="search"
        enterKeyHint="search"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="جست‌وجو در صفحه‌ها، شهر، دسته‌بندی…"
        aria-label="جست‌وجو در دیسکاور"
        className="h-full w-full rounded-full border border-border bg-card pe-12 ps-12 text-base font-medium text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-foreground/20"
      />
      {value.length > 0 ? (
        <button
          type="button"
          onClick={onClear}
          aria-label="پاک کردن جست‌وجو"
          className="tap-target absolute inset-s-2 grid size-8 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <X className="size-4" />
        </button>
      ) : null}
    </form>
  );
}
