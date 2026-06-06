"use client";

import { useActionState } from "react";

import {
  generateBatchAction,
  type AdminCardState,
} from "@/app/admin/cards/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const idle: AdminCardState = { status: "idle" };

export function GenerateBatchForm() {
  const [state, formAction] = useActionState(generateBatchAction, idle);
  return (
    <form
      action={formAction}
      className="space-y-4 rounded-2xl border border-border bg-card p-4"
    >
      <h2 className="text-sm font-semibold text-foreground">ساخت دستهٔ جدید</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="batch">نام دسته</Label>
          <Input id="batch" name="batch" placeholder="۲۰۲۶-۰۰۱" dir="ltr" required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="count">تعداد</Label>
          <Input
            id="count"
            name="count"
            type="number"
            inputMode="numeric"
            min={1}
            max={10000}
            defaultValue={100}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="color">رنگ</Label>
          <Input id="color" name="color" defaultValue="black" dir="ltr" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="material">جنس</Label>
          <select
            id="material"
            name="material"
            className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm md:h-9"
            defaultValue="colorful"
          >
            <option value="colorful">رنگی</option>
            <option value="metal">فلزی</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="source">منبع</Label>
          <select
            id="source"
            name="source"
            className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm md:h-9"
            defaultValue="purchased"
          >
            <option value="purchased">خریداری‌شده</option>
            <option value="gift_pro">هدیهٔ Pro</option>
            <option value="gift_business">هدیهٔ Business</option>
          </select>
        </div>
      </div>

      {state.status === "error" && state.message ? (
        <p className="text-sm text-destructive">{state.message}</p>
      ) : null}
      {state.status === "ok" && state.message ? (
        <p className="text-sm text-emerald-600">{state.message}</p>
      ) : null}

      <Button type="submit" className="w-full sm:w-auto">
        ساخت دسته
      </Button>
    </form>
  );
}
