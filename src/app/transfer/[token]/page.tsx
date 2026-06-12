/**
 * `/transfer/[token]` — public landing for a page-ownership transfer link.
 *
 * The token is a single-use locator only: it identifies WHICH transfer this
 * is, never authorizes acceptance. Three visitor states:
 *
 *   1. Logged out → show the offer + a "sign up / log in" CTA. After they
 *      authenticate with the matching phone, the in-app prompt (mounted in
 *      the (app) layout, keyed by phone) surfaces the transfer automatically.
 *      No pending-intent cookie is needed — the DB row is the source of truth.
 *   2. Logged in, phone matches → inline accept/reject (the action re-asserts
 *      the phone match server-side).
 *   3. Logged in, phone does NOT match → explain it's addressed to another
 *      number; offer to switch accounts.
 *
 * Visual language mirrors /invited (bg-muted page, floating pill navbar,
 * bg-card cards, no borders/shadows). No gradients (hard project rule).
 */
import type { Metadata } from "next";

import Image from "next/image";
import Link from "next/link";

import { ArrowRightLeftIcon, ClockIcon } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { KioarAvatar } from "@/components/shared/kioar-avatar";
import { TransferAcceptButtons } from "@/components/public/transfer-accept-buttons";
import { getCurrentViewer } from "@/lib/auth/session";
import { toPersianDigits } from "@/lib/date/persian";
import { formatPhoneDisplay } from "@/lib/phone";
import { getTransferByToken } from "@/lib/transfer-service";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "انتقال صفحه — کی‌یو‌آر",
  robots: { index: false, follow: false },
};

type Params = Promise<{ token: string }>;

export default async function TransferLandingPage({
  params,
}: {
  params: Params;
}) {
  const { token } = await params;

  const [transfer, viewer] = await Promise.all([
    getTransferByToken(token),
    getCurrentViewer(),
  ]);

  const isPending =
    transfer?.status === "pending" &&
    transfer.expiresAt.getTime() > Date.now();

  const pageLabel =
    transfer?.page?.fullName?.trim() ||
    transfer?.page?.title?.trim() ||
    (transfer?.page ? `/${transfer.page.slug}` : "یک صفحه");

  const phoneMatches =
    Boolean(viewer) && viewer!.user.phone === transfer?.toPhone;

  return (
    <div
      dir="rtl"
      className="relative min-h-dvh bg-muted font-sans pt-[env(safe-area-inset-top)]"
    >
      {/* Floating pill navbar (mirrors /invited) */}
      <div className="sticky top-4 z-30 mx-auto w-full max-w-3xl px-4">
        <header className="flex h-16 w-full items-center justify-between rounded-full bg-card pl-2 pr-5 ring-1 ring-border">
          <Link
            href="/"
            aria-label="کیوآر"
            className="flex items-center gap-2 transition-opacity hover:opacity-80"
          >
            <Image
              src="/brand/logo.svg"
              alt=""
              width={20}
              height={24}
              className="h-6 w-auto"
              priority
            />
            <span className="hidden text-lg font-bold sm:inline">کیوآر</span>
          </Link>
        </header>
      </div>

      <section className="mx-auto w-full max-w-md space-y-5 px-4 pb-16 pt-10 sm:pt-14">
        <div className="flex flex-col items-center gap-3 text-center">
          <span className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <ArrowRightLeftIcon className="size-7" />
          </span>
          <h1 className="text-2xl font-bold leading-tight sm:text-3xl">
            درخواست انتقال صفحه
          </h1>
        </div>

        {/* No transfer / not pending / expired */}
        {!transfer || !isPending ? (
          <div className="flex flex-col items-center gap-3 rounded-3xl bg-card p-6 text-center">
            <ClockIcon className="size-8 text-muted-foreground" />
            <p className="text-sm font-bold">این لینک دیگر معتبر نیست</p>
            <p className="text-[13px] leading-7 text-muted-foreground">
              ممکن است درخواست انتقال تأیید، رد، لغو یا منقضی شده باشد. برای
              انتقال جدید از فرستنده بخواهید دوباره لینک بسازد.
            </p>
            <Link
              href="/"
              className="mt-1 flex h-11 items-center justify-center rounded-full bg-foreground px-6 text-sm font-bold text-background transition-colors hover:bg-foreground/90"
            >
              رفتن به کی‌یو‌آر
            </Link>
          </div>
        ) : (
          <>
            {/* Page preview card */}
            <div className="rounded-3xl bg-card p-5">
              <p className="mb-3 text-center text-[13px] leading-7 text-muted-foreground">
                {transfer.fromUser?.phone ? (
                  <>
                    صاحب شماره{" "}
                    <span dir="ltr" className="font-mono font-semibold text-foreground">
                      {toPersianDigits(formatPhoneDisplay(transfer.fromUser.phone))}
                    </span>{" "}
                    می‌خواهد مالکیت این صفحه را به شما منتقل کند.
                  </>
                ) : (
                  "یک نفر می‌خواهد مالکیت این صفحه را به شما منتقل کند."
                )}
              </p>
              <div className="flex items-center gap-3 rounded-2xl bg-muted p-4">
                <Avatar className="size-12 shrink-0 rounded-full">
                  {transfer.page?.avatarUrl ? (
                    <AvatarImage src={transfer.page.avatarUrl} alt={pageLabel} />
                  ) : null}
                  <AvatarFallback>
                    <KioarAvatar
                      seed={transfer.page?.avatarSeed ?? transfer.page?.slug ?? "kioar"}
                      size={48}
                    />
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold">{pageLabel}</p>
                  {transfer.page?.slug ? (
                    <p dir="ltr" className="truncate font-mono text-xs text-muted-foreground">
                      /{transfer.page.slug}
                    </p>
                  ) : null}
                </div>
              </div>
              <p className="mt-3 text-center text-[11px] leading-5 text-muted-foreground">
                با تأیید، صفحه و پلن فعال آن به حساب شما اضافه می‌شود.
              </p>
            </div>

            {/* Action area depends on auth state */}
            <div className="rounded-3xl bg-card p-5">
              {!viewer ? (
                <div className="flex flex-col gap-3 text-center">
                  <p className="text-[13px] leading-7 text-muted-foreground">
                    این انتقال برای شماره{" "}
                    <span dir="ltr" className="font-mono font-semibold text-foreground">
                      {toPersianDigits(formatPhoneDisplay(transfer.toPhone))}
                    </span>{" "}
                    است. برای دریافت، با همین شماره وارد شوید یا ثبت‌نام کنید.
                  </p>
                  <Link
                    href="/auth"
                    className="flex h-12 items-center justify-center rounded-full bg-foreground px-6 text-[15px] font-bold text-background transition-colors hover:bg-foreground/90"
                  >
                    ورود / ثبت‌نام با این شماره
                  </Link>
                </div>
              ) : phoneMatches ? (
                <TransferAcceptButtons token={token} />
              ) : (
                <div className="flex flex-col gap-3 text-center">
                  <p className="text-[13px] leading-7 text-muted-foreground">
                    این انتقال برای شماره‌ی دیگری است:{" "}
                    <span dir="ltr" className="font-mono font-semibold text-foreground">
                      {toPersianDigits(formatPhoneDisplay(transfer.toPhone))}
                    </span>
                    . شما با شماره‌ی دیگری وارد شده‌اید. برای دریافت، با شماره‌ی
                    گیرنده وارد شوید.
                  </p>
                  <Link
                    href="/account"
                    className="flex h-11 items-center justify-center rounded-full bg-muted px-6 text-sm font-bold text-foreground transition-colors hover:bg-muted/80"
                  >
                    رفتن به حساب کاربری
                  </Link>
                </div>
              )}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
