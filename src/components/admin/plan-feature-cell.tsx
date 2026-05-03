"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2Icon } from "lucide-react";

import { adminTogglePlanFeatureAction } from "@/app/admin/plans/actions";
import { Switch } from "@/components/ui/switch";

type Props = {
  planId: string;
  featureId: string;
  enabled: boolean;
  limitValue: number | null;
  hasLimit: boolean;
};

export function PlanFeatureCell({
  planId,
  featureId,
  enabled: initialEnabled,
  limitValue: initialLimit,
  hasLimit,
}: Props) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [limit, setLimit] = useState<string>(
    initialLimit === null ? "" : String(initialLimit),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const limitRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setEnabled(initialEnabled);
  }, [initialEnabled]);
  useEffect(() => {
    setLimit(initialLimit === null ? "" : String(initialLimit));
  }, [initialLimit]);

  async function commit(nextEnabled: boolean, nextLimit: string) {
    setBusy(true);
    setError(null);
    const fd = new FormData();
    fd.set("planId", planId);
    fd.set("featureId", featureId);
    fd.set("enabled", nextEnabled ? "true" : "false");
    fd.set("limitValue", nextLimit);
    try {
      const result = await adminTogglePlanFeatureAction(
        { status: "idle" } as never,
        fd,
      );
      if (result.status === "error") setError(result.message ?? "خطا.");
    } catch {
      setError("خطا در ذخیره.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex items-center gap-2">
        {busy ? (
          <Loader2Icon className="size-3 animate-spin text-muted-foreground" />
        ) : null}
        <Switch
          checked={enabled}
          onCheckedChange={(c) => {
            setEnabled(c);
            void commit(c, limit);
          }}
        />
      </div>
      {hasLimit && enabled ? (
        <input
          ref={limitRef}
          type="number"
          inputMode="numeric"
          dir="ltr"
          value={limit}
          onChange={(e) => setLimit(e.target.value)}
          onBlur={() => {
            if (
              (limit === "" ? null : Number(limit)) !==
              (initialLimit === null ? null : initialLimit)
            ) {
              void commit(true, limit);
            }
          }}
          className="h-8 w-20 rounded-lg border border-border bg-background px-2 text-center font-mono text-xs"
          placeholder="∞"
        />
      ) : null}
      {error ? <p className="text-[10px] text-destructive">{error}</p> : null}
    </div>
  );
}
