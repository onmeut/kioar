"use client";

import type { Route } from "next";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BarChart3Icon,
  BellIcon,
  CalendarClockIcon,
  CalendarDaysIcon,
  CopyIcon,
  CreditCardIcon,
  ExternalLinkIcon,
  FileBoxIcon,
  FormInputIcon,
  GiftIcon,
  HelpCircleIcon,
  HomeIcon,
  LayoutGridIcon,
  LinkIcon,
  LockIcon,
  LogInIcon,
  MailQuestionIcon,
  MegaphoneIcon,
  MessageCircleQuestionIcon,
  ReceiptIcon,
  ScrollTextIcon,
  SparklesIcon,
  TagIcon,
  UserIcon,
} from "lucide-react";
import { toast } from "sonner";

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";

export type CommandPalettePage = {
  id: string;
  slug: string;
  title: string;
  avatarUrl: string | null;
  avatarSeed: string | null;
  planKey: "free" | "pro" | "business";
  isOnTrial: boolean;
};

export type CommandPaletteFeatureFlags = {
  contactForm: boolean;
  bookings: boolean;
  csvExport: boolean;
};

export interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** All pages owned by the viewer, oldest-first. */
  pages: CommandPalettePage[];
  /** Current page id (matches the `kioar_page_id` cookie). */
  currentPageId: string;
  /** Public share URL of the current page. */
  publicUrl: string;
  /** Pre-resolved per-page entitlements for the *current* page only. */
  features: CommandPaletteFeatureFlags;
}

function LockedPill() {
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-bold text-purple-700">
      <LockIcon className="size-2.5" />
      Business
    </span>
  );
}

function ProLockedPill() {
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
      <LockIcon className="size-2.5" />
      Pro
    </span>
  );
}

/**
 * Global ⌘K command palette.
 *
 *  - Group order is fixed (navigation → quick actions → tools → help)
 *    so muscle-memory works regardless of which page the user is editing.
 *  - Page-scoped routes bake the *current* `pageId` into the href at
 *    render time. Switching pages re-mounts the dashboard layout,
 *    which re-supplies fresh data here.
 *  - Plan-aware items use `pageHasFeature(...)` resolved server-side
 *    and passed via `features`. The palette never gates execution — it
 *    only switches between "go do it" and "go upgrade" routes, plus
 *    surfaces a small "Business" badge so the user understands why.
 */
export function CommandPalette({
  open,
  onOpenChange,
  pages,
  currentPageId,
  publicUrl,
  features,
}: CommandPaletteProps) {
  const router = useRouter();

  const currentPage =
    pages.find((p) => p.id === currentPageId) ?? pages[0] ?? null;

  // Helper: close the palette, then run the navigation/action. cmdk fires
  // the select callback synchronously; `setTimeout(0)` ensures the dialog
  // close transition starts before navigation, which avoids the brief
  // flash of stale palette state on the new route.
  const run = (fn: () => void) => {
    onOpenChange(false);
    setTimeout(fn, 0);
  };

  const goPage = (href: string) => run(() => router.push(href as Route));

  // Trigger a quick action on the page editor. If the user is already on
  // /me the action is dispatched as a custom event; otherwise we store it
  // in sessionStorage and navigate — LinksPageClient picks it up on mount.
  const triggerEditorAction = (action: string) => {
    run(() => {
      const isOnMe = window.location.pathname === "/me";
      if (isOnMe) {
        window.dispatchEvent(
          new CustomEvent("cmd-palette-action", { detail: action }),
        );
      } else {
        sessionStorage.setItem("kioar:pending-palette-action", action);
        router.push("/me" as Route);
      }
    });
  };

  const copy = async (value: string, successMessage: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(successMessage);
    } catch {
      toast.error("کپی انجام نشد. لطفاً دستی کپی کنید.");
    }
  };

  const copyPageLink = () =>
    run(() => void copy(publicUrl, "لینک صفحه کپی شد."));

  const copyPageId = () =>
    run(() => void copy(currentPageId, "شناسه‌ی صفحه کپی شد."));

  const openPublic = () =>
    run(() => window.open(publicUrl, "_blank", "noopener,noreferrer"));

  // Plan-aware billing entry — same ladder as the sidebar upgrade card.
  const planBilling = currentPage
    ? currentPage.planKey === "free"
      ? {
          label: "ارتقا به Pro",
          icon: SparklesIcon,
          href: "/pro" as const,
        }
      : currentPage.planKey === "pro"
        ? {
            label: "ارتقا به Business",
            icon: SparklesIcon,
            href: `/dashboard/pages/${currentPageId}/billing/plans` as const,
          }
        : {
            label: "مدیریت اشتراک",
            icon: CreditCardIcon,
            href: `/dashboard/pages/${currentPageId}/billing` as const,
          }
    : null;

  // Discount entry only makes sense on Free / Pro pages (display-only).
  const showDiscountEntry =
    currentPage !== null && currentPage.planKey !== "business";

  return (
    <>
      <CommandDialog
        open={open}
        onOpenChange={onOpenChange}
        title="جستجو در کیوار"
        description="میان‌برهای سراسری برای حرکت سریع در داشبورد."
      >
        <CommandInput placeholder="جستجو در کیوار..." />
        <CommandList>
          <CommandEmpty>چیزی پیدا نشد.</CommandEmpty>

          {/* ── Group 1 — Navigation ──────────────────────────────── */}
          <CommandGroup heading="رفتن به">
            <CommandItem
              value="nav-dashboard"
              keywords={["dashboard", "home", "داشبورد", "خانه"]}
              onSelect={() => goPage("/dashboard")}
            >
              <HomeIcon />
              <span>داشبورد</span>
            </CommandItem>
            <CommandItem
              value="nav-page"
              keywords={["editor", "page", "links", "لینک من", "ویرایش"]}
              onSelect={() => goPage("/me")}
            >
              <LayoutGridIcon />
              <span>لینک من</span>
            </CommandItem>
            <CommandItem
              value="nav-analytics"
              keywords={["stats", "analytics", "آمار", "بازدید"]}
              onSelect={() =>
                goPage(`/dashboard/pages/${currentPageId}/analytics`)
              }
            >
              <BarChart3Icon />
              <span>آمار</span>
            </CommandItem>
            <CommandItem
              value="nav-bookings"
              keywords={["bookings", "رزرو", "نوبت"]}
              onSelect={() => goPage("/bookings")}
            >
              <CalendarClockIcon />
              <span>هماهنگی‌ها</span>
            </CommandItem>
            <CommandItem
              value="nav-forms"
              keywords={["forms", "submissions", "ارسال", "فرم"]}
              onSelect={() => goPage("/forms")}
            >
              <FormInputIcon />
              <span>پاسخ‌های فرم</span>
            </CommandItem>
            <CommandItem
              value="nav-events"
              keywords={["events", "رویداد"]}
              onSelect={() => goPage("/my-events")}
            >
              <CalendarDaysIcon />
              <span>رویدادها</span>
            </CommandItem>
            <CommandItem
              value="nav-card-request"
              keywords={["card", "request", "کارت", "درخواست"]}
              onSelect={() => goPage("/premium")}
            >
              <ScrollTextIcon />
              <span>کارت هوشمند</span>
            </CommandItem>
            <CommandItem
              value="nav-billing"
              keywords={[
                "billing",
                "plan",
                "subscription",
                "صورت‌حساب",
                "پلن",
                "اشتراک",
              ]}
              onSelect={() =>
                goPage(`/dashboard/pages/${currentPageId}/billing`)
              }
            >
              <ReceiptIcon />
              <span>پلن و صورت‌حساب</span>
            </CommandItem>

            <CommandItem
              value="nav-notifications"
              keywords={["notifications", "اعلان"]}
              onSelect={() => goPage("/dashboard/notifications")}
            >
              <BellIcon />
              <span>اعلان‌ها</span>
            </CommandItem>
            <CommandItem
              value="nav-profile"
              keywords={["profile", "account", "پروفایل", "حساب"]}
              onSelect={() => goPage("/dashboard/account")}
            >
              <UserIcon />
              <span>پروفایل کاربری</span>
            </CommandItem>
            <CommandItem
              value="nav-help"
              keywords={["help", "support", "راهنما", "پشتیبانی"]}
              onSelect={() => goPage("/help")}
            >
              <HelpCircleIcon />
              <span>راهنما و پشتیبانی</span>
            </CommandItem>
            <CommandItem
              value="nav-referral"
              keywords={["referral", "invite", "دعوت", "دوست"]}
              onSelect={() => goPage("/dashboard/referral")}
            >
              <GiftIcon />
              <span>دعوت دوستان</span>
            </CommandItem>
          </CommandGroup>

          <CommandSeparator />

          {/* ── Group 2 — Quick Actions ───────────────────────────── */}
          <CommandGroup heading="اقدامات سریع">
            <CommandItem
              value="action-add-link"
              keywords={[
                "link",
                "add",
                "new link",
                "افزودن لینک",
                "لینک جدید",
                "بلاک",
              ]}
              onSelect={() => triggerEditorAction("add-block")}
            >
              <LinkIcon />
              <span>افزودن لینک / بلاک جدید</span>
            </CommandItem>
            <CommandItem
              value="action-add-booking"
              keywords={["booking", "reservation", "رزرو", "نوبت"]}
              onSelect={() =>
                features.bookings
                  ? triggerEditorAction("add-booking")
                  : goPage(`/dashboard/pages/${currentPageId}/billing/plans`)
              }
            >
              <CalendarClockIcon />
              <span>افزودن بلاک رزرو</span>
              {!features.bookings && <LockedPill />}
            </CommandItem>
            <CommandItem
              value="action-add-form"
              keywords={["form", "contact", "فرم", "تماس"]}
              onSelect={() =>
                features.contactForm
                  ? triggerEditorAction("add-form")
                  : goPage(`/dashboard/pages/${currentPageId}/billing/plans`)
              }
            >
              <MailQuestionIcon />
              <span>افزودن فرم تماس</span>
              {!features.contactForm && <LockedPill />}
            </CommandItem>
            <CommandItem
              value="action-view-public"
              keywords={[
                "public",
                "view",
                "open",
                "site",
                "مشاهده",
                "صفحه عمومی",
              ]}
              onSelect={openPublic}
            >
              <ExternalLinkIcon />
              <span>مشاهده صفحه‌ی عمومی</span>
              <CommandShortcut>
                {publicUrl.replace(/^https?:\/\//, "")}
              </CommandShortcut>
            </CommandItem>
            <CommandItem
              value="action-copy-link"
              keywords={["copy", "share", "url", "کپی", "لینک", "اشتراک"]}
              onSelect={copyPageLink}
            >
              <CopyIcon />
              <span>کپی لینک صفحه</span>
            </CommandItem>
            {planBilling ? (
              <CommandItem
                value="action-billing"
                keywords={[
                  "upgrade",
                  "plan",
                  "subscription",
                  "ارتقا",
                  "اشتراک",
                  "پلن",
                ]}
                onSelect={() => goPage(planBilling.href)}
              >
                <planBilling.icon />
                <span>{planBilling.label}</span>
              </CommandItem>
            ) : null}
          </CommandGroup>

          <CommandSeparator />

          {/* ── Group 3 — Tools ───────────────────────────────────── */}
          <CommandGroup heading="ابزارها">
            {showDiscountEntry ? (
              <CommandItem
                value="tool-discount"
                keywords={["discount", "promo", "code", "کد", "تخفیف"]}
                onSelect={() =>
                  goPage(`/dashboard/pages/${currentPageId}/billing#discount`)
                }
              >
                <TagIcon />
                <span>وارد کردن کد تخفیف</span>
              </CommandItem>
            ) : null}
            <CommandItem
              value="tool-invoices"
              keywords={["invoices", "billing", "صورت‌حساب", "فاکتور"]}
              onSelect={() =>
                goPage(`/dashboard/pages/${currentPageId}/billing#invoices`)
              }
            >
              <ReceiptIcon />
              <span>مشاهده صورت‌حساب‌ها</span>
            </CommandItem>
            <CommandItem
              value="tool-csv-export"
              keywords={["csv", "export", "خروجی", "آمار"]}
              onSelect={() =>
                goPage(
                  features.csvExport
                    ? `/dashboard/pages/${currentPageId}/analytics?export=csv`
                    : `/dashboard/pages/${currentPageId}/billing/plans`,
                )
              }
            >
              <FileBoxIcon />
              <span>خروج CSV از آمار</span>
              {!features.csvExport && <ProLockedPill />}
            </CommandItem>
            <CommandItem
              value="tool-copy-page-id"
              keywords={["page id", "uuid", "debug", "شناسه", "آیدی"]}
              onSelect={copyPageId}
            >
              <CopyIcon />
              <span>کپی شناسه صفحه</span>
              <CommandShortcut dir="ltr">
                {currentPageId.slice(0, 6)}…
              </CommandShortcut>
            </CommandItem>
          </CommandGroup>

          <CommandSeparator />

          {/* ── Group 5 — Help ────────────────────────────────────── */}
          <CommandGroup heading="راهنما">
            <CommandItem
              value="help-search"
              keywords={["help", "docs", "راهنما"]}
              onSelect={() => goPage("/help")}
            >
              <HelpCircleIcon />
              <span>جستجو در راهنما</span>
            </CommandItem>
            <CommandItem
              value="help-contact"
              keywords={["support", "contact", "پشتیبانی", "تماس"]}
              onSelect={() => goPage("/help")}
            >
              <MessageCircleQuestionIcon />
              <span>تماس با پشتیبانی</span>
            </CommandItem>
            <CommandItem
              value="help-report"
              keywords={["report", "bug", "issue", "مشکل", "گزارش"]}
              onSelect={() => goPage("/help")}
            >
              <MegaphoneIcon />
              <span>گزارش مشکل</span>
            </CommandItem>
            <CommandItem
              value="help-changelog"
              keywords={["changelog", "what's new", "جدید", "تغییرات"]}
              onSelect={() => goPage("/help")}
            >
              <SparklesIcon />
              <span>چه چیز جدید است؟</span>
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}

/**
 * Hook that wires ⌘K (Cmd on macOS, Ctrl elsewhere) to open the
 * palette. Mirrors the input-focus bail-out used by the sidebar
 * shortcut so typing in inputs/textareas/contentEditable elements
 * isn't intercepted.
 */
export function useCommandPaletteShortcut(toggle: () => void) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "k" && event.key !== "K") return;
      if (!(event.metaKey || event.ctrlKey)) return;
      const target = event.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || target.isContentEditable) {
          // Only swallow inside inputs when the user is *not* using ⌘K
          // — but ⌘K is rarely a native input shortcut, so preempting
          // is fine. Keeping the bail-out for parity with sidebar logic.
          return;
        }
      }
      event.preventDefault();
      toggle();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggle]);
}

// Re-exported for callers that build their own trigger button to
// duck-type the icon prop without importing lucide directly.
export const _commandPaletteIcons = {
  LogInIcon,
};
