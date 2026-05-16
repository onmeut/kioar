"use client";

import { useActionState, useState } from "react";
import { Fragment } from "react";
import Link from "next/link";
import type { Route } from "next";
import {
  BanIcon,
  CheckCircleIcon,
  ExternalLinkIcon,
  FileTextIcon,
  LayoutGridIcon,
  MoreHorizontalIcon,
  PencilIcon,
  ReceiptIcon,
  RefreshCwIcon,
  ShieldCheckIcon,
  Trash2Icon,
  UserIcon,
  UserPlusIcon,
} from "lucide-react";
import type { ComponentType } from "react";

import {
  adminDisablePageAction,
  adminEnablePageAction,
} from "@/app/admin/billing/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { idleState } from "@/lib/action-state";
import type { RowAction, RowActionIcon } from "./row-actions-menu";

const ICONS: Record<RowActionIcon, ComponentType<{ className?: string }>> = {
  edit: PencilIcon,
  view: ExternalLinkIcon,
  external: ExternalLinkIcon,
  user: UserIcon,
  "user-plus": UserPlusIcon,
  shield: ShieldCheckIcon,
  ban: BanIcon,
  trash: Trash2Icon,
  invoice: FileTextIcon,
  receipt: ReceiptIcon,
  page: LayoutGridIcon,
  refresh: RefreshCwIcon,
};

type Props = {
  pageId: string;
  isDisabled: boolean;
  actions: RowAction[];
  align?: "start" | "center" | "end";
};

export function PageActionsMenu({
  pageId,
  isDisabled,
  actions,
  align = "end",
}: Props) {
  const [dialogOpen, setDialogOpen] = useState(false);

  const [state, formAction, pending] = useActionState(
    isDisabled ? adminEnablePageAction : adminDisablePageAction,
    idleState,
  );

  function handleDisableClick() {
    setTimeout(() => setDialogOpen(true), 0);
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon-sm"
              className="size-8 rounded-full"
              aria-label="اقدامات"
            />
          }
        >
          <MoreHorizontalIcon className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align={align} className="min-w-52">
          {actions.map((a, idx) => {
            const Icon = a.icon ? ICONS[a.icon] : null;
            const inner = (
              <>
                {Icon ? <Icon className="size-4" /> : null}
                <span className="flex-1 text-start">{a.label}</span>
              </>
            );
            const node = a.href ? (
              <DropdownMenuItem
                variant={a.variant}
                disabled={a.disabled}
                render={
                  <Link
                    href={a.href as Route}
                    target={a.external ? "_blank" : undefined}
                    rel={a.external ? "noopener noreferrer" : undefined}
                  />
                }
              >
                {inner}
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem variant={a.variant} disabled={a.disabled}>
                {inner}
              </DropdownMenuItem>
            );
            return (
              <Fragment key={a.key}>
                {a.separatorBefore && idx > 0 ? (
                  <DropdownMenuSeparator />
                ) : null}
                {node}
              </Fragment>
            );
          })}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant={isDisabled ? "default" : "destructive"}
            onClick={handleDisableClick}
          >
            {isDisabled ? (
              <CheckCircleIcon className="size-4" />
            ) : (
              <BanIcon className="size-4" />
            )}
            <span className="flex-1 text-start">
              {isDisabled ? "فعال‌سازی مجدد صفحه" : "غیرفعال کردن صفحه"}
            </span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <form action={formAction}>
            <input type="hidden" name="pageId" value={pageId} />
            <DialogHeader>
              <DialogTitle>
                {isDisabled ? "فعال‌سازی مجدد صفحه" : "غیرفعال کردن صفحه"}
              </DialogTitle>
              <DialogDescription>
                {isDisabled
                  ? "صفحه مجدداً در دسترس عموم قرار می‌گیرد."
                  : "صفحه برای بازدیدکنندگان نمایش داده نمی‌شود و پیام غیرفعال‌بودن نشان داده می‌شود. این عمل قابل بازگشت است."}
              </DialogDescription>
            </DialogHeader>
            {state.status === "error" && state.message ? (
              <p className="mt-3 text-xs text-destructive">{state.message}</p>
            ) : null}
            <DialogFooter className="mt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
              >
                انصراف
              </Button>
              <Button
                type="submit"
                variant={isDisabled ? "default" : "destructive"}
                disabled={pending}
              >
                {pending
                  ? "در حال ثبت…"
                  : isDisabled
                    ? "فعال‌سازی"
                    : "غیرفعال کردن"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
