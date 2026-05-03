"use client";

/**
 * Phase 12 — cancel-confirm client island.
 *
 * Shows the user *exactly* what cancelling means (in Persian, end-of-period
 * semantics) and POSTs to `/api/billing/cancel` with explicit double-tap
 * confirmation. Includes a reactivate button for the case where they
 * arrived here already-cancelled and want to undo.
 */
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { Loader2Icon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

type Props = {
  pageId: string;
  alreadyCancelled: boolean;
  postCancelHref: Route;
};

export function CancelConfirmActions({
  pageId,
  alreadyCancelled,
  postCancelHref,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [confirmed, setConfirmed] = useState(false);

  const cancel = () => {
    startTransition(async () => {
      try {
        const res = await fetch("/api/billing/cancel", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ pageId }),
        });
        const data = (await res.json().catch(() => null)) as
          | { ok: true }
          | { error: string }
          | null;
        if (!res.ok || !data || (data as { ok?: boolean }).ok !== true) {
          const code = (data && "error" in data && data.error) || "unknown";
          toast.error(`عملیات انجام نشد: ${code}`);
          return;
        }
        toast.success("لغو در پایان دوره ثبت شد.");
        router.push(postCancelHref);
        router.refresh();
      } catch (err) {
        toast.error(`ارتباط با سرور برقرار نشد: ${(err as Error).message}`);
      }
    });
  };

  const reactivate = () => {
    startTransition(async () => {
      try {
        const res = await fetch("/api/billing/reactivate", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ pageId }),
        });
        const data = (await res.json().catch(() => null)) as
          | { ok: true }
          | { error: string }
          | null;
        if (!res.ok || !data || (data as { ok?: boolean }).ok !== true) {
          const code = (data && "error" in data && data.error) || "unknown";
          toast.error(`عملیات انجام نشد: ${code}`);
          return;
        }
        toast.success("اشتراک شما دوباره فعال شد.");
        router.push(postCancelHref);
        router.refresh();
      } catch (err) {
        toast.error(`ارتباط با سرور برقرار نشد: ${(err as Error).message}`);
      }
    });
  };

  if (alreadyCancelled) {
    return (
      <Button
        type="button"
        className="h-12 w-full"
        disabled={isPending}
        onClick={reactivate}
      >
        {isPending ? <Loader2Icon className="size-4 animate-spin" /> : "فعال‌سازی مجدد اشتراک"}
      </Button>
    );
  }

  return (
    <div className="space-y-3">
      <label className="flex items-start gap-3 rounded-xl border border-zinc-200 bg-white p-3 text-[13px] text-zinc-700 has-[:checked]:border-foreground has-[:checked]:bg-zinc-50">
        <input
          type="checkbox"
          className="mt-0.5 size-4 cursor-pointer accent-foreground"
          checked={confirmed}
          onChange={(e) => setConfirmed(e.target.checked)}
        />
        <span>
          متوجه‌ام که با لغو، در پایان دوره دسترسی به امکانات پلن فعلی روی این
          صفحه قطع می‌شود و اطلاعات قفل‌شده تنها پس از ارتقای مجدد قابل
          نمایش‌اند.
        </span>
      </label>

      <Button
        type="button"
        variant="outline"
        className="h-12 w-full border-red-200 text-red-700 hover:bg-red-50 hover:text-red-700"
        disabled={!confirmed || isPending}
        onClick={cancel}
      >
        {isPending ? (
          <Loader2Icon className="size-4 animate-spin" />
        ) : (
          "لغو اشتراک در پایان دوره"
        )}
      </Button>
    </div>
  );
}
