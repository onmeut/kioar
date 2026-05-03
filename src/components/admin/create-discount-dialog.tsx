"use client";

import { useState } from "react";
import { PlusIcon } from "lucide-react";

import { DiscountProgramForm } from "@/components/admin/discount-program-form";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function CreateDiscountDialog() {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button size="sm" className="h-9 gap-1">
            <PlusIcon className="size-4" />
            ایجاد برنامه
          </Button>
        }
      />
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>ایجاد برنامه تخفیف</DialogTitle>
        </DialogHeader>
        <DiscountProgramForm existing={null} onCancel={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}
