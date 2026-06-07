"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { BanIcon, RotateCcwIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  deleteEventAction,
  setEventStatusAction,
} from "@/app/(app)/my-events/actions";

/**
 * Host lifecycle controls for an event: cancel / re-open (un-cancel) / delete.
 * Publish & unpublish live in the form's publish-on-save toggle; this covers
 * the post-publish actions. Delete confirms and warns when registrants exist.
 */
export function EventHostActions({
  eventId,
  status,
  registrantCount,
}: {
  eventId: string;
  status: "draft" | "published" | "cancelled";
  registrantCount: number;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function setStatus(next: "published" | "cancelled", confirmMsg?: string) {
    if (confirmMsg && !window.confirm(confirmMsg)) return;
    const fd = new FormData();
    fd.set("eventId", eventId);
    fd.set("status", next);
    start(async () => {
      const res = await setEventStatusAction(
        { status: "idle" },
        fd,
      );
      if (res.status === "error") {
        toast.error(res.message ?? "تغییر وضعیت ناموفق بود.");
      } else {
        toast.success(next === "cancelled" ? "رویداد لغو شد." : "رویداد بازگشایی شد.");
        router.refresh();
      }
    });
  }

  function remove() {
    const warning =
      registrantCount > 0
        ? `این رویداد ${registrantCount} ثبت‌نام دارد. با حذف، همهٔ ثبت‌نام‌ها هم پاک می‌شوند. مطمئن هستید؟`
        : "این رویداد حذف شود؟ این کار قابل بازگشت نیست.";
    if (!window.confirm(warning)) return;
    const fd = new FormData();
    fd.set("eventId", eventId);
    start(async () => {
      // deleteEventAction redirects to /my-events on success; a returned value
      // means it errored before redirecting.
      const res = await deleteEventAction({ status: "idle" }, fd);
      if (res?.status === "error") {
        toast.error(res.message ?? "حذف ناموفق بود.");
      }
    });
  }

  return (
    <div className="flex flex-wrap gap-2">
      {status !== "cancelled" ? (
        <Button
          type="button"
          variant="outline"
          className="h-11 text-amber-700"
          disabled={pending}
          onClick={() =>
            setStatus(
              "cancelled",
              registrantCount > 0
                ? `این رویداد ${registrantCount} ثبت‌نام دارد. با لغو، رویداد از صفحهٔ عمومی برداشته می‌شود. ادامه؟`
                : "این رویداد لغو شود؟",
            )
          }
        >
          <BanIcon className="size-4" />
          لغو رویداد
        </Button>
      ) : (
        <Button
          type="button"
          variant="outline"
          className="h-11"
          disabled={pending}
          onClick={() => setStatus("published")}
        >
          <RotateCcwIcon className="size-4" />
          بازگشایی رویداد
        </Button>
      )}

      <Button
        type="button"
        variant="outline"
        className="h-11 text-rose-600"
        disabled={pending}
        onClick={remove}
      >
        <Trash2Icon className="size-4" />
        حذف
      </Button>
    </div>
  );
}
