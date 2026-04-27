"use client";

import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BanknoteIcon,
  BarChart3Icon,
  BellIcon,
  CalendarClockIcon,
  CalendarDaysIcon,
  CreditCardIcon,
  FormInputIcon,
  GiftIcon,
  HelpCircleIcon,
  HomeIcon,
  LayoutGridIcon,
  Link2Icon,
  MessageSquareIcon,
  PencilRulerIcon,
  PlusSquareIcon,
  QrCodeIcon,
  ReceiptIcon,
  ShieldCheckIcon,
  SlidersHorizontalIcon,
  TagIcon,
  UserIcon,
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
  | "page"
  | "links"
  | "qr"
  | "events"
  | "bookings"
  | "forms"
  | "requests"
  | "admin"
  | "create"
  | "users"
  | "sms"
  | "discounts"
  | "billing"
  | "receipt"
  | "plans"
  | "analytics"
  | "notifications"
  | "user"
  | "help"
  | "referral";

export type SidebarNavItem = {
  href: Route;
  label: string;
  icon: IconKey;
  badge?: string;
  match?: "exact" | "prefix";
  /**
   * Visual treatment. `"muted"` is used for the secondary footer group
   * (help / referral) — smaller height and dimmer text so it visually
   * subordinates to the primary navigation above.
   */
  tone?: "default" | "muted";
};

const iconMap = {
  home: HomeIcon,
  profile: PencilRulerIcon,
  page: LayoutGridIcon,
  links: Link2Icon,
  qr: QrCodeIcon,
  events: CalendarDaysIcon,
  bookings: CalendarClockIcon,
  forms: FormInputIcon,
  requests: CreditCardIcon,
  admin: ShieldCheckIcon,
  create: PlusSquareIcon,
  users: UsersIcon,
  sms: MessageSquareIcon,
  discounts: TagIcon,
  billing: BanknoteIcon,
  receipt: ReceiptIcon,
  plans: SlidersHorizontalIcon,
  analytics: BarChart3Icon,
  notifications: BellIcon,
  user: UserIcon,
  help: HelpCircleIcon,
  referral: GiftIcon,
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
              className={
                item.tone === "muted"
                  ? "h-8 gap-3 px-3 text-[13px] text-muted-foreground hover:text-foreground"
                  : "h-10 gap-3 px-3 text-sm"
              }
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
