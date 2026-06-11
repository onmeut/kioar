"use client";

import { useMemo, useState, useTransition } from "react";
import {
  CheckIcon,
  DownloadIcon,
  FileTextIcon,
  ImageIcon,
  SearchIcon,
  UserCheckIcon,
  XIcon,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { REGISTRATION_STATUS_LABELS } from "@/lib/events/labels";
import { formatShamsiDateTimeInZone } from "@/lib/date/timezone";
import { toPersianDigits } from "@/lib/date/persian";
import { cn } from "@/lib/utils";
import {
  approveRegistrationAction,
  getReceiptUrlAction,
  markAttendedAction,
  rejectRegistrationAction,
  removeRegistrantAction,
} from "@/app/(app)/my-events/[eventId]/manage/actions";

type Registrant = {
  registrationId: string;
  userId: string;
  name: string;
  phone: string;
  status: keyof typeof REGISTRATION_STATUS_LABELS;
  answers: Record<string, string | string[]>;
  receiptKey: string | null;
  discountCode: string | null;
  expectedToman: number;
  ticketTypeName: string | null;
  registeredAt: string; // ISO
  decidedAt: string | null;
  checkedInAt: string | null;
};

type QuestionLite = { id: string; label: string };

type Filter =
  | "all"
  | "pending"
  | "approved"
  | "checked_in"
  | "waitlisted";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "همه" },
  { key: "pending", label: "در انتظار" },
  { key: "approved", label: "تأیید شده" },
  { key: "checked_in", label: "حاضر" },
  { key: "waitlisted", label: "فهرست انتظار" },
];

const STATUS_TONE: Record<string, string> = {
  approved: "bg-emerald-500/12 text-emerald-700",
  attended: "bg-sky-500/12 text-sky-700",
  pending_approval: "bg-amber-500/12 text-amber-800",
  payment_pending: "bg-amber-500/12 text-amber-800",
  payment_submitted: "bg-amber-500/12 text-amber-800",
  waitlisted: "bg-violet-500/12 text-violet-700",
  rejected: "bg-rose-500/12 text-rose-700",
  cancelled: "bg-muted text-muted-foreground",
};

function matchesFilter(r: Registrant, f: Filter): boolean {
  switch (f) {
    case "all":
      return true;
    case "pending":
      return (
        r.status === "pending_approval" ||
        r.status === "payment_pending" ||
        r.status === "payment_submitted"
      );
    case "approved":
      return r.status === "approved" || r.status === "attended";
    case "checked_in":
      return r.status === "attended";
    case "waitlisted":
      return r.status === "waitlisted";
  }
}

export function RegistrantTable({
  eventId,
  timezone,
  registrants,
  questions,
}: {
  eventId: string;
  timezone: string;
  registrants: Registrant[];
  questions: QuestionLite[];
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [detail, setDetail] = useState<Registrant | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return registrants.filter((r) => {
      if (!matchesFilter(r, filter)) return false;
      if (!q) return true;
      return (
        r.name.toLowerCase().includes(q) || r.phone.toLowerCase().includes(q)
      );
    });
  }, [registrants, query, filter]);

  function exportCsv() {
    const headers = [
      "نام",
      "تلفن",
      "نوع بلیت",
      "وضعیت",
      "زمان ثبت‌نام",
      "حضور",
      "کد تخفیف",
      "مبلغ",
      ...questions.map((q) => q.label),
    ];
    const rows = filtered.map((r) => [
      r.name,
      r.phone,
      r.ticketTypeName ?? "",
      REGISTRATION_STATUS_LABELS[r.status],
      formatShamsiDateTimeInZone(new Date(r.registeredAt), timezone),
      r.checkedInAt
        ? formatShamsiDateTimeInZone(new Date(r.checkedInAt), timezone)
        : "",
      r.discountCode ?? "",
      String(r.expectedToman),
      ...questions.map((q) => {
        const a = r.answers[q.id];
        return Array.isArray(a) ? a.join("، ") : (a ?? "");
      }),
    ]);
    const csv = [headers, ...rows]
      .map((row) =>
        row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","),
      )
      .join("\n");
    // BOM so Excel reads UTF-8 Persian correctly.
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "registrants.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <SearchIcon className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="جستجوی نام یا تلفن"
            className="ps-9"
            type="search"
            inputMode="search"
            enterKeyHint="search"
          />
        </div>
        <Button
          type="button"
          variant="outline"
          className="h-11 shrink-0"
          onClick={exportCsv}
          disabled={filtered.length === 0}
        >
          <DownloadIcon className="size-4" />
          خروجی CSV
        </Button>
      </div>

      <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={cn(
              "shrink-0 rounded-full border px-3 py-1.5 text-sm",
              filter === f.key
                ? "border-foreground bg-foreground text-background"
                : "border-border text-muted-foreground",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-4xl border border-dashed border-border/70 bg-muted/20 p-8 text-center text-sm text-muted-foreground">
          {registrants.length === 0
            ? "هنوز کسی ثبت‌نام نکرده است."
            : "موردی با این فیلتر پیدا نشد."}
        </p>
      ) : (
        <>
          {/* Mobile: cards */}
          <div className="space-y-3 lg:hidden">
            {filtered.map((r) => (
              <RegistrantCard
                key={r.registrationId}
                eventId={eventId}
                timezone={timezone}
                r={r}
                onOpen={() => setDetail(r)}
              />
            ))}
          </div>

          {/* Desktop: table */}
          <div className="hidden overflow-hidden rounded-3xl border border-border lg:block">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-muted-foreground">
                <tr>
                  <th className="p-3 text-start font-medium">نام</th>
                  <th className="p-3 text-start font-medium">تلفن</th>
                  <th className="p-3 text-start font-medium">نوع بلیت</th>
                  <th className="p-3 text-start font-medium">وضعیت</th>
                  <th className="p-3 text-start font-medium">حضور</th>
                  <th className="p-3 text-start font-medium">اقدام</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr
                    key={r.registrationId}
                    className="border-t border-border/60"
                  >
                    <td className="p-3">
                      <button
                        type="button"
                        onClick={() => setDetail(r)}
                        className="font-medium hover:underline"
                      >
                        {r.name}
                      </button>
                    </td>
                    <td className="p-3" dir="ltr">
                      {toPersianDigits(r.phone)}
                    </td>
                    <td className="p-3">
                      {r.ticketTypeName ?? "—"}
                    </td>
                    <td className="p-3">
                      <StatusBadge status={r.status} />
                    </td>
                    <td className="p-3 text-muted-foreground">
                      {r.checkedInAt
                        ? toPersianDigits(
                            formatShamsiDateTimeInZone(
                              new Date(r.checkedInAt),
                              timezone,
                            ),
                          )
                        : "—"}
                    </td>
                    <td className="p-3">
                      <RowActions eventId={eventId} r={r} onOpen={() => setDetail(r)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <RegistrantDetailSheet
        eventId={eventId}
        timezone={timezone}
        registrant={detail}
        questions={questions}
        onClose={() => setDetail(null)}
      />
    </div>
  );
}

function StatusBadge({ status }: { status: Registrant["status"] }) {
  return (
    <Badge className={cn("rounded-full", STATUS_TONE[status] ?? "")}>
      {REGISTRATION_STATUS_LABELS[status]}
    </Badge>
  );
}

function RegistrantCard({
  eventId,
  timezone,
  r,
  onOpen,
}: {
  eventId: string;
  timezone: string;
  r: Registrant;
  onOpen: () => void;
}) {
  return (
    <div className="rounded-3xl border border-border p-4">
      <div className="flex items-start justify-between gap-2">
        <button
          type="button"
          onClick={onOpen}
          className="min-w-0 text-start"
        >
          <p className="truncate font-semibold">{r.name}</p>
          <p className="mt-0.5 text-xs text-muted-foreground" dir="ltr">
            {toPersianDigits(r.phone)}
          </p>
          {r.ticketTypeName ? (
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {r.ticketTypeName}
            </p>
          ) : null}
        </button>
        <StatusBadge status={r.status} />
      </div>
      {r.checkedInAt ? (
        <p className="mt-2 text-xs text-sky-700">
          حاضر شد:{" "}
          {toPersianDigits(
            formatShamsiDateTimeInZone(new Date(r.checkedInAt), timezone),
          )}
        </p>
      ) : null}
      <div className="mt-3">
        <RowActions eventId={eventId} r={r} onOpen={onOpen} />
      </div>
    </div>
  );
}

/**
 * Per-row action buttons. Each wraps a server action via useTransition so the
 * row reflects pending state without a full form. Actions shown depend on the
 * registrant's current status.
 */
function RowActions({ eventId, r, onOpen }: { eventId: string; r: Registrant; onOpen?: () => void }) {
  const [pending, start] = useTransition();

  function run(
    fn: (prev: never, fd: FormData) => Promise<{ status: string; message?: string }>,
    confirmMsg?: string,
  ) {
    if (confirmMsg && !window.confirm(confirmMsg)) return;
    const fd = new FormData();
    fd.set("eventId", eventId);
    fd.set("registrationId", r.registrationId);
    start(async () => {
      const res = await fn(undefined as never, fd);
      if (res.status === "error") toast.error(res.message ?? "خطا رخ داد.");
      else toast.success("انجام شد.");
    });
  }

  const canApprove =
    r.status === "pending_approval" ||
    r.status === "payment_submitted" ||
    r.status === "payment_pending" ||
    r.status === "waitlisted";
  const canReject =
    r.status !== "rejected" &&
    r.status !== "cancelled" &&
    r.status !== "attended";
  const canMarkAttended =
    r.status !== "attended" &&
    r.status !== "rejected" &&
    r.status !== "cancelled";

  return (
    <div className="flex flex-wrap gap-2">
      {canApprove ? (
        <Button
          type="button"
          size="sm"
          className="h-9"
          disabled={pending}
          onClick={() => run(approveRegistrationAction)}
        >
          <CheckIcon className="size-4" />
          تأیید
        </Button>
      ) : null}
      {canMarkAttended ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-9"
          disabled={pending}
          onClick={() => run(markAttendedAction)}
        >
          <UserCheckIcon className="size-4" />
          حاضر شد
        </Button>
      ) : null}
      {canReject ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-9 text-rose-600"
          disabled={pending}
          onClick={() =>
            run(rejectRegistrationAction, "این ثبت‌نام رد شود؟")
          }
        >
          <XIcon className="size-4" />
          رد
        </Button>
      ) : null}
      {r.receiptKey && onOpen ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-9"
          onClick={onOpen}
        >
          <FileTextIcon className="size-4" />
          رسید
        </Button>
      ) : null}
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className="h-9 text-muted-foreground"
        disabled={pending}
        onClick={() =>
          run(removeRegistrantAction, "این شرکت‌کننده حذف شود؟")
        }
      >
        حذف
      </Button>
    </div>
  );
}

function RegistrantDetailSheet({
  eventId,
  timezone,
  registrant,
  questions,
  onClose,
}: {
  eventId: string;
  timezone: string;
  registrant: Registrant | null;
  questions: QuestionLite[];
  onClose: () => void;
}) {
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);
  const [loadingReceipt, setLoadingReceipt] = useState(false);

  async function viewReceipt(key: string) {
    setLoadingReceipt(true);
    try {
      const { url } = await getReceiptUrlAction(eventId, key);
      if (url) setReceiptUrl(url);
      else toast.error("رسید در دسترس نیست.");
    } finally {
      setLoadingReceipt(false);
    }
  }

  const r = registrant;

  return (
    <Sheet
      open={r != null}
      onOpenChange={(open) => {
        if (!open) {
          setReceiptUrl(null);
          onClose();
        }
      }}
    >
      <SheetContent side="bottom" className="max-h-[85dvh] overflow-y-auto">
        {r ? (
          <>
            <SheetHeader>
              <SheetTitle>{r.name}</SheetTitle>
            </SheetHeader>
            <div className="space-y-4 p-4 pt-0 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">وضعیت</span>
                <StatusBadge status={r.status} />
              </div>
              <Row label="تلفن" value={toPersianDigits(r.phone)} ltr />
              <Row
                label="زمان ثبت‌نام"
                value={toPersianDigits(
                  formatShamsiDateTimeInZone(
                    new Date(r.registeredAt),
                    timezone,
                  ),
                )}
              />
              {r.checkedInAt ? (
                <Row
                  label="زمان ورود"
                  value={toPersianDigits(
                    formatShamsiDateTimeInZone(
                      new Date(r.checkedInAt),
                      timezone,
                    ),
                  )}
                />
              ) : null}
              {r.expectedToman > 0 ? (
                <Row
                  label="مبلغ مورد انتظار"
                  value={`${toPersianDigits(
                    r.expectedToman.toLocaleString("en-US"),
                  )} تومان`}
                />
              ) : null}
              {r.discountCode ? (
                <Row label="کد تخفیف" value={r.discountCode} ltr />
              ) : null}

              {r.receiptKey ? (
                <div className="space-y-2">
                  <p className="text-muted-foreground">رسید پرداخت</p>
                  {receiptUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={receiptUrl}
                      alt="رسید"
                      className="w-full rounded-2xl border border-border"
                    />
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      className="h-11 w-full"
                      disabled={loadingReceipt}
                      onClick={() => viewReceipt(r.receiptKey!)}
                    >
                      <ImageIcon className="size-4" />
                      نمایش رسید
                    </Button>
                  )}
                </div>
              ) : null}

              {questions.length > 0 ? (
                <div className="space-y-2 border-t border-border/60 pt-3">
                  <p className="text-muted-foreground">پاسخ‌ها</p>
                  {questions.map((q) => {
                    const a = r.answers[q.id];
                    const text = Array.isArray(a) ? a.join("، ") : a;
                    return (
                      <div key={q.id}>
                        <p className="font-medium">{q.label}</p>
                        <p className="text-muted-foreground">
                          {text || "—"}
                        </p>
                      </div>
                    );
                  })}
                </div>
              ) : null}

              <div className="border-t border-border/60 pt-3">
                <RowActions eventId={eventId} r={r} />
              </div>
            </div>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function Row({
  label,
  value,
  ltr,
}: {
  label: string;
  value: string;
  ltr?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span dir={ltr ? "ltr" : undefined} className="font-medium">
        {value}
      </span>
    </div>
  );
}
