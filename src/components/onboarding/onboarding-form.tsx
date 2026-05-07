"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import {
  CheckCircle2Icon,
  CircleXIcon,
  Loader2Icon,
  LoaderCircleIcon,
} from "lucide-react";
import { useFormStatus } from "react-dom";

import { idleState, type ActionState } from "@/lib/action-state";
import { normalizeSlug } from "@/lib/slug";
import { cn } from "@/lib/utils";
import { BrandMark } from "@/components/shared/brand-mark";

type SlugStatus =
  | "idle"
  | "checking"
  | "available"
  | "taken"
  | "reserved"
  | "too_short"
  | "invalid";

type OnboardingFormProps = {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  initialSlug?: string;
};

function ContinueButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  const isDisabled = disabled || pending;
  return (
    <button
      type="submit"
      disabled={isDisabled}
      className={cn(
        "tap-target inline-flex h-14 w-full items-center justify-center gap-2 rounded-full text-base font-semibold transition-colors duration-200 outline-none focus-visible:ring-3 focus-visible:ring-ring/30 disabled:cursor-not-allowed",
        isDisabled
          ? "bg-muted text-muted-foreground"
          : "bg-foreground text-background hover:bg-foreground/90 active:translate-y-px",
      )}
    >
      {pending ? (
        <>
          <Loader2Icon className="size-4 animate-spin" />
          <span>در حال ساخت…</span>
        </>
      ) : (
        <span>ساخت کارت و ادامه</span>
      )}
    </button>
  );
}

export function OnboardingForm({ action, initialSlug }: OnboardingFormProps) {
  const [state, formAction] = useActionState(action, idleState);
  const [step, setStep] = useState<1 | 2>(1);

  const [slug, setSlug] = useState(() =>
    initialSlug ? normalizeSlug(initialSlug) : "",
  );
  const [slugEdited, setSlugEdited] = useState(Boolean(initialSlug));
  const [pageName, setPageName] = useState("");

  const [slugStatus, setSlugStatus] = useState<SlugStatus>("idle");
  const slugTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const slugAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!slug || slug.length < 2) {
      setSlugStatus(slug.length === 0 ? "idle" : "too_short");
      return;
    }
    setSlugStatus("checking");
    if (slugTimerRef.current) clearTimeout(slugTimerRef.current);
    if (slugAbortRef.current) slugAbortRef.current.abort();
    slugTimerRef.current = setTimeout(async () => {
      const controller = new AbortController();
      slugAbortRef.current = controller;
      try {
        const res = await fetch(
          `/api/slug/check?handle=${encodeURIComponent(slug)}`,
          { signal: controller.signal },
        );
        const data = (await res.json()) as {
          available: boolean;
          reason?: string;
        };
        setSlugStatus(
          data.available
            ? "available"
            : ((data.reason as SlugStatus) ?? "taken"),
        );
      } catch {
        // aborted — ignore
      }
    }, 400);
    return () => {
      if (slugTimerRef.current) clearTimeout(slugTimerRef.current);
    };
  }, [slug]);

  const slugIcon = (() => {
    if (slugStatus === "checking")
      return (
        <LoaderCircleIcon className="size-5 animate-spin text-muted-foreground" />
      );
    if (slugStatus === "available")
      return <CheckCircle2Icon className="size-5 text-emerald-500" />;
    if (slugStatus === "taken" || slugStatus === "reserved")
      return <CircleXIcon className="size-5 text-destructive" />;
    return null;
  })();

  const slugOk =
    slug.length >= 2 &&
    slugStatus !== "taken" &&
    slugStatus !== "reserved" &&
    slugStatus !== "invalid" &&
    slugStatus !== "too_short";

  const slugServerError = state.fieldErrors?.slug?.[0];

  // Step 1 — slug picker
  if (step === 1) {
    return (
      <div className="flex flex-col items-center gap-7">
        <div className="flex flex-col items-center gap-5 text-center">
          <BrandMark variant="mark" className="size-14" />
          <div className="flex flex-col gap-2">
            <h1 className="text-2xl font-bold leading-tight sm:text-3xl">
              ساخت صفحه رایگان
            </h1>
            <p className="text-sm text-muted-foreground sm:text-base">
              این همون لینکیه که با دوستان و مشتری‌هات به اشتراک می‌گذاری. بعدا
              می‌تونی برای کسب‌وکارت هم یه لینک جدا بسازی.
            </p>
          </div>
        </div>

        <div className="flex w-full flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <div
              dir="ltr"
              className={cn(
                "relative flex h-14 w-full min-w-0 items-center rounded-full bg-muted transition-colors",
                "focus-within:ring-3 focus-within:ring-ring/20",
                slugStatus === "available" && "ring-2 ring-emerald-400/40",
                (slugStatus === "taken" || slugStatus === "reserved") &&
                  "ring-2 ring-destructive/40",
              )}
            >
              <span className="ps-5 font-mono text-[15px] font-semibold text-muted-foreground whitespace-nowrap select-none">
                kioar.me/
              </span>
              <input
                name="slug"
                type="text"
                inputMode="text"
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                placeholder="elonmusk"
                aria-label="نام کاربری"
                autoFocus
                enterKeyHint="next"
                value={slug}
                onChange={(event) => {
                  setSlugEdited(true);
                  setSlug(normalizeSlug(event.target.value));
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && slugOk) {
                    e.preventDefault();
                    setStep(2);
                  }
                }}
                className="min-w-0 flex-1 bg-transparent px-3 pe-12 font-mono text-[16px] font-semibold text-foreground placeholder:text-muted-foreground/70 focus:outline-none"
              />
              {slugIcon ? (
                <span className="absolute inset-e-4 top-1/2 -translate-y-1/2">
                  {slugIcon}
                </span>
              ) : null}
            </div>
            {slugServerError ? (
              <p className="px-3 text-xs text-destructive" role="alert">
                {slugServerError}
              </p>
            ) : null}
          </div>

          <button
            type="button"
            disabled={!slugOk}
            onClick={() => setStep(2)}
            className={cn(
              "tap-target inline-flex h-14 w-full items-center justify-center rounded-full text-base font-semibold transition-colors duration-200 outline-none focus-visible:ring-3 focus-visible:ring-ring/30 disabled:cursor-not-allowed",
              !slugOk
                ? "bg-muted text-muted-foreground"
                : "bg-foreground text-background hover:bg-foreground/90 active:translate-y-px",
            )}
          >
            ادامه
          </button>
        </div>
      </div>
    );
  }

  // Step 2 — page name
  return (
    <div className="flex flex-col items-center gap-7">
      <div className="flex flex-col items-center gap-5 text-center">
        <BrandMark variant="mark" className="size-14" />
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold leading-tight sm:text-3xl">
            نام صفحه‌ات چیه؟
          </h1>
          <p className="text-sm text-muted-foreground sm:text-base">
            این اسم روی صفحه‌ات نمایش داده می‌شه. بعداً می‌تونی تغییرش بدی.
          </p>
        </div>
      </div>

      <form action={formAction} className="flex w-full flex-col gap-4">
        <input type="hidden" name="slug" value={slug} />

        <input
          id="pageName"
          name="pageName"
          value={pageName}
          onChange={(event) => setPageName(event.target.value)}
          autoComplete="name"
          autoFocus
          enterKeyHint="done"
          placeholder="ایلان ماسک یا مدرسه هایپرلنس"
          aria-label="نام صفحه"
          className={cn(
            "h-14 w-full rounded-full bg-muted px-5 text-base font-medium text-foreground placeholder:text-muted-foreground/70 outline-none transition-colors",
            "focus-visible:ring-3 focus-visible:ring-ring/20",
            state.fieldErrors?.pageName?.[0] && "ring-3 ring-destructive/30",
          )}
        />

        {state.fieldErrors?.pageName?.[0] && (
          <p className="text-center text-sm text-destructive" role="alert">
            {state.fieldErrors.pageName[0]}
          </p>
        )}

        {state.message && state.status === "error" && !slugServerError ? (
          <p className="text-center text-sm text-destructive" role="alert">
            {state.message}
          </p>
        ) : null}

        <ContinueButton disabled={pageName.trim().length < 1} />

        <button
          type="button"
          onClick={() => setStep(1)}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          ویرایش لینک
        </button>
      </form>
    </div>
  );
}
