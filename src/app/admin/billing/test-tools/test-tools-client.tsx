"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { idleState, type ActionState } from "@/lib/action-state";

import {
  fireSmsNowAction,
  mockZarinpalVerifyAction,
  simulateRenewalDryRunAction,
  type DryRunResult,
} from "./actions";

const dryRunInitial: DryRunResult = idleState;

function StatusLine({ state }: { state: ActionState }) {
  if (state.status === "idle") return null;
  return (
    <p
      className={
        state.status === "success"
          ? "text-sm font-semibold text-emerald-700"
          : "text-sm font-semibold text-destructive"
      }
    >
      {state.message}
    </p>
  );
}

function DryRunCard() {
  const [state, formAction, pending] = useActionState(
    simulateRenewalDryRunAction,
    dryRunInitial,
  );
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">شبیه‌سازی تجدید (آزمایشی)</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="dry-pageId">شناسه صفحه</Label>
            <Input
              id="dry-pageId"
              name="pageId"
              dir="ltr"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="dry-reason">دلیل</Label>
            <Textarea id="dry-reason" name="reason" required minLength={3} />
          </div>
          <Button type="submit" disabled={pending} className="w-full sm:w-auto">
            {pending ? "در حال اجرا…" : "اجرای آزمایشی"}
          </Button>
          <StatusLine state={state} />
          {state.status === "success" && state.candidates ? (
            <ul className="mt-2 space-y-1 text-xs">
              {state.candidates.length === 0 ? (
                <li className="text-muted-foreground">
                  هیچ رویدادی برای امروز نیست.
                </li>
              ) : (
                state.candidates.map((c, i) => (
                  <li key={i} className="font-mono" dir="ltr">
                    {c.type} @ {c.keyDate}
                  </li>
                ))
              )}
            </ul>
          ) : null}
        </form>
      </CardContent>
    </Card>
  );
}

function FireSmsCard({ smsTemplateKeys }: { smsTemplateKeys: string[] }) {
  const [state, formAction, pending] = useActionState(
    fireSmsNowAction,
    idleState,
  );
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">ارسال فوری پیامک</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="sms-pageId">شناسه صفحه</Label>
            <Input
              id="sms-pageId"
              name="pageId"
              dir="ltr"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sms-template">قالب پیامک</Label>
            <Select
              name="templateKey"
              required
              defaultValue={smsTemplateKeys[0]}
            >
              <SelectTrigger id="sms-template" dir="ltr">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {smsTemplateKeys.map((k) => (
                  <SelectItem key={k} value={k} dir="ltr">
                    {k}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sms-reason">دلیل</Label>
            <Textarea id="sms-reason" name="reason" required minLength={3} />
          </div>
          <Button type="submit" disabled={pending} className="w-full sm:w-auto">
            {pending ? "در حال ارسال…" : "افزودن به صف"}
          </Button>
          <StatusLine state={state} />
        </form>
      </CardContent>
    </Card>
  );
}

function MockVerifyCard() {
  const [state, formAction, pending] = useActionState(
    mockZarinpalVerifyAction,
    idleState,
  );
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          تأیید آزمایشی پرداخت زرین‌پال
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="mv-invoice">شناسه فاکتور</Label>
            <Input
              id="mv-invoice"
              name="invoiceId"
              dir="ltr"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="mv-ref">کد پیگیری ساختگی</Label>
            <Input
              id="mv-ref"
              name="refId"
              dir="ltr"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
              defaultValue="TEST-REF"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="mv-reason">دلیل</Label>
            <Textarea id="mv-reason" name="reason" required minLength={3} />
          </div>
          <Button type="submit" disabled={pending} className="w-full sm:w-auto">
            {pending ? "در حال اعمال…" : "اعمال تأیید آزمایشی"}
          </Button>
          <StatusLine state={state} />
        </form>
      </CardContent>
    </Card>
  );
}

export function TestToolsClient({
  smsTemplateKeys,
}: {
  smsTemplateKeys: string[];
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <DryRunCard />
      <FireSmsCard smsTemplateKeys={smsTemplateKeys} />
      <MockVerifyCard />
    </div>
  );
}
