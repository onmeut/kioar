"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import Image from "next/image";
import { Share2Icon, SparklesIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PhoneMockupFrame } from "@/components/dashboard/phone-mockup-frame";
import { ProfilePreviewMock } from "@/components/dashboard/profile-preview-mock";
import type { PublicProfileCardData } from "@/components/public/public-profile-card";

// PhoneMockupFrame is exactly 340 × 690 px.
const PW = 340;
const PH = 690;

/**
 * Render phone at `scale` occupying exactly the scaled pixel area.
 * transformOrigin "top center" keeps content centered inside the clipping box.
 */
function ScaledPhone({ scale, profile }: { scale: number; profile: PublicProfileCardData }) {
  const w = Math.round(PW * scale);
  const h = Math.round(PH * scale);
  return (
    <div style={{ width: w, height: h, overflow: "hidden", flexShrink: 0, position: "relative" }}>
      <div style={{
        width: PW,
        height: PH,
        transform: `scale(${scale})`,
        transformOrigin: "top center",
        position: "absolute",
        top: 0,
        left: "50%",
        marginLeft: -(PW / 2),
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
  onComplete: () => void;
};

export function NewPageCelebration({ previewProfile, onComplete }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [visible, setVisible] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Enrich preview with dummy contact so call/email buttons show in the mockup
  const richProfile: PublicProfileCardData = {
    ...previewProfile,
    publicPhone: previewProfile.publicPhone ?? "09123456789",
    email: previewProfile.email ?? "you@example.com",
  };

  useEffect(() => {
    setMounted(true);
    if (searchParams.get("new") === "1") {
      setVisible(true);
      const next = new URLSearchParams(searchParams.toString());
      next.delete("new");
      const qs = next.toString();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      router.replace((pathname + (qs ? `?${qs}` : "")) as any, { scroll: false });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!visible) return;
    // zIndex must exceed our overlay (99999) so confetti paints on top
    const Z = 999999;
    const colors = ["#1ED760", "#ffffff", "#f97316", "#3b82f6", "#facc15", "#a855f7", "#ec4899"];

    import("canvas-confetti").then(({ default: confetti }) => {
      // Big opening salvo from center
      confetti({ particleCount: 180, spread: 100, origin: { y: 0.45 }, colors, zIndex: Z, ticks: 300, decay: 0.93 });

      // Continuous side cannons for 2.5 s
      const interval = setInterval(() => {
        confetti({ particleCount: 55, angle: 60, spread: 70, origin: { x: 0, y: 0.6 }, colors, zIndex: Z, ticks: 260, decay: 0.92 });
        confetti({ particleCount: 55, angle: 120, spread: 70, origin: { x: 1, y: 0.6 }, colors, zIndex: Z, ticks: 260, decay: 0.92 });
      }, 220);

      // Extra mid-screen burst at 600 ms
      setTimeout(() => {
        confetti({ particleCount: 140, spread: 120, origin: { y: 0.38, x: 0.5 }, colors, zIndex: Z, ticks: 320, decay: 0.94 });
      }, 600);

      // Stop the cannons at 2.6 s
      setTimeout(() => clearInterval(interval), 2600);
    });
  }, [visible]);

  if (!mounted || !visible) return null;

  function dismiss() { setVisible(false); }
  function complete() { setVisible(false); onComplete(); }

  // Static header row matching the public profile page header
  const mockupHeader = (
    <div className="flex items-center justify-between">
      <div className="inline-flex size-10 items-center justify-center rounded-full bg-foreground/[0.07]">
        <Image src="/brand/logo.svg" alt="" width={17} height={21} />
      </div>
      <div className="inline-flex size-10 items-center justify-center rounded-full bg-foreground/[0.07]">
        <Share2Icon className="size-4.5" />
      </div>
    </div>
  );

  // Enrich ProfilePreviewMock via headerSlot — we need to render PublicProfileCard directly
  // to pass headerSlot. ProfilePreviewMock doesn't expose that prop, so we inline the same
  // pattern: wrap ScaledPhone but inject header via a custom profile preview below.
  // Actually ProfilePreviewMock just wraps PublicProfileCard — let's use it with the
  // richProfile that already has publicPhone + email. The headerSlot goes into
  // PublicProfileCard directly. We need a custom ScaledPhoneWithHeader.

  return createPortal(
    <div className="fixed inset-0 bg-background" style={{ zIndex: 99999 }}>

      {/* ── MOBILE ── */}
      <div className="flex h-full flex-col lg:hidden">
        <div className="flex flex-col items-center gap-3 px-6 pt-8 pb-2 text-center">
          <Image src="/brand/logo.svg" alt="کیوآر" width={28} height={34} className="h-8 w-auto" />
          <h1 className="text-2xl font-bold">به کیوآر خوش‌آمدی!</h1>
          <p className="text-sm text-muted-foreground">
            صفحه‌ات آماده‌ست. اطلاعاتت رو کامل کن تا دیده بشی.
          </p>
        </div>

        <div className="flex flex-1 items-start justify-center overflow-hidden pt-5">
          <ScaledPhone scale={0.72} profile={richProfile} />
        </div>

        <div className="shrink-0 space-y-2 border-t px-5 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3">
          <Button
            type="button"
            onClick={complete}
            className="h-12 w-full gap-2 rounded-full text-sm font-bold"
            style={{ backgroundColor: "var(--brand)", color: "var(--brand-foreground)" }}
          >
            <SparklesIcon className="size-4" />
            تکمیل اطلاعات
          </Button>
          <button
            type="button"
            onClick={dismiss}
            className="h-11 w-full text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            بعداً
          </button>
        </div>
      </div>

      {/* ── DESKTOP ── */}
      <div className="hidden h-full lg:grid lg:grid-cols-2">

        {/* Left — text centered */}
        <div className="flex flex-col items-center justify-center gap-10 px-16 text-center">
          <div className="flex flex-col items-center gap-5">
            <Image src="/brand/logo.svg" alt="کیوآر" width={32} height={39} className="h-12 w-auto" />
            <div className="space-y-3">
              <h1 className="text-3xl font-bold">به کیوآر خوش‌آمدی!</h1>
              <p className="text-base text-muted-foreground leading-relaxed">
                صفحه‌ات آماده‌ست. اطلاعاتت رو کامل کن
                <br />
                تا مخاطباتت پیداتت کنن.
              </p>
            </div>
          </div>
          <div className="flex w-full max-w-xs flex-col gap-2">
            <Button
              type="button"
              onClick={complete}
              className="h-12 w-full gap-2 rounded-full text-sm font-bold"
              style={{ backgroundColor: "var(--brand)", color: "var(--brand-foreground)" }}
            >
              <SparklesIcon className="size-4" />
              تکمیل اطلاعات
            </Button>
            <button
              type="button"
              onClick={dismiss}
              className="h-11 w-full text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              بعداً
            </button>
          </div>
        </div>

        {/* Right — phone on bg-muted (same as public page bg) */}
        <div className="flex items-center justify-center bg-muted">
          <ScaledPhoneWithHeader scale={0.9} profile={richProfile} header={mockupHeader} />
        </div>

      </div>
    </div>,
    document.body
  );
}

/**
 * Same as ScaledPhone but renders PublicProfileCard directly so we can
 * inject the headerSlot (logo + share icon row matching the public page).
 */
function ScaledPhoneWithHeader({
  scale,
  profile,
  header,
}: {
  scale: number;
  profile: PublicProfileCardData;
  header: React.ReactNode;
}) {
  const { PublicProfileCard } = require("@/components/public/public-profile-card");
  const w = Math.round(PW * scale);
  const h = Math.round(PH * scale);
  return (
    <div style={{ width: w, height: h, overflow: "hidden", flexShrink: 0, position: "relative" }}>
      <div style={{
        width: PW,
        height: PH,
        transform: `scale(${scale})`,
        transformOrigin: "top center",
        position: "absolute",
        top: 0,
        left: "50%",
        marginLeft: -(PW / 2),
      }}>
        <PhoneMockupFrame>
          <PublicProfileCard
            profile={profile}
            interactive={false}
            headerSlot={header}
            className="min-h-full lg:p-6! lg:rounded-none! lg:shadow-none!"
          />
        </PhoneMockupFrame>
      </div>
    </div>
  );
}
