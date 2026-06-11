"use client";

import { useRef, useState, useTransition, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CheckCircle2Icon,
  ClockIcon,
  CopyIcon,
  CreditCardIcon,
  QrCodeIcon,
  UploadIcon,
  XIcon,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { formatShamsiDateTimeInZone } from "@/lib/date/timezone";
import type { PublicTicketType } from "@/lib/events/queries";
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
import type { PublicEventView } from "@/lib/events/queries";
import {
  applyDiscountToRegistrationAction,
  cancelRegistrationAction,
  registerAction,
  submitReceiptAction,
} from "@/app/[slug]/e/[eventSlug]/actions";

type Props = {
  event: PublicEventView;
  isLoggedIn: boolean;
  currentUserId: string | null;
  /** True when the viewer already owns a completed Kioar page. Used to decide
   *  whether to surface the "create your own page" off-ramp after they RSVP. */
  viewerHasPage: boolean;
};

export function PublicEventRegister({
  event,
  isLoggedIn,
  currentUserId,
  viewerHasPage,
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
        ticketTypeId={reg.ticketTypeId}
        currentUserId={currentUserId}
        viewerHasPage={viewerHasPage}
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

  // A tier is selectable when on sale and either has remaining capacity or
  // offers a waitlist. If NO tier is selectable, the event is effectively
  // closed for registration.
  const selectableTiers = event.ticketTypes.filter(
    (t) => t.saleState === "open" && (!t.soldOut || t.waitlistEnabled),
  );
  if (selectableTiers.length === 0) {
    // Distinguish "everything sold out" from "no tiers configured yet".
    const anyOpenButFull = event.ticketTypes.some(
      (t) => t.saleState === "open" && t.soldOut,
    );
    return (
      <p className="rounded-2xl bg-muted px-4 py-3 text-center text-sm text-muted-foreground">
        {anyOpenButFull ? "ظرفیت تکمیل است." : "ثبت‌نام در دسترس نیست."}
      </p>
    );
  }

  return (
    <RegisterForm
      event={event}
      isLoggedIn={isLoggedIn}
      pending={pending}
      onSubmit={(ticketTypeId, answers) =>
        startTransition(async () => {
          const result = await registerAction(event.pageSlug, event.slug, {
            ticketTypeId,
            answers,
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

/** Is a tier selectable (on sale + has room or a waitlist)? */
function isTierSelectable(t: PublicTicketType): boolean {
  return t.saleState === "open" && (!t.soldOut || t.waitlistEnabled);
}

/** One selectable ticket-type card (the Luma-style radio row). */
function TicketCard({
  tier,
  timezone,
  selected,
  selectable,
  onSelect,
}: {
  tier: PublicTicketType;
  timezone: string;
  selected: boolean;
  selectable: boolean;
  onSelect: () => void;
}) {
  const priceLabel =
    tier.priceType === "free"
      ? "رایگان"
      : `${toPersianDigits(tier.priceToman.toLocaleString("en-US"))} تومان`;

  // Status line under the card: sold out / waitlist / sale window / closed.
  let statusLine: { text: string; tone: "muted" | "rose" | "emerald" } | null =
    null;
  if (tier.soldOut) {
    statusLine = tier.waitlistEnabled
      ? { text: "ظرفیت تکمیل شد — فهرست انتظار باز است", tone: "rose" }
      : { text: "ظرفیت تکمیل شد", tone: "rose" };
  } else if (tier.saleState === "ended") {
    statusLine = { text: "مهلت تهیه به پایان رسید", tone: "rose" };
  } else if (tier.saleState === "not_started" && tier.availableFrom) {
    statusLine = {
      text: `فروش از ${formatShamsiDateTimeInZone(tier.availableFrom, timezone)}`,
      tone: "muted",
    };
  } else if (tier.saleState === "inactive") {
    statusLine = { text: "در دسترس نیست", tone: "muted" };
  } else if (tier.availableUntil) {
    statusLine = {
      text: `تا ${formatShamsiDateTimeInZone(tier.availableUntil, timezone)}`,
      tone: "emerald",
    };
  }

  return (
    <button
      type="button"
      disabled={!selectable}
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        "w-full rounded-2xl border p-4 text-start transition-colors",
        selected
          ? "border-foreground bg-background"
          : "border-border bg-muted/40 hover:bg-muted",
        !selectable && "cursor-not-allowed opacity-60",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2">
          <span
            className={cn(
              "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border",
              selected
                ? "border-foreground bg-foreground text-background"
                : "border-muted-foreground/40",
            )}
          >
            {selected ? <CheckCircle2Icon className="size-4" /> : null}
          </span>
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold">{tier.name}</span>
              {tier.approvalRequired ? (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                  نیازمند تأیید
                </span>
              ) : null}
            </div>
            {tier.description ? (
              <p className="text-sm text-muted-foreground">
                {tier.description}
              </p>
            ) : null}
            {statusLine ? (
              <p
                className={cn(
                  "text-xs",
                  statusLine.tone === "rose"
                    ? "text-rose-600"
                    : statusLine.tone === "emerald"
                      ? "text-emerald-600"
                      : "text-muted-foreground",
                )}
              >
                {statusLine.text}
              </p>
            ) : null}
          </div>
        </div>
        <span className="shrink-0 text-sm font-semibold">{priceLabel}</span>
      </div>
    </button>
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
    ticketTypeId: string,
    answers: Record<string, string | string[]>,
  ) => void;
}) {
  const [answers, setAnswers] = useState<Record<string, string | string[]>>(
    {},
  );

  // Default-select the first selectable tier so the common single-tier case is
  // zero-tap. Falls back to the first tier id if (somehow) none are selectable.
  const [selectedId, setSelectedId] = useState<string>(
    () =>
      event.ticketTypes.find(isTierSelectable)?.id ??
      event.ticketTypes[0]?.id ??
      "",
  );

  const selectedTier =
    event.ticketTypes.find((t) => t.id === selectedId) ?? null;

  function setAnswer(id: string, value: string | string[]) {
    setAnswers((p) => ({ ...p, [id]: value }));
  }

  const tierSoldOut = selectedTier?.soldOut ?? false;

  return (
    <div className="space-y-4">
      {/* Ticket-type selector. Single-tier events still render one card so the
          price/approval terms are always explicit. */}
      {event.ticketTypes.length > 0 ? (
        <div className="space-y-2">
          {event.ticketTypes.map((t) => (
            <TicketCard
              key={t.id}
              tier={t}
              timezone={event.timezone}
              selected={t.id === selectedId}
              selectable={isTierSelectable(t)}
              onSelect={() => setSelectedId(t.id)}
            />
          ))}
        </div>
      ) : null}

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

      <Button
        type="button"
        className="h-12 w-full text-base font-bold"
        disabled={pending || !selectedTier || !isTierSelectable(selectedTier)}
        onClick={() => selectedTier && onSubmit(selectedTier.id, answers)}
      >
        {pending
          ? "در حال ثبت…"
          : !isLoggedIn
            ? "ورود و ثبت‌نام"
            : tierSoldOut
              ? "افزودن به فهرست انتظار"
              : selectedTier?.approvalRequired
                ? "درخواست ثبت‌نام"
                : "ثبت‌نام در رویداد"}
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
  ticketTypeId,
  currentUserId,
  viewerHasPage,
}: {
  event: PublicEventView;
  status: string;
  expected: number;
  ticketTypeId: string | null;
  currentUserId: string | null;
  viewerHasPage: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);
  const [qrOpen, setQrOpen] = useState(false);

  // Discount code state for payment_pending step
  const [discountOpen, setDiscountOpen] = useState(false);
  const [discountCode, setDiscountCode] = useState("");
  const [appliedDiscount, setAppliedDiscount] = useState<{
    originalToman: number;
    amountToman: number;
    discountToman: number;
  } | null>(null);
  const [applyingDiscount, startApplyDiscount] = useTransition();

  const needsReceipt =
    status === "payment_pending" && event.receiptUploadEnabled;
  const confirmed = status === "approved" || status === "attended";
  const receiptSubmitted = status === "payment_submitted";

  const statusMessage: Record<string, string> = {
    approved: "ثبت‌نام شما با موفقیت انجام شد.",
    attended: "حضور شما در رویداد ثبت شده است.",
    pending_approval: "ثبت‌نام شما دریافت شد و در انتظار تأیید میزبان است.",
    payment_pending: "ثبت‌نام شما دریافت شد. لطفاً پرداخت را تکمیل کنید.",
    payment_submitted: "رسید پرداخت شما ارسال شد و در انتظار تأیید است.",
    waitlisted: "شما در فهرست انتظار ثبت شدید.",
  };

  // The selected tier for looking up the original price
  const selectedTier =
    ticketTypeId ? event.ticketTypes.find((t) => t.id === ticketTypeId) ?? null : null;

  // Current payable amount: local optimistic state or server-stored amount
  const currentAmount = appliedDiscount?.amountToman ?? expected;
  const originalAmount = appliedDiscount?.originalToman ?? selectedTier?.priceToman ?? expected;

  function handleApplyDiscount() {
    if (!discountCode.trim()) return;
    startApplyDiscount(async () => {
      const r = await applyDiscountToRegistrationAction(
        event.pageSlug,
        event.slug,
        discountCode.trim(),
      );
      if (r.ok) {
        setAppliedDiscount({
          originalToman: r.originalToman,
          amountToman: r.amountToman,
          discountToman: r.discountToman,
        });
        toast.success("کد تخفیف اعمال شد.");
      } else {
        toast.error(r.message);
      }
    });
  }

  function handleRemoveDiscount() {
    startApplyDiscount(async () => {
      const r = await applyDiscountToRegistrationAction(
        event.pageSlug,
        event.slug,
        null,
      );
      if (r.ok) {
        setAppliedDiscount(null);
        setDiscountCode("");
        setDiscountOpen(false);
        toast.success("کد تخفیف حذف شد.");
      } else {
        toast.error(r.message);
      }
    });
  }

  return (
    <div className="space-y-3">
      <div
        className={cn(
          "flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-medium",
          confirmed
            ? "bg-primary text-primary-foreground"
            : receiptSubmitted
              ? "bg-foreground text-background"
              : "bg-muted text-foreground",
        )}
      >
        {confirmed ? (
          <CheckCircle2Icon className="size-4 shrink-0" />
        ) : (
          <ClockIcon className="size-4 shrink-0" />
        )}
        {statusMessage[status] ?? "ثبت‌نام شما ثبت شد."}
      </div>

      {/* Paid tier + receipt OFF: attendee owes money but uploads no receipt;
          the host confirms out-of-band. */}
      {!confirmed && !receiptSubmitted && !needsReceipt && expected > 0 ? (
        <div className="space-y-3 rounded-2xl border border-border p-3">
          <div className="space-y-1" dir="rtl">
            {appliedDiscount ? (
              <p className="text-sm text-muted-foreground line-through">
                {toPersianDigits(originalAmount.toLocaleString("en-US"))} تومان
              </p>
            ) : null}
            <p className="text-base font-bold">
              مبلغ قابل پرداخت:{" "}
              {toPersianDigits(currentAmount.toLocaleString("en-US"))} تومان
            </p>
          </div>
          <PaymentMethods event={event} />
        </div>
      ) : null}

      {needsReceipt ? (
        <div className="space-y-3 rounded-2xl border border-border p-3">
          {/* Amount block */}
          <div className="space-y-1" dir="rtl">
            {appliedDiscount ? (
              <p className="text-sm text-muted-foreground line-through">
                {toPersianDigits(originalAmount.toLocaleString("en-US"))} تومان
              </p>
            ) : null}
            <p className="text-base font-bold">
              مبلغ قابل پرداخت:{" "}
              {toPersianDigits(currentAmount.toLocaleString("en-US"))} تومان
            </p>
          </div>

          {/* Discount code toggle */}
          {selectedTier?.priceType === "paid" ? (
            <div>
              {!appliedDiscount && !discountOpen ? (
                <button
                  type="button"
                  className="text-xs text-primary underline-offset-2 hover:underline"
                  onClick={() => setDiscountOpen(true)}
                >
                  کد تخفیف دارید؟
                </button>
              ) : null}

              {discountOpen && !appliedDiscount ? (
                <div className="flex items-center gap-2">
                  <Input
                    value={discountCode}
                    onChange={(e) =>
                      setDiscountCode(e.target.value.toUpperCase())
                    }
                    placeholder="کد تخفیف"
                    autoCapitalize="characters"
                    inputMode="text"
                    autoComplete="off"
                    enterKeyHint="done"
                    className="h-11 flex-1 rounded-full font-mono md:h-11"
                    disabled={applyingDiscount}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 shrink-0"
                    disabled={applyingDiscount || !discountCode.trim()}
                    onClick={handleApplyDiscount}
                  >
                    اعمال
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="shrink-0 text-muted-foreground"
                    onClick={() => {
                      setDiscountOpen(false);
                      setDiscountCode("");
                    }}
                    aria-label="بستن"
                  >
                    <XIcon className="size-4" />
                  </Button>
                </div>
              ) : null}

              {appliedDiscount ? (
                <div className="flex items-center justify-between rounded-xl border border-border bg-background px-3 py-2">
                  <span className="text-xs font-medium text-foreground">
                    {toPersianDigits(
                      appliedDiscount.discountToman.toLocaleString("en-US"),
                    )}{" "}
                    تومان تخفیف اعمال شد
                  </span>
                  <button
                    type="button"
                    className="text-xs text-foreground hover:underline"
                    onClick={handleRemoveDiscount}
                    disabled={applyingDiscount}
                  >
                    حذف کد
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}

          <PaymentMethods event={event} />
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

      {!event.isPast ? (
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
        <ConfirmDialog
          title="لغو ثبت‌نام"
          description="آیا مطمئن هستید که می‌خواهید ثبت‌نام خود را لغو کنید؟ این عمل قابل بازگشت نیست."
          confirmLabel="بله، لغو کن"
          cancelLabel="انصراف"
          destructive
          onConfirm={() =>
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
          <Button
            type="button"
            variant="outline"
            className="h-11 w-full text-muted-foreground"
            disabled={pending}
          >
            لغو ثبت‌نام
          </Button>
        </ConfirmDialog>
      ) : null}

      {/* Off-ramp: an attendee who doesn't yet own a Kioar page can spin one
          up. Non-blocking — shown only after they've already RSVP'd, so it
          never competes with finishing the registration they came for. */}
      {!viewerHasPage ? (
        <div className="space-y-2 rounded-2xl border border-border p-4 text-center">
          <p className="text-sm font-semibold">صفحه‌ی خودت رو توی کیوآر بساز</p>
          <p className="text-xs text-muted-foreground">
            لینک‌ها، رویدادها و فرم‌هات رو یک‌جا داشته باش.
          </p>
          <Button className="h-11 w-full" render={<Link href="/start" />}>
            ادامه ثبت‌نام
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function PaymentMethods({ event }: { event: PublicEventView }) {
  const hasCard = event.cardEnabled && event.cardNumber;
  const hasSheba = event.shebaEnabled && event.shebaNumber;

  if (!hasCard && !hasSheba && !event.paymentInstructions) return null;

  return (
    <div className="space-y-2">
      {hasCard ? (
        <PaymentMethodBlock
          label="کارت‌به‌کارت"
          number={event.cardNumber!}
          holderName={event.cardHolderName}
          icon={<CreditCardIcon className="size-4" />}
        />
      ) : null}
      {hasSheba ? (
        <PaymentMethodBlock
          label="شبا"
          number={event.shebaNumber!}
          holderName={event.shebaHolderName}
          icon={<span className="text-xs font-bold">IR</span>}
        />
      ) : null}
      {event.paymentInstructions ? (
        <p className="whitespace-pre-line text-xs text-muted-foreground">
          {event.paymentInstructions}
        </p>
      ) : null}
    </div>
  );
}

function PaymentMethodBlock({
  label,
  number,
  holderName,
  icon,
}: {
  label: string;
  number: string;
  holderName: string | null;
  icon: ReactNode;
}) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(number).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="rounded-xl border border-border bg-background p-3">
      <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        {icon}
        <span>{label}</span>
      </div>
      <div className="flex items-center justify-between gap-2">
        <span
          dir="ltr"
          className="font-mono text-base tracking-widest text-foreground"
        >
          {number}
        </span>
        <button
          type="button"
          onClick={handleCopy}
          className="shrink-0 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label="کپی شماره"
        >
          {copied ? (
            <CheckCircle2Icon className="size-4 text-green-600" />
          ) : (
            <CopyIcon className="size-4" />
          )}
        </button>
      </div>
      {holderName ? (
        <p className="text-xs text-muted-foreground">{holderName}</p>
      ) : null}
    </div>
  );
}
