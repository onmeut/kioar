"use client";

import * as React from "react";

import {
  CalendarClockIcon,
  CheckCircle2Icon,
  CrownIcon,
  ExternalLinkIcon,
  MousePointerClickIcon,
  UserPlusIcon,
} from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { KioarAvatar } from "@/components/shared/kioar-avatar";
import {
  DEFAULT_PROFILE_DOMAIN,
  isProfileDomain,
  profileShareUrl,
} from "@/lib/profile-domains";
import { toPersianDigits } from "@/lib/persian";
import { cn } from "@/lib/utils";

/**
 * Social wall — recent referrals with avatars, slugs, and status pills.
 *
 * Identity rules:
 *
 *   - When the referee has signed up + has a profile: show their
 *     avatar, fullName, and a clickable @slug → public URL.
 *   - When the referee is `clicked` only (no signup): render a "ghost"
 *     row with no PII ("کسی ۳ روز پیش روی لینک شما کلیک کرد").
 *   - When `rewarded`: emerald accent border + "پرو شد 🎉" badge.
 *
 * Lives in `/components/referral/` so the public landing page can
 * later reuse it for "what others say" sections, but currently only
 * mounted from /dashboard/referral.
 */
export type ReferralFeedClientRow = {
  id: string;
  status: string;
  refereeName: string | null;
  refereeSlug: string | null;
  refereeAvatarUrl: string | null;
  refereeAvatarSeed: string | null;
  refereeDomain: string | null;
  refereePlanKey: "free" | "pro" | "business" | null;
  clickedAt: string;
  signedUpAt: string | null;
  convertedAt: string | null;
  rewardedAt: string | null;
};

const STATUS: Record<
  string,
  {
    label: string;
    tone: string;
    icon: React.ComponentType<{ className?: string }>;
  }
> = {
  clicked: {
    label: "کلیک",
    tone: "border-zinc-200 bg-zinc-100 text-zinc-700",
    icon: MousePointerClickIcon,
  },
  signed_up: {
    label: "ثبت‌نام شد",
    tone: "border-sky-200 bg-sky-50 text-sky-800",
    icon: UserPlusIcon,
  },
  converted: {
    label: "خرید کرد",
    tone: "border-amber-200 bg-amber-50 text-amber-900",
    icon: CrownIcon,
  },
  rewarded: {
    label: "پرو شد 🎉",
    tone: "border-violet-300 bg-violet-50 text-violet-800",
    icon: CrownIcon,
  },
  rejected: {
    label: "رد شد",
    tone: "border-rose-200 bg-rose-50 text-rose-800",
    icon: CheckCircle2Icon,
  },
  flagged: {
    label: "بررسی",
    tone: "border-rose-200 bg-rose-50 text-rose-800",
    icon: CheckCircle2Icon,
  },
};

export function ReferralFeed({ rows }: { rows: ReferralFeedClientRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="px-6 py-10 text-center">
        <p className="text-sm font-bold text-foreground">
          هنوز هیچ ثبت‌نامی نداری
        </p>
        <p className="mx-auto mt-2 max-w-sm text-xs leading-6 text-muted-foreground">
          لینک شخصیت رو توی استوری اینستا، یه پیام واتس‌اپی، یا بایوی پروفایلت
          بذار. اولین ثبت‌نام‌ها معمولاً همون اولِ راهن.
        </p>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-border">
      {rows.map((r) => (
        <Row key={r.id} row={r} />
      ))}
    </ul>
  );
}

function Row({ row }: { row: ReferralFeedClientRow }) {
  const isGhost = row.status === "clicked" || !row.refereeSlug;
  const isHero = row.status === "rewarded";
  const meta = STATUS[row.status] ?? STATUS.clicked;
  const Icon = meta.icon;

  const timestamp = relativeFa(
    row.rewardedAt ?? row.convertedAt ?? row.signedUpAt ?? row.clickedAt,
  );

  const profileUrl = row.refereeSlug
    ? profileShareUrl(
        row.refereeSlug,
        isProfileDomain(row.refereeDomain ?? "")
          ? (row.refereeDomain ?? DEFAULT_PROFILE_DOMAIN)
          : DEFAULT_PROFILE_DOMAIN,
      )
    : null;

  return (
    <li
      className={cn(
        "flex items-center gap-3 px-4 py-3 sm:px-6",
        isHero && "border-r-4 border-violet-400 bg-violet-50/30",
      )}
    >
      {/* Avatar */}
      <div className="shrink-0">
        {isGhost ? (
          <div className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <MousePointerClickIcon className="size-4" />
          </div>
        ) : (
          <Avatar size="default" className="size-10">
            {row.refereeAvatarUrl ? (
              <AvatarImage
                src={row.refereeAvatarUrl}
                alt={row.refereeName ?? row.refereeSlug ?? ""}
              />
            ) : null}
            <AvatarFallback>
              <KioarAvatar
                seed={row.refereeAvatarSeed ?? row.refereeSlug ?? row.id}
                size={40}
              />
            </AvatarFallback>
          </Avatar>
        )}
      </div>

      {/* Identity */}
      <div className="min-w-0 flex-1">
        {isGhost ? (
          <>
            <p className="truncate text-sm font-semibold text-foreground">
              کسی روی لینک شما کلیک کرد
            </p>
            <p className="text-[11px] text-muted-foreground">
              {timestamp} • هنوز ثبت‌نام نکرده
            </p>
          </>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <p className="truncate text-sm font-bold text-foreground">
                {row.refereeName?.trim() || `@${row.refereeSlug}`}
              </p>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              {profileUrl ? (
                <a
                  href={profileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 truncate font-mono text-muted-foreground hover:text-primary"
                  dir="ltr"
                >
                  @{row.refereeSlug}
                  <ExternalLinkIcon className="size-3" />
                </a>
              ) : (
                <span dir="ltr" className="truncate font-mono">
                  @{row.refereeSlug}
                </span>
              )}
              <span aria-hidden>•</span>
              <span className="inline-flex items-center gap-1">
                <CalendarClockIcon className="size-3" />
                {timestamp}
              </span>
            </div>
          </>
        )}
      </div>

      {/* Status pill */}
      <Badge
        variant="outline"
        className={cn(
          "shrink-0 inline-flex items-center gap-1 border text-[11px] font-bold",
          meta.tone,
        )}
      >
        <Icon className="size-3" />
        {meta.label}
      </Badge>
    </li>
  );
}

function relativeFa(iso: string): string {
  const date = new Date(iso);
  const now = Date.now();
  const diffMin = Math.floor((now - date.getTime()) / 60000);
  if (diffMin < 1) return "همین الان";
  if (diffMin < 60) return `${toPersianDigits(diffMin)} دقیقه پیش`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${toPersianDigits(diffHour)} ساعت پیش`;
  const diffDay = Math.floor(diffHour / 24);
  if (diffDay < 30) return `${toPersianDigits(diffDay)} روز پیش`;
  return toPersianDigits(
    new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium" }).format(date),
  );
}
