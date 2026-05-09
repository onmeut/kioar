"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { idleState } from "@/lib/action-state";
import { formatPersianDateTime } from "@/lib/persian";
import { cn } from "@/lib/utils";

import {
  reconcileSmsTemplateAction,
  testSmsTemplateAction,
  updateSmsBodyPreviewAction,
  updateSmsTemplateMappingAction,
} from "@/app/admin/sms/actions";

type Props = {
  templateKey: string;
  nameFa: string;
  descriptionFa: string | null;
  kavenegarTemplate: string | null;
  variableSchema: string[];
  isActive: boolean;
  bodyFaPreview: string | null;
  bodyPreviewUpdatedAt: Date | null;
  kavenegarSyncedAt: Date | null;
};

export function SmsTemplateRow(props: Props) {
  const [mappingState, mappingAction] = useActionState(
    updateSmsTemplateMappingAction,
    idleState,
  );
  const [testState, testAction] = useActionState(
    testSmsTemplateAction,
    idleState,
  );
  const [bodyState, bodyAction] = useActionState(
    updateSmsBodyPreviewAction,
    idleState,
  );
  const [reconcileState, reconcileAction] = useActionState(
    reconcileSmsTemplateAction,
    idleState,
  );

  const variables = props.variableSchema ?? [];
  const isMapped = Boolean(props.kavenegarTemplate);
  const previewAt = props.bodyPreviewUpdatedAt
    ? new Date(props.bodyPreviewUpdatedAt)
    : null;
  const syncedAt = props.kavenegarSyncedAt
    ? new Date(props.kavenegarSyncedAt)
    : null;
  const outOfSync =
    Boolean(previewAt) &&
    (!syncedAt || previewAt!.getTime() > syncedAt.getTime());

  return (
    <article className="rounded-3xl border border-border bg-card p-4 shadow-sm">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-foreground">
            {props.nameFa}
          </h3>
          <p className="mt-1 font-mono text-xs text-muted-foreground" dir="ltr">
            {props.templateKey}
          </p>
          {props.descriptionFa ? (
            <p className="mt-1 text-xs text-muted-foreground">
              {props.descriptionFa}
            </p>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          {outOfSync ? (
            <span className="rounded-full bg-amber-500/10 px-2 py-1 text-[10px] font-medium text-amber-700">
              نیاز به همگام‌سازی
            </span>
          ) : null}
          <span
            className={cn(
              "rounded-full px-2 py-1 text-[10px] font-medium",
              isMapped && props.isActive
                ? "bg-emerald-500/10 text-emerald-700"
                : !isMapped
                  ? "bg-amber-500/10 text-amber-700"
                  : "bg-muted text-muted-foreground",
            )}
          >
            {!isMapped ? "نگاشت نشده" : props.isActive ? "فعال" : "غیرفعال"}
          </span>
        </div>
      </header>

      {variables.length > 0 ? (
        <p className="mt-3 text-xs text-muted-foreground">
          متغیرها (به ترتیب توکن کاوه‌نگار):{" "}
          <span dir="ltr" className="font-mono">
            {variables.map((v, i) => `${i + 1}:${v}`).join(" · ")}
          </span>
        </p>
      ) : null}

      <form action={mappingAction} className="mt-4 space-y-3">
        <input type="hidden" name="key" value={props.templateKey} />
        <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
          <div className="grid gap-1.5">
            <Label htmlFor={`${props.templateKey}-mapping`} className="text-xs">
              نام تمپلیت کاوه‌نگار
            </Label>
            <Input
              id={`${props.templateKey}-mapping`}
              name="kavenegarTemplate"
              defaultValue={props.kavenegarTemplate ?? ""}
              placeholder="kioarTrialStarted"
              dir="ltr"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              className="font-mono"
            />
          </div>
          <div className="flex items-center justify-between gap-3 sm:justify-end">
            <Label
              htmlFor={`${props.templateKey}-active`}
              className="flex items-center gap-2 text-xs"
            >
              <Switch
                id={`${props.templateKey}-active`}
                name="isActive"
                defaultChecked={props.isActive}
              />
              فعال
            </Label>
            <Button type="submit" className="h-11 sm:h-9">
              ذخیره
            </Button>
          </div>
        </div>
        {mappingState.message ? (
          <p
            className={cn(
              "text-xs",
              mappingState.status === "success"
                ? "text-emerald-600"
                : "text-rose-600",
            )}
          >
            {mappingState.message}
          </p>
        ) : null}
      </form>

      <form
        action={testAction}
        className="mt-3 space-y-3 border-t border-border pt-3"
      >
        <input type="hidden" name="key" value={props.templateKey} />
        <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
          <div className="grid gap-1.5">
            <Label
              htmlFor={`${props.templateKey}-test-phone`}
              className="text-xs"
            >
              ارسال آزمایشی به شماره (قالب 98XXXXXXXXXX)
            </Label>
            <Input
              id={`${props.templateKey}-test-phone`}
              name="phone"
              type="tel"
              inputMode="numeric"
              dir="ltr"
              autoComplete="off"
              placeholder="989121234567"
            />
          </div>
          <Button
            type="submit"
            variant="outline"
            className="h-11 sm:h-9"
            disabled={!isMapped || !props.isActive}
          >
            ارسال آزمایشی
          </Button>
        </div>
        {testState.message ? (
          <p
            className={cn(
              "text-xs",
              testState.status === "success"
                ? "text-emerald-600"
                : "text-rose-600",
            )}
          >
            {testState.message}
          </p>
        ) : null}
      </form>

      <form
        action={bodyAction}
        className="mt-3 space-y-3 border-t border-border pt-3"
      >
        <input type="hidden" name="key" value={props.templateKey} />
        <div className="grid gap-1.5">
          <Label
            htmlFor={`${props.templateKey}-body-preview`}
            className="text-xs"
          >
            پیش‌نمایش متن فارسی (مرجع — متن واقعی از کاوه‌نگار ارسال می‌شود)
          </Label>
          <Textarea
            id={`${props.templateKey}-body-preview`}
            name="bodyFaPreview"
            defaultValue={props.bodyFaPreview ?? ""}
            placeholder="مثال: سلام {plan} عزیز، اشتراک شما {daysLeft} روز دیگر تجدید می‌شود."
            rows={3}
          />
          <p className="text-[11px] text-muted-foreground" dir="ltr">
            {previewAt
              ? `last edited: ${formatPersianDateTime(previewAt)}`
              : "preview not set"}
            {syncedAt
              ? ` · synced: ${formatPersianDateTime(syncedAt)}`
              : " · never synced"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="submit" variant="outline" className="h-11 sm:h-9">
            ذخیره پیش‌نمایش
          </Button>
        </div>
        {bodyState.message ? (
          <p
            className={cn(
              "text-xs",
              bodyState.status === "success"
                ? "text-emerald-600"
                : "text-rose-600",
            )}
          >
            {bodyState.message}
          </p>
        ) : null}
      </form>

      <form
        action={reconcileAction}
        className="mt-3 flex flex-wrap items-center gap-3 border-t border-border pt-3"
      >
        <input type="hidden" name="key" value={props.templateKey} />
        <Button
          type="submit"
          variant={outOfSync ? "default" : "outline"}
          className="h-11 sm:h-9"
        >
          {outOfSync
            ? "تأیید همگام‌سازی با کاوه‌نگار"
            : "تأیید مجدد همگام‌سازی"}
        </Button>
        {reconcileState.message ? (
          <p
            className={cn(
              "text-xs",
              reconcileState.status === "success"
                ? "text-emerald-600"
                : "text-rose-600",
            )}
          >
            {reconcileState.message}
          </p>
        ) : null}
      </form>
    </article>
  );
}
