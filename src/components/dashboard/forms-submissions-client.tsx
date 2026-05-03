"use client";

// Forms submissions admin — switch between forms, view rows, delete, export CSV.
// Mobile renders cards; desktop renders a real table.

import { useMemo, useState, useTransition } from "react";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import {
  DownloadIcon,
  EyeIcon,
  MoreHorizontalIcon,
  Trash2Icon,
} from "lucide-react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { idleState, type ActionState } from "@/lib/action-state";
import { formatShamsi, toPersianDigits } from "@/lib/date/persian";
import type { FormFieldKind } from "@/lib/validations";

type FieldMeta = {
  id: string;
  kind: FormFieldKind;
  label: string;
};

type BlockOption = {
  id: string;
  name: string;
  fields: FieldMeta[];
};

type Submission = {
  id: string;
  createdAt: string;
  data: Record<string, string | string[]>;
};

type Props = {
  blocks: BlockOption[];
  selectedBlockId: string;
  selectedBlock: BlockOption;
  submissions: Submission[];
  total: number;
  deleteSubmissionAction: (
    state: ActionState,
    formData: FormData,
  ) => Promise<ActionState>;
};

function formatValue(value: string | string[] | undefined): string {
  if (value === undefined) return "—";
  if (Array.isArray(value)) return value.join("، ");
  return value || "—";
}

function formatDate(iso: string): string {
  try {
    return formatShamsi(iso, "yyyy/MM/dd HH:mm");
  } catch {
    return iso;
  }
}

function buildCsv(block: BlockOption, rows: Submission[]): string {
  const headers = ["تاریخ", ...block.fields.map((f) => f.label)];
  const escape = (val: string) => {
    const needsQuote = /[",\n\r]/.test(val);
    const s = val.replace(/"/g, '""');
    return needsQuote ? `"${s}"` : s;
  };
  const lines = [headers.map(escape).join(",")];
  for (const row of rows) {
    const cells = [
      new Date(row.createdAt).toISOString(),
      ...block.fields.map((f) => {
        const v = row.data[f.id];
        if (Array.isArray(v)) return v.join(" | ");
        return v ?? "";
      }),
    ];
    lines.push(cells.map(escape).join(","));
  }
  // BOM for Excel UTF-8 compatibility
  return "\uFEFF" + lines.join("\n");
}

export function FormsSubmissionsClient({
  blocks,
  selectedBlockId,
  selectedBlock,
  submissions,
  total,
  deleteSubmissionAction,
}: Props) {
  const router = useRouter();
  const [viewing, setViewing] = useState<Submission | null>(null);
  const [deleting, setDeleting] = useState<Submission | null>(null);
  const [pending, startTransition] = useTransition();

  const handleSelectBlock = (id: string | null) => {
    if (!id) return;
    const params = new URLSearchParams();
    params.set("blockId", id);
    router.push(`/forms?${params.toString()}` as Route);
  };

  const handleDelete = (sub: Submission) => {
    startTransition(async () => {
      const fd = new FormData();
      fd.set("submissionId", sub.id);
      const result = await deleteSubmissionAction(idleState, fd);
      if (result.status === "error") {
        toast.error(result.message ?? "حذف نشد.");
        return;
      }
      toast.success("ارسال حذف شد.");
      setDeleting(null);
      router.refresh();
    });
  };

  const handleExport = () => {
    const csv = buildCsv(selectedBlock, submissions);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${selectedBlock.name || "form"}-submissions.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const columnFields = useMemo(
    () => selectedBlock.fields.slice(0, 4),
    [selectedBlock.fields],
  );

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-5xl space-y-5">
        <header className="space-y-1">
          <h1 className="text-2xl font-bold">پاسخ‌های فرم</h1>
          <p className="text-sm text-muted-foreground">
            مشاهده، مدیریت و خروجی‌گرفتن از پاسخ‌هایی که از فرم‌های شما دریافت
            شده‌اند.
          </p>
        </header>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex-1">
            <Select value={selectedBlockId} onValueChange={handleSelectBlock}>
              <SelectTrigger className="w-full sm:max-w-xs">
                <SelectValue>
                  {blocks.find((b) => b.id === selectedBlockId)?.name ??
                    selectedBlockId}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {blocks.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="h-8 rounded-full px-3">
              {toPersianDigits(total)} ارسال
            </Badge>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleExport}
              disabled={submissions.length === 0}
              className="h-9 gap-2 rounded-full"
            >
              <DownloadIcon className="size-4" />
              خروجی CSV
            </Button>
          </div>
        </div>

        {submissions.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-2 py-16 text-center">
              <p className="text-base font-bold">هنوز ارسالی ثبت نشده</p>
              <p className="text-sm text-muted-foreground">
                وقتی کسی فرم شما را پر کند، اینجا نمایش داده می‌شود.
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Mobile cards */}
            <ul className="space-y-2.5 lg:hidden">
              {submissions.map((sub) => (
                <li key={sub.id}>
                  <Card>
                    <CardContent className="flex flex-col gap-3 py-4">
                      <div className="flex items-start justify-between gap-2">
                        <RowMenu
                          onView={() => setViewing(sub)}
                          onDelete={() => setDeleting(sub)}
                        />
                        <span className="text-xs text-muted-foreground">
                          {formatDate(sub.createdAt)}
                        </span>
                      </div>
                      <dl className="space-y-1.5 text-sm">
                        {columnFields.map((f) => (
                          <div
                            key={f.id}
                            className="flex flex-col gap-0.5 border-b border-dashed pb-1.5 last:border-b-0 last:pb-0"
                          >
                            <dt className="text-xs text-muted-foreground">
                              {f.label}
                            </dt>
                            <dd className="break-words font-medium">
                              {formatValue(sub.data[f.id])}
                            </dd>
                          </div>
                        ))}
                      </dl>
                    </CardContent>
                  </Card>
                </li>
              ))}
            </ul>

            {/* Desktop table */}
            <div className="hidden lg:block">
              <div className="overflow-x-auto rounded-2xl border bg-card">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {columnFields.map((f) => (
                        <TableHead key={f.id}>{f.label}</TableHead>
                      ))}
                      <TableHead className="w-44">تاریخ</TableHead>
                      <TableHead className="w-12" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {submissions.map((sub) => (
                      <TableRow key={sub.id}>
                        {columnFields.map((f) => (
                          <TableCell
                            key={f.id}
                            className="max-w-[240px] truncate font-medium"
                          >
                            {formatValue(sub.data[f.id])}
                          </TableCell>
                        ))}
                        <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                          {formatDate(sub.createdAt)}
                        </TableCell>
                        <TableCell>
                          <RowMenu
                            onView={() => setViewing(sub)}
                            onDelete={() => setDeleting(sub)}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </>
        )}
      </div>

      {/* View dialog */}
      <Dialog
        open={!!viewing}
        onOpenChange={(o) => {
          if (!o) setViewing(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>جزئیات ارسال</DialogTitle>
            {viewing ? (
              <DialogDescription>
                دریافت شده در {formatDate(viewing.createdAt)}
              </DialogDescription>
            ) : null}
          </DialogHeader>
          {viewing ? (
            <dl className="space-y-3 text-sm">
              {selectedBlock.fields.map((f) => (
                <div key={f.id} className="space-y-0.5">
                  <dt className="text-xs text-muted-foreground">{f.label}</dt>
                  <dd className="break-words font-medium">
                    {formatValue(viewing.data[f.id])}
                  </dd>
                </div>
              ))}
            </dl>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog
        open={!!deleting}
        onOpenChange={(o) => {
          if (!o) setDeleting(null);
        }}
      >
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>حذف ارسال</AlertDialogTitle>
            <AlertDialogDescription>
              این ارسال برای همیشه حذف می‌شود. این عمل قابل بازگشت نیست.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>انصراف</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={pending}
              onClick={(e) => {
                e.preventDefault();
                if (deleting) handleDelete(deleting);
              }}
            >
              حذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function RowMenu({
  onView,
  onDelete,
}: {
  onView: () => void;
  onDelete: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="size-9 rounded-full"
            aria-label="گزینه‌ها"
          />
        }
      >
        <MoreHorizontalIcon className="size-5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          onClick={() => {
            onView();
          }}
        >
          <EyeIcon className="size-4" />
          مشاهده
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          onClick={() => {
            onDelete();
          }}
        >
          <Trash2Icon className="size-4" />
          حذف
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
