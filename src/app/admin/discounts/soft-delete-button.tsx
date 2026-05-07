"use client";

/**
 * Phase 7 — soft-delete a discount code with a required reason.
 * Confirms via Dialog → form posts to softDeleteDiscountCodeAction.
 */

import { useActionState, useState } from "react";
import { Trash2Icon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { idleState } from "@/lib/action-state";

import { softDeleteDiscountCodeAction } from "./actions";

type Props = {
  id: string;
  code: string;
};

export function SoftDeleteDiscountButton({ id, code }: Props) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(
    softDeleteDiscountCodeAction,
    idleState,
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="size-9 p-0 text-destructive hover:bg-destructive/10"
            aria-label="حذف"
          >
            <Trash2Icon className="size-4" />
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>حذف کد تخفیف</DialogTitle>
        </DialogHeader>
        <form action={action} className="space-y-4">
          <input type="hidden" name="id" value={id} />
          <p className="text-sm text-muted-foreground">
            کد <span className="font-mono">{code}</span> حذف نرم می‌شود و دیگر
            در فرایند پرداخت قابل استفاده نخواهد بود.
          </p>
          {state.status === "error" && state.message ? (
            <div className="rounded-md border border-destructive/40 bg-destructive/5 p-2 text-xs text-destructive">
              {state.message}
            </div>
          ) : null}
          <div className="space-y-1.5">
            <Label htmlFor={`sd-reason-${id}`}>دلیل حذف</Label>
            <Textarea id={`sd-reason-${id}`} name="reason" rows={2} required />
          </div>
          <div className="flex items-center justify-end gap-2">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-10"
              onClick={() => setOpen(false)}
            >
              انصراف
            </Button>
            <Button
              type="submit"
              size="sm"
              variant="destructive"
              className="h-10"
              disabled={pending}
            >
              {pending ? "در حال حذف..." : "حذف"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
