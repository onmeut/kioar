"use client";

import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarClockIcon,
  CalendarDaysIcon,
  CreditCardIcon,
  HomeIcon,
  Link2Icon,
  PencilRulerIcon,
  PlusSquareIcon,
  QrCodeIcon,
  ShieldCheckIcon,
  UsersIcon,
} from "lucide-react";

import {
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

type IconKey =
  | "home"
  | "profile"
  | "links"
  | "qr"
  | "events"
  | "bookings"
  | "requests"
  | "admin"
  | "create"
  | "users";

export type SidebarNavItem = {
  href: Route;
  label: string;
  icon: IconKey;
  badge?: string;
  match?: "exact" | "prefix";
};

const iconMap = {
  home: HomeIcon,
  profile: PencilRulerIcon,
  links: Link2Icon,
  qr: QrCodeIcon,
  events: CalendarDaysIcon,
  bookings: CalendarClockIcon,
  requests: CreditCardIcon,
  admin: ShieldCheckIcon,
  create: PlusSquareIcon,
  users: UsersIcon,
} satisfies Record<IconKey, React.ComponentType<{ className?: string }>>;

export function SidebarNav({ items }: { items: SidebarNavItem[] }) {
  const pathname = usePathname();

  return (
    <SidebarMenu>
      {items.map((item) => {
        const Icon = iconMap[item.icon];
        const active =
          item.match === "exact"
            ? pathname === item.href
            : pathname === item.href || pathname.startsWith(`${item.href}/`);

        return (
          <SidebarMenuItem key={item.href}>
            <SidebarMenuButton
              render={<Link href={item.href} />}
              isActive={active}
              tooltip={item.label}
              className="h-10 gap-3 px-3 text-sm"
            >
              <Icon />
              <span>{item.label}</span>
            </SidebarMenuButton>
            {item.badge ? (
              <SidebarMenuBadge>{item.badge}</SidebarMenuBadge>
            ) : null}
          </SidebarMenuItem>
        );
      })}
    </SidebarMenu>
  );
}
