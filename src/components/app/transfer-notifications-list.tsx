"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useFormStatus } from "react-dom";
import { ArrowRightLeftIcon, Loader2Icon } from "lucide-react";
import { toast } from "sonner";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { KioarAvatar } from "@/components/shared/kioar-avatar";
import { Button } from "@/components/ui/button";
import {
  acceptTransferAction,
  rejectTransferAction,
  type SimpleActionState,
} from "@/app/(app)/account/transfer-actions";
import { toPersianDigits } from "@/lib/date/persian";
import { formatPhoneDisplay } from "@/lib/phone";

export type TransferNotification = {
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

export function TransferNotificationsList({
  transfers,
}: {
  transfers: TransferNotification[];
}) {
  if (transfers.length === 0) return null;

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold">درخواست‌های انتقال صفحه</h2>
      <div className="flex flex-col gap-2.5">
        {transfers.map((t) => (
          <TransferNotificationRow key={t.id} transfer={t} />
        ))}
      </div>
    </section>
  );
}

function TransferNotificationRow({
  transfer,
}: {
  transfer: TransferNotification;
}) {
  const router = useRouter();
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
      router.refresh();
    } else if (acceptState.status === "error" && acceptState.message) {
      toast.error(acceptState.message);
    }
  }, [acceptState, router]);

  useEffect(() => {
    if (rejectState.status === "success") {
      toast.success(rejectState.message ?? "درخواست رد شد.");
      router.refresh();
    } else if (rejectState.status === "error" && rejectState.message) {
      toast.error(rejectState.message);
    }
  }, [rejectState, router]);

  const label = transfer.page?.label ?? "یک صفحه";

  return (
    <div className="space-y-3 rounded-2xl bg-white p-4 ring-1 ring-zinc-200">
      <div className="flex items-center gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <ArrowRightLeftIcon className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">درخواست انتقال صفحه</p>
          <p className="text-xs text-muted-foreground">
            {transfer.fromPhone ? (
              <>
                از{" "}
                <span dir="ltr" className="font-mono">
                  {toPersianDigits(formatPhoneDisplay(transfer.fromPhone))}
                </span>
              </>
            ) : (
              "یک کاربر"
            )}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3 rounded-xl bg-muted p-3">
        <Avatar className="size-10 shrink-0 rounded-full">
          {transfer.page?.avatarUrl ? (
            <AvatarImage src={transfer.page.avatarUrl} alt={label} />
          ) : null}
          <AvatarFallback>
            <KioarAvatar
              seed={transfer.page?.avatarSeed ?? transfer.page?.slug ?? "kioar"}
              size={40}
            />
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold">{label}</p>
          {transfer.page?.slug ? (
            <p dir="ltr" className="truncate font-mono text-xs text-muted-foreground">
              /{transfer.page.slug}
            </p>
          ) : null}
        </div>
      </div>

      <div className="flex gap-2">
        <form action={acceptAction} className="flex-1">
          <input type="hidden" name="transferId" value={transfer.id} />
          <RowButton variant="primary" idleLabel="تأیید" pendingLabel="در حال انتقال…" />
        </form>
        <form action={rejectAction} className="flex-1">
          <input type="hidden" name="transferId" value={transfer.id} />
          <RowButton variant="outline" idleLabel="رد کردن" pendingLabel="در حال رد…" />
        </form>
      </div>
    </div>
  );
}

function RowButton({
  variant,
  idleLabel,
  pendingLabel,
}: {
  variant: "primary" | "outline";
  idleLabel: string;
  pendingLabel: string;
}) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant={variant === "outline" ? "outline" : undefined}
      disabled={pending}
      className="h-11 w-full rounded-full text-sm font-bold"
    >
      {pending ? (
        <>
          <Loader2Icon className="size-4 animate-spin" />
          {pendingLabel}
        </>
      ) : (
        idleLabel
      )}
    </Button>
  );
}
