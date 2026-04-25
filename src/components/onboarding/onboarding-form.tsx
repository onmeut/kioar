"use client";

import { useActionState, useState } from "react";

import { idleState, type ActionState } from "@/lib/action-state";
import { generateSlugSuggestion, normalizeSlug } from "@/lib/slug";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/shared/submit-button";

type OnboardingFormProps = {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  /** Handle claimed on the landing page (via ?handle=) if any. */
  initialSlug?: string;
};

/**
 * Minimal first-run form. Order matters: username first (it's the hero of the
 * landing claim bar), then identity (first/last name, role). Everything else
 * — avatar, bio, contact, links — lives on the dashboard so this screen stays
 * a single scroll on mobile.
 */
export function OnboardingForm({ action, initialSlug }: OnboardingFormProps) {
  const [state, formAction] = useActionState(action, idleState);
  const [slug, setSlug] = useState(() =>
    initialSlug ? normalizeSlug(initialSlug) : "",
  );
  const [slugEdited, setSlugEdited] = useState(Boolean(initialSlug));
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");

  // Suggest a slug from the name ONLY if the user hasn't typed one yet. Once
  // they touch the slug field we stop rewriting their input from underneath.
  function maybeSuggestSlug(first: string, last: string) {
    if (slugEdited) return;
    const source = `${first} ${last}`.trim();
    if (!source) return;
    setSlug(generateSlugSuggestion(source));
  }

  return (
    <form action={formAction} className="grid gap-5">
      <div className="space-y-2">
        <Label htmlFor="slug">نام کاربری</Label>
        <div className="flex items-stretch overflow-hidden rounded-3xl border border-border bg-background focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20">
          <span
            dir="ltr"
            className="flex items-center border-e border-border bg-muted px-3 font-mono text-[13px] font-semibold text-muted-foreground"
          >
            kioar.me/
          </span>
          <Input
            id="slug"
            name="slug"
            value={slug}
            onChange={(event) => {
              setSlugEdited(true);
              setSlug(event.target.value);
            }}
            autoFocus
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            inputMode="url"
            enterKeyHint="next"
            dir="ltr"
            placeholder="yourname"
            className="h-11 rounded-none border-0 bg-transparent font-mono text-[15px] font-semibold focus-visible:ring-0 md:h-11"
          />
        </div>
        <p className="text-xs text-muted-foreground">
          این همان نشانی عمومی کارت شماست و بعداً قابل تغییر است.
        </p>
        {state.fieldErrors?.slug?.[0] ? (
          <p className="text-sm text-destructive">
            {state.fieldErrors.slug[0]}
          </p>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="firstName">نام</Label>
          <Input
            id="firstName"
            name="firstName"
            value={firstName}
            onChange={(event) => {
              const next = event.target.value;
              setFirstName(next);
              maybeSuggestSlug(next, lastName);
            }}
            autoComplete="given-name"
            enterKeyHint="next"
            placeholder="مثلاً سارا"
          />
          {state.fieldErrors?.firstName?.[0] ? (
            <p className="text-sm text-destructive">
              {state.fieldErrors.firstName[0]}
            </p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="lastName">نام خانوادگی</Label>
          <Input
            id="lastName"
            name="lastName"
            value={lastName}
            onChange={(event) => {
              const next = event.target.value;
              setLastName(next);
              maybeSuggestSlug(firstName, next);
            }}
            autoComplete="family-name"
            enterKeyHint="next"
            placeholder="مثلاً نعمتی"
          />
          {state.fieldErrors?.lastName?.[0] ? (
            <p className="text-sm text-destructive">
              {state.fieldErrors.lastName[0]}
            </p>
          ) : null}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="title">عنوان شغلی</Label>
        <Input
          id="title"
          name="title"
          autoComplete="organization-title"
          enterKeyHint="done"
          placeholder="مثلاً مدیر محصول"
        />
        {state.fieldErrors?.title?.[0] ? (
          <p className="text-sm text-destructive">
            {state.fieldErrors.title[0]}
          </p>
        ) : null}
      </div>

      {state.message && state.status === "error" ? (
        <p className="rounded-3xl bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.message}
        </p>
      ) : null}

      <SubmitButton
        type="submit"
        size="lg"
        className="h-12 w-full rounded-full sm:w-auto sm:min-w-56"
        pendingLabel="در حال ساخت..."
      >
        ساخت کارت و ادامه
      </SubmitButton>
    </form>
  );
}
