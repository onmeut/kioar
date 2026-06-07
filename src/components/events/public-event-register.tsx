"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2Icon,
  ClockIcon,
  QrCodeIcon,
  UploadIcon,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { QrCard } from "@/components/dashboard/qr-card";
import { AddToCalendar } from "@/components/events/add-to-calendar";
import { userShortUrl } from "@/lib/site";
import { cn } from "@/lib/utils";
import { toPersianDigits } from "@/lib/date/persian";
import { REGISTRATION_STATUS_LABELS } from "@/lib/events/labels";
import type { PublicEventView } from "@/lib/events/queries";
import {
  applyDiscountAction,
  cancelRegistrationAction,
  registerAction,
  submitReceiptAction,
} from "@/app/[slug]/e/[eventSlug]/actions";

type Props = {
  event: PublicEventView;
  isLoggedIn: boolean;
  currentUserId: string | null;
};

export function PublicEventRegister({
  event,
  isLoggedIn,
  currentUserId,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const reg = event.viewerRegistration;

  // Already registered → show the status + next-step affordances.
  if (reg && reg.status !== "cancelled" && reg.status !== "rejected") {
    return (
      <RegisteredState
        event={event}
        status={reg.status}
        expected={reg.expectedToman}
        currentUserId={currentUserId}
      />
    );
  }

  if (event.isPast) {
    return (
      <p className="rounded-2xl bg-muted px-4 py-3 text-center text-sm text-muted-foreground">
        این رویداد به پایان رسیده است.
      </p>
    );
  }
  if (event.status === "cancelled") {
    return (
      <p className="rounded-2xl bg-rose-50 px-4 py-3 text-center text-sm text-rose-700">
        این رویداد لغو شده است.
      </p>
    );
  }
  if (event.isFull && !event.waitlistEnabled) {
    return (
      <p className="rounded-2xl bg-muted px-4 py-3 text-center text-sm text-muted-foreground">
        ظرفیت تکمیل است.
      </p>
    );
  }

  return (
    <RegisterForm
      event={event}
      isLoggedIn={isLoggedIn}
      pending={pending}
      onSubmit={(answers, discountCode) =>
        startTransition(async () => {
          const result = await registerAction(event.pageSlug, event.slug, {
            answers,
            discountCode,
          });
          if (result.ok) {
            toast.success("ثبت‌نام شما ثبت شد.");
            router.refresh();
          } else if ("redirect" in result) {
            router.push(result.redirect as never);
          } else {
            toast.error(result.message);
          }
        })
      }
    />
  );
}

function RegisterForm({
  event,
  isLoggedIn,
  pending,
  onSubmit,
}: {
  event: PublicEventView;
  isLoggedIn: boolean;
  pending: boolean;
  onSubmit: (
    answers: Record<string, string | string[]>,
    discountCode: string | null,
  ) => void;
}) {
  const [answers, setAnswers] = useState<Record<string, string | string[]>>(
    {},
  );
  const [code, setCode] = useState("");
  const [applied, setApplied] = useState<{
    amount: number;
    discount: number;
  } | null>(null);
  const [applying, startApply] = useTransition();

  function setAnswer(id: string, value: string | string[]) {
    setAnswers((p) => ({ ...p, [id]: value }));
  }

  return (
    <div className="space-y-4">
      {event.questions.length > 0 ? (
        <div className="space-y-4">
          {event.questions.map((q) => (
            <div key={q.id} className="space-y-1.5">
              <label className="text-sm font-medium">
                {q.label}
                {q.required ? <span className="text-rose-500"> *</span> : null}
              </label>
              {q.kind === "long_text" ? (
                <Textarea
                  value={(answers[q.id] as string) ?? ""}
                  onChange={(e) => setAnswer(q.id, e.target.value)}
                  className="min-h-24"
                />
              ) : q.kind === "short_text" ? (
                <Input
                  value={(answers[q.id] as string) ?? ""}
                  onChange={(e) => setAnswer(q.id, e.target.value)}
                />
              ) : q.kind === "single_select" ? (
                <div className="flex flex-wrap gap-2">
                  {(q.options ?? []).map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setAnswer(q.id, opt)}
                      className={cn(
                        "rounded-full border px-3 py-1.5 text-sm transition-colors",
                        answers[q.id] === opt
                          ? "border-foreground bg-foreground text-background"
                          : "border-border hover:bg-muted",
                      )}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {(q.options ?? []).map((opt) => {
                    const cur = (answers[q.id] as string[]) ?? [];
                    const on = cur.includes(opt);
                    return (
                      <button
                        key={opt}
                        type="button"
                        onClick={() =>
                          setAnswer(
                            q.id,
                            on
                              ? cur.filter((o) => o !== opt)
                              : [...cur, opt],
                          )
                        }
                        className={cn(
                          "rounded-full border px-3 py-1.5 text-sm transition-colors",
                          on
                            ? "border-foreground bg-foreground text-background"
                            : "border-border hover:bg-muted",
                        )}
                      >
                        {opt}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : null}

      {event.priceType === "paid" ? (
        <div className="space-y-2 rounded-2xl bg-muted/40 p-3">
          <p className="text-sm font-semibold">
            مبلغ:{" "}
            {toPersianDigits(
              (applied?.amount ?? event.priceToman).toLocaleString("en-US"),
            )}{" "}
            تومان
            {applied ? (
              <span className="ms-2 text-xs text-emerald-700">
                ({toPersianDigits(applied.discount.toLocaleString("en-US"))}{" "}
                تومان تخفیف)
              </span>
            ) : null}
          </p>
          <div className="flex gap-2">
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="کد تخفیف"
              dir="ltr"
              autoCapitalize="characters"
              className="flex-1 font-mono"
            />
            <Button
              type="button"
              variant="outline"
              className="h-11"
              disabled={applying || !code.trim()}
              onClick={() =>
                startApply(async () => {
                  const r = await applyDiscountAction(
                    event.pageSlug,
                    event.slug,
                    code.trim(),
                  );
                  if (r.ok) {
                    setApplied({
                      amount: r.amountToman,
                      discount: r.discountToman,
                    });
                    toast.success("کد تخفیف اعمال شد.");
                  } else {
                    setApplied(null);
                    toast.error(r.message);
                  }
                })
              }
            >
              اعمال
            </Button>
          </div>
        </div>
      ) : null}

      <Button
        type="button"
        className="h-12 w-full text-base font-bold"
        disabled={pending}
        onClick={() => onSubmit(answers, applied ? code.trim() : null)}
      >
        {pending
          ? "در حال ثبت…"
          : isLoggedIn
            ? event.isFull
              ? "افزودن به فهرست انتظار"
              : "ثبت‌نام در رویداد"
            : "ورود و ثبت‌نام"}
      </Button>
      {!isLoggedIn ? (
        <p className="text-center text-xs text-muted-foreground">
          برای ثبت‌نام با پیامک احراز هویت می‌شوید؛ بعد به همین صفحه برمی‌گردید.
        </p>
      ) : null}
    </div>
  );
}

function RegisteredState({
  event,
  status,
  expected,
  currentUserId,
}: {
  event: PublicEventView;
  status: string;
  expected: number;
  currentUserId: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);
  const [qrOpen, setQrOpen] = useState(false);

  const needsReceipt =
    status === "payment_pending" && event.receiptUploadEnabled;
  const confirmed = status === "approved" || status === "attended";

  return (
    <div className="space-y-3">
      <div
        className={cn(
          "flex items-center gap-2 rounded-2xl px-4 py-3 text-sm",
          confirmed
            ? "bg-emerald-50 text-emerald-700"
            : "bg-amber-50 text-amber-800",
        )}
      >
        {confirmed ? (
          <CheckCircle2Icon className="size-4 shrink-0" />
        ) : (
          <ClockIcon className="size-4 shrink-0" />
        )}
        وضعیت شما: {REGISTRATION_STATUS_LABELS[
          status as keyof typeof REGISTRATION_STATUS_LABELS
        ] ?? status}
      </div>

      {/* Paid + receipt OFF: attendee owes money but uploads no receipt; the
          host confirms out-of-band. Show amount + how-to-pay so they know
          where to send it. */}
      {!confirmed &&
      !needsReceipt &&
      event.priceType === "paid" &&
      expected > 0 ? (
        <div className="space-y-2 rounded-2xl border border-border p-3">
          <p className="text-sm">
            مبلغ قابل پرداخت:{" "}
            {toPersianDigits(expected.toLocaleString("en-US"))} تومان
          </p>
          {event.paymentInstructions ? (
            <p className="whitespace-pre-line text-xs text-muted-foreground">
              {event.paymentInstructions}
            </p>
          ) : null}
        </div>
      ) : null}

      {needsReceipt ? (
        <div className="space-y-2 rounded-2xl border border-border p-3">
          <p className="text-sm">
            مبلغ قابل پرداخت:{" "}
            {toPersianDigits(expected.toLocaleString("en-US"))} تومان
          </p>
          {event.paymentInstructions ? (
            <p className="whitespace-pre-line text-xs text-muted-foreground">
              {event.paymentInstructions}
            </p>
          ) : null}
          <p className="text-xs text-muted-foreground">
            پس از پرداخت، تصویر رسید را آپلود کنید تا میزبان تأیید کند.
          </p>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const fd = new FormData();
              fd.set("receipt", file);
              startTransition(async () => {
                const r = await submitReceiptAction(
                  event.pageSlug,
                  event.slug,
                  fd,
                );
                if (r.ok) {
                  toast.success("رسید ارسال شد.");
                  router.refresh();
                } else {
                  toast.error(r.message ?? "خطا در ارسال رسید.");
                }
              });
            }}
          />
          <Button
            type="button"
            className="h-11 w-full"
            disabled={pending}
            onClick={() => fileRef.current?.click()}
          >
            <UploadIcon className="size-4" />
            {pending ? "در حال ارسال…" : "آپلود رسید پرداخت"}
          </Button>
        </div>
      ) : null}

      {confirmed && event.locationType === "online" && event.onlineUrl ? (
        <a
          href={event.onlineUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="block rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-center text-sm font-semibold text-emerald-700"
        >
          لینک ورود به رویداد آنلاین
        </a>
      ) : null}

      {confirmed && !event.isPast ? (
        <div className="space-y-2">
          <AddToCalendar
            title={event.title}
            description={event.description}
            location={
              event.locationType === "physical"
                ? event.locationAddress
                : event.onlineUrl
            }
            startsAt={new Date(event.startsAt).toISOString()}
            endsAt={event.endsAt ? new Date(event.endsAt).toISOString() : null}
            timezone={event.timezone}
            uid={event.id}
            url={`https://kioar.com/${event.pageSlug}/e/${event.slug}`}
          />
          {currentUserId ? (
            <Button
              type="button"
              variant="outline"
              className="h-11 w-full"
              onClick={() => setQrOpen(true)}
            >
              <QrCodeIcon className="size-4" />
              نمایش کد QR برای ورود
            </Button>
          ) : null}
        </div>
      ) : null}

      {currentUserId ? (
        <Sheet open={qrOpen} onOpenChange={setQrOpen}>
          <SheetContent side="bottom">
            <SheetHeader>
              <SheetTitle>کد QR شما</SheetTitle>
            </SheetHeader>
            <div className="p-4 pt-0">
              <p className="mb-4 text-center text-sm text-muted-foreground">
                این کد را در ورودی رویداد به میزبان نشان دهید.
              </p>
              <QrCard
                url={userShortUrl(currentUserId)}
                title="کد QR کی‌یوآر من"
              />
            </div>
          </SheetContent>
        </Sheet>
      ) : null}

      {!event.isPast && status !== "attended" ? (
        <Button
          type="button"
          variant="outline"
          className="h-11 w-full text-muted-foreground"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const r = await cancelRegistrationAction(
                event.pageSlug,
                event.slug,
              );
              if (r.ok) {
                toast.success("ثبت‌نام شما لغو شد.");
                router.refresh();
              } else {
                toast.error(r.message ?? "خطا در لغو ثبت‌نام.");
              }
            })
          }
        >
          لغو ثبت‌نام
        </Button>
      ) : null}
    </div>
  );
}
