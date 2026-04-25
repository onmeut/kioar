"use client";

import { useRef, useTransition } from "react";
import { BanIcon } from "lucide-react";

import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface BanUserFormProps {
  userId: string;
  banAction: (formData: FormData) => Promise<void>;
}

export function BanUserForm({ userId, banAction }: BanUserFormProps) {
  const reasonRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();

  function handleConfirm() {
    startTransition(async () => {
      const fd = new FormData();
      fd.set("userId", userId);
      fd.set("reason", reasonRef.current?.value ?? "");
      await banAction(fd);
    });
  }

  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <Input
        ref={reasonRef}
        name="reason"
        placeholder="دلیل (اختیاری)"
        maxLength={200}
        className="sm:flex-1"
      />
      <ConfirmDialog
        title="مسدود کردن کاربر؟"
        description="همه جلسات فعال ابطال می‌شوند و کاربر نمی‌تواند وارد شود."
        confirmLabel="مسدود کن"
        destructive
        onConfirm={handleConfirm}
      >
        <Button
          type="button"
          variant="outline"
          className="h-11 text-rose-700 hover:text-rose-700"
          disabled={isPending}
        >
          <BanIcon className="size-4" />
          مسدود کن
        </Button>
      </ConfirmDialog>
    </div>
  );
}
