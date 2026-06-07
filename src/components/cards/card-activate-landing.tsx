"use client";

import Image from "next/image";
import Link from "next/link";
import { useActionState, useState } from "react";

import {
  activateCardAction,
  type ActivateState,
} from "@/app/c/[id]/activate-actions";
import { SubmitButton } from "@/components/shared/submit-button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

type PageOption = { id: string; slug: string; fullName: string | null };

const idle: ActivateState = { status: "idle" };

/**
 * "Activate this card" landing for an unassigned (gift) card on `/c/{id}`.
 *
 * Logged-in users pick which of their pages the card should point to and bind
 * it (one-time, via `activateCardAction`). Logged-out users get a login CTA;
 * after signing in they re-tap the card to land back here, now authenticated.
 */
export function CardActivateLanding({
  cardId,
  isLoggedIn,
  pages,
}: {
  cardId: string;
  isLoggedIn: boolean;
  pages: PageOption[];
}) {
  const [state, formAction] = useActionState(activateCardAction, idle);
  const [selected, setSelected] = useState<string>(pages[0]?.id ?? "");

  return (
    <main
      dir="rtl"
      className="flex min-h-dvh items-center justify-center bg-muted px-4 py-10"
    >
      <div className="w-full max-w-sm space-y-6 text-center">
        <div className="space-y-3">
          <Image
            src="/brand/logo.svg"
            alt="کی‌یو‌آر"
            width={28}
            height={32}
            className="mx-auto h-8 w-auto"
          />
          <h1 className="text-2xl font-bold text-foreground">فعال‌سازی کارت</h1>
          <p className="text-sm text-muted-foreground">
            این کارت کی‌یو‌آر آماده‌ی فعال‌سازی است. آن را به یکی از صفحه‌هایتان
            متصل کنید تا با هر تپ، صفحه‌ی شما باز شود.
          </p>
        </div>

        {!isLoggedIn ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              برای فعال‌سازی، ابتدا وارد حساب کی‌یو‌آر خود شوید، سپس دوباره کارت
              را تپ کنید.
            </p>
            <Link
              href="/auth"
              className="tap-target inline-flex h-12 w-full items-center justify-center rounded-full bg-foreground px-6 text-sm font-medium text-background"
            >
              ورود / ثبت‌نام
            </Link>
          </div>
        ) : pages.length === 0 ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              هنوز هیچ صفحه‌ای ندارید. ابتدا یک صفحه بسازید و بعد کارت را فعال
              کنید.
            </p>
            <Link
              href="/me"
              className="tap-target inline-flex h-12 w-full items-center justify-center rounded-full bg-foreground px-6 text-sm font-medium text-background"
            >
              ساخت صفحه
            </Link>
          </div>
        ) : (
          <form action={formAction} className="space-y-5 text-start">
            <input type="hidden" name="cardId" value={cardId} />
            <input type="hidden" name="pageId" value={selected} />
            <div className="space-y-2">
              <Label>این کارت به کدام صفحه متصل شود؟</Label>
              <RadioGroup
                value={selected}
                onValueChange={setSelected}
                className="space-y-2"
              >
                {pages.map((p) => (
                  <label
                    key={p.id}
                    htmlFor={`page-${p.id}`}
                    className="tap-target flex cursor-pointer items-center gap-3 rounded-2xl border border-border bg-background p-3"
                  >
                    <RadioGroupItem value={p.id} id={`page-${p.id}`} />
                    <span className="flex flex-col">
                      <span className="text-sm font-medium text-foreground">
                        {p.fullName || p.slug}
                      </span>
                      <span dir="ltr" className="text-xs text-muted-foreground">
                        kioar.com/{p.slug}
                      </span>
                    </span>
                  </label>
                ))}
              </RadioGroup>
            </div>

            {state.status === "error" && state.message ? (
              <p className="text-sm text-destructive">{state.message}</p>
            ) : null}

            <SubmitButton className="h-12 w-full rounded-full">
              فعال‌سازی کارت
            </SubmitButton>
          </form>
        )}
      </div>
    </main>
  );
}
