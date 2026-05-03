"use client";

import { useActionState, useState } from "react";
import { GiftIcon, MinusCircleIcon } from "lucide-react";

import {
  adminGrantEntitlementAction,
  adminRevokeEntitlementAction,
} from "@/app/admin/billing/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { idleState } from "@/lib/action-state";
import { formatPersianDateTime, toPersianDigits } from "@/lib/persian";
import { cn } from "@/lib/utils";

export type EntitlementRow = {
  featureKey: string;
  source: "subscription" | "admin_grant" | "promo";
  expiresAt: Date | null;
  featureNameFa: string | null;
  featureCategory: string | null;
};

export type FeatureOption = {
  key: string;
  nameFa: string;
  category: string;
};

type Props = {
  pageId: string;
  rows: EntitlementRow[];
  features: FeatureOption[];
};

const SOURCE_LABELS: Record<EntitlementRow["source"], { label: string; className: string }> = {
  subscription: { label: "پلن", className: "bg-muted text-muted-foreground" },
  admin_grant: { label: "ادمین", className: "bg-blue-500/12 text-blue-700" },
  promo: { label: "تخفیف", className: "bg-purple-500/12 text-purple-700" },
};

export function EntitlementsManager({ pageId, rows, features }: Props) {
  const [grantOpen, setGrantOpen] = useState(false);
  const [grantState, grantAction, grantPending] = useActionState(
    adminGrantEntitlementAction,
    idleState,
  );
  const [revokeOpen, setRevokeOpen] = useState<string | null>(null);
  const [revokeState, revokeAction, revokePending] = useActionState(
    adminRevokeEntitlementAction,
    idleState,
  );

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">قابلیت‌های فعال</h2>
        <Dialog open={grantOpen} onOpenChange={setGrantOpen}>
          <DialogTrigger
            render={
              <Button size="sm" className="h-9 gap-1">
                <GiftIcon className="size-4" />
                اعطای قابلیت
              </Button>
            }
          />
          <DialogContent className="sm:max-w-md">
            <form action={grantAction}>
              <input type="hidden" name="pageId" value={pageId} />
              <DialogHeader>
                <DialogTitle>اعطای قابلیت دستی</DialogTitle>
                <DialogDescription>
                  این قابلیت با منبع «ادمین» اضافه می‌شود و توسط بازسازی
                  اشتراک حذف نخواهد شد.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3 py-4">
                <div>
                  <Label htmlFor="featureKey">قابلیت</Label>
                  <select
                    name="featureKey"
                    id="featureKey"
                    required
                    className="mt-1 h-11 w-full rounded-2xl border border-border bg-background px-3 text-sm md:h-9"
                  >
                    <option value="">— انتخاب کنید —</option>
                    {features.map((f) => (
                      <option key={f.key} value={f.key}>
                        {f.nameFa} ({f.key})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label htmlFor="expiresInDays">انقضا (روز)</Label>
                  <Input
                    type="number"
                    name="expiresInDays"
                    id="expiresInDays"
                    placeholder="خالی = دائمی"
                    inputMode="numeric"
                    min={1}
                    max={3650}
                  />
                </div>
                <div>
                  <Label htmlFor="reason">دلیل</Label>
                  <Textarea
                    name="reason"
                    id="reason"
                    required
                    rows={3}
                    placeholder="مثلاً: درخواست پشتیبانی #۱۲۳۴"
                  />
                </div>
                {grantState.status === "error" && grantState.message ? (
                  <p className="text-xs text-destructive">{grantState.message}</p>
                ) : null}
              </div>
              <DialogFooter>
                <Button type="submit" disabled={grantPending}>
                  {grantPending ? "در حال ثبت…" : "اعطا"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-3xl border border-dashed border-border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
          هیچ قابلیت فعالی برای این صفحه ثبت نشده است.
        </p>
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => (
            <li
              key={r.featureKey}
              className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-3"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">
                  {r.featureNameFa ?? r.featureKey}
                </p>
                <p
                  className="mt-0.5 font-mono text-[11px] text-muted-foreground"
                  dir="ltr"
                >
                  {r.featureKey}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge className={SOURCE_LABELS[r.source].className}>
                  {SOURCE_LABELS[r.source].label}
                </Badge>
                {r.expiresAt ? (
                  <span className="text-[11px] text-muted-foreground">
                    تا {formatPersianDateTime(r.expiresAt)}
                  </span>
                ) : null}
                {r.source === "admin_grant" ? (
                  <Dialog
                    open={revokeOpen === r.featureKey}
                    onOpenChange={(o) =>
                      setRevokeOpen(o ? r.featureKey : null)
                    }
                  >
                    <DialogTrigger
                      render={
                        <Button
                          size="sm"
                          variant="outline"
                          className={cn("h-8 gap-1 text-xs")}
                        >
                          <MinusCircleIcon className="size-3" />
                          لغو
                        </Button>
                      }
                    />
                    <DialogContent className="sm:max-w-md">
                      <form action={revokeAction}>
                        <input type="hidden" name="pageId" value={pageId} />
                        <input
                          type="hidden"
                          name="featureKey"
                          value={r.featureKey}
                        />
                        <DialogHeader>
                          <DialogTitle>لغو قابلیت</DialogTitle>
                          <DialogDescription>
                            <span dir="ltr" className="font-mono">
                              {r.featureKey}
                            </span>{" "}
                            از این صفحه برداشته می‌شود.
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-3 py-4">
                          <Label htmlFor={`reason-${r.featureKey}`}>دلیل</Label>
                          <Textarea
                            name="reason"
                            id={`reason-${r.featureKey}`}
                            required
                            rows={3}
                          />
                          {revokeState.status === "error" &&
                          revokeState.message ? (
                            <p className="text-xs text-destructive">
                              {revokeState.message}
                            </p>
                          ) : null}
                        </div>
                        <DialogFooter>
                          <Button
                            type="submit"
                            variant="destructive"
                            disabled={revokePending}
                          >
                            {revokePending ? "در حال ثبت…" : "لغو قابلیت"}
                          </Button>
                        </DialogFooter>
                      </form>
                    </DialogContent>
                  </Dialog>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
      <p className="text-[11px] text-muted-foreground">
        مجموع{" "}
        <span className="font-semibold text-foreground">
          {toPersianDigits(rows.length)}
        </span>{" "}
        قابلیت فعال.
      </p>
    </section>
  );
}
