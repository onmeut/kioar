"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { ArrowRightLeftIcon, Loader2Icon } from "lucide-react";
import { toast } from "sonner";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { KioarAvatar } from "@/components/shared/kioar-avatar";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  acceptTransferAction,
  rejectTransferAction,
  type SimpleActionState,
} from "@/app/(app)/account/transfer-actions";
import { toPersianDigits } from "@/lib/date/persian";
import { formatPhoneDisplay } from "@/lib/phone";

export type PendingTransfer = {
  id: string;
  fromPhone: string | null;
  page: {
    slug: string;
    label: string;
    avatarUrl: string | null;
    avatarSeed: string | null;
  } | null;
};

const idle: SimpleActionState = { status: "idle" };

/**
 * Surfaces incoming page-transfer offers as a bottom sheet on app open.
 *
 * The layout fetches pending transfers (matched by the viewer's phone) and
 * passes them here. We show the newest one; accepting/rejecting it advances
 * to the next. A `localStorage` "snoozed" set lets the user dismiss without
 * acting for the rest of the session — but a fresh load re-surfaces anything
 * still pending, matching the "prompt on next open" behaviour.
 */
export function TransferPrompt({
  transfers,
}: {
  transfers: PendingTransfer[];
}) {
  const [snoozed, setSnoozed] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState(false);

  // Resolve the first transfer not snoozed this session.
  const active = transfers.find((t) => !snoozed.has(t.id)) ?? null;

  useEffect(() => {
    setOpen(Boolean(active));
  }, [active]);

  const [acceptState, acceptAction] = useActionState(
    acceptTransferAction,
    idle,
  );
  const [rejectState, rejectAction] = useActionState(
    rejectTransferAction,
    idle,
  );

  useEffect(() => {
    if (acceptState.status === "success") {
      toast.success(acceptState.message ?? "صفحه منتقل شد.");
    } else if (acceptState.status === "error" && acceptState.message) {
      toast.error(acceptState.message);
    }
  }, [acceptState]);

  useEffect(() => {
    if (rejectState.status === "error" && rejectState.message) {
      toast.error(rejectState.message);
    }
  }, [rejectState]);

  if (!active) return null;

  const label = active.page?.label ?? "یک صفحه";

  function snooze() {
    if (!active) return;
    setSnoozed((prev) => new Set(prev).add(active.id));
    setOpen(false);
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) snooze();
        else setOpen(true);
      }}
    >
      <SheetContent side="bottom" className="rounded-t-3xl">
        <SheetHeader className="items-center text-center">
          <span className="mb-1 flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <ArrowRightLeftIcon className="size-6" />
          </span>
          <SheetTitle>درخواست انتقال صفحه</SheetTitle>
          <SheetDescription>
            {active.fromPhone ? (
              <>
                صاحب شماره{" "}
                <span dir="ltr" className="font-mono font-semibold">
                  {toPersianDigits(formatPhoneDisplay(active.fromPhone))}
                </span>{" "}
                می‌خواهد مالکیت یک صفحه را به شما منتقل کند.
              </>
            ) : (
              "یک نفر می‌خواهد مالکیت یک صفحه را به شما منتقل کند."
            )}
          </SheetDescription>
        </SheetHeader>

        {/* Page preview */}
        <div className="mx-auto my-2 flex w-full max-w-sm items-center gap-3 rounded-2xl bg-muted p-4">
          <Avatar className="size-12 shrink-0 rounded-full">
            {active.page?.avatarUrl ? (
              <AvatarImage src={active.page.avatarUrl} alt={label} />
            ) : null}
            <AvatarFallback>
              <KioarAvatar
                seed={active.page?.avatarSeed ?? active.page?.slug ?? "kioar"}
                size={48}
              />
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold">{label}</p>
            {active.page?.slug ? (
              <p dir="ltr" className="truncate font-mono text-xs text-muted-foreground">
                /{active.page.slug}
              </p>
            ) : null}
          </div>
        </div>

        <p className="px-1 text-center text-[11px] leading-5 text-muted-foreground">
          با تأیید، صفحه و پلن فعال آن به حساب شما اضافه می‌شود. فاکتورهای فرستنده
          نزد خودش باقی می‌ماند.
        </p>

        <div className="mt-3 flex flex-col gap-2 sm:flex-row-reverse">
          <form action={acceptAction} className="sm:flex-1">
            <input type="hidden" name="transferId" value={active.id} />
            <AcceptButton />
          </form>
          <form action={rejectAction} className="sm:flex-1">
            <input type="hidden" name="transferId" value={active.id} />
            <RejectButton />
          </form>
        </div>

        <button
          type="button"
          onClick={snooze}
          className="mt-1 w-full py-2 text-center text-xs text-muted-foreground hover:text-foreground"
        >
          بعداً تصمیم می‌گیرم
        </button>
      </SheetContent>
    </Sheet>
  );
}

function AcceptButton() {
  return (
    <Button type="submit" className="h-12 w-full rounded-full text-sm font-bold">
      <PendingLabel idleLabel="تأیید و دریافت صفحه" pendingLabel="در حال انتقال…" />
    </Button>
  );
}

function RejectButton() {
  return (
    <Button
      type="submit"
      variant="outline"
      className="h-12 w-full rounded-full text-sm font-bold"
    >
      <PendingLabel idleLabel="رد کردن" pendingLabel="در حال رد…" />
    </Button>
  );
}

function PendingLabel({
  idleLabel,
  pendingLabel,
}: {
  idleLabel: string;
  pendingLabel: string;
}) {
  // Read inside the <form> via the Button child — useFormStatus reports the
  // enclosing form's submission state.
  const { pending } = useFormStatus();
  return pending ? (
    <>
      <Loader2Icon className="size-4 animate-spin" />
      {pendingLabel}
    </>
  ) : (
    <>{idleLabel}</>
  );
}
