"use client";

import type { Route } from "next";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import * as React from "react";
import {
  BanknoteIcon,
  BarChart3Icon,
  BellIcon,
  CalendarClockIcon,
  CalendarDaysIcon,
  CreditCardIcon,
  FormInputIcon,
  GiftIcon,
  GlobeIcon,
  HandshakeIcon,
  HelpCircleIcon,
  HomeIcon,
  IdCardIcon,
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { toPersianDigits } from "@/lib/persian";

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
  | "cards"
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
  | "referral"
  | "affiliate";

export type SidebarNavItem = {
  href: Route;
  label: string;
  icon: IconKey;
  /**
   * Numeric badge surfaced on the row. Hidden when 0 (zero-noise rule).
   * Display is capped at "+۹" — counts above 9 collapse to a stable
   * fixed-width pill so the row geometry doesn't jitter.
   */
  badgeCount?: number;
  /** Pre-formatted text badge (e.g. "جدید"). Wins over `badgeCount`. */
  badge?: string;
  match?: "exact" | "prefix";
  /**
   * Visual treatment.
   *  - `"primary"` — the centerpiece treatment (used for "لینک من").
   *    Taller, bolder typography, soft tinted background even when
   *    inactive; even more emphasis when active.
   *  - `"muted"`   — tertiary, dimmer (legacy support row treatment;
   *    no longer used directly here but kept for compatibility).
   *  - default     — standard nav row.
   */
  tone?: "default" | "primary" | "muted";
  /**
   * Optional keyboard-shortcut hint shown inline at the end of the row
   * (always visible when the sidebar is expanded). Example: `"⌘1"`.
   * Display only — wiring lives in `<SidebarShortcuts />`.
   */
  shortcut?: string;
};

const iconMap = {
  home: HomeIcon,
  profile: PencilRulerIcon,
  page: GlobeIcon,
  links: Link2Icon,
  qr: QrCodeIcon,
  events: CalendarDaysIcon,
  bookings: CalendarClockIcon,
  forms: FormInputIcon,
  requests: CreditCardIcon,
  cards: IdCardIcon,
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
  affiliate: HandshakeIcon,
} satisfies Record<IconKey, React.ComponentType<{ className?: string }>>;

function formatBadge(count: number): string {
  if (count <= 0) return "";
  if (count > 9) return `+${toPersianDigits(9)}`;
  return toPersianDigits(count);
}

export function SidebarNav({ items }: { items: SidebarNavItem[] }) {
  const pathname = usePathname();

  // "لینک من" gets a one-shot buzz on mount and every 60 s thereafter.
  const [myPageBuzzing, setMyPageBuzzing] = React.useState(true);
  const myPageBuzzTimer = React.useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  React.useEffect(() => {
    return () => {
      if (myPageBuzzTimer.current) clearTimeout(myPageBuzzTimer.current);
    };
  }, []);
  const handleMyPageBuzzEnd = React.useCallback(() => {
    setMyPageBuzzing(false);
    myPageBuzzTimer.current = setTimeout(() => setMyPageBuzzing(true), 60_000);
  }, []);

  return (
    <SidebarMenu>
      {items.map((item) => {
        const Icon = iconMap[item.icon];
        const active =
          item.match === "exact"
            ? pathname === item.href
            : pathname === item.href || pathname.startsWith(`${item.href}/`);

        const badgeText =
          item.badge ??
          (typeof item.badgeCount === "number" && item.badgeCount > 0
            ? formatBadge(item.badgeCount)
            : "");

        // The primary tone gives the row a meaningful "this is the
        // app's main section" vibe: a soft brand-tinted background even
        // when inactive, a slightly heavier weight, and extra height.
        // When active, the tint deepens — common pattern for "you are
        // here, and this matters".
        const isPrimary = item.tone === "primary";

        const className = isPrimary
          ? cn(
              "h-12 gap-3 px-3 text-[15px] font-bold",
              "bg-primary/[0.06] hover:bg-primary/[0.10]",
              "ring-1 ring-inset ring-primary/10",
              "[&>svg]:size-5",
              active &&
                "bg-primary/15 text-foreground hover:bg-primary/15 ring-primary/25",
            )
          : item.tone === "muted"
            ? "h-8 gap-3 px-3 text-[13px] text-muted-foreground hover:text-foreground"
            : "h-10 gap-3 px-3 text-sm font-semibold [&>svg]:size-4.5";

        const isMyPage = item.href === ("/me" as Route);

        return (
          <SidebarMenuItem key={item.href}>
            <SidebarMenuButton
              render={<Link href={item.href} prefetch={false} />}
              isActive={active}
              tooltip={item.label}
              className={cn(
                className,
                isMyPage && myPageBuzzing && "anim-block-buzz-once",
              )}
              onAnimationEnd={isMyPage ? handleMyPageBuzzEnd : undefined}
            >
              <Icon />
              <span className="flex-1 truncate">{item.label}</span>
              {item.shortcut ? (
                <kbd
                  data-slot="kbd"
                  dir="ltr"
                  aria-hidden
                  className={cn(
                    "ms-auto rounded-md border border-border/70 bg-background/80",
                    "px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground",
                    "tabular-nums leading-none",
                    "[font-family:system-ui,-apple-system,sans-serif]",
                    "hidden md:inline-flex group-data-[collapsible=icon]:hidden",
                  )}
                >
                  {item.shortcut}
                </kbd>
              ) : null}
            </SidebarMenuButton>
            {badgeText ? (
              <SidebarMenuBadge
                className={cn(
                  "bg-primary/15 text-primary",
                  isPrimary && "top-3.5",
                )}
              >
                {badgeText}
              </SidebarMenuBadge>
            ) : null}
          </SidebarMenuItem>
        );
      })}
    </SidebarMenu>
  );
}

// ---------------------------------------------------------------------------
// Bottom icon-only row (notifications / profile / help)
// ---------------------------------------------------------------------------

export type SidebarIconRowItem = {
  href: Route;
  label: string;
  icon: "notifications" | "user" | "help" | "home";
  /**
   * When true, renders a small red presence dot on the icon — used by
   * the notifications icon to signal "you have unread items" without
   * committing to a count. Counts live in the primary nav badges; the
   * footer row is intentionally minimal.
   */
  showDot?: boolean;
};

export function SidebarIconRow({ items }: { items: SidebarIconRowItem[] }) {
  return (
    <TooltipProvider delay={150}>
      <nav
        aria-label="ابزارهای کاربر"
        className={cn("flex items-center justify-around gap-0", "rounded-full")}
      >
        {items.map((item) => {
          const Icon = iconMap[item.icon];
          return (
            <Tooltip key={item.href}>
              <TooltipTrigger
                render={
                  <Link
                    href={item.href}
                    prefetch={false}
                    aria-label={item.label}
                    className={cn(
                      "tap-target relative inline-flex flex-1 items-center justify-center",
                      "rounded-lg p-2 text-muted-foreground",
                      "transition-colors hover:bg-sidebar-accent hover:text-foreground",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    )}
                  />
                }
              >
                <Icon className="size-4.5" />
                {item.showDot ? (
                  <span
                    aria-hidden
                    className={cn(
                      "absolute inset-e-1.5 top-1.5 size-2 rounded-full",
                      "bg-red-500 ring-2 ring-sidebar",
                    )}
                  />
                ) : null}
              </TooltipTrigger>
              <TooltipContent side="top">{item.label}</TooltipContent>
            </Tooltip>
          );
        })}
      </nav>
    </TooltipProvider>
  );
}

// ---------------------------------------------------------------------------
// Featured purple "دعوت دوستان" CTA
// ---------------------------------------------------------------------------

/**
 * Small but distinct CTA living above the bottom icon row. Purple to
 * break the otherwise green/neutral visual rhythm so the referral
 * affordance reads as something rewarding rather than another nav row.
 *
 * `availableMonths` flips the right-side pill: when the user has
 * unredeemed credit it pulses emerald with the live count, nudging
 * them to apply it on a page. Otherwise the static "۳ ماه رایگان"
 * teaser stays so first-time visitors still get the value prop.
 */
export function SidebarReferralCTA({
  href,
  availableMonths = 0,
}: {
  href: Route;
  availableMonths?: number;
}) {
  // Buzz once 10 s after mount, then every 80 s to remind the user.
  const [buzzing, setBuzzing] = React.useState(false);
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    timerRef.current = setTimeout(() => setBuzzing(true), 10_000);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const handleAnimationEnd = React.useCallback(() => {
    setBuzzing(false);
    timerRef.current = setTimeout(() => setBuzzing(true), 80_000);
  }, []);

  const hasCredit = availableMonths > 0;

  return (
    <Link
      href={href}
      prefetch={false}
      aria-label={
        hasCredit
          ? `${availableMonths} ماه پروی رایگان آماده‌ی استفاده`
          : "دعوت دوستان"
      }
      className={cn(
        "relative inline-flex h-10 w-full items-center justify-center gap-2",
        "rounded-full border px-3 text-sm font-bold transition-colors",
        hasCredit
          ? "border-emerald-300 bg-emerald-50/70 text-emerald-700 hover:bg-emerald-100/70 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300"
          : "border-border text-purple-600 hover:bg-purple-50/60 dark:hover:bg-purple-950/20",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar",
        buzzing && "anim-block-buzz-once",
      )}
      onAnimationEnd={handleAnimationEnd}
    >
      <GiftIcon className="size-4" />
      <span>{hasCredit ? "اعتبار آماده" : "دعوت دوستان"}</span>
      <span
        className={cn(
          "ms-auto inline-flex items-center rounded-full px-1.5 py-1 text-[10px] font-bold leading-none",
          hasCredit
            ? "bg-emerald-600 text-white"
            : "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
        )}
      >
        {hasCredit ? `${toPersianDigits(availableMonths)} ماه` : "۳ ماه رایگان"}
      </span>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Smart card animated CTA
// ---------------------------------------------------------------------------

/**
 * Full-width pill CTA for the "کارت هوشمند" section. Uses the same
 * rotating-conic-gradient border trick as `hero-cta-ring` in globals.css
 * but with the four card colors (orange/lime/cyan/pink). The inner button
 * has a solid background — no gradient fill, just animated border.
 */
export function SidebarCardCTA({ href }: { href: Route }) {
  return (
    <div className="sidebar-card-ring w-full">
      <Link
        href={href}
        prefetch={false}
        className={cn(
          "relative inline-flex h-10 w-full items-center justify-center gap-2",
          "rounded-full bg-background px-3 text-sm font-bold transition-colors",
          "text-foreground hover:bg-muted/60",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar",
        )}
      >
        <IdCardIcon className="size-4" />
        <span>کارت هوشمند</span>
      </Link>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Keyboard shortcuts (⌘1 / ⌘2 / ⌘3)
// ---------------------------------------------------------------------------

export type SidebarShortcutBinding = {
  /** "1" | "2" | "3" — `event.key` literal. */
  key: string;
  href: Route;
};

/**
 * Tiny global listener that wires Meta/Ctrl + digit to the three
 * primary entries. Mounted once near the sidebar; renders nothing.
 *
 * Rules:
 *  - Mac uses Cmd; everything else uses Ctrl. Detection happens via
 *    `navigator.platform` once on mount (avoids SSR mismatch).
 *  - Skips when the user is typing — input/textarea/contenteditable
 *    targets are ignored so a "1" keystroke in a form field doesn't
 *    fight the page.
 *  - `router.push` keeps it client-side (no full page reload).
 */
export function SidebarShortcuts({
  bindings,
}: {
  bindings: SidebarShortcutBinding[];
}) {
  const router = useRouter();

  React.useEffect(() => {
    const isMac =
      typeof navigator !== "undefined" &&
      /Mac|iPhone|iPod|iPad/i.test(navigator.platform);

    function isEditableTarget(target: EventTarget | null): boolean {
      if (!(target instanceof HTMLElement)) return false;
      const tag = target.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") {
        return true;
      }
      if (target.isContentEditable) return true;
      return false;
    }

    function onKeyDown(event: KeyboardEvent) {
      const modifier = isMac ? event.metaKey : event.ctrlKey;
      if (!modifier) return;
      if (event.altKey || event.shiftKey) return;
      if (isEditableTarget(event.target)) return;
      const match = bindings.find((b) => b.key === event.key);
      if (!match) return;
      event.preventDefault();
      router.push(match.href);
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [bindings, router]);

  return null;
}
