"use client";

import { useActionState, useEffect, useRef, useState } from "react";

import {
  flushSmsQueueAction,
  purgeStaleQueuedAction,
  resetStuckSendingAction,
} from "@/app/admin/sms/actions";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import { idleState } from "@/lib/action-state";
import { formatPersianDateTime, toPersianDigits } from "@/lib/persian";
import { cn } from "@/lib/utils";

type BreakdownEntry = {
  templateKey: string;
  count: number;
  oldestCreatedAtIso: string;
};

type Props = {
  queuedCount: number;
  sendingCount: number;
  queuedBreakdown: BreakdownEntry[];
};

// Client-side cooldown after a flush click. The worker itself throttles
// outbound calls, but this also prevents accidental double-fires and
// gives the page revalidation time to land.
const FLUSH_COOLDOWN_MS = 3000;

export function SmsQueueControls({
  queuedCount,
  sendingCount,
  queuedBreakdown,
}: Props) {
  const [flushState, flushAction, flushPending] = useActionState(
    flushSmsQueueAction,
    idleState,
  );
  const [resetState, resetAction, resetPending] = useActionState(
    resetStuckSendingAction,
    idleState,
  );
  const [purgeState, purgeAction, purgePending] = useActionState(
    purgeStaleQueuedAction,
    idleState,
  );

  const flushFormRef = useRef<HTMLFormElement | null>(null);
  const resetFormRef = useRef<HTMLFormElement | null>(null);
  const purgeFormRef = useRef<HTMLFormElement | null>(null);
  // cooldownLeft is in ms. State, not derived, so render is pure.
  const [cooldownLeft, setCooldownLeft] = useState(0);
  const [purgeDays, setPurgeDays] = useState(3);

  // When a flush success arrives, (re)start the cooldown timer.
  const lastHandledRef = useRef<typeof flushState | null>(null);
  useEffect(() => {
    if (flushState.status !== "success") return;
    if (lastHandledRef.current === flushState) return;
    lastHandledRef.current = flushState;
    const deadline = Date.now() + FLUSH_COOLDOWN_MS;
    setCooldownLeft(FLUSH_COOLDOWN_MS);
    const handle = setInterval(() => {
      const left = deadline - Date.now();
      if (left <= 0) {
        setCooldownLeft(0);
        clearInterval(handle);
      } else {
        setCooldownLeft(left);
      }
    }, 250);
    return () => clearInterval(handle);
  }, [flushState]);

  const flushDisabled =
    flushPending || queuedCount === 0 || cooldownLeft > 0;
  const cooldownSeconds = Math.ceil(cooldownLeft / 1000);

  const oldestEntry =
    queuedBreakdown.length > 0
      ? queuedBreakdown.reduce((acc, row) =>
          row.oldestCreatedAtIso < acc.oldestCreatedAtIso ? row : acc,
        )
      : null;

  return (
    <div className="flex flex-col items-end gap-3">
      {/* Manual flush */}
      <form
        ref={flushFormRef}
        action={flushAction}
        className="flex flex-col items-end gap-1.5"
      >
        <ConfirmDialog
          title="ارسال دستی ۵۰ پیام بعدی؟"
          description={
            queuedBreakdown.length === 0
              ? "هیچ پیامی در صف نیست."
              : `${toPersianDigits(queuedCount)} پیام در صف است. در این کلیک حداکثر ۵۰ پیام ارسال می‌شود. بعد از تأیید، تفکیک تمپلیت‌ها در پایین قابل مرور است.`
          }
          confirmLabel="ارسال کن"
          onConfirm={() => flushFormRef.current?.requestSubmit()}
        >
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={flushDisabled}
          >
            {flushPending
              ? "در حال پردازش…"
              : cooldownLeft > 0
                ? `صبر کنید (${toPersianDigits(cooldownSeconds)} ثانیه)`
                : `ارسال دستی (${toPersianDigits(queuedCount)} در صف)`}
          </Button>
        </ConfirmDialog>
        {flushState.message ? (
          <p
            className={cn(
              "text-xs",
              flushState.status === "success"
                ? "text-emerald-600"
                : "text-rose-600",
            )}
          >
            {flushState.message}
          </p>
        ) : null}
      </form>

      {/* Reset stuck */}
      {sendingCount > 0 ? (
        <form
          ref={resetFormRef}
          action={resetAction}
          className="flex flex-col items-end gap-1.5"
        >
          <ConfirmDialog
            title="بازنشانی پیام‌های گیر کرده؟"
            description="فقط پیام‌هایی که بیش از ۵ دقیقه در حالت «در حال ارسال» مانده‌اند به صف بازمی‌گردند تا از ارسال تکراری جلوگیری شود."
            confirmLabel="بازنشانی کن"
            onConfirm={() => resetFormRef.current?.requestSubmit()}
          >
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={resetPending}
            >
              {resetPending
                ? "در حال بازنشانی…"
                : `بازنشانی گیر کرده (${toPersianDigits(sendingCount)})`}
            </Button>
          </ConfirmDialog>
          {resetState.message ? (
            <p
              className={cn(
                "text-xs",
                resetState.status === "success"
                  ? "text-emerald-600"
                  : "text-rose-600",
              )}
            >
              {resetState.message}
            </p>
          ) : null}
        </form>
      ) : null}

      {/* Purge stale queued */}
      {queuedCount > 0 ? (
        <form
          ref={purgeFormRef}
          action={purgeAction}
          className="flex flex-col items-end gap-1.5"
        >
          <input type="hidden" name="olderThanDays" value={purgeDays} />
          <div className="flex items-center gap-2">
            <label
              className="text-xs text-muted-foreground"
              htmlFor="purge-days"
            >
              قدیمی‌تر از
            </label>
            <input
              id="purge-days"
              type="number"
              min={1}
              max={365}
              inputMode="numeric"
              value={purgeDays}
              onChange={(e) => {
                const v = Number(e.target.value);
                if (Number.isFinite(v) && v >= 1 && v <= 365) {
                  setPurgeDays(Math.floor(v));
                }
              }}
              className="h-9 w-16 rounded-md border border-input bg-background px-2 text-sm"
              dir="ltr"
            />
            <span className="text-xs text-muted-foreground">روز</span>
            <ConfirmDialog
              title="علامت‌گذاری پیام‌های قدیمی به‌عنوان منقضی؟"
              description={`همه پیام‌های «در صف» قدیمی‌تر از ${toPersianDigits(purgeDays)} روز به «ناموفق» با دلیل stale_backlog علامت می‌خورند و ارسال نمی‌شوند. این عملیات قابل بازگشت نیست.`}
              confirmLabel="علامت بزن"
              destructive
              onConfirm={() => purgeFormRef.current?.requestSubmit()}
            >
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={purgePending}
              >
                {purgePending
                  ? "در حال علامت‌گذاری…"
                  : "علامت‌گذاری به‌عنوان منقضی"}
              </Button>
            </ConfirmDialog>
          </div>
          {purgeState.message ? (
            <p
              className={cn(
                "text-xs",
                purgeState.status === "success"
                  ? "text-emerald-600"
                  : "text-rose-600",
              )}
            >
              {purgeState.message}
            </p>
          ) : null}
        </form>
      ) : null}

      {/* Breakdown preview */}
      {queuedBreakdown.length > 0 ? (
        <details className="w-full max-w-md rounded-2xl border border-border bg-card p-3 text-xs">
          <summary className="cursor-pointer font-medium">
            تفکیک صف (
            {toPersianDigits(queuedBreakdown.length)} تمپلیت)
            {oldestEntry ? (
              <span className="ms-2 text-muted-foreground">
                · قدیمی‌ترین:{" "}
                {formatPersianDateTime(new Date(oldestEntry.oldestCreatedAtIso))}
              </span>
            ) : null}
          </summary>
          <ul className="mt-2 space-y-1">
            {queuedBreakdown.map((row) => (
              <li
                key={row.templateKey}
                className="flex items-center justify-between gap-2"
              >
                <span dir="ltr" className="font-mono">
                  {row.templateKey}
                </span>
                <span className="text-muted-foreground">
                  {toPersianDigits(row.count)} · از{" "}
                  {formatPersianDateTime(new Date(row.oldestCreatedAtIso))}
                </span>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}
