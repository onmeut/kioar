import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requireAdmin } from "@/lib/auth/session";
import { getAdminCardRequests } from "@/lib/data";
import { formatPersianDateTime, toPersianDigits } from "@/lib/persian";
import { userShortUrl } from "@/lib/site";

// Must match the `card_request_status` Postgres enum in src/db/schema.ts.
// Previously had stale labels (pending/approved/rejected/shipped) which meant
// every row fell through to the muted fallback and the admin view was broken.
type RequestStatus = "new" | "reviewing" | "fulfilled" | string;

const DESIGN_LABEL: Record<string, string> = {
  design_1: "طرح کلاسیک",
  design_2: "طرح مدرن",
  design_3: "طرح مینیمال",
};

const STATUS_VARIANT: Record<string, { label: string; className: string }> = {
  new: {
    label: "جدید",
    className: "bg-amber-500/15 text-amber-700",
  },
  reviewing: {
    label: "در حال بررسی",
    className: "bg-primary/15 text-primary",
  },
  fulfilled: {
    label: "انجام شد",
    className: "bg-emerald-500/15 text-emerald-700",
  },
};

function StatusPill({ status }: { status: RequestStatus }) {
  const config = STATUS_VARIANT[status] ?? {
    label: status,
    className: "bg-muted text-muted-foreground",
  };
  return (
    <Badge
      className={`rounded-full border-transparent px-3 py-1 font-semibold ${config.className}`}
    >
      {config.label}
    </Badge>
  );
}

function CardTypeLabel({ cardType }: { cardType: string }) {
  return (
    <span className="font-semibold">
      {cardType === "nfc" ? "NFC" : "فیزیکی"}
    </span>
  );
}

export default async function AdminRequestsPage() {
  await requireAdmin();
  const requests = await getAdminCardRequests();

  return (
    <section className="section-shell space-y-4 py-6">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-muted-foreground">
          {toPersianDigits(requests.length)} مورد
        </span>
      </div>

      {requests.length === 0 ? (
        <div className="rounded-[1.5rem] border border-dashed border-border/70 bg-background/60 py-10 text-center text-muted-foreground">
          هنوز درخواستی ثبت نشده است.
        </div>
      ) : (
        <>
          {/* Mobile-first card list */}
          <ul className="grid gap-3 lg:hidden">
            {requests.map((request) => (
              <li
                key={request.id}
                className="rounded-4xl bg-card p-4 border border-border"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <p className="truncate font-bold">{request.fullName}</p>
                    <a
                      href={`tel:${request.phone}`}
                      className="block truncate text-sm font-semibold text-primary underline-offset-2 hover:underline"
                      dir="ltr"
                    >
                      {request.phone}
                    </a>
                  </div>
                  <StatusPill status={request.status} />
                </div>

                <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
                  <div className="space-y-0.5">
                    <dt className="text-xs text-muted-foreground">نوع کارت</dt>
                    <dd>
                      <CardTypeLabel cardType={request.cardType} />
                    </dd>
                  </div>
                  <div className="space-y-0.5">
                    <dt className="text-xs text-muted-foreground">طرح</dt>
                    <dd className="text-sm font-semibold">
                      {DESIGN_LABEL[request.cardDesign] ?? request.cardDesign}
                    </dd>
                  </div>
                  <div className="space-y-0.5">
                    <dt className="text-xs text-muted-foreground">ثبت</dt>
                    <dd className="text-sm">
                      {formatPersianDateTime(request.createdAt)}
                    </dd>
                  </div>
                  <div className="space-y-0.5">
                    <dt className="text-xs text-muted-foreground">آدرس کارت</dt>
                    <dd
                      className="truncate text-xs font-mono text-foreground"
                      dir="ltr"
                    >
                      {userShortUrl(request.userId)}
                    </dd>
                  </div>
                </dl>

                {request.deliveryInfo ? (
                  <div className="mt-3 space-y-1 rounded-2xl bg-muted/50 p-3">
                    <p className="text-xs font-semibold text-muted-foreground">
                      اطلاعات ارسال
                    </p>
                    <p className="text-sm leading-7">{request.deliveryInfo}</p>
                  </div>
                ) : null}

                {request.notes ? (
                  <p className="mt-2 text-xs leading-6 text-muted-foreground">
                    یادداشت: {request.notes}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>

          {/* Desktop table */}
          <div className="hidden overflow-x-auto rounded-4xl border border-border lg:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>کاربر</TableHead>
                  <TableHead>نوع کارت</TableHead>
                  <TableHead>طرح</TableHead>
                  <TableHead>وضعیت</TableHead>
                  <TableHead>زمان</TableHead>
                  <TableHead>ارسال</TableHead>
                  <TableHead>آدرس کارت</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests.map((request) => (
                  <TableRow key={request.id}>
                    <TableCell>
                      <div className="space-y-1">
                        <p className="font-semibold">{request.fullName}</p>
                        <p className="text-xs text-muted-foreground" dir="ltr">
                          {request.phone}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <CardTypeLabel cardType={request.cardType} />
                    </TableCell>
                    <TableCell className="text-sm font-semibold">
                      {DESIGN_LABEL[request.cardDesign] ?? request.cardDesign}
                    </TableCell>
                    <TableCell>
                      <StatusPill status={request.status} />
                    </TableCell>
                    <TableCell>
                      {formatPersianDateTime(request.createdAt)}
                    </TableCell>
                    <TableCell className="max-w-60">
                      <div className="space-y-1 text-sm leading-7">
                        <p>{request.deliveryInfo}</p>
                        {request.notes ? (
                          <p className="text-xs text-muted-foreground">
                            یادداشت: {request.notes}
                          </p>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs" dir="ltr">
                      {userShortUrl(request.userId)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </section>
  );
}
