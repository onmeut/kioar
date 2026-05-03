"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { PlusIcon, SparklesIcon } from "lucide-react";
import { toast } from "sonner";

import { createPageAction } from "@/app/(app)/dashboard/pages/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const MAX_PAGES_PER_OWNER = 25;

type CreatePageDialogProps = {
  existingCount: number;
  /**
   * Optional uncontrolled trigger. When provided the dialog renders an
   * internal `<Button>` with this label. Leave undefined when triggering
   * from outside (e.g. the sidebar PageSwitcher) and pass `open` /
   * `onOpenChange` instead.
   */
  triggerLabel?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

export function CreatePageDialog({
  triggerLabel,
  existingCount,
  open: controlledOpen,
  onOpenChange,
}: CreatePageDialogProps) {
  const router = useRouter();
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = (next: boolean) => {
    if (!isControlled) setInternalOpen(next);
    onOpenChange?.(next);
  };

  const [isPending, startTransition] = useTransition();
  const [errors, setErrors] = useState<{ slug?: string; fullName?: string }>(
    {},
  );

  const limitReached = existingCount >= MAX_PAGES_PER_OWNER;

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setErrors({});
    startTransition(async () => {
      const result = await createPageAction(formData);
      if (!result.ok) {
        if (result.field) {
          setErrors({ [result.field]: result.message });
        } else {
          toast.error(result.message);
        }
        return;
      }
      toast.success("صفحه‌ی جدید ساخته شد.");
      setOpen(false);
      router.push(result.redirectTo as Route);
      router.refresh();
    });
  };

  return (
    <>
      {triggerLabel ? (
        <Button
          className="h-11 cursor-pointer w-full sm:w-auto"
          disabled={limitReached}
          onClick={() => setOpen(true)}
        >
          <PlusIcon className="size-4" aria-hidden />
          {triggerLabel}
        </Button>
      ) : null}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader className="items-start text-start">
            <div className="mb-3 flex size-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
              <SparklesIcon className="size-5" aria-hidden />
            </div>
            <DialogTitle className="text-xl">ساخت صفحه‌ی جدید</DialogTitle>
            <DialogDescription>
              هر صفحه نشانی اختصاصی، طراحی و تنظیمات اشتراک مستقل دارد.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="page-slug">نام کاربری</Label>
              {/*
                The whole row is forced LTR so the `kioar.com/` prefix is
                pinned on the visual *left* and the typed slug grows to
                its right — matching the layout in the screenshot. The
                surrounding label/help text stays RTL because they live
                outside this wrapper.
              */}
              <div
                dir="ltr"
                className="flex items-stretch overflow-hidden rounded-md border bg-background focus-within:ring-2 focus-within:ring-ring"
              >
                <span className="flex items-center border-e bg-zinc-50 px-3 text-xs text-muted-foreground">
                  kioar.com/
                </span>
                <Input
                  id="page-slug"
                  name="slug"
                  required
                  autoFocus
                  dir="ltr"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  inputMode="url"
                  enterKeyHint="next"
                  pattern="[a-z0-9](?:[a-z0-9\-]{1,28}[a-z0-9])?"
                  maxLength={30}
                  placeholder="my-page"
                  className="rounded-none border-0 focus-visible:ring-0"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                فقط حروف انگلیسی کوچک، عدد و خط تیره. ۳ تا ۳۰ کاراکتر.
              </p>
              {errors.slug ? (
                <p className="text-xs text-destructive">{errors.slug}</p>
              ) : null}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="page-fullName">نام صفحه</Label>
              <Input
                id="page-fullName"
                name="fullName"
                required
                autoComplete="off"
                enterKeyHint="go"
                maxLength={80}
                placeholder="مثلاً «استودیو رویا»"
              />
              {errors.fullName ? (
                <p className="text-xs text-destructive">{errors.fullName}</p>
              ) : null}
            </div>

            {limitReached ? (
              <p className="text-xs text-destructive">
                حداکثر {MAX_PAGES_PER_OWNER} صفحه برای هر حساب.
              </p>
            ) : null}

            <DialogFooter className="flex-col-reverse gap-2 sm:flex-row">
              <Button
                type="button"
                variant="outline"
                className="h-11 cursor-pointer w-full sm:w-auto"
                onClick={() => setOpen(false)}
                disabled={isPending}
              >
                انصراف
              </Button>
              <Button
                type="submit"
                className="h-11 cursor-pointer w-full sm:w-auto"
                disabled={isPending || limitReached}
              >
                {isPending ? "در حال ساخت…" : "ساخت صفحه"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
