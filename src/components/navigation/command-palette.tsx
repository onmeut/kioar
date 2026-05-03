"use client";

import type { Route } from "next";
import { useEffect, useState, useTransition } from "react";
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
  ImageIcon,
  LayoutGridIcon,
  LinkIcon,
  LockIcon,
  LogInIcon,
  MailQuestionIcon,
  MegaphoneIcon,
  MessageCircleQuestionIcon,
  PlusIcon,
  ReceiptIcon,
  ScrollTextIcon,
  ShieldCheckIcon,
  SlidersHorizontalIcon,
  SparklesIcon,
  TagIcon,
  UserIcon,
  UsersIcon,
  VideoIcon,
} from "lucide-react";
import { toast } from "sonner";

import { switchPageAction } from "@/app/(app)/dashboard/pages/actions";
import { CreatePageDialog } from "@/components/dashboard/create-page-dialog";
import { BoringAvatar } from "@/components/shared/boring-avatar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import { cn } from "@/lib/utils";

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
  /** Whether the viewer's user role is `admin`. */
  isAdmin: boolean;
}

const PLAN_LABEL: Record<CommandPalettePage["planKey"], string> = {
  free: "رایگان",
  pro: "پرو",
  business: "بیزنس",
};

function PlanPill({
  planKey,
  isOnTrial,
}: {
  planKey: CommandPalettePage["planKey"];
  isOnTrial: boolean;
}) {
  const label = isOnTrial ? "آزمایشی" : PLAN_LABEL[planKey];
  const color =
    planKey === "free"
      ? "bg-zinc-100 text-zinc-600"
      : planKey === "pro"
        ? "bg-emerald-100 text-emerald-700"
        : "bg-purple-100 text-purple-700";
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-bold",
        color,
      )}
    >
      {label}
    </span>
  );
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
 * Global ⌘K command palette. The shell is plan- and admin-aware:
 *
 *  - Group order is fixed (pages → navigation → quick actions →
 *    tools → help → admin) so muscle-memory works regardless of which
 *    page the user is editing.
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
  isAdmin,
}: CommandPaletteProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [createOpen, setCreateOpen] = useState(false);

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

  const handleSwitchPage = (pageId: string) => {
    if (pageId === currentPageId) {
      onOpenChange(false);
      return;
    }
    onOpenChange(false);
    startTransition(async () => {
      const result = await switchPageAction(pageId);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      router.push("/dashboard");
      router.refresh();
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
        description="میان‌برهای سراسری برای حرکت سریع بین صفحه‌ها، آمار، و ابزارها."
      >
        <CommandInput placeholder="جستجو در کیوار..." />
        <CommandList>
          <CommandEmpty>چیزی پیدا نشد.</CommandEmpty>

          {/* ── Group 1 — Pages ────────────────────────────────────── */}
          <CommandGroup heading="صفحه‌ها">
            {pages.map((page) => {
              const isCurrent = page.id === currentPageId;
              return (
                <CommandItem
                  key={page.id}
                  value={`${page.title}__${page.slug}__${page.id}`}
                  keywords={[page.slug, page.title, `/${page.slug}`]}
                  onSelect={() => handleSwitchPage(page.id)}
                >
                  <Avatar
                    className={cn(
                      "size-7 shrink-0 [&_svg]:size-full!",
                      isCurrent &&
                        "ring-2 ring-foreground ring-offset-2 ring-offset-popover",
                    )}
                  >
                    {page.avatarUrl ? (
                      <AvatarImage src={page.avatarUrl} alt={page.title} />
                    ) : (
                      <AvatarFallback className="bg-transparent p-0">
                        <BoringAvatar seed={page.avatarSeed} size={28} />
                      </AvatarFallback>
                    )}
                  </Avatar>
                  <span className="flex min-w-0 flex-1 flex-col leading-tight">
                    <span className="truncate text-sm font-semibold">
                      {page.title}
                    </span>
                    <span
                      dir="ltr"
                      className="truncate text-start text-[11px] text-muted-foreground"
                    >
                      /{page.slug}
                    </span>
                  </span>
                  <PlanPill planKey={page.planKey} isOnTrial={page.isOnTrial} />
                </CommandItem>
              );
            })}
            <CommandItem
              value="new-page"
              keywords={["page", "create", "new", "صفحه جدید", "ساخت صفحه"]}
              onSelect={() => {
                onOpenChange(false);
                setTimeout(() => setCreateOpen(true), 0);
              }}
            >
              <PlusIcon />
              <span>صفحه‌ی جدید</span>
            </CommandItem>
          </CommandGroup>

          <CommandSeparator />

          {/* ── Group 2 — Navigation ──────────────────────────────── */}
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
              keywords={["editor", "page", "links", "صفحه‌ی من", "ویرایش"]}
              onSelect={() => goPage("/page")}
            >
              <LayoutGridIcon />
              <span>صفحه‌ی من</span>
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
              onSelect={() => goPage("/dashboard/profile")}
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

          {/* ── Group 3 — Quick Actions ───────────────────────────── */}
          <CommandGroup heading="اقدامات سریع">
            <CommandItem
              value="action-add-link"
              keywords={["link", "add", "new link", "افزودن لینک", "لینک جدید"]}
              onSelect={() => goPage("/page?add=link")}
            >
              <LinkIcon />
              <span>افزودن لینک جدید</span>
            </CommandItem>
            <CommandItem
              value="action-add-video"
              keywords={["video", "ویدیو", "بلاک"]}
              onSelect={() => goPage("/page?add=video")}
            >
              <VideoIcon />
              <span>افزودن بلاک ویدیو</span>
            </CommandItem>
            <CommandItem
              value="action-add-image"
              keywords={["image", "gallery", "تصویر", "گالری"]}
              onSelect={() => goPage("/page?add=image")}
            >
              <ImageIcon />
              <span>افزودن بلاک تصویر / گالری</span>
            </CommandItem>
            <CommandItem
              value="action-add-form"
              keywords={["form", "contact", "فرم", "تماس"]}
              onSelect={() =>
                goPage(
                  features.contactForm
                    ? "/page?add=form"
                    : `/dashboard/pages/${currentPageId}/billing/plans`,
                )
              }
            >
              <MailQuestionIcon />
              <span>افزودن فرم تماس</span>
              {!features.contactForm && <LockedPill />}
            </CommandItem>
            <CommandItem
              value="action-add-booking"
              keywords={["booking", "reservation", "رزرو"]}
              onSelect={() =>
                goPage(
                  features.bookings
                    ? "/page?add=booking"
                    : `/dashboard/pages/${currentPageId}/billing/plans`,
                )
              }
            >
              <CalendarClockIcon />
              <span>افزودن بلاک رزرو</span>
              {!features.bookings && <LockedPill />}
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

          {/* ── Group 4 — Tools ───────────────────────────────────── */}
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

          {isAdmin ? (
            <>
              <CommandSeparator />
              {/* ── Group 6 — Admin (admins only) ──────────────────── */}
              <CommandGroup heading="ادمین">
                <CommandItem
                  value="admin-users"
                  keywords={["admin", "users", "کاربران", "ادمین"]}
                  onSelect={() => goPage("/admin/users")}
                >
                  <UsersIcon />
                  <span>جستجوی کاربران</span>
                </CommandItem>
                <CommandItem
                  value="admin-pages"
                  keywords={["admin", "pages", "صفحه‌ها", "ادمین"]}
                  onSelect={() => goPage("/admin/pages")}
                >
                  <LayoutGridIcon />
                  <span>جستجوی صفحه‌ها</span>
                </CommandItem>
                <CommandItem
                  value="admin-billing"
                  keywords={["admin", "invoices", "billing", "صورت‌حساب"]}
                  onSelect={() => goPage("/admin/billing/invoices")}
                >
                  <ReceiptIcon />
                  <span>صورت‌حساب‌ها</span>
                </CommandItem>
                <CommandItem
                  value="admin-plans"
                  keywords={["admin", "plans", "features", "پلن"]}
                  onSelect={() => goPage("/admin/plans")}
                >
                  <SlidersHorizontalIcon />
                  <span>پلن‌ها و قابلیت‌ها</span>
                </CommandItem>
                <CommandItem
                  value="admin-discounts"
                  keywords={["admin", "discounts", "تخفیف"]}
                  onSelect={() => goPage("/admin/discounts")}
                >
                  <TagIcon />
                  <span>تخفیف‌ها</span>
                </CommandItem>
                <CommandItem
                  value="admin-sms"
                  keywords={["admin", "sms", "پیامک"]}
                  onSelect={() => goPage("/admin/sms")}
                >
                  <ShieldCheckIcon />
                  <span>پیامک‌ها</span>
                </CommandItem>
              </CommandGroup>
            </>
          ) : null}
        </CommandList>
      </CommandDialog>

      <CreatePageDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        existingCount={pages.length}
      />
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
