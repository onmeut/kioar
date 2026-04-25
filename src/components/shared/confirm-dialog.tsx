"use client";

import { cloneElement, isValidElement, useState } from "react";
import type { ReactElement, ReactNode } from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface ConfirmDialogProps {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void | Promise<void>;
  children: ReactNode;
}

export function ConfirmDialog({
  title,
  description,
  confirmLabel = "تایید",
  cancelLabel = "انصراف",
  destructive = false,
  onConfirm,
  children,
}: ConfirmDialogProps) {
  const [open, setOpen] = useState(false);

  // Inject onClick into the child trigger element
  const trigger = isValidElement(children)
    ? cloneElement(children as ReactElement<{ onClick?: () => void }>, {
        onClick: () => setOpen(true),
      })
    : children;

  return (
    <>
      {trigger}
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>{title}</AlertDialogTitle>
            {description ? (
              <AlertDialogDescription>{description}</AlertDialogDescription>
            ) : null}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{cancelLabel}</AlertDialogCancel>
            <AlertDialogAction
              variant={destructive ? "destructive" : "default"}
              onClick={() => void onConfirm()}
            >
              {confirmLabel}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
