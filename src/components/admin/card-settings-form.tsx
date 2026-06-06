"use client";

import { useActionState, useState } from "react";

import {
  saveCardSettingsAction,
  type SettingsState,
} from "@/app/admin/cards/settings-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const idle: SettingsState = { status: "idle" };

type Props = {
  priceColorful: number;
  priceMetal: number;
  shippingCost: number;
  purchaseGrantsPlan: string;
  proMaterial: string;
  businessMaterial: string;
  colorfulEnabled: boolean;
  metalEnabled: boolean;
};

export function CardSettingsForm(props: Props) {
  const [state, formAction] = useActionState(saveCardSettingsAction, idle);

  // Controlled inputs avoid the Base UI uncontrolled→controlled warning.
  const [priceColorful, setPriceColorful] = useState(String(props.priceColorful));
  const [priceMetal, setPriceMetal] = useState(String(props.priceMetal));
  const [shippingCost, setShippingCost] = useState(String(props.shippingCost));

  return (
    <form
      action={formAction}
      className="space-y-5 rounded-2xl border border-border bg-card p-5"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="priceColorful">قیمت کارت رنگی (تومان)</Label>
          <Input
            id="priceColorful"
            name="priceColorful"
            type="number"
            inputMode="numeric"
            min={0}
            value={priceColorful}
            onChange={(e) => setPriceColorful(e.target.value)}
            dir="ltr"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="priceMetal">قیمت کارت فلزی (تومان)</Label>
          <Input
            id="priceMetal"
            name="priceMetal"
            type="number"
            inputMode="numeric"
            min={0}
            value={priceMetal}
            onChange={(e) => setPriceMetal(e.target.value)}
            dir="ltr"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="shippingCost">هزینه ارسال (تومان) — صفر = رایگان</Label>
        <Input
          id="shippingCost"
          name="shippingCost"
          type="number"
          inputMode="numeric"
          min={0}
          value={shippingCost}
          onChange={(e) => setShippingCost(e.target.value)}
          dir="ltr"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="purchaseGrantsPlan">خرید کارت چه پلنی هدیه می‌دهد؟</Label>
        <select
          id="purchaseGrantsPlan"
          name="purchaseGrantsPlan"
          defaultValue={props.purchaseGrantsPlan}
          className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm md:h-9"
        >
          <option value="free">بدون هدیه</option>
          <option value="pro">یک سال Pro</option>
          <option value="business">یک سال Business</option>
        </select>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="proMaterial">پلن Pro چه کارتی هدیه می‌دهد؟</Label>
          <select
            id="proMaterial"
            name="proMaterial"
            defaultValue={props.proMaterial}
            className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm md:h-9"
          >
            <option value="colorful">رنگی</option>
            <option value="metal">فلزی</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="businessMaterial">پلن Business چه کارتی هدیه می‌دهد؟</Label>
          <select
            id="businessMaterial"
            name="businessMaterial"
            defaultValue={props.businessMaterial}
            className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm md:h-9"
          >
            <option value="colorful">رنگی</option>
            <option value="metal">فلزی</option>
          </select>
        </div>
      </div>

      <div className="space-y-2">
        <Label>در دسترس بودن</Label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="colorfulEnabled"
            defaultChecked={props.colorfulEnabled}
            className="size-4"
          />
          کارت رنگی فعال است
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="metalEnabled"
            defaultChecked={props.metalEnabled}
            className="size-4"
          />
          کارت فلزی فعال است
        </label>
      </div>

      {state.status === "error" && state.message ? (
        <p className="text-sm text-destructive">{state.message}</p>
      ) : null}
      {state.status === "ok" && state.message ? (
        <p className="text-sm text-emerald-600">{state.message}</p>
      ) : null}

      <Button type="submit" className="w-full sm:w-auto">
        ذخیرهٔ تنظیمات
      </Button>
    </form>
  );
}
