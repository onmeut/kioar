"use client";

import { useActionState } from "react";
import { Loader2Icon } from "lucide-react";
import { useFormStatus } from "react-dom";

import { idleState, type ActionState } from "@/lib/action-state";
import { cn } from "@/lib/utils";
import { saveAccountAction } from "@/app/(app)/account/actions";

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={cn(
        "tap-target inline-flex h-11 items-center justify-center gap-2 rounded-full px-6 text-sm font-semibold transition-colors",
        "bg-foreground text-background hover:bg-foreground/90 active:translate-y-px",
        "disabled:cursor-not-allowed disabled:opacity-50",
      )}
    >
      {pending ? (
        <>
          <Loader2Icon className="size-4 animate-spin" />
          در حال ذخیره…
        </>
      ) : (
        "ذخیره"
      )}
    </button>
  );
}

type Props = {
  initialFirstName: string;
  initialLastName: string;
};

export function AccountForm({ initialFirstName, initialLastName }: Props) {
  const [state, formAction] = useActionState(saveAccountAction, idleState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="firstName" className="text-sm font-medium">
            نام
          </label>
          <input
            id="firstName"
            name="firstName"
            type="text"
            defaultValue={initialFirstName}
            autoComplete="given-name"
            enterKeyHint="next"
            placeholder="ایلان"
            className={cn(
              "h-11 w-full rounded-xl bg-muted px-4 text-base font-medium text-foreground placeholder:text-muted-foreground/70 outline-none transition-colors",
              "focus-visible:ring-3 focus-visible:ring-ring/20",
            )}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="lastName" className="text-sm font-medium">
            نام خانوادگی
          </label>
          <input
            id="lastName"
            name="lastName"
            type="text"
            defaultValue={initialLastName}
            autoComplete="family-name"
            enterKeyHint="done"
            placeholder="ماسک"
            className={cn(
              "h-11 w-full rounded-xl bg-muted px-4 text-base font-medium text-foreground placeholder:text-muted-foreground/70 outline-none transition-colors",
              "focus-visible:ring-3 focus-visible:ring-ring/20",
            )}
          />
        </div>
      </div>

      {state.status === "error" && state.message ? (
        <p className="text-sm text-destructive" role="alert">
          {state.message}
        </p>
      ) : null}

      {state.status === "success" && state.message ? (
        <p className="text-sm text-emerald-600" role="status">
          {state.message}
        </p>
      ) : null}

      <div className="flex justify-end">
        <SaveButton />
      </div>
    </form>
  );
}
