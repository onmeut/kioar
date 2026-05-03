"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { CalendarClockIcon, CheckCircle2Icon, GiftIcon } from "lucide-react";
import { toast } from "sonner";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BoringAvatar } from "@/components/shared/boring-avatar";
import { toPersianDigits } from "@/lib/persian";
import { cn } from "@/lib/utils";

/**
 * Visual page picker for redeeming a referral credit. Replaces the old
 * dropdown — every owned page renders as a card with avatar, slug, plan
 * badge, and current `currentPeriodEnd`. The CTA button on each card
 * applies one month and shows a celebratory toast with the new expiry
 * date.
 */
export type RedeemablePage = {
  id: string;
  slug: string;
  fullName: string | null;
  avatarUrl: string | null;
  avatarSeed: string | null;
  domain: string | null;
  planKey: "free" | "pro" | "business" | null;
  currentPeriodEnd: Date | null;
  shareHost: string;
};

const planLabel: Record<string, string> = {
  free: "رایگان",
  pro: "پرو",
  business: "بیزنس",
};

const planTone: Record<string, string> = {
  free: "border-zinc-200 bg-zinc-100 text-zinc-700",
  pro: "border-violet-200 bg-violet-50 text-violet-700",
  business: "border-amber-200 bg-amber-50 text-amber-800",
};

function formatFa(date: Date): string {
  return toPersianDigits(
    new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium" }).format(date),
  );
}

export function RedeemGrid({
  pages,
  available,
}: {
  pages: RedeemablePage[];
  available: number;
}) {
  const router = useRouter();
  const [pendingId, setPendingId] = React.useState<string | null>(null);

  if (pages.length === 0) {
    return null;
  }

  async function redeem(page: RedeemablePage) {
    if (available < 1 || pendingId) return;
    setPendingId(page.id);
    const t = toast.loading("در حال اعمال یک ماه پرو…");
    try {
      const res = await fetch("/api/referrals/redeem", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ pageId: page.id }),
      });
      const json = (await res.json()) as
        | { ok: true; newPeriodEnd: string }
        | { ok: false; errorCode: string; message?: string };
      if (!json.ok) {
        toast.error("اعمال نشد", {
          id: t,
          description: messageForError(json.errorCode),
        });
        return;
      }
      const newEnd = new Date(json.newPeriodEnd);
      toast.success("یک ماه پرو اضافه شد 🎉", {
        id: t,
        description: `اشتراک «${page.fullName ?? page.slug}» تا ${formatFa(newEnd)} تمدید شد.`,
      });
      router.refresh();
    } catch (err) {
      toast.error("اتصال شکست خورد", {
        id: t,
        description: (err as Error).message,
      });
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {pages.map((page) => {
        const eligible = page.planKey !== "free";
        const isPending = pendingId === page.id;
        const tone = planTone[page.planKey ?? "free"] ?? planTone.free;
        const periodEnd = page.currentPeriodEnd
          ? formatFa(page.currentPeriodEnd)
          : "—";
        return (
          <div
            key={page.id}
            className={cn(
              "group relative flex flex-col gap-3 rounded-2xl border p-4 transition",
              eligible
                ? "border-zinc-200 bg-white hover:border-violet-300 hover:shadow-sm"
                : "border-dashed border-zinc-200 bg-zinc-50/60",
            )}
          >
            <div className="flex items-start gap-3">
              <Avatar size="lg" className="size-12 shrink-0">
                {page.avatarUrl ? (
                  <AvatarImage src={page.avatarUrl} alt={page.slug} />
                ) : null}
                <AvatarFallback>
                  <BoringAvatar seed={page.avatarSeed ?? page.slug} size={48} />
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-bold text-zinc-900">
                    {page.fullName?.trim() || page.slug}
                  </p>
                  <Badge
                    variant="outline"
                    className={cn(
                      "shrink-0 border text-[10px] font-bold",
                      tone,
                    )}
                  >
                    {planLabel[page.planKey ?? "free"]}
                  </Badge>
                </div>
                <p
                  className="mt-0.5 truncate font-mono text-[11px] text-zinc-500"
                  dir="ltr"
                >
                  {page.shareHost}/{page.slug}
                </p>
                <div className="mt-2 inline-flex items-center gap-1 text-[11px] text-zinc-500">
                  <CalendarClockIcon className="size-3.5" />
                  <span>پایان دوره: </span>
                  <span dir="ltr" className="font-semibold text-zinc-700">
                    {periodEnd}
                  </span>
                </div>
              </div>
            </div>

            {eligible ? (
              <Button
                type="button"
                size="sm"
                className="h-10 w-full gap-2"
                disabled={available < 1 || isPending}
                onClick={() => redeem(page)}
              >
                {isPending ? (
                  <>در حال اعمال…</>
                ) : (
                  <>
                    <GiftIcon className="size-4" />
                    اعمال یک ماه پرو
                  </>
                )}
              </Button>
            ) : (
              <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] leading-5 text-amber-900">
                <CheckCircle2Icon className="size-4 shrink-0" />
                <span>
                  این صفحه روی پلن رایگانه. اول پرو یا بیزنس فعال کن تا اعتبار
                  معنا پیدا کنه.
                </span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function messageForError(code: string): string {
  switch (code) {
    case "no_credit":
      return "اعتبارت کافی نیست.";
    case "page_not_owned":
      return "این صفحه به شما تعلق نداره.";
    case "subscription_missing":
      return "اشتراک این صفحه پیدا نشد.";
    case "free_plan":
      return "روی پلن رایگان نمی‌شه اعتبار اعمال کرد.";
    default:
      return "خطایی رخ داد. دوباره تلاش کن.";
  }
}
