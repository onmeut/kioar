"use client";

import { useState, useTransition } from "react";

import { CheckIcon, MessageSquareIcon, XIcon } from "lucide-react";

import {
  approveApplicationAction,
  needsInfoApplicationAction,
  rejectApplicationAction,
} from "@/app/admin/affiliates/actions";
import { Button } from "@/components/ui/button";

type Mode = null | "reject" | "needsInfo";

export function ApplicationActions({
  applicationId,
}: {
  applicationId: string;
}) {
  const [mode, setMode] = useState<Mode>(null);
  const [text, setText] = useState("");
  const [pending, startTransition] = useTransition();

  const onApprove = () => {
    if (
      !confirm("درخواست تأیید بشه؟ کد همکاری فعال می‌شه و پیامک خوش‌آمد می‌ره.")
    )
      return;
    const fd = new FormData();
    fd.set("applicationId", applicationId);
    startTransition(() => approveApplicationAction(fd));
  };

  const onSubmitText = () => {
    if (text.trim().length < 4) {
      alert("متن حداقل ۴ کاراکتر باشه.");
      return;
    }
    const fd = new FormData();
    fd.set("applicationId", applicationId);
    if (mode === "reject") {
      fd.set("reason", text.trim());
      startTransition(() => rejectApplicationAction(fd));
    } else if (mode === "needsInfo") {
      fd.set("message", text.trim());
      startTransition(() => needsInfoApplicationAction(fd));
    }
    setMode(null);
    setText("");
  };

  if (mode) {
    return (
      <div className="space-y-2">
        <textarea
          rows={3}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={
            mode === "reject"
              ? "دلیل رد (برای متقاضی پیامک می‌شه)…"
              : "پیامی که برای متقاضی پیامک می‌شه…"
          }
          className="w-full rounded-xl border border-border bg-background p-3 text-[13px] leading-7 outline-none focus:border-foreground/50"
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
            onClick={onSubmitText}
          >
            ارسال
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        type="button"
        size="sm"
        disabled={pending}
        onClick={onApprove}
        className="bg-emerald-600 text-white hover:bg-emerald-700"
      >
        <CheckIcon className="size-4" />
        تأیید
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={() => setMode("needsInfo")}
      >
        <MessageSquareIcon className="size-4" />
        نیاز به اطلاعات
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={() => setMode("reject")}
        className="text-rose-700 hover:bg-rose-50"
      >
        <XIcon className="size-4" />
        رد
      </Button>
    </div>
  );
}
