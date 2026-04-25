"use client";

import { useTransition } from "react";
import { Trash2Icon } from "lucide-react";

import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";

interface DeleteEventButtonProps {
  eventId: string;
  deleteAction: (formData: FormData) => Promise<void>;
}

export function DeleteEventButton({
  eventId,
  deleteAction,
}: DeleteEventButtonProps) {
  const [isPending, startTransition] = useTransition();

  function handleConfirm() {
    startTransition(async () => {
      const fd = new FormData();
      fd.set("eventId", eventId);
      await deleteAction(fd);
    });
  }

  return (
    <ConfirmDialog
      title="حذف رویداد؟"
      description="این رویداد و تمام ثبت‌نام‌های مرتبط برای همیشه حذف می‌شوند."
      confirmLabel="حذف"
      destructive
      onConfirm={handleConfirm}
    >
      <Button
        variant="outline"
        size="lg"
        className="h-11 text-destructive hover:text-destructive"
        disabled={isPending}
      >
        <Trash2Icon className="size-4" />
        حذف
      </Button>
    </ConfirmDialog>
  );
}
