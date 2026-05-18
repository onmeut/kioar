"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import {
  Building2Icon,
  CheckCircle2Icon,
  CheckIcon,
  CircleXIcon,
  Loader2Icon,
  LoaderCircleIcon,
  SearchIcon,
  UserRoundIcon,
} from "lucide-react";
import { useFormStatus, flushSync } from "react-dom";

import { idleState, type ActionState } from "@/lib/action-state";
import { type AccountType, type Category, type Industry } from "@/lib/discover";
import { resolveIconEntry } from "@/lib/link-icons";
import { PAGE_TYPES, type PageTypeSlug } from "@/lib/page-type";
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

type StartWizardProps = {
  /**
   * Server action invoked at the final step. For unauthenticated visitors
   * this writes the choices into the `kioar_pending_page_intent` cookie and
   * redirects to `/auth`. For an already-authenticated user with an
   * incomplete profile it saves the page row directly.
   */
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  initialSlug?: string;
  initialPageType?: PageTypeSlug | null;
  initialFullName?: string | null;
  initialDiscoverCategory?: string | null;
  industries: Industry[];
  categories: Category[];
};

function SubmitButton({ disabled }: { disabled: boolean }) {
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
          <span>در حال ادامه…</span>
        </>
      ) : (
        <span>ادامه</span>
      )}
    </button>
  );
}

export function StartWizard({
  action,
  initialSlug,
  initialPageType,
  initialFullName,
  initialDiscoverCategory,
  industries,
  categories,
}: StartWizardProps) {
  const [state, formAction] = useActionState(action, idleState);
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  const [slug, setSlug] = useState(() =>
    initialSlug ? normalizeSlug(initialSlug) : "",
  );
  const [pageType, setPageType] = useState<PageTypeSlug | null>(
    initialPageType ?? null,
  );
  const [fullName, setFullName] = useState<string>(initialFullName ?? "");
  const [discoverCategory, setDiscoverCategory] = useState<string | null>(
    initialDiscoverCategory ?? null,
  );
  const [categoryQuery, setCategoryQuery] = useState("");
  const categoryFormRef = useRef<HTMLFormElement | null>(null);

  const [slugStatus, setSlugStatus] = useState<SlugStatus>("idle");
  const slugTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const slugAbortRef = useRef<AbortController | null>(null);
  // Track whether the user has manually changed the slug since mount so we
  // can skip the debounce on the very first check (pre-filled from cookie).
  const slugUserEditedRef = useRef(false);

  useEffect(() => {
    if (!slug || slug.length < 2) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSlugStatus(slug.length === 0 ? "idle" : "too_short");
      return;
    }
    setSlugStatus("checking");
    if (slugTimerRef.current) clearTimeout(slugTimerRef.current);
    if (slugAbortRef.current) slugAbortRef.current.abort();
    // Use a short delay only when the user is actively typing; on the
    // initial mount (slug comes pre-filled from a cookie) fire immediately
    // so the button enables without requiring a keystroke.
    const delay = slugUserEditedRef.current ? 400 : 0;
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
    }, delay);
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

  // Require an explicit "available" confirmation so the button stays
  // disabled while the check is in-flight. This also means a pre-filled
  // slug (from cookie) forces the check to run on mount before advancing.
  const slugOk = slug.length >= 2 && slugStatus === "available";

  const slugServerError = state.fieldErrors?.slug?.[0];

  // Step 1 — slug picker
  if (step === 1) {
    return (
      <div
        className="flex flex-col items-center gap-7"
        suppressHydrationWarning
      >
        <div className="flex flex-col items-center gap-5 text-center">
          <BrandMark variant="mark" className="size-14" />
          <div className="flex flex-col gap-2">
            <h1 className="text-2xl font-bold leading-tight sm:text-3xl">
              ساخت صفحه رایگان
            </h1>
            <p className="text-sm text-muted-foreground sm:text-base">
              یک نام کاربری دلخواه برای صفحه‌ات انتخاب کن. این همون لینکیه که با
              دوستان و مشتری‌هات به اشتراک می‌گذاری.
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
              <span className="ps-5 font-mono text-[16px] font-semibold text-muted-foreground whitespace-nowrap select-none">
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
                  slugUserEditedRef.current = true;
                  setSlug(normalizeSlug(event.target.value));
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && slugOk) {
                    e.preventDefault();
                    setStep(2);
                  }
                }}
                suppressHydrationWarning
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

  // Step 2 — page type (Personal / Business)
  if (step === 2) {
    return (
      <div className="flex flex-col items-center gap-7">
        <div className="flex flex-col items-center gap-5 text-center">
          <BrandMark variant="mark" className="size-14" />
          <div className="flex flex-col gap-2">
            <h1 className="text-2xl font-bold leading-tight sm:text-3xl">
              این صفحه برای چیه؟
            </h1>
            <p className="text-sm text-muted-foreground sm:text-base">
              یکی رو انتخاب کن. بعداً می‌تونی از تنظیمات صفحه عوضش کنی.
            </p>
          </div>
        </div>

        <div className="flex w-full flex-col gap-4">
          <div className="flex flex-col gap-3">
            {PAGE_TYPES.map((t) => {
              const selected = pageType === t.slug;
              const Icon =
                t.slug === "personal" ? UserRoundIcon : Building2Icon;
              return (
                <button
                  key={t.slug}
                  type="button"
                  onClick={() => setPageType(t.slug)}
                  aria-pressed={selected}
                  className={cn(
                    "tap-target group flex items-center gap-4 rounded-3xl border-2 px-5 py-4 text-start transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/30",
                    selected
                      ? "border-foreground bg-foreground/3"
                      : "border-transparent bg-muted hover:bg-muted/70",
                  )}
                >
                  <span
                    aria-hidden
                    className="grid size-12 shrink-0 place-items-center rounded-2xl bg-background text-foreground"
                  >
                    <Icon className="size-6" strokeWidth={1.75} />
                  </span>
                  <span className="flex flex-1 flex-col">
                    <span className="text-base font-semibold leading-tight">
                      {t.label}
                    </span>
                    <span className="mt-0.5 text-xs text-muted-foreground">
                      {t.description}
                    </span>
                  </span>
                  <span
                    aria-hidden
                    className={cn(
                      "grid size-6 shrink-0 place-items-center rounded-full border-2 transition-colors",
                      selected
                        ? "border-foreground bg-foreground text-background"
                        : "border-muted-foreground/30",
                    )}
                  >
                    {selected ? <CheckIcon className="size-3.5" /> : null}
                  </span>
                </button>
              );
            })}
          </div>

          <button
            type="button"
            disabled={!pageType}
            onClick={() => setStep(3)}
            className={cn(
              "tap-target inline-flex h-14 w-full items-center justify-center rounded-full text-base font-semibold transition-colors duration-200 outline-none focus-visible:ring-3 focus-visible:ring-ring/30 disabled:cursor-not-allowed",
              !pageType
                ? "bg-muted text-muted-foreground"
                : "bg-foreground text-background hover:bg-foreground/90 active:translate-y-px",
            )}
          >
            ادامه
          </button>

          <button
            type="button"
            onClick={() => setStep(1)}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            بازگشت
          </button>
        </div>
      </div>
    );
  }

  // Step 3 — page display name
  if (step === 3) {
    const trimmedName = fullName.trim();
    const nameOk = trimmedName.length >= 1 && trimmedName.length <= 80;
    const placeholder =
      pageType === "business" ? "جواهری گوهربین" : "ایلان ماسک";
    const nameServerError = state.fieldErrors?.pageName?.[0];
    return (
      <div className="flex flex-col items-center gap-7">
        <div className="flex flex-col items-center gap-5 text-center">
          <BrandMark variant="mark" className="size-14" />
          <div className="flex flex-col gap-2">
            <h1 className="text-2xl font-bold leading-tight sm:text-3xl">
              نام صفحه‌ات چیه؟
            </h1>
            <p className="text-sm text-muted-foreground sm:text-base">
              {pageType === "business"
                ? "اسم کسب‌وکارت رو وارد کن. توی صفحه عمومی نمایش داده می‌شه."
                : "اسمی که می‌خوای روی صفحه‌ات نشون داده بشه."}
            </p>
          </div>
        </div>

        <div className="flex w-full flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <input
              type="text"
              inputMode="text"
              autoComplete="name"
              autoCapitalize="words"
              autoCorrect="off"
              spellCheck={false}
              autoFocus
              enterKeyHint="next"
              maxLength={80}
              aria-label="نام صفحه"
              placeholder={placeholder}
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && nameOk) {
                  e.preventDefault();
                  setStep(4);
                }
              }}
              className={cn(
                "h-14 w-full rounded-full bg-muted px-5 text-base font-semibold text-foreground placeholder:text-muted-foreground/70 outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/20",
                nameServerError && "ring-2 ring-destructive/40",
              )}
            />
            {nameServerError ? (
              <p className="px-3 text-xs text-destructive" role="alert">
                {nameServerError}
              </p>
            ) : null}
          </div>

          <button
            type="button"
            disabled={!nameOk}
            onClick={() => setStep(4)}
            className={cn(
              "tap-target inline-flex h-14 w-full items-center justify-center rounded-full text-base font-semibold transition-colors duration-200 outline-none focus-visible:ring-3 focus-visible:ring-ring/30 disabled:cursor-not-allowed",
              !nameOk
                ? "bg-muted text-muted-foreground"
                : "bg-foreground text-background hover:bg-foreground/90 active:translate-y-px",
            )}
          >
            ادامه
          </button>

          <button
            type="button"
            onClick={() => setStep(2)}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            بازگشت
          </button>
        </div>
      </div>
    );
  }

  // Step 4 — discover industry + category (skippable) + final submit
  const accountType: AccountType =
    pageType === "business" ? "business" : "personal";
  const visibleIndustries = industries.filter((i) =>
    i.accountTypes.includes(accountType),
  );
  const query = categoryQuery.trim();
  const filteredCategories = categories.filter((c) => {
    if (c.accountType !== accountType) return false;
    if (query.length > 0 && !c.titleFa.includes(query)) return false;
    return true;
  });
  const groupedByIndustry = visibleIndustries
    .map((ind) => ({
      industry: ind,
      items: filteredCategories.filter((c) => c.industryId === ind.id),
    }))
    .filter((g) => g.items.length > 0);

  return (
    <div className="flex flex-col items-center gap-7">
      <div className="flex flex-col items-center gap-5 text-center">
        <BrandMark variant="mark" className="size-14" />
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold leading-tight sm:text-3xl">
            دسته‌بندی صفحه‌ات
          </h1>
          <p className="text-sm text-muted-foreground sm:text-base">
            یه دسته انتخاب کن تا توی دیسکاور راحت‌تر پیدا بشی. اختیاریه.
          </p>
        </div>
      </div>

      <form
        ref={categoryFormRef}
        action={formAction}
        className="flex w-full flex-col gap-4"
      >
        <input type="hidden" name="slug" value={slug} />
        <input type="hidden" name="pageType" value={pageType ?? ""} />
        <input type="hidden" name="pageName" value={fullName.trim()} />
        <input
          type="hidden"
          name="discoverCategory"
          value={discoverCategory ?? ""}
        />

        <CategoryPicker
          groupedByIndustry={groupedByIndustry}
          query={categoryQuery}
          onQueryChange={setCategoryQuery}
          discoverCategory={discoverCategory}
          setDiscoverCategory={setDiscoverCategory}
        />

        {state.message && state.status === "error" && !slugServerError ? (
          <p className="text-center text-sm text-destructive" role="alert">
            {state.message}
          </p>
        ) : null}

        <SubmitButton
          disabled={!slug || !pageType || fullName.trim().length === 0}
        />

        <button
          type="button"
          onClick={() => {
            // Clear the category, flush the state update so the hidden input
            // reflects the new value, then submit the form.
            flushSync(() => setDiscoverCategory(null));
            categoryFormRef.current?.requestSubmit();
          }}
          className="tap-target inline-flex h-11 w-full items-center justify-center rounded-full bg-muted text-sm font-medium text-muted-foreground hover:bg-muted/70 transition-colors"
        >
          بعداً انتخاب می‌کنم
        </button>

        <button
          type="button"
          onClick={() => setStep(3)}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          بازگشت
        </button>
      </form>
    </div>
  );
}

type CategoryPickerProps = {
  groupedByIndustry: { industry: Industry; items: Category[] }[];
  query: string;
  onQueryChange: (value: string) => void;
  discoverCategory: string | null;
  setDiscoverCategory: (slug: string | null) => void;
};

function CategoryPicker({
  groupedByIndustry,
  query,
  onQueryChange,
  discoverCategory,
  setDiscoverCategory,
}: CategoryPickerProps) {
  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <SearchIcon
          aria-hidden
          className="absolute inset-e-5 top-1/2 size-5 -translate-y-1/2 text-muted-foreground"
        />
        <input
          type="text"
          inputMode="search"
          enterKeyHint="search"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="جستجوی دسته‌بندی…"
          aria-label="جستجوی دسته‌بندی"
          className="h-14 w-full rounded-full bg-muted ps-5 pe-14 text-base font-medium text-foreground placeholder:text-muted-foreground/70 outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/20"
        />
      </div>

      <div
        role="listbox"
        aria-label="دسته‌بندی‌ها"
        className="max-h-80 overflow-y-auto rounded-3xl bg-muted/40 px-2 pb-2"
      >
        {groupedByIndustry.length === 0 ? (
          <p className="px-3 py-8 text-center text-sm text-muted-foreground">
            دسته‌بندی‌ای پیدا نشد.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {groupedByIndustry.map(({ industry, items }) => {
              const indEntry = resolveIconEntry(industry.iconKey, null);
              const IndIcon = indEntry.Icon;
              return (
                <section
                  key={industry.id}
                  aria-label={industry.titleFa}
                  className="flex flex-col gap-1.5"
                >
                  <header className="sticky top-0 z-10 -mx-2 flex items-center gap-2 bg-muted/40 px-3 py-2.5 backdrop-blur-sm">
                    <IndIcon
                      className="size-4"
                      style={{ color: indEntry.color }}
                    />
                    <span className="text-xs font-semibold text-muted-foreground">
                      {industry.titleFa}
                    </span>
                  </header>
                  <div className="grid grid-cols-2 gap-2">
                    {items.map((c) => {
                      const selected = discoverCategory === c.slug;
                      const entry = resolveIconEntry(c.iconKey, null);
                      const Icon = entry.Icon;
                      return (
                        <button
                          key={c.slug}
                          type="button"
                          role="option"
                          aria-selected={selected}
                          onClick={() =>
                            setDiscoverCategory(selected ? null : c.slug)
                          }
                          className={cn(
                            "tap-target flex items-center gap-2 rounded-2xl px-3 py-3 text-start text-sm font-medium transition-colors",
                            selected
                              ? "bg-foreground text-background"
                              : "bg-background text-foreground hover:bg-background/70",
                          )}
                        >
                          <span
                            aria-hidden
                            className="inline-flex items-center text-base"
                          >
                            <Icon
                              className="size-4"
                              style={
                                selected ? undefined : { color: entry.color }
                              }
                            />
                          </span>
                          <span className="truncate">{c.titleFa}</span>
                        </button>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
