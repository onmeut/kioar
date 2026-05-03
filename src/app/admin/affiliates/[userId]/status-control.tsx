"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { setStatusAction } from "@/app/admin/affiliates/actions";

const NEXT: Record<string, { status: string; label: string; cls: string }[]> = {
  active: [
    {
      status: "paused",
      label: "توقف موقت",
      cls: "border-amber-300 text-amber-800 hover:bg-amber-50",
    },
    {
      status: "banned",
      label: "محروم",
      cls: "border-rose-300 text-rose-800 hover:bg-rose-50",
    },
  ],
  paused: [
    {
      status: "active",
      label: "فعال‌سازی",
      cls: "border-emerald-300 text-emerald-800 hover:bg-emerald-50",
    },
    {
      status: "banned",
      label: "محروم",
      cls: "border-rose-300 text-rose-800 hover:bg-rose-50",
    },
  ],
  banned: [
    {
      status: "active",
      label: "بازفعال‌سازی",
      cls: "border-emerald-300 text-emerald-800 hover:bg-emerald-50",
    },
  ],
};

export function StatusControl({
  affiliateUserId,
  currentStatus,
}: {
  affiliateUserId: string;
  currentStatus: "active" | "paused" | "banned";
}) {
  const [pending, startTransition] = useTransition();
  const [target, setTarget] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  const submit = () => {
    if (!target) return;
    if (reason.trim().length < 3) {
      alert("دلیل تغییر وضعیت رو ثبت کن.");
      return;
    }
    const fd = new FormData();
    fd.set("affiliateUserId", affiliateUserId);
    fd.set("status", target);
    fd.set("reason", reason.trim());
    startTransition(() => setStatusAction(fd));
    setTarget(null);
    setReason("");
  };

  if (target) {
    return (
      <div className="flex w-full max-w-md flex-col gap-2">
        <input
          type="text"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="دلیل تغییر وضعیت…"
          className="h-10 rounded-xl border border-border bg-background px-3 text-[13px] outline-none focus:border-foreground/50"
        />
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setTarget(null);
              setReason("");
            }}
          >
            انصراف
          </Button>
          <Button type="button" size="sm" disabled={pending} onClick={submit}>
            ثبت
          </Button>
        </div>
      </div>
    );
  }

  const options = NEXT[currentStatus] ?? [];
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <Button
          key={o.status}
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setTarget(o.status)}
          className={o.cls}
        >
          {o.label}
        </Button>
      ))}
    </div>
  );
}
