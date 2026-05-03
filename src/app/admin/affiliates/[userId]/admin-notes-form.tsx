"use client";

import { useTransition } from "react";

import { Button } from "@/components/ui/button";
import { updateAdminNotesAction } from "@/app/admin/affiliates/actions";

export function AdminNotesForm({
  userId,
  defaultValue,
}: {
  userId: string;
  defaultValue: string;
}) {
  const [pending, startTransition] = useTransition();
  const submit = (fd: FormData) => {
    fd.set("userId", userId);
    startTransition(() => updateAdminNotesAction(fd));
  };

  return (
    <form action={submit} className="grid gap-3">
      <textarea
        name="notes"
        defaultValue={defaultValue}
        rows={4}
        placeholder="یادداشت‌های داخلی ادمین — برای کاربر نمایش داده نمی‌شود."
        className="w-full resize-y rounded-2xl border border-border bg-background p-3 text-[13px] leading-7 text-foreground placeholder:text-muted-foreground focus:border-foreground focus:outline-none"
      />
      <div>
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "در حال ذخیره…" : "ذخیره‌ی یادداشت"}
        </Button>
      </div>
    </form>
  );
}
