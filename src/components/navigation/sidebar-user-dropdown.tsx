"use client";

import { useTransition } from "react";
import { LogOutIcon } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

function getInitials(name: string | null | undefined) {
  if (!name) return "·";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "·";
  if (parts.length === 1) return parts[0].slice(0, 2);
  return (parts[0][0] + parts[parts.length - 1][0]).slice(0, 2);
}

interface SidebarUserDropdownProps {
  fullName: string | null | undefined;
  avatarUrl: string | null | undefined;
  slug: string;
  signOut: () => Promise<void>;
}

export function SidebarUserDropdown({
  fullName,
  avatarUrl,
  slug,
  signOut,
}: SidebarUserDropdownProps) {
  const [isPending, startTransition] = useTransition();

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <SidebarMenuButton
            render={<DropdownMenuTrigger />}
            tooltip={fullName ?? "پروفایل"}
            className="h-auto gap-3 px-2 py-2"
          >
            <Avatar className="size-8 shrink-0">
              {avatarUrl ? (
                <AvatarImage src={avatarUrl} alt={fullName ?? ""} />
              ) : null}
              <AvatarFallback className="text-xs font-bold">
                {getInitials(fullName)}
              </AvatarFallback>
            </Avatar>
            <span className="truncate text-sm font-semibold">
              {fullName || "پروفایل شما"}
            </span>
          </SidebarMenuButton>

          <DropdownMenuContent side="top" sideOffset={8} className="w-64">
            {/* Profile header */}
            <div className="flex items-center gap-3 px-3 py-3">
              <Avatar className="size-10 shrink-0">
                {avatarUrl ? (
                  <AvatarImage src={avatarUrl} alt={fullName ?? ""} />
                ) : null}
                <AvatarFallback className="text-xs font-bold">
                  {getInitials(fullName)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">
                  {fullName || "پروفایل شما"}
                </p>
                <p className="truncate text-xs text-muted-foreground" dir="ltr">
                  /{slug}
                </p>
              </div>
            </div>

            <DropdownMenuSeparator />

            <DropdownMenuItem
              disabled={isPending}
              className="text-destructive focus:text-destructive focus:bg-destructive/10"
              onClick={() => startTransition(() => void signOut())}
            >
              <LogOutIcon />
              <span>خروج از حساب</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
