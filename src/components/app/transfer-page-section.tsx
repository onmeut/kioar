"use client";

import { useActionState, useEffect, useState } from "react";
import QRCode from "qrcode";
import {
  ArrowRightLeftIcon,
  CheckIcon,
  CopyIcon,
  Loader2Icon,
  Share2Icon,
  XIcon,
} from "lucide-react";
import { useFormStatus } from "react-dom";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  cancelTransferAction,
  initiateTransferAction,
  type InitiateTransferState,
  type SimpleActionState,
} from "@/app/(app)/account/transfer-actions";
import { toPersianDigits } from "@/lib/date/persian";
import { formatPhoneDisplay } from "@/lib/phone";
import { cn } from "@/lib/utils";

type OwnedPage = {
  id: string;
  slug: string;
  label: string;
};

type OutgoingTransfer = {
  id: string;
  pageLabel: string;
  pageSlug: string;
  toPhone: string;
};

const initiateInitial: InitiateTransferState = { status: "idle" };
const simpleInitial: SimpleActionState = { status: "idle" };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      disabled={pending}
      className="h-11 w-full rounded-full text-sm font-bold sm:w-auto"
    >
      {pending ? (
        <>
          <Loader2Icon className="size-4 animate-spin" />
          در حال ارسال…
        </>
      ) : (
        <>
          <ArrowRightLeftIcon className="size-4" />
          ارسال درخواست انتقال
        </>
      )}
    </Button>
  );
}

export function TransferPageSection({
  pages,
  outgoing,
}: {
  pages: OwnedPage[];
  outgoing: OutgoingTransfer[];
}) {
  const [pageId, setPageId] = useState("");
  const [state, formAction] = useActionState(
    initiateTransferAction,
    initiateInitial,
  );

  if (pages.length === 0) return null;

  return (
    <section className="space-y-4 rounded-3xl bg-white p-5 ring-1 ring-zinc-200 sm:p-6">
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <ArrowRightLeftIcon className="size-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">انتقال مالکیت صفحه</h2>
        </div>
        <p className="text-xs leading-6 text-muted-foreground">
          مالکیت یک صفحه را به شماره موبایل فرد دیگری منتقل کنید. پلن و محتوای
          صفحه همراه آن منتقل می‌شود؛ فاکتورهای شما نزد خودتان باقی می‌ماند.
          فرد گیرنده باید با همان شماره وارد شود و درخواست را تأیید کند.
        </p>
      </div>

      <form action={formAction} className="flex flex-col gap-4">
        {/* hidden field carries the chosen page id */}
        <input type="hidden" name="pageId" value={pageId} />

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">صفحه</label>
            <Select
              value={pageId}
              onValueChange={(value) => setPageId(value ?? "")}
              items={pages.map((p) => ({ value: p.id, label: p.label }))}
            >
              <SelectTrigger className="h-11 w-full rounded-xl bg-muted px-4 text-base font-medium text-foreground border-none outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/20">
                <SelectValue placeholder="انتخاب صفحه" />
              </SelectTrigger>
              <SelectContent>
                {pages.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="toPhone" className="text-sm font-medium">
              شماره موبایل گیرنده
            </label>
            <input
              id="toPhone"
              name="toPhone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              enterKeyHint="send"
              dir="ltr"
              placeholder="0912 345 6789"
              className={cn(
                "h-11 w-full rounded-xl bg-muted px-4 text-base font-medium text-foreground placeholder:text-muted-foreground/70 outline-none transition-colors",
                "focus-visible:ring-3 focus-visible:ring-ring/20",
              )}
            />
          </div>
        </div>

        {state.status === "error" && state.message ? (
          <p className="text-sm text-destructive" role="alert">
            {state.message}
          </p>
        ) : null}

        {state.status === "success" && state.message ? (
          <p className="text-sm text-emerald-600" role="status">
            {state.message}
          </p>
        ) : null}

        <div className="flex justify-end">
          <SubmitButton />
        </div>
      </form>

      {/* Unregistered recipient → show QR + share link to send manually. */}
      {state.status === "success" && state.data && !state.data.recipientRegistered ? (
        <ShareTransfer shareUrl={state.data.shareUrl} toPhone={state.data.toPhone} />
      ) : null}

      {/* Outgoing pending transfers with cancel. */}
      {outgoing.length > 0 ? (
        <div className="space-y-2.5 border-t border-zinc-100 pt-4">
          <h3 className="text-xs font-semibold text-muted-foreground">
            درخواست‌های انتقال باز
          </h3>
          {outgoing.map((t) => (
            <OutgoingRow key={t.id} transfer={t} />
          ))}
        </div>
      ) : null}
    </section>
  );
}

function ShareTransfer({
  shareUrl,
  toPhone,
}: {
  shareUrl: string;
  toPhone: string;
}) {
  const [dataUrl, setDataUrl] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    QRCode.toDataURL(shareUrl, {
      margin: 2,
      width: 512,
      color: { dark: "#123b36", light: "#ffffff" },
    })
      .then(setDataUrl)
      .catch(() => toast.error("ساخت QR با خطا مواجه شد."));
  }, [shareUrl]);

  async function copyLink() {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    toast.success("لینک انتقال کپی شد.");
    window.setTimeout(() => setCopied(false), 2000);
  }

  async function share() {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "انتقال صفحه در کی‌یو‌آر",
          text: "می‌خواهم مالکیت صفحه‌ام را به تو منتقل کنم. این لینک را باز کن:",
          url: shareUrl,
        });
        return;
      } catch {
        // dismissed
      }
    }
    await copyLink();
  }

  return (
    <div className="space-y-3 rounded-2xl bg-muted p-4">
      <p className="text-xs leading-6 text-muted-foreground">
        گیرنده با شماره{" "}
        <span dir="ltr" className="font-mono font-semibold text-foreground">
          {toPersianDigits(formatPhoneDisplay(toPhone))}
        </span>{" "}
        هنوز در کی‌یو‌آر ثبت‌نام نکرده. این کد یا لینک را برایش بفرست؛ بعد از
        ثبت‌نام با همین شماره، درخواست انتقال را می‌بیند.
      </p>
      <div className="flex flex-col items-center gap-3">
        {dataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={dataUrl}
            alt="کد QR انتقال"
            className="size-44 rounded-xl bg-white p-2"
          />
        ) : (
          <div className="flex size-44 items-center justify-center rounded-xl bg-white">
            <Loader2Icon className="size-5 animate-spin text-muted-foreground" />
          </div>
        )}
        <div
          dir="ltr"
          className="w-full truncate rounded-lg bg-white px-3 py-2 text-center font-mono text-xs text-muted-foreground select-all"
        >
          {shareUrl}
        </div>
        <div className="flex w-full gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={copyLink}
            className="h-11 flex-1 rounded-full text-sm font-semibold"
          >
            {copied ? (
              <CheckIcon className="size-4" />
            ) : (
              <CopyIcon className="size-4" />
            )}
            {copied ? "کپی شد" : "کپی لینک"}
          </Button>
          <Button
            type="button"
            onClick={share}
            className="h-11 flex-1 rounded-full text-sm font-bold"
          >
            <Share2Icon className="size-4" />
            اشتراک‌گذاری
          </Button>
        </div>
      </div>
    </div>
  );
}

function CancelButton() {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant="outline"
      size="sm"
      disabled={pending}
      className="h-9 shrink-0 rounded-full px-3 text-xs font-semibold text-destructive"
    >
      {pending ? (
        <Loader2Icon className="size-3.5 animate-spin" />
      ) : (
        <XIcon className="size-3.5" />
      )}
      لغو
    </Button>
  );
}

function OutgoingRow({ transfer }: { transfer: OutgoingTransfer }) {
  const [state, formAction] = useActionState(
    cancelTransferAction,
    simpleInitial,
  );

  useEffect(() => {
    if (state.status === "error" && state.message) toast.error(state.message);
  }, [state]);

  return (
    <form
      action={formAction}
      className="flex items-center gap-3 rounded-2xl bg-muted p-3"
    >
      <input type="hidden" name="transferId" value={transfer.id} />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-sm font-semibold text-zinc-900">
          {transfer.pageLabel}
        </span>
        <span className="truncate text-xs text-muted-foreground">
          به{" "}
          <span dir="ltr" className="font-mono">
            {toPersianDigits(formatPhoneDisplay(transfer.toPhone))}
          </span>
        </span>
      </div>
      <CancelButton />
    </form>
  );
}
