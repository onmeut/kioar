"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { ChevronDownIcon, LogOutIcon, PlusIcon } from "lucide-react";
import { toast } from "sonner";

import { switchPageAction } from "@/app/(app)/dashboard/pages/actions";
import { KioarAvatar } from "@/components/shared/kioar-avatar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
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
  /**
   * `sidebar` (default) renders the full-width sidebar trigger row.
   * `compact` renders a small avatar + chevron pill — used in the
   * mobile dashboard header where vertical space is precious.
   */
  variant?: "sidebar" | "compact";
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
        "shrink-0 overflow-hidden transition-shadow [&_svg]:size-full!",
        highlighted &&
          "ring-2 ring-foreground ring-offset-4 ring-offset-popover",
      )}
      style={{ width: size, height: size }}
    >
      {page.avatarUrl ? (
        <AvatarImage src={page.avatarUrl} alt={page.title} />
      ) : (
        <AvatarFallback className="p-0 bg-transparent">
          <KioarAvatar seed={page.avatarSeed} size={size} />
        </AvatarFallback>
      )}
    </Avatar>
  );
}

/**
 * Sidebar-header dropdown that names the page being edited and lets the
 * user switch to another of their owned pages or jump to the full-page
 * "Add new page" onboarding flow at `/onboarding/new-page`. The latter
 * reuses the exact same `<OnboardingForm>` as first-run signup so the
 * experience is identical whether it's the user's first page or fifth.
 * Light theme; Persian copy.
 */
export function PageSwitcher({
  pages,
  currentPageId,
  signOut,
  variant = "sidebar",
}: PageSwitcherProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

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
      router.push("/me");
      router.refresh();
    });
  };

  // Shared dropdown content — same items regardless of variant.
  const dropdownContent = (
    <DropdownMenuContent align="start" sideOffset={8} className="w-72">
      <DropdownMenuGroup>
        {pages.map((page) => {
          const isCurrent = page.id === currentPageId;
          return (
            <DropdownMenuItem
              key={page.id}
              onClick={() => onSelect(page.id)}
              className="cursor-pointer items-center gap-3 py-2"
            >
              <PageAvatar page={page} size={44} highlighted={isCurrent} />
              <span className="flex min-w-0 flex-1 flex-col justify-center text-start leading-tight">
                <span className="truncate text-sm font-semibold">
                  {page.title}
                </span>
                <span className="truncate text-[11px] text-muted-foreground">
                  /{page.slug}
                </span>
              </span>
              <PlanBadge planKey={page.planKey} isOnTrial={page.isOnTrial} />
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuGroup>

      <DropdownMenuSeparator />

      <DropdownMenuItem
        onClick={() => router.push("/onboarding/new-page" as Route)}
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
  );

  if (variant === "compact") {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger
          disabled={isPending}
          aria-label={`صفحه‌ی فعلی: ${current.title}`}
          className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border bg-background ps-1 pe-2.5 transition-colors hover:bg-muted disabled:opacity-60"
        >
          <PageAvatar page={current} size={26} />
          <span className="max-w-20 truncate text-sm font-semibold leading-none">
            {current.title}
          </span>
          <ChevronDownIcon
            className="size-4 shrink-0 text-muted-foreground"
            aria-hidden
          />
        </DropdownMenuTrigger>
        {dropdownContent}
      </DropdownMenu>
    );
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <SidebarMenuButton
            render={<DropdownMenuTrigger />}
            tooltip={current.title}
            className="h-auto cursor-pointer gap-3 px-2 py-2"
            disabled={isPending}
          >
            <PageAvatar page={current} size={32} />
            <span className="min-w-0 flex-1 truncate text-sm font-semibold">
              {current.title}
              </span>
              <PlanBadge
                planKey={current.planKey}
                isOnTrial={current.isOnTrial}
              />
              <ChevronDownIcon
                className="size-4 shrink-0 text-muted-foreground"
                aria-hidden
              />
            </SidebarMenuButton>

          {dropdownContent}
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
