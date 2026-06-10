"use client";

import { ArrowRightIcon, XIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { EventForm, type EventFormInitial } from "@/components/events/event-form";
import type { ActionState } from "@/lib/action-state";

export type EventBuilderDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pageId: string;
  /** Existing event when editing; null when creating a new one. */
  initial: EventFormInitial | null;
  saveAction: (
    state: ActionState,
    formData: FormData,
  ) => Promise<ActionState>;
  /** Fired after a successful save so the editor can refresh + close. */
  onSaved: (state: ActionState) => void;
  /** Back button on the create flow reopens the add-block picker. */
  onBack?: () => void;
};

/**
 * Inline event builder. Wraps {@link EventForm} in a bottom sheet (mobile) /
 * dialog (desktop) so hosts create and edit events from the blocks list on
 * /me — exactly like the form and product builders — instead of navigating
 * away to /my-events/new. Registration management still lives at /my-events.
 */
export function EventBuilderDialog({
  open,
  onOpenChange,
  pageId,
  initial,
  saveAction,
  onSaved,
  onBack,
}: EventBuilderDialogProps) {
  const isMobile = useIsMobile();
  const title = initial ? "ویرایش رویداد" : "افزودن رویداد";

  const body = (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Header */}
      <div className="grid shrink-0 grid-cols-[40px_1fr_40px] items-center border-b px-4 py-3 sm:px-5 sm:py-4">
        <div className="flex">
          {onBack && !initial ? (
            <button
              type="button"
              onClick={onBack}
              aria-label="بازگشت"
              className="tap-target inline-flex size-10 items-center justify-center rounded-2xl border border-border bg-background text-foreground transition-colors hover:bg-muted"
            >
              <ArrowRightIcon className="size-5" />
            </button>
          ) : null}
        </div>
        <h2 className="text-center text-lg font-bold">{title}</h2>
        <div className="flex justify-end">
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            className="rounded-full"
            onClick={() => onOpenChange(false)}
            aria-label="بستن"
          >
            <XIcon className="size-5" />
          </Button>
        </div>
      </div>

      {/* Scrollable form */}
      <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
        <EventForm
          // Remount the form when switching target event so its internal
          // controlled state is rebuilt from the new `initial`.
          key={initial?.id ?? "new"}
          pageId={pageId}
          initial={initial}
          saveAction={saveAction}
          onSuccess={onSaved}
        />
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="bottom"
          className="max-h-[94dvh] overflow-hidden rounded-t-3xl p-0"
          showCloseButton={false}
        >
          <SheetTitle className="sr-only">{title}</SheetTitle>
          {body}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex max-h-[90dvh] w-full max-w-xl flex-col p-0 sm:max-w-2xl"
        showCloseButton={false}
      >
        <DialogTitle className="sr-only">{title}</DialogTitle>
        {body}
      </DialogContent>
    </Dialog>
  );
}
