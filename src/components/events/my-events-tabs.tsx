"use client";

import { useState } from "react";

import { cn } from "@/lib/utils";

/**
 * Client tab switcher for /my-events. Both panels are server-rendered and
 * passed as children; this only toggles visibility so there's no client fetch.
 */
export function MyEventsTabs({
  attending,
  hosting,
  defaultTab = "attending",
}: {
  attending: React.ReactNode;
  hosting: React.ReactNode;
  defaultTab?: "attending" | "hosting";
}) {
  const [tab, setTab] = useState<"attending" | "hosting">(defaultTab);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 rounded-full border border-border bg-muted/30 p-1">
        <button
          type="button"
          onClick={() => setTab("attending")}
          className={cn(
            "h-10 rounded-full text-sm font-medium transition-colors",
            tab === "attending"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground",
          )}
        >
          شرکت می‌کنم
        </button>
        <button
          type="button"
          onClick={() => setTab("hosting")}
          className={cn(
            "h-10 rounded-full text-sm font-medium transition-colors",
            tab === "hosting"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground",
          )}
        >
          میزبانی می‌کنم
        </button>
      </div>

      <div className={tab === "attending" ? "block" : "hidden"}>{attending}</div>
      <div className={tab === "hosting" ? "block" : "hidden"}>{hosting}</div>
    </div>
  );
}
