"use client";

// Public form modal — opens when a visitor taps a form pill on a profile.
// Renders the fields by kind, validates client-side, posts to the server
// action, then shows the outro thank-you state.

import { useEffect, useId, useState, useTransition } from "react";
import { CheckCircle2Icon, FormInputIcon, XIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useIsInMockup } from "@/components/dashboard/mockup-portal-context";
import { useIsMobile } from "@/hooks/use-mobile";
import { idleState, type ActionState } from "@/lib/action-state";
import { cn } from "@/lib/utils";
import type { FormFieldKind } from "@/lib/validations";

export type PublicFormField = {
  id: string;
  kind: FormFieldKind;
  label: string;
  required: boolean;
  options: string[];
};

export type PublicFormBlockData = {
  id: string;
  name: string;
  intro: string | null;
  outro: string | null;
  fields: PublicFormField[];
  sortOrder?: number;
};

type SubmitFn = (
  state: ActionState,
  formData: FormData,
) => Promise<ActionState>;

export function PublicFormPill({
  block,
  submitAction,
  defaultOpen = false,
  className,
}: {
  block: PublicFormBlockData;
  submitAction: SubmitFn;
  defaultOpen?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "relative flex w-full items-center justify-center rounded-full bg-foreground/[0.04] px-4 py-4 transition-colors hover:bg-primary/8 active:bg-primary/12",
          className,
        )}
      >
        <span className="absolute inset-s-3 inline-flex size-9 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <FormInputIcon className="size-5" />
        </span>
        <span className="block w-full truncate px-10 text-center text-[15px] font-bold">
          {block.name}
        </span>
      </button>
      <PublicFormModal
        open={open}
        onOpenChange={setOpen}
        block={block}
        submitAction={submitAction}
      />
    </>
  );
}

function PublicFormModal({
  open,
  onOpenChange,
  block,
  submitAction,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  block: PublicFormBlockData;
  submitAction: SubmitFn;
}) {
  const isMobile = useIsMobile();
  // Inside the dashboard live-preview phone mockup we always render the
  // mobile sheet variant — the mockup *is* a phone, regardless of the host
  // viewport — and we make it fill the frame so headers stay visible.
  const inMockup = useIsInMockup();
  const fullscreen = isMobile || inMockup;
  const Container = fullscreen ? Sheet : Dialog;
  const Content = fullscreen ? SheetContent : DialogContent;
  const Title = fullscreen ? SheetTitle : DialogTitle;

  const contentProps = fullscreen
    ? {
        side: "bottom" as const,
        // `inset-0 h-full max-h-none rounded-none` makes the sheet fill the
        // mockup (or the real mobile viewport) edge-to-edge — no whitespace
        // around the modal, no centered "card" feel. Header sits at the top
        // of the sheet so it's always visible on small screens.
        className:
          "inset-0 h-full max-h-none rounded-none p-0 flex flex-col gap-0 bg-background overflow-hidden",
        showCloseButton: false,
      }
    : {
        className:
          "p-0 sm:max-w-md flex flex-col gap-0 max-h-[92vh] overflow-hidden",
        showCloseButton: false,
      };

  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!open) setSubmitted(false);
  }, [open]);

  return (
    <Container open={open} onOpenChange={onOpenChange}>
      <Content {...contentProps}>
        <Title className="sr-only">{block.name}</Title>
        <div className="flex items-center justify-between border-b px-3 py-2.5">
          <span className="w-9" />
          <h2 className="text-sm font-bold">{block.name}</h2>
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            className="rounded-full"
            onClick={() => onOpenChange(false)}
            aria-label="بستن"
          >
            <XIcon className="size-5" />
          </Button>
        </div>

        {submitted ? (
          <ThankYouState
            outro={block.outro || "ممنون از پاسخ شما!"}
            onClose={() => onOpenChange(false)}
          />
        ) : (
          <FormBody
            block={block}
            submitAction={submitAction}
            onSubmitted={() => setSubmitted(true)}
          />
        )}
      </Content>
    </Container>
  );
}

function ThankYouState({
  outro,
  onClose,
}: {
  outro: string;
  onClose: () => void;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-12 text-center">
      <span className="inline-flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
        <CheckCircle2Icon className="size-7" />
      </span>
      <p className="max-w-xs text-base font-bold">{outro}</p>
      <Button
        type="button"
        onClick={onClose}
        className="mt-2 h-11 rounded-full px-8"
      >
        بستن
      </Button>
    </div>
  );
}

function FormBody({
  block,
  submitAction,
  onSubmitted,
}: {
  block: PublicFormBlockData;
  submitAction: SubmitFn;
  onSubmitted: () => void;
}) {
  const [values, setValues] = useState<Record<string, string | string[]>>({});
  const [pending, startTransition] = useTransition();

  function setValue(fieldId: string, value: string | string[]) {
    setValues((curr) => ({ ...curr, [fieldId]: value }));
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    // Client-side required + format checks before posting to the server.
    for (const field of block.fields) {
      const v = values[field.id];
      const isEmpty =
        v === undefined || v === "" || (Array.isArray(v) && v.length === 0);
      if (field.required && isEmpty) {
        toast.error(`لطفاً ${field.label} را تکمیل کنید.`);
        return;
      }
      if (field.kind === "email" && typeof v === "string" && v) {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) {
          toast.error("ایمیل معتبر نیست.");
          return;
        }
      }
    }

    startTransition(async () => {
      const fd = new FormData();
      fd.set("blockId", block.id);
      fd.set("values", JSON.stringify(values));
      const result = await submitAction(idleState, fd);
      if (result.status === "error") {
        toast.error(result.message ?? "ارسال نشد.");
        return;
      }
      onSubmitted();
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex min-h-0 flex-1 flex-col"
      noValidate
    >
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-6">
        {block.intro ? (
          <p className="text-right text-sm text-muted-foreground">
            {block.intro}
          </p>
        ) : null}
        {block.fields.map((field) => (
          <FieldInput
            key={field.id}
            field={field}
            value={values[field.id]}
            onChange={(v) => setValue(field.id, v)}
          />
        ))}
      </div>
      <div className="border-t bg-background p-4 safe-pb">
        <Button
          type="submit"
          disabled={pending}
          className="h-12 w-full rounded-full text-base font-bold"
        >
          {pending ? "در حال ارسال…" : "ارسال"}
        </Button>
      </div>
    </form>
  );
}

function FieldInput({
  field,
  value,
  onChange,
}: {
  field: PublicFormField;
  value: string | string[] | undefined;
  onChange: (v: string | string[]) => void;
}) {
  const id = useId();

  const labelEl = (
    <Label htmlFor={id} className="text-sm font-bold">
      {field.label}
      {field.required ? <span className="text-red-500"> *</span> : null}
    </Label>
  );

  switch (field.kind) {
    case "name":
      return (
        <div className="space-y-2">
          {labelEl}
          <Input
            id={id}
            type="text"
            autoComplete="name"
            enterKeyHint="next"
            value={(value as string) ?? ""}
            onChange={(e) => onChange(e.target.value)}
            placeholder="نام"
          />
        </div>
      );
    case "email":
      return (
        <div className="space-y-2">
          {labelEl}
          <Input
            id={id}
            type="email"
            inputMode="email"
            autoComplete="email"
            enterKeyHint="next"
            dir="ltr"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            value={(value as string) ?? ""}
            onChange={(e) => onChange(e.target.value)}
            placeholder="name@example.com"
          />
        </div>
      );
    case "phone":
      return (
        <div className="space-y-2">
          {labelEl}
          <Input
            id={id}
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            enterKeyHint="next"
            dir="ltr"
            value={(value as string) ?? ""}
            onChange={(e) => onChange(e.target.value)}
            placeholder="+98…"
          />
        </div>
      );
    case "country":
      return (
        <div className="space-y-2">
          {labelEl}
          <Input
            id={id}
            type="text"
            autoComplete="country-name"
            enterKeyHint="next"
            value={(value as string) ?? ""}
            onChange={(e) => onChange(e.target.value)}
            placeholder="ایران"
          />
        </div>
      );
    case "short_answer":
      return (
        <div className="space-y-2">
          {labelEl}
          <Input
            id={id}
            type="text"
            enterKeyHint="next"
            value={(value as string) ?? ""}
            onChange={(e) => onChange(e.target.value)}
          />
        </div>
      );
    case "paragraph":
      return (
        <div className="space-y-2">
          {labelEl}
          <Textarea
            id={id}
            rows={4}
            value={(value as string) ?? ""}
            onChange={(e) => onChange(e.target.value)}
            className="min-h-24 resize-y"
          />
        </div>
      );
    case "date":
      return (
        <div className="space-y-2">
          {labelEl}
          <Input
            id={id}
            type="date"
            dir="ltr"
            value={(value as string) ?? ""}
            onChange={(e) => onChange(e.target.value)}
          />
        </div>
      );
    case "single_choice":
      return (
        <div className="space-y-2">
          {labelEl}
          <RadioGroup
            value={(value as string) ?? ""}
            onValueChange={(v) => onChange(v)}
            className="space-y-2"
          >
            {field.options.map((opt) => {
              const optId = `${id}-${opt}`;
              return (
                <Label
                  key={opt}
                  htmlFor={optId}
                  className={cn(
                    "flex cursor-pointer items-center gap-3 rounded-2xl border bg-card px-4 py-3 text-sm font-medium transition-colors",
                    value === opt
                      ? "border-foreground bg-foreground/5"
                      : "hover:bg-muted/40",
                  )}
                >
                  <RadioGroupItem id={optId} value={opt} />
                  <span>{opt}</span>
                </Label>
              );
            })}
          </RadioGroup>
        </div>
      );
    case "checkboxes":
      return (
        <div className="space-y-2">
          {labelEl}
          <div className="space-y-2">
            {field.options.map((opt) => {
              const arr = Array.isArray(value) ? value : [];
              const checked = arr.includes(opt);
              const optId = `${id}-${opt}`;
              return (
                <Label
                  key={opt}
                  htmlFor={optId}
                  className={cn(
                    "flex cursor-pointer items-center gap-3 rounded-2xl border bg-card px-4 py-3 text-sm font-medium transition-colors",
                    checked
                      ? "border-foreground bg-foreground/5"
                      : "hover:bg-muted/40",
                  )}
                >
                  <input
                    id={optId}
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => {
                      if (e.target.checked) onChange([...arr, opt]);
                      else onChange(arr.filter((v) => v !== opt));
                    }}
                    className="size-4 accent-foreground"
                  />
                  <span>{opt}</span>
                </Label>
              );
            })}
          </div>
        </div>
      );
    case "dropdown":
      return (
        <div className="space-y-2">
          {labelEl}
          <Select
            value={(value as string) ?? ""}
            onValueChange={(v) => onChange(v ?? "")}
          >
            <SelectTrigger id={id} className="w-full">
              <SelectValue placeholder="انتخاب کنید…" />
            </SelectTrigger>
            <SelectContent>
              {field.options.map((opt) => (
                <SelectItem key={opt} value={opt}>
                  {opt}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      );
    default:
      return null;
  }
}
