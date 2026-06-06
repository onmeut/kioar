import type { Metadata } from "next";
import Link from "next/link";
import { and, desc, eq, inArray } from "drizzle-orm";
import {
  CheckCircle2,
  Clock,
  Package,
  PackageCheck,
  Truck,
  XCircle,
} from "lucide-react";

import { RepointControl } from "@/components/cards/repoint-control";
import { BrandMark } from "@/components/shared/brand-mark";
import { getDb } from "@/db";
import { cardOrders, cards } from "@/db/schema";
import { requireCompletedProfile } from "@/lib/auth/session";
import { resolveCurrentPageForOwner, listPagesForOwner } from "@/lib/pages";
import { formatPersianDateTime, formatPersianNumber } from "@/lib/persian";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "سفارش‌های کارت" };

const MATERIAL_LABEL: Record<string, string> = {
  colorful: "بانکی (PVC)",
  metal: "پریمیوم (فلزی)",
};

type StatusMeta = {
  label: string;
  description: string;
  icon: React.ElementType;
  color: string;
  bg: string;
  border: string;
  step: number; // 1-4 for progress bar
};

const STATUS_META: Record<string, StatusMeta> = {
  pending_payment: {
    label: "در انتظار پرداخت",
    description: "پرداخت هنوز تأیید نشده است.",
    icon: Clock,
    color: "#f59e0b",
    bg: "rgba(245,158,11,0.07)",
    border: "rgba(245,158,11,0.2)",
    step: 1,
  },
  paid: {
    label: "پرداخت تأیید شد",
    description: "سفارش شما در صف آماده‌سازی است.",
    icon: CheckCircle2,
    color: "#1ed760",
    bg: "rgba(30,215,96,0.07)",
    border: "rgba(30,215,96,0.2)",
    step: 2,
  },
  processing: {
    label: "در حال آماده‌سازی",
    description: "کارت شما دارد چاپ و برنامه‌ریزی می‌شود.",
    icon: Package,
    color: "#60a5fa",
    bg: "rgba(96,165,250,0.07)",
    border: "rgba(96,165,250,0.2)",
    step: 2,
  },
  shipped: {
    label: "ارسال شد",
    description: "کارت شما در راه است.",
    icon: Truck,
    color: "#a78bfa",
    bg: "rgba(167,139,250,0.07)",
    border: "rgba(167,139,250,0.2)",
    step: 3,
  },
  fulfilled: {
    label: "تحویل داده شد",
    description: "کارت شما به دستتان رسیده است.",
    icon: PackageCheck,
    color: "#1ed760",
    bg: "rgba(30,215,96,0.07)",
    border: "rgba(30,215,96,0.2)",
    step: 4,
  },
  cancelled: {
    label: "لغو شده",
    description: "این سفارش لغو شده است.",
    icon: XCircle,
    color: "#f87171",
    bg: "rgba(248,113,113,0.07)",
    border: "rgba(248,113,113,0.2)",
    step: 0,
  },
};

const STEPS = ["ثبت سفارش", "آماده‌سازی", "ارسال", "تحویل"];

// Card face color mapping (same as Card3D)
function cardBgHex(material: string, color: string): string {
  if (material === "metal") return "#000000";
  const map: Record<string, string> = {
    black: "#141414",
    white: "#ececec",
    silver: "#cfd3d6",
    gold: "#c9a23b",
    green: "#1f7a4d",
    blue: "#2455c7",
    pink: "#e58aa8",
  };
  return map[color] ?? "#141414";
}

function isDark(material: string, color: string): boolean {
  if (material === "metal") return true;
  return ["black", "green", "blue"].includes(color);
}

export default async function CardOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ placed?: string; status?: string }>;
}) {
  const viewer = await requireCompletedProfile();
  const sp = await searchParams;

  // Orders are scoped to the current page (each page has its own card).
  const currentPage = await resolveCurrentPageForOwner(viewer.user.id);

  const db = getDb();
  const orders = await db
    .select()
    .from(cardOrders)
    .where(
      and(
        eq(cardOrders.userId, viewer.user.id),
        ...(currentPage ? [eq(cardOrders.pageId, currentPage.id)] : []),
      ),
    )
    .orderBy(desc(cardOrders.createdAt));

  const cardIds = orders.map((o) => o.cardId).filter((x): x is string => !!x);
  const cardRows =
    cardIds.length > 0
      ? await db
          .select({ id: cards.id, pageId: cards.pageId, status: cards.status })
          .from(cards)
          .where(inArray(cards.id, cardIds))
      : [];
  const cardById = new Map(cardRows.map((c) => [c.id, c]));
  const ownerPages = (await listPagesForOwner(viewer.user.id)).map((p) => ({
    id: p.id,
    slug: p.slug,
    fullName: p.fullName,
  }));

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 px-4 py-8 sm:py-12">
      {/* Header */}
      <header className="flex flex-col items-center gap-4 text-center">
        <BrandMark variant="mark" className="size-10 opacity-80" />
        <div className="space-y-1.5">
          <h1 className="text-2xl font-bold text-foreground sm:text-3xl">
            سفارش کارت هوشمند
          </h1>
          <p className="text-sm text-muted-foreground">
            وضعیت سفارش کارت فیزیکی شما
          </p>
        </div>
      </header>

      {/* Toast messages */}
      {sp.placed ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          سفارش شما با موفقیت ثبت شد. به‌زودی با شما هماهنگ می‌کنیم.
        </div>
      ) : null}
      {sp.status === "cancelled" ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          پرداخت لغو شد. در صورت تمایل دوباره تلاش کنید.
        </div>
      ) : null}
      {sp.status === "failed" ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          پرداخت ناموفق بود.
        </div>
      ) : null}

      {orders.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border p-10 text-center space-y-4">
          <p className="text-sm text-muted-foreground">هنوز سفارشی ندارید.</p>
          <Link
            href="/cards"
            className="inline-flex h-10 items-center justify-center rounded-full bg-foreground px-6 text-sm font-semibold text-background transition-opacity hover:opacity-80"
          >
            سفارش کارت
          </Link>
        </div>
      ) : (
        <ul className="space-y-5">
          {orders.map((o) => {
            const meta = STATUS_META[o.status] ?? STATUS_META.paid;
            const StatusIcon = meta.icon;
            const bg = cardBgHex(o.material, o.color);
            const dark = isDark(o.material, o.color);
            const isCancelled = o.status === "cancelled";
            const isActive = !isCancelled;

            return (
              <li key={o.id} className="overflow-hidden rounded-3xl border border-border bg-card">
                {/* Card visual + status hero */}
                <div
                  className="relative flex items-center justify-between gap-4 overflow-hidden p-5 sm:p-6"
                  style={{ background: bg }}
                >
                  {/* Dot grid overlay */}
                  <div
                    aria-hidden
                    className="pointer-events-none absolute inset-0 opacity-[0.14]"
                    style={{
                      backgroundImage:
                        "radial-gradient(rgba(255,255,255,0.3) 1px, transparent 1px)",
                      backgroundSize: "18px 18px",
                    }}
                  />

                  {/* Card mini-preview (left, visually right in RTL) */}
                  <div
                    className="relative shrink-0 rounded-xl shadow-xl"
                    style={{
                      width: 90,
                      aspectRatio: "1.586",
                      background: bg,
                      border: dark ? "1px solid rgba(255,255,255,0.12)" : "1px solid rgba(0,0,0,0.12)",
                    }}
                  >
                    <div className="flex h-full items-center justify-center p-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={dark ? "/brand/logo-white.svg" : "/brand/logo.svg"}
                        alt="kioar"
                        className="w-10 opacity-80"
                      />
                    </div>
                  </div>

                  {/* Status info */}
                  <div className="relative flex-1 min-w-0 text-end">
                    <p
                      className="text-[10px] font-medium uppercase tracking-widest opacity-60"
                      style={{ color: dark ? "#fff" : "#000" }}
                    >
                      {MATERIAL_LABEL[o.material] ?? o.material}
                    </p>
                    <p
                      className="truncate text-lg font-bold mt-0.5"
                      style={{ color: dark ? "#fff" : "#000" }}
                      dir="ltr"
                    >
                      {o.nameOnCard}
                    </p>
                    <div
                      className="mt-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold"
                      style={{ background: meta.bg, border: `1px solid ${meta.border}`, color: meta.color }}
                    >
                      <StatusIcon className="size-3 shrink-0" />
                      {meta.label}
                    </div>
                  </div>
                </div>

                {/* Progress steps — only for active orders */}
                {isActive && meta.step > 0 ? (
                  <div className="border-t border-border px-5 py-4 sm:px-6">
                    <div className="flex items-center gap-0">
                      {STEPS.map((label, i) => {
                        const stepNum = i + 1;
                        const done = meta.step > stepNum;
                        const active = meta.step === stepNum;
                        return (
                          <div key={i} className="flex flex-1 items-center">
                            <div className="flex flex-col items-center gap-1">
                              <div
                                className={`size-5 rounded-full flex items-center justify-center text-[9px] font-bold transition-colors ${
                                  done
                                    ? "bg-foreground text-background"
                                    : active
                                      ? "bg-foreground text-background ring-4 ring-foreground/15"
                                      : "bg-muted text-muted-foreground"
                                }`}
                              >
                                {done ? "✓" : stepNum}
                              </div>
                              <span
                                className={`text-[9px] whitespace-nowrap font-medium ${
                                  done || active ? "text-foreground" : "text-muted-foreground"
                                }`}
                              >
                                {label}
                              </span>
                            </div>
                            {i < STEPS.length - 1 ? (
                              <div
                                className={`mb-4 h-px flex-1 mx-1 transition-colors ${
                                  done ? "bg-foreground" : "bg-border"
                                }`}
                              />
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : null}

                {/* Order detail row */}
                <div className="border-t border-border px-5 py-4 sm:px-6">
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-3">
                    <div>
                      <dt className="text-xs text-muted-foreground">مبلغ پرداختی</dt>
                      <dd className="mt-0.5 font-medium text-foreground">
                        {o.amountToman > 0
                          ? `${formatPersianNumber(o.amountToman)} تومان`
                          : "رایگان"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">شهر ارسال</dt>
                      <dd className="mt-0.5 font-medium text-foreground">
                        {o.province} • {o.city}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">تاریخ ثبت</dt>
                      <dd className="mt-0.5 font-medium text-foreground">
                        {formatPersianDateTime(o.createdAt)}
                      </dd>
                    </div>
                  </dl>
                </div>

                {/* Repoint control — only when card is assigned */}
                {o.cardId && cardById.get(o.cardId)?.status === "assigned" ? (
                  <div className="border-t border-border px-5 py-4 sm:px-6">
                    <RepointControl
                      cardId={o.cardId}
                      currentPageId={cardById.get(o.cardId)?.pageId ?? null}
                      pages={ownerPages}
                    />
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      {/* New order CTA — only if all orders are cancelled */}
      {orders.length > 0 && orders.every((o) => o.status === "cancelled") ? (
        <div className="text-center">
          <Link
            href="/cards"
            className="inline-flex h-11 items-center justify-center rounded-full bg-foreground px-8 text-sm font-semibold text-background transition-opacity hover:opacity-80"
          >
            سفارش مجدد
          </Link>
        </div>
      ) : null}
    </div>
  );
}
