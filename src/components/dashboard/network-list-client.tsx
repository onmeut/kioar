"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { MoreHorizontalIcon, SearchIcon, Trash2Icon, UsersIcon } from "lucide-react";
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
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { KioarAvatar } from "@/components/shared/kioar-avatar";
import { formatShamsiDate, toPersianDigits } from "@/lib/date/persian";

type ConnectionItem = {
  pageId: string;
  slug: string;
  fullName: string | null;
  avatarUrl: string | null;
  avatarSeed: string | null;
  /** ISO 8601 UTC; rendered Shamsi via `formatShamsiDate`. */
  connectedAt: string;
};

export function NetworkListClient({
  items,
  removeAction,
}: {
  items: ConnectionItem[];
  removeAction: (formData: FormData) => Promise<void>;
}) {
  const [query, setQuery] = useState("");
  const [removing, setRemoving] = useState<ConnectionItem | null>(null);
  const [pending, startTransition] = useTransition();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) => {
      const name = (item.fullName ?? "").toLowerCase();
      const handle = item.slug.toLowerCase();
      return name.includes(q) || handle.includes(q);
    });
  }, [items, query]);

  function confirmRemove() {
    if (!removing) return;
    const target = removing;
    setRemoving(null);
    startTransition(async () => {
      try {
        const fd = new FormData();
        fd.set("pageId", target.pageId);
        fd.set("slug", target.slug);
        await removeAction(fd);
        toast.success("از دایره شما حذف شد.");
      } catch {
        toast.error("حذف ممکن نشد. لطفاً دوباره تلاش کنید.");
      }
    });
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 lg:px-8">
      <header className="mb-6 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">دایره من</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {toPersianDigits(items.length)} اتصال
          </p>
        </div>
      </header>

      {items.length > 0 ? (
        <div className="mb-4">
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute end-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="جستجو در نام یا یوزرنیم"
              inputMode="search"
              enterKeyHint="search"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              className="pe-9"
              aria-label="جستجو در دایره"
            />
          </div>
        </div>
      ) : null}

      {items.length === 0 ? (
        <EmptyState />
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-foreground/15 px-6 py-10 text-center text-sm text-muted-foreground">
          نتیجه‌ای پیدا نشد.
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {filtered.map((item) => (
            <ConnectionRow
              key={item.pageId}
              item={item}
              pending={pending}
              onRemove={() => setRemoving(item)}
            />
          ))}
        </ul>
      )}

      <AlertDialog
        open={!!removing}
        onOpenChange={(o) => {
          if (!o) setRemoving(null);
        }}
      >
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>حذف از دایره</AlertDialogTitle>
            <AlertDialogDescription>
              {removing?.fullName || removing?.slug
                ? `اتصال شما با ${removing.fullName || removing.slug} برداشته می‌شود. این کار برای هر دو طرف انجام می‌شود.`
                : "این اتصال برای هر دو طرف برداشته می‌شود."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>انصراف</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={pending}
              onClick={(e) => {
                e.preventDefault();
                confirmRemove();
              }}
            >
              حذف از دایره
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ConnectionRow({
  item,
  pending,
  onRemove,
}: {
  item: ConnectionItem;
  pending: boolean;
  onRemove: () => void;
}) {
  const displayName = item.fullName || item.slug;
  return (
    <li className="group flex items-center gap-3 rounded-2xl bg-foreground/4 p-3 transition-colors hover:bg-foreground/6">
      <Link
        href={`/${item.slug}`}
        target="_blank"
        rel="noopener"
        className="flex min-w-0 flex-1 items-center gap-3"
      >
        <span className="relative inline-flex size-12 shrink-0 overflow-hidden rounded-full bg-background">
          {item.avatarUrl ? (
            <Image
              src={item.avatarUrl}
              alt=""
              fill
              sizes="48px"
              className="object-cover"
              unoptimized
            />
          ) : (
            <KioarAvatar seed={item.avatarSeed} size={48} />
          )}
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-[15px] font-bold">{displayName}</span>
          <span dir="ltr" className="truncate text-[12px] text-muted-foreground">
            kioar.com/{item.slug}
          </span>
          <span className="mt-0.5 text-[11px] text-muted-foreground">
            اتصال در {formatShamsiDate(item.connectedAt)}
          </span>
        </span>
      </Link>

      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="size-9 shrink-0 rounded-full"
              aria-label="گزینه‌ها"
              disabled={pending}
            />
          }
        >
          <MoreHorizontalIcon className="size-5" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem variant="destructive" onClick={onRemove}>
            <Trash2Icon className="size-4" />
            حذف از دایره
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-3 rounded-3xl border border-dashed border-foreground/15 bg-background/60 px-6 py-12 text-center">
      <span className="inline-flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <UsersIcon className="size-6" />
      </span>
      <h2 className="text-base font-bold">هنوز کسی در دایره‌ی شما نیست</h2>
      <p className="max-w-sm text-sm text-muted-foreground">
        وقتی روی کارت کسی روی «افزودن» بزنید، اینجا نگه‌داری می‌شود — و آنها هم
        شما را در دایره‌شان می‌بینند.
      </p>
    </div>
  );
}
