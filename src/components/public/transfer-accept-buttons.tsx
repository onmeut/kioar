"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useFormStatus } from "react-dom";
import { Loader2Icon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  acceptTransferAction,
  rejectTransferAction,
  type SimpleActionState,
} from "@/app/(app)/account/transfer-actions";

const idle: SimpleActionState = { status: "idle" };

/**
 * Inline accept/reject for the public /transfer/[token] landing when the
 * visitor is already logged in with the matching phone. The token is passed
 * (not a transferId) since this is the public-link path; the server action
 * re-asserts the phone match regardless.
 */
export function TransferAcceptButtons({ token }: { token: string }) {
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
      router.push("/account");
    } else if (acceptState.status === "error" && acceptState.message) {
      toast.error(acceptState.message);
    }
  }, [acceptState, router]);

  useEffect(() => {
    if (rejectState.status === "success") {
      toast.success(rejectState.message ?? "درخواست رد شد.");
      router.push("/me");
    } else if (rejectState.status === "error" && rejectState.message) {
      toast.error(rejectState.message);
    }
  }, [rejectState, router]);

  return (
    <div className="flex w-full flex-col gap-2">
      <form action={acceptAction}>
        <input type="hidden" name="token" value={token} />
        <AcceptButton />
      </form>
      <form action={rejectAction}>
        <input type="hidden" name="token" value={token} />
        <RejectButton />
      </form>
    </div>
  );
}

function AcceptButton() {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      size="lg"
      disabled={pending}
      className="h-12 w-full rounded-full text-[15px] font-bold"
    >
      {pending ? (
        <>
          <Loader2Icon className="size-4 animate-spin" />
          در حال انتقال…
        </>
      ) : (
        "تأیید و دریافت صفحه"
      )}
    </Button>
  );
}

function RejectButton() {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant="outline"
      size="lg"
      disabled={pending}
      className="h-12 w-full rounded-full text-[15px] font-bold"
    >
      {pending ? (
        <>
          <Loader2Icon className="size-4 animate-spin" />
          در حال رد…
        </>
      ) : (
        "رد کردن"
      )}
    </Button>
  );
}
