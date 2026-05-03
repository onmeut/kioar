"use client";

import { useActionState, useState } from "react";
import { CheckIcon } from "lucide-react";

import { createCardRequestAction } from "@/app/(app)/requests/actions";
import { idleState } from "@/lib/action-state";
import { SubmitButton } from "@/components/shared/submit-button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type DesignKey = "design_1" | "design_2" | "design_3";

// Visual placeholders for each card design. Replace the inner JSX with the
// real artwork (e.g. <Image src="/brand/cards/<key>.png" />) once the final
// designs are uploaded.
const CARD_DESIGNS: ReadonlyArray<{
  key: DesignKey;
  label: string;
  preview: React.ReactNode;
}> = [
  {
    key: "design_1",
    label: "طرح کلاسیک",
    preview: (
      <div className="absolute inset-0 bg-emerald-600">
        <div className="absolute inset-x-3 bottom-3 space-y-1 text-white">
          <div className="h-1.5 w-12 rounded-full bg-white/80" />
          <div className="h-1 w-8 rounded-full bg-white/50" />
        </div>
      </div>
    ),
  },
  {
    key: "design_2",
    label: "طرح مدرن",
    preview: (
      <div className="absolute inset-0 bg-zinc-800">
        <div className="absolute inset-x-3 top-3 space-y-1">
          <div className="h-1.5 w-10 rounded-full bg-amber-300" />
          <div className="h-1 w-6 rounded-full bg-white/40" />
        </div>
      </div>
    ),
  },
  {
    key: "design_3",
    label: "طرح مینیمال",
    preview: (
      <div className="absolute inset-0 bg-stone-200">
        <div className="absolute inset-x-3 bottom-3 space-y-1">
          <div className="h-1.5 w-14 rounded-full bg-zinc-900/80" />
          <div className="h-1 w-8 rounded-full bg-zinc-900/40" />
        </div>
      </div>
    ),
  },
];

export function CardRequestForm({
  fullName,
  phone,
}: {
  fullName: string;
  phone: string;
}) {
  const [state, formAction] = useActionState(
    createCardRequestAction,
    idleState,
  );
  const [design, setDesign] = useState<DesignKey>("design_1");

  return (
    <Card className="border-0 bg-transparent shadow-none ring-0">
      <CardContent className="space-y-4 p-0 sm:p-0">
        <form
          action={formAction}
          className="space-y-5"
          onReset={(e) => e.preventDefault()}
          suppressHydrationWarning
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="fullName">نام کامل</Label>
              <Input
                id="fullName"
                name="fullName"
                defaultValue={fullName}
                autoComplete="name"
                enterKeyHint="next"
                className="h-12"
              />
              {state.fieldErrors?.fullName?.[0] ? (
                <p className="text-sm text-destructive">
                  {state.fieldErrors.fullName[0]}
                </p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">شماره تماس</Label>
              <Input
                id="phone"
                name="phone"
                defaultValue={phone}
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                enterKeyHint="next"
                className="h-12"
                dir="ltr"
              />
              {state.fieldErrors?.phone?.[0] ? (
                <p className="text-sm text-destructive">
                  {state.fieldErrors.phone[0]}
                </p>
              ) : null}
            </div>
          </div>

          <div className="space-y-2">
            <Label>نوع کارت</Label>
            <RadioGroup
              name="cardType"
              defaultValue="physical"
              className="grid gap-3"
            >
              <label className="flex items-center gap-3 rounded-3xl border border-border/70 bg-background/70 px-4 py-3">
                <RadioGroupItem value="physical" id="physical" />
                <div>
                  <p className="font-semibold">کارت فیزیکی</p>
                  <p className="text-sm text-muted-foreground">
                    نسخه چاپی کلاسیک برای معرفی حضوری
                  </p>
                </div>
              </label>
              <label className="flex items-center gap-3 rounded-3xl border border-border/70 bg-background/70 px-4 py-3">
                <RadioGroupItem value="nfc" id="nfc" />
                <div>
                  <p className="font-semibold">کارت NFC</p>
                  <p className="text-sm text-muted-foreground">
                    کارت هوشمند برای اشتراک با نزدیک‌کردن گوشی
                  </p>
                </div>
              </label>
            </RadioGroup>
          </div>

          <div className="space-y-3">
            <Label>طرح کارت</Label>
            <input type="hidden" name="cardDesign" value={design} />
            <div className="grid grid-cols-3 gap-3">
              {CARD_DESIGNS.map((opt) => {
                const selected = design === opt.key;
                return (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => setDesign(opt.key)}
                    aria-pressed={selected}
                    className={cn(
                      "group relative flex flex-col gap-2 rounded-3xl border bg-background/70 p-2 text-start transition-colors",
                      selected
                        ? "border-primary ring-2 ring-primary/30"
                        : "border-border/70 hover:border-border",
                    )}
                  >
                    <div className="relative aspect-[1.586/1] w-full overflow-hidden rounded-2xl">
                      {opt.preview}
                      {selected ? (
                        <span className="absolute end-1.5 top-1.5 inline-flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground shadow">
                          <CheckIcon className="size-3.5" />
                        </span>
                      ) : null}
                    </div>
                    <span className="px-1 text-xs font-semibold">
                      {opt.label}
                    </span>
                  </button>
                );
              })}
            </div>
            {state.fieldErrors?.cardDesign?.[0] ? (
              <p className="text-sm text-destructive">
                {state.fieldErrors.cardDesign[0]}
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="deliveryInfo">اطلاعات ارسال یا تحویل</Label>
            <Textarea
              id="deliveryInfo"
              name="deliveryInfo"
              className="min-h-28 rounded-3xl"
              placeholder="آدرس کامل، شهر، کدپستی یا توضیح نحوه تحویل را بنویسید."
            />
            {state.fieldErrors?.deliveryInfo?.[0] ? (
              <p className="text-sm text-destructive">
                {state.fieldErrors.deliveryInfo[0]}
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">یادداشت</Label>
            <Textarea
              id="notes"
              name="notes"
              className="min-h-24 rounded-3xl"
              placeholder="اگر درباره طراحی، رنگ، تیراژ یا زمان تحویل نکته‌ای دارید اینجا بنویسید."
            />
          </div>

          {state.message ? (
            <p className="rounded-3xl bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {state.message}
            </p>
          ) : null}

          <SubmitButton
            type="submit"
            size="lg"
            className="h-12 w-full sm:w-auto"
            pendingLabel="در حال ثبت درخواست..."
          >
            ثبت درخواست
          </SubmitButton>
        </form>
      </CardContent>
    </Card>
  );
}
