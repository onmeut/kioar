"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDownIcon, LogOutIcon, PlusIcon } from "lucide-react";
import { toast } from "sonner";

import { switchPageAction } from "@/app/(app)/dashboard/pages/actions";
import { CreatePageDialog } from "@/components/dashboard/create-page-dialog";
import { BoringAvatar } from "@/components/shared/boring-avatar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

export type PageSwitcherItem = {
  id: string;
  slug: string;
  title: string;
  avatarUrl: string | null;
  avatarSeed: string | null;
  planKey: "free" | "pro" | "business";
  isOnTrial: boolean;
};

interface PageSwitcherProps {
  pages: PageSwitcherItem[];
  currentPageId: string;
  /**
   * Server action that signs the current user out. Threaded through here
   * because the sidebar-footer user dropdown was removed in favor of a
   * dedicated upgrade card; the page-switcher inherits its sign-out
   * affordance.
   */
  signOut: () => Promise<void>;
}

const PLAN_LABEL: Record<PageSwitcherItem["planKey"], string> = {
  free: "رایگان",
  pro: "پرو",
  business: "بیزنس",
};

function PlanBadge({
  planKey,
  isOnTrial,
}: {
  planKey: PageSwitcherItem["planKey"];
  isOnTrial: boolean;
}) {
  const label = isOnTrial ? "آزمایشی" : PLAN_LABEL[planKey];
  const colorClass =
    planKey === "free"
      ? "bg-zinc-100 text-zinc-500"
      : planKey === "pro"
        ? "bg-emerald-100 text-emerald-700"
        : "bg-purple-100 text-purple-700";
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${colorClass}`}
    >
      {label}
    </span>
  );
}

function PageAvatar({
  page,
  size,
  highlighted = false,
}: {
  page: Pick<PageSwitcherItem, "avatarUrl" | "avatarSeed" | "title">;
  size: number;
  /**
   * Adds a thicker accent ring to mark the avatar as the active page —
   * Linktree-style "current account" treatment that replaces a separate
   * checkmark column in the row.
   */
  highlighted?: boolean;
}) {
  return (
    <Avatar
      className={cn(
        "shrink-0 overflow-hidden transition-shadow [&_svg]:!size-full",
        highlighted &&
          "ring-2 ring-foreground ring-offset-4 ring-offset-popover",
      )}
      style={{ width: size, height: size }}
    >
      {page.avatarUrl ? (
        <AvatarImage src={page.avatarUrl} alt={page.title} />
      ) : (
        <AvatarFallback className="p-0 bg-transparent">
          <BoringAvatar seed={page.avatarSeed} size={size} />
        </AvatarFallback>
      )}
    </Avatar>
  );
}

/**
 * Sidebar-header dropdown that names the page being edited and lets the
 * user switch to another of their owned pages or open the inline
 * CreatePageDialog. Light theme; Persian copy.
 */
export function PageSwitcher({
  pages,
  currentPageId,
  signOut,
}: PageSwitcherProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [createOpen, setCreateOpen] = useState(false);

  const current = pages.find((p) => p.id === currentPageId) ?? pages[0];

  if (!current) return null;

  const onSelect = (pageId: string) => {
    if (pageId === currentPageId) return;
    startTransition(async () => {
      const result = await switchPageAction(pageId);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      router.push("/page");
      router.refresh();
    });
  };
  return (
    <>
      <SidebarMenu>
        <SidebarMenuItem>
          <DropdownMenu>
            <SidebarMenuButton
              render={<DropdownMenuTrigger />}
              tooltip={current.title}
              className="h-auto cursor-pointer gap-3 px-2 py-2"
              disabled={isPending}
            >
              <PageAvatar page={current} size={40} />
              <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                {current.title}
              </span>
              <ChevronDownIcon
                className="size-4 shrink-0 text-muted-foreground"
                aria-hidden
              />
            </SidebarMenuButton>

            <DropdownMenuContent align="start" sideOffset={8} className="w-72">
              <DropdownMenuGroup>
                <DropdownMenuLabel className="text-xs text-muted-foreground">
                  صفحه‌های شما
                </DropdownMenuLabel>
                {pages.map((page) => {
                  const isCurrent = page.id === currentPageId;
                  return (
                    <DropdownMenuItem
                      key={page.id}
                      // Base UI's Menu.Item dispatches via `onClick` (not the
                      // Radix-style `onSelect`). closeOnClick defaults to true
                      // so the menu auto-closes after the handler runs.
                      onClick={() => onSelect(page.id)}
                      className="cursor-pointer items-center gap-3 py-2"
                    >
                      <PageAvatar
                        page={page}
                        size={44}
                        highlighted={isCurrent}
                      />
                      <span className="flex min-w-0 flex-1 flex-col justify-center text-start leading-tight">
                        <span className="truncate text-sm font-semibold">
                          {page.title}
                        </span>
                        <span className="truncate text-[11px] text-muted-foreground">
                          /{page.slug}
                        </span>
                      </span>
                      <PlanBadge
                        planKey={page.planKey}
                        isOnTrial={page.isOnTrial}
                      />
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuGroup>

              <DropdownMenuSeparator />

              <DropdownMenuItem
                onClick={() => setCreateOpen(true)}
                className="cursor-pointer items-center gap-3 py-2"
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-zinc-700">
                  <PlusIcon className="size-4" aria-hidden />
                </span>
                <span className="text-sm font-medium">صفحه‌ی جدید</span>
              </DropdownMenuItem>

              <DropdownMenuSeparator />

              <DropdownMenuItem
                onClick={() => startTransition(() => void signOut())}
                disabled={isPending}
                className="cursor-pointer items-center gap-3 py-2 text-destructive focus:bg-destructive/10 focus:text-destructive"
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                  <LogOutIcon className="size-4" aria-hidden />
                </span>
                <span className="text-sm font-medium">خروج از حساب</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarMenuItem>
      </SidebarMenu>

      <CreatePageDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        existingCount={pages.length}
      />
    </>
  );
}
