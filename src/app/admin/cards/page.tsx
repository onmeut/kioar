import { requireAdmin } from "@/lib/auth/session";
import { getAdminCardOrders } from "@/lib/cards/admin-data";
import { formatPersianDateTime, formatPersianNumber, toPersianDigits } from "@/lib/persian";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AssignCardForm,
  NfcChecklist,
  OrderStatusControl,
} from "@/components/admin/card-order-controls";

export const dynamic = "force-dynamic";

const STATUS_FA: Record<string, string> = {
  pending_payment: "در انتظار پرداخت",
  paid: "پرداخت‌شده",
  processing: "در حال آماده‌سازی",
  shipped: "ارسال‌شده",
  fulfilled: "تحویل‌شده",
  cancelled: "لغوشده",
};

const SOURCE_FA: Record<string, string> = {
  purchased: "خریداری‌شده",
  gift_pro: "هدیهٔ Pro",
  gift_business: "هدیهٔ Business",
};

const MATERIAL_FA: Record<string, string> = {
  colorful: "رنگی",
  metal: "فلزی",
};

export default async function AdminCardOrdersPage() {
  await requireAdmin();
  const orders = await getAdminCardOrders();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-foreground">سفارش‌های کارت</h1>
        <p className="text-sm text-muted-foreground">
          تخصیص کارت فیزیکی، چک‌لیست NFC و پیشبرد وضعیت سفارش‌ها.
        </p>
      </div>

      {orders.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          هنوز سفارشی ثبت نشده است.
        </p>
      ) : (
        <>
          {/* Mobile cards */}
          <ul className="grid gap-3 lg:hidden">
            {orders.map((o) => (
              <li
                key={o.id}
                className="space-y-3 rounded-2xl border border-border bg-card p-4"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-foreground">
                    {o.pageName || o.pageSlug || "—"}
                  </span>
                  <span className="rounded-full bg-muted px-3 py-1 text-xs">
                    {STATUS_FA[o.status] ?? o.status}
                  </span>
                </div>
                <dl className="grid grid-cols-2 gap-2 text-sm text-muted-foreground">
                  <Field label="نوع">
                    {MATERIAL_FA[o.material]} • {SOURCE_FA[o.source]}
                  </Field>
                  <Field label="نام روی کارت">
                    <span dir="ltr">{o.nameOnCard}</span>
                  </Field>
                  <Field label="مبلغ">
                    {o.amountToman > 0
                      ? `${formatPersianNumber(o.amountToman)} ت`
                      : "رایگان"}
                  </Field>
                  <Field label="تلفن">
                    <span dir="ltr">{toPersianDigits(o.userPhone ?? "—")}</span>
                  </Field>
                  <Field label="نشانی">
                    {o.province} • {o.city} — {o.address} ({toPersianDigits(o.postalCode)})
                  </Field>
                  <Field label="کارت">
                    {o.cardId ? (
                      <span dir="ltr">{o.cardId}</span>
                    ) : (
                      <AssignCardForm orderId={o.id} />
                    )}
                  </Field>
                </dl>
                {o.cardId ? (
                  <NfcChecklist
                    cardId={o.cardId}
                    written={Boolean(o.nfcWrittenAt)}
                    locked={Boolean(o.nfcLockedAt)}
                  />
                ) : null}
                <OrderStatusControl orderId={o.id} current={o.status} />
              </li>
            ))}
          </ul>

          {/* Desktop table */}
          <div className="hidden overflow-x-auto rounded-2xl border border-border lg:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>صفحه</TableHead>
                  <TableHead>نوع</TableHead>
                  <TableHead>نام / تلفن</TableHead>
                  <TableHead>نشانی</TableHead>
                  <TableHead>مبلغ</TableHead>
                  <TableHead>کارت / NFC</TableHead>
                  <TableHead>وضعیت</TableHead>
                  <TableHead>تاریخ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell className="font-medium">
                      {o.pageName || o.pageSlug || "—"}
                    </TableCell>
                    <TableCell>
                      {MATERIAL_FA[o.material]}
                      <span className="block text-xs text-muted-foreground">
                        {SOURCE_FA[o.source]} • {o.color}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span dir="ltr" className="block">
                        {o.nameOnCard}
                      </span>
                      <span dir="ltr" className="block text-xs text-muted-foreground">
                        {toPersianDigits(o.userPhone ?? "—")}
                      </span>
                    </TableCell>
                    <TableCell className="max-w-50 text-xs text-muted-foreground">
                      {o.province} • {o.city}
                      <span className="block">{o.address}</span>
                      <span dir="ltr" className="block">
                        {toPersianDigits(o.postalCode)}
                      </span>
                    </TableCell>
                    <TableCell>
                      {o.amountToman > 0
                        ? `${formatPersianNumber(o.amountToman)} ت`
                        : "رایگان"}
                    </TableCell>
                    <TableCell>
                      {o.cardId ? (
                        <>
                          <span dir="ltr" className="block font-mono text-xs">
                            {o.cardId}
                          </span>
                          <NfcChecklist
                            cardId={o.cardId}
                            written={Boolean(o.nfcWrittenAt)}
                            locked={Boolean(o.nfcLockedAt)}
                          />
                        </>
                      ) : (
                        <AssignCardForm orderId={o.id} />
                      )}
                    </TableCell>
                    <TableCell>
                      <OrderStatusControl orderId={o.id} current={o.status} />
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                      {formatPersianDateTime(o.createdAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="col-span-2 sm:col-span-1">
      <dt className="text-xs">{label}</dt>
      <dd className="text-foreground">{children}</dd>
    </div>
  );
}
