"use client";

import { useActionState, useState } from "react";

import {
  advanceStatusAction,
  assignCardAction,
  disableCardAction,
  markNfcStepAction,
  type AdminCardState,
} from "@/app/admin/cards/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const idle: AdminCardState = { status: "idle" };

const NEXT_STATUS: Record<string, { value: string; label: string }[]> = {
  paid: [{ value: "processing", label: "شروع آماده‌سازی" }],
  processing: [{ value: "shipped", label: "ارسال شد" }],
  shipped: [{ value: "fulfilled", label: "تحویل شد" }],
};

/** Scan/enter a printed card id to assign it to an order. */
export function AssignCardForm({ orderId }: { orderId: string }) {
  const [state, formAction] = useActionState(assignCardAction, idle);
  return (
    <form action={formAction} className="flex flex-col gap-1.5">
      <input type="hidden" name="orderId" value={orderId} />
      <div className="flex gap-1.5">
        <Input
          name="cardId"
          placeholder="شناسهٔ کارت"
          dir="ltr"
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          className="h-9 w-28 font-mono text-xs"
        />
        <Button type="submit" size="sm" className="h-9">
          تخصیص
        </Button>
      </div>
      {state.status === "error" && state.message ? (
        <span className="text-xs text-destructive">{state.message}</span>
      ) : null}
      {state.status === "ok" && state.message ? (
        <span className="text-xs text-emerald-600">{state.message}</span>
      ) : null}
    </form>
  );
}

/** Write → lock NFC checklist (write must come before lock). */
export function NfcChecklist({
  cardId,
  written,
  locked,
}: {
  cardId: string;
  written: boolean;
  locked: boolean;
}) {
  return (
    <div className="mt-1 flex flex-wrap items-center gap-1.5">
      <form action={markNfcStepAction}>
        <input type="hidden" name="cardId" value={cardId} />
        <input type="hidden" name="step" value="written" />
        <StepButton done={written} disabled={written}>
          نوشتن چیپ
        </StepButton>
      </form>
      <form action={markNfcStepAction}>
        <input type="hidden" name="cardId" value={cardId} />
        <input type="hidden" name="step" value="locked" />
        <StepButton done={locked} disabled={!written || locked}>
          قفل
        </StepButton>
      </form>
    </div>
  );
}

function StepButton({
  done,
  disabled,
  children,
}: {
  done: boolean;
  disabled: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="submit"
      disabled={disabled}
      className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors ${
        done
          ? "bg-emerald-100 text-emerald-700"
          : disabled
            ? "cursor-not-allowed bg-muted text-muted-foreground/50"
            : "bg-foreground text-background hover:opacity-90"
      }`}
    >
      {done ? `✓ ${children}` : children}
    </button>
  );
}

/** Advance order status + disable-card escape hatch. */
export function OrderStatusControl({
  orderId,
  current,
}: {
  orderId: string;
  current: string;
}) {
  const options = NEXT_STATUS[current] ?? [];
  return (
    <div className="flex flex-col gap-1.5">
      {options.map((opt) => (
        <form key={opt.value} action={advanceStatusAction}>
          <input type="hidden" name="orderId" value={orderId} />
          <input type="hidden" name="status" value={opt.value} />
          <Button type="submit" size="sm" variant="outline" className="h-8 w-full">
            {opt.label}
          </Button>
        </form>
      ))}
      {current !== "cancelled" && current !== "fulfilled" ? (
        <form action={advanceStatusAction}>
          <input type="hidden" name="orderId" value={orderId} />
          <input type="hidden" name="status" value="cancelled" />
          <button
            type="submit"
            className="text-xs text-muted-foreground hover:text-destructive"
          >
            لغو سفارش
          </button>
        </form>
      ) : null}
    </div>
  );
}

/** Disable a card by id (used on the inventory page). */
export function DisableCardButton({ cardId }: { cardId: string }) {
  const [confirming, setConfirming] = useState(false);
  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="text-xs text-muted-foreground hover:text-destructive"
      >
        غیرفعال‌سازی
      </button>
    );
  }
  return (
    <form action={disableCardAction} className="flex items-center gap-1">
      <input type="hidden" name="cardId" value={cardId} />
      <button type="submit" className="text-xs font-medium text-destructive">
        تأیید
      </button>
      <button
        type="button"
        onClick={() => setConfirming(false)}
        className="text-xs text-muted-foreground"
      >
        انصراف
      </button>
    </form>
  );
}
