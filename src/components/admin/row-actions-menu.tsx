"use client";

import Link from "next/link";
import type { Route } from "next";
import {
  BanIcon,
  ExternalLinkIcon,
  EyeIcon,
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
import type { ComponentType, ReactNode } from "react";
import { Fragment } from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

// String-keyed icons keep RowAction[] plain-serializable when built in a
// Server Component and passed into this Client Component.
export type RowActionIcon =
  | "edit"
  | "view"
  | "external"
  | "user"
  | "user-plus"
  | "shield"
  | "ban"
  | "trash"
  | "invoice"
  | "receipt"
  | "page"
  | "refresh";

const ICONS: Record<RowActionIcon, ComponentType<{ className?: string }>> = {
  edit: PencilIcon,
  view: EyeIcon,
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

export type RowAction = {
  key: string;
  label: string;
  href?: Route | string;
  icon?: RowActionIcon;
  external?: boolean;
  variant?: "default" | "destructive";
  separatorBefore?: boolean;
  disabled?: boolean;
};

export function RowActionsMenu({
  actions,
  align = "end",
  size = "sm",
  label = "اقدامات",
  triggerClassName,
  triggerNode,
}: {
  actions: RowAction[];
  align?: "start" | "center" | "end";
  size?: "sm" | "default";
  label?: string;
  triggerClassName?: string;
  triggerNode?: ReactNode;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size={size === "sm" ? "icon-sm" : "icon"}
            className={cn(
              "rounded-full",
              size === "sm" ? "size-8" : "size-9",
              triggerClassName,
            )}
            aria-label={label}
          />
        }
      >
        {triggerNode ?? <MoreHorizontalIcon className="size-4" />}
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
              {a.separatorBefore && idx > 0 ? <DropdownMenuSeparator /> : null}
              {node}
            </Fragment>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
