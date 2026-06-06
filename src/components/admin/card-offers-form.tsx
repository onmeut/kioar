"use client";

import { useActionState } from "react";

import {
  saveCardOffersAction,
  type SettingsState,
} from "@/app/admin/cards/settings-actions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const idle: SettingsState = { status: "idle" };

type Props = {
  planGrantsCard: boolean;
  cardGrantsPlan: boolean;
  copyPlanIncludesCard: string;
  copyCardIncludesPlan: string;
};

export function CardOffersForm(props: Props) {
  const [state, formAction] = useActionState(saveCardOffersAction, idle);
  return (
    <form
      action={formAction}
      className="space-y-5 rounded-2xl border border-border bg-card p-5"
    >
      <div className="space-y-3">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="planGrantsCard"
            defaultChecked={props.planGrantsCard}
            className="size-4"
          />
          خرید پلن سالانه، یک کارت رایگان هدیه می‌دهد
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="cardGrantsPlan"
            defaultChecked={props.cardGrantsPlan}
            className="size-4"
          />
          خرید کارت، یک سال پلن رایگان هدیه می‌دهد
        </label>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="copyPlanIncludesCard">
          متن صفحهٔ پلن‌ها (شامل کارت رایگان)
        </Label>
        <Textarea
          id="copyPlanIncludesCard"
          name="copyPlanIncludesCard"
          rows={2}
          maxLength={200}
          defaultValue={props.copyPlanIncludesCard}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="copyCardIncludesPlan">
          متن فروشگاه کارت (شامل یک سال پلن)
        </Label>
        <Textarea
          id="copyCardIncludesPlan"
          name="copyCardIncludesPlan"
          rows={2}
          maxLength={200}
          defaultValue={props.copyCardIncludesPlan}
        />
      </div>

      {state.status === "error" && state.message ? (
        <p className="text-sm text-destructive">{state.message}</p>
      ) : null}
      {state.status === "ok" && state.message ? (
        <p className="text-sm text-emerald-600">{state.message}</p>
      ) : null}

      <Button type="submit" className="w-full sm:w-auto">
        ذخیرهٔ پیشنهادها
      </Button>
    </form>
  );
}
