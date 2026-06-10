"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PencilIcon } from "lucide-react";

import { EventBuilderDialog } from "@/components/dashboard/event-builder-dialog";
import { Button } from "@/components/ui/button";
import type { EventFormInitial } from "@/components/events/event-form";
import type { ActionState } from "@/lib/action-state";

type Props = {
  pageId: string;
  initial: EventFormInitial;
  saveAction: (
    state: ActionState & { id?: string; slug?: string },
    formData: FormData,
  ) => Promise<ActionState & { id?: string; slug?: string }>;
};

export function EditEventButton({ pageId, initial, saveAction }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  function handleSaved() {
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <Button variant="outline" className="h-11 shrink-0" onClick={() => setOpen(true)}>
        <PencilIcon className="size-4" />
        ویرایش
      </Button>
      <EventBuilderDialog
        open={open}
        onOpenChange={setOpen}
        pageId={pageId}
        initial={initial}
        saveAction={saveAction}
        onSaved={handleSaved}
      />
    </>
  );
}
