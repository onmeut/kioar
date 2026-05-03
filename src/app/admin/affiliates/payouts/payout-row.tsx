"use client";

import { useState, useTransition } from "react";

import { CheckIcon, CopyIcon, Loader2Icon, XIcon } from "lucide-react";

import {
  payoutMarkPaidAction,
  payoutMarkProcessingAction,
  payoutRejectAction,
} from "@/app/admin/affiliates/actions";
import { Button } from "@/components/ui/button";

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  requested: {
    label: "ارسال‌شده",
    cls: "bg-violet-500/15 text-violet-700",
  },
  processing: {
    label: "در حال پردازش",
    cls: "bg-amber-500/15 text-amber-700",
  },
  paid: {
    label: "پرداخت‌شده",
    cls: "bg-emerald-500/15 text-emerald-700",
  },
  rejected: { label: "رد شده", cls: "bg-rose-500/15 text-rose-700" },
};

type Mode = null | "paid" | "reject";

export function PayoutRow({
  payout,
}: {
  payout: {
    id: string;
    status: "requested" | "processing" | "paid" | "rejected";
    sheba: string;
    holder: string;
    nationalId: string | null;
    ref: string | null;
    rejected: string | null;
  };
}) {
  const [mode, setMode] = useState<Mode>(null);
  const [text, setText] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const v = STATUS_LABEL[payout.status];

  const copy = async (label: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      // ignore
    }
  };

  const onProcessing = () => {
    const fd = new FormData();
    fd.set("payoutId", payout.id);
    startTransition(() => payoutMarkProcessingAction(fd));
  };

  const submitText = () => {
    if (text.trim().length < 3) {
      alert("متن خیلی کوتاهه.");
      return;
    }
    const fd = new FormData();
    fd.set("payoutId", payout.id);
    if (mode === "paid") {
      fd.set("transactionRef", text.trim());
      startTransition(() => payoutMarkPaidAction(fd));
    } else if (mode === "reject") {
      fd.set("reason", text.trim());
      startTransition(() => payoutRejectAction(fd));
    }
    setMode(null);
    setText("");
  };

  return (
    <div className="mt-4 space-y-3">
      <span
        className={`inline-block rounded-full px-2.5 py-1 text-[10px] font-bold ${v.cls}`}
      >
        {v.label}
      </span>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <CopyField
          label="شبا"
          value={payout.sheba}
          mono
          onCopy={() => copy("sheba", payout.sheba)}
          copied={copied === "sheba"}
        />
        <CopyField
          label="صاحب حساب"
          value={payout.holder}
          onCopy={() => copy("holder", payout.holder)}
          copied={copied === "holder"}
        />
        {payout.nationalId ? (
          <CopyField
            label="کد ملی"
            value={payout.nationalId}
            mono
            onCopy={() => copy("nid", payout.nationalId!)}
            copied={copied === "nid"}
          />
        ) : null}
        {payout.ref ? (
          <CopyField
            label="کد پیگیری"
            value={payout.ref}
            mono
            onCopy={() => copy("ref", payout.ref!)}
            copied={copied === "ref"}
          />
        ) : null}
      </div>

      {payout.rejected ? (
        <p className="rounded-xl bg-rose-50 px-3 py-2 text-[12px] leading-6 text-rose-900">
          <span className="font-bold">دلیل رد:</span> {payout.rejected}
        </p>
      ) : null}

      {mode ? (
        <div className="space-y-2">
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={
              mode === "paid"
                ? "کد رهگیری بانکی…"
                : "دلیل رد (برای همکار پیامک می‌شه)…"
            }
            className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-[13px] outline-none focus:border-foreground/50"
            dir={mode === "paid" ? "ltr" : "rtl"}
          />
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setMode(null);
                setText("");
              }}
            >
              انصراف
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={pending}
              onClick={submitText}
            >
              {pending ? (
                <Loader2Icon className="size-3.5 animate-spin" />
              ) : null}
              تأیید
            </Button>
          </div>
        </div>
      ) : (
        payout.status !== "paid" &&
        payout.status !== "rejected" && (
          <div className="flex flex-wrap gap-2">
            {payout.status === "requested" ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={pending}
                onClick={onProcessing}
              >
                علامت‌گذاری «در حال پردازش»
              </Button>
            ) : null}
            <Button
              type="button"
              size="sm"
              disabled={pending}
              onClick={() => setMode("paid")}
              className="bg-emerald-600 text-white hover:bg-emerald-700"
            >
              <CheckIcon className="size-4" />
              پرداخت شد
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() => setMode("reject")}
              className="text-rose-700 hover:bg-rose-50"
            >
              <XIcon className="size-4" />
              رد
            </Button>
          </div>
        )
      )}
    </div>
  );
}

function CopyField({
  label,
  value,
  mono,
  onCopy,
  copied,
}: {
  label: string;
  value: string;
  mono?: boolean;
  onCopy: () => void;
  copied: boolean;
}) {
  return (
    <div className="rounded-xl border border-border bg-muted/30 px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        <button
          type="button"
          onClick={onCopy}
          className="flex h-7 items-center gap-1 rounded-full bg-foreground px-2.5 text-[10px] font-bold text-background hover:bg-foreground/90"
        >
          {copied ? (
            <CheckIcon className="size-3" />
          ) : (
            <CopyIcon className="size-3" />
          )}
          {copied ? "کپی شد" : "کپی"}
        </button>
      </div>
      <p
        className={`mt-1 break-all text-[13px] ${mono ? "font-mono font-bold" : "font-medium"}`}
        dir={mono ? "ltr" : undefined}
      >
        {value}
      </p>
    </div>
  );
}
