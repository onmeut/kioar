"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Share2Icon } from "lucide-react";
import { IconConfettiFilled, IconCrownFilled } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { PhoneMockupFrame } from "@/components/dashboard/phone-mockup-frame";
import { ProfilePreviewMock } from "@/components/dashboard/profile-preview-mock";
import { ShareModal } from "@/components/dashboard/share/share-modal";
import type { PublicProfileCardData } from "@/components/public/public-profile-card";
import { toPersianDigits } from "@/lib/date/persian";
import { absoluteUrl } from "@/lib/site";

const PW = 340;
const PH = 690;

function ScaledPhone({ scale, profile }: { scale: number; profile: PublicProfileCardData }) {
  const w = Math.round(PW * scale);
  const h = Math.round(PH * scale);
  return (
    <div style={{ width: w, height: h, overflow: "hidden", flexShrink: 0, position: "relative" }} className="pointer-events-none select-none">
      <div style={{
        width: PW, height: PH,
        transform: `scale(${scale})`, transformOrigin: "top center",
        position: "absolute", top: 0, left: "50%", marginLeft: -(PW / 2),
      }}>
        <PhoneMockupFrame>
          <ProfilePreviewMock profile={profile} />
        </PhoneMockupFrame>
      </div>
    </div>
  );
}

type Props = {
  previewProfile: PublicProfileCardData;
  /** ISO string of trial end date. Null = free plan, no active trial. */
  trialEndsAt: string | null;
  pageId: string;
  onClose: () => void;
};

function getDaysRemaining(isoDate: string): number {
  const end = new Date(isoDate);
  const now = new Date();
  const ms = end.getTime() - now.getTime();
  return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
}

export function ActivationStepDone({ previewProfile, trialEndsAt, pageId, onClose }: Props) {
  const daysLeft = trialEndsAt ? getDaysRemaining(trialEndsAt) : null;
  const isOnTrial = daysLeft !== null && daysLeft > 0;
  const [shareOpen, setShareOpen] = useState(false);

  const publicUrl = absoluteUrl(`/${previewProfile.slug}`);

  useEffect(() => {
    let cancelled = false;
    const colors = ["#1ED760", "#ffffff", "#f97316", "#3b82f6", "#facc15", "#a855f7", "#ec4899"];
    const Z = 999999;

    import("canvas-confetti").then(({ default: confetti }) => {
      if (cancelled) return;
      confetti({ particleCount: 80, spread: 90, origin: { y: 0.45 }, colors, zIndex: Z, ticks: 60, decay: 0.9 });
    });
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Scrollable content */}
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto pb-4">
        {/* Headline */}
        <div className="space-y-3 pt-2 text-center">
          <div className="flex justify-center">
            <div className="flex size-16 items-center justify-center rounded-2xl bg-foreground text-background">
              <IconConfettiFilled className="size-8" />
            </div>
          </div>
          <h2 className="text-2xl font-bold">صفحه‌ات آماده‌ی انتشاره!</h2>
          {isOnTrial ? (
            <p className="text-sm text-muted-foreground leading-relaxed">
              برای دسترسی به امکانات حرفه‌ای می‌تونی اشتراکت رو به پرو ارتقا بدی. فعلا پلن حرفه‌ای تا{" "}
              <span className="font-semibold text-foreground">
                {toPersianDigits(daysLeft!)} روز دیگه
              </span>{" "} برات فعال هست.     </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              صفحه‌ات آماده‌ست.
            </p>
          )}
        </div>

        {/* Phone preview — fills remaining space, hidden on desktop */}
        <div className="flex min-h-0 flex-1 justify-center overflow-hidden sm:hidden">
          <ScaledPhone scale={0.68} profile={previewProfile} />
        </div>
      </div>

      {/* CTAs — sticky to bottom */}
      <div className="shrink-0 border-t pt-4 flex flex-col gap-3">
        <Button
          render={<Link href="/pro" />}
          className="h-12 w-full gap-2 rounded-full text-sm font-bold"
        >
          <IconCrownFilled className="size-4" />
          خرید اشتراک
        </Button>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="h-12 flex-1 rounded-full text-sm font-bold"
          >
            بستن
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => setShareOpen(true)}
            className="h-12 flex-1 gap-2 rounded-full text-sm font-bold"
          >
            <Share2Icon className="size-4" />
            اشتراک‌گذاری
          </Button>
        </div>
      </div>

      <ShareModal
        open={shareOpen}
        onOpenChange={setShareOpen}
        publicUrl={publicUrl}
        slug={previewProfile.slug}
        displayHost={`kioar.com/${previewProfile.slug}`}
        displayName={previewProfile.fullName ?? previewProfile.slug}
        pageId={pageId}
        canCustomizeQr={false}
      />
    </div>
  );
}
