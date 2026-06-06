import { requireAdmin } from "@/lib/auth/session";
import { getBatchSummaries } from "@/lib/cards/inventory";
import { formatPersianNumber } from "@/lib/persian";
import { GenerateBatchForm } from "@/components/admin/generate-batch-form";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const dynamic = "force-dynamic";

export default async function AdminCardInventoryPage() {
  await requireAdmin();
  const batches = await getBatchSummaries();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground">موجودی و دسته‌ها</h1>
        <p className="text-sm text-muted-foreground">
          ساخت دستهٔ جدید کارت و مشاهدهٔ شمارش وضعیت‌ها به‌ازای هر دسته.
        </p>
      </div>

      <GenerateBatchForm />

      <div className="rounded-2xl border border-dashed border-border p-4 text-sm text-muted-foreground">
        برای خروجی QR و فایل manifest چاپ، از دستور CLI استفاده کنید:
        <code dir="ltr" className="mt-2 block rounded-lg bg-muted px-3 py-2 font-mono text-xs text-foreground">
          npm run cards:batch -- --count N --batch {"{batch}"} --color black
          --material colorful --source purchased
        </code>
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold text-foreground">دسته‌ها</h2>
        {batches.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            هنوز دسته‌ای ساخته نشده است.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>دسته</TableHead>
                  <TableHead>کل</TableHead>
                  <TableHead>تخصیص‌نیافته</TableHead>
                  <TableHead>تخصیص‌یافته</TableHead>
                  <TableHead>غیرفعال</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {batches.map((b) => (
                  <TableRow key={b.batch}>
                    <TableCell dir="ltr" className="font-mono">
                      {b.batch}
                    </TableCell>
                    <TableCell>{formatPersianNumber(b.total)}</TableCell>
                    <TableCell>{formatPersianNumber(b.unassigned)}</TableCell>
                    <TableCell>{formatPersianNumber(b.assigned)}</TableCell>
                    <TableCell>{formatPersianNumber(b.disabled)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}
