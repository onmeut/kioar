"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { XIcon, ArrowRightIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import type { PublicProfileCardData } from "@/components/public/public-profile-card";
import type { ActionState } from "@/lib/action-state";
import type { EditableLink } from "@/components/dashboard/links-manager.types";
import type { IconKey } from "@/lib/link-icons";

import { useActivationDraft, clearActivationDraft } from "./use-activation-draft";
import { WIZARD_PLATFORMS } from "./platforms";
import { ActivationStepPlatforms } from "./activation-step-platforms";
import { ActivationStepLinks } from "./activation-step-links";
import { ActivationStepProfile } from "./activation-step-profile";
import { ActivationStepDone } from "./activation-step-done";

// Steps: 0=platforms, 1=links, 2=profile, 3=done/confetti (trial upsell merged into done)
const TOTAL_STEPS = 4;
const STEP_DONE = 3;

type Props = {
  open: boolean;
  onClose: () => void;
  pageId: string;
  initialDisplayName: string;
  initialBio: string;
  initialAvatarUrl: string | null;
  initialAvatarSeed: string | null;
  /** ISO string of trial end. Null = no active trial. */
  trialEndsAt: string | null;
  previewProfile: PublicProfileCardData;

  autosaveLinksAction: (
    state: ActionState,
    formData: FormData,
  ) => Promise<ActionState>;
  autosaveAvatarAction: (
    state: ActionState,
    formData: FormData,
  ) => Promise<ActionState>;
  deleteAvatarAction: (
    state: ActionState,
    formData: FormData,
  ) => Promise<ActionState>;
  saveAvatarSeedAction: (
    state: ActionState,
    formData: FormData,
  ) => Promise<ActionState>;
  /** Called by parent after wizard completes so the links list re-renders. */
  onLinksAdded: (links: EditableLink[]) => void;
  /** Called after profile name/bio saved. */
  onProfileUpdated: (patch: { fullName: string; bio: string; avatarUrl: string | null; avatarSeed: string | null }) => void;

  /** Ref that receives a `resetDraft()` function so the parent can reset
   *  wizard state immediately when the user deletes all their links. */
  resetDraftRef?: React.MutableRefObject<(() => void) | null>;

  saveProfileDetails: (
    state: ActionState,
    formData: FormData,
  ) => Promise<ActionState>;
};

function buildLinksFromDraft(
  selectedPlatforms: string[],
  platformValues: Record<string, string>,
): EditableLink[] {
  const result: EditableLink[] = [];

  WIZARD_PLATFORMS.forEach((platform) => {
    if (!selectedPlatforms.includes(platform.key)) return;
    const raw = (platformValues[platform.key] ?? "").trim();
    if (!raw) return;

    let url: string;
    if (platform.usernameOnly) {
      // Strip @ prefix if user typed it, then build full URL
      const username = raw.startsWith("@") ? raw.slice(1) : raw;
      url = platform.prefix + username;
    } else if (platform.key === "email") {
      url = raw.startsWith("mailto:") ? raw : `mailto:${raw}`;
    } else if (platform.key === "phone") {
      url = raw.startsWith("tel:") ? raw : `tel:${raw}`;
    } else {
      url = raw.startsWith("http") ? raw : platform.prefix + raw;
    }

    result.push({
      id: `wizard-${platform.key}-${Date.now()}`,
      label: platform.label,
      url,
      description: null,
      imageUrl: null,
      iconKey: platform.key as IconKey,
      iconUrl: null,
      sortOrder: result.length,
      isActive: true,
      spotlight: "none",
      animationStyle: null,
    } satisfies EditableLink);
  });

  return result;
}

/**
 * After `autosaveLinksAction` succeeds it returns the real DB uuids (in saved
 * order) under `values.linkIds` as a JSON-encoded array. Swap them onto the
 * locally-built links so the parent's `onLinksAdded` receives real ids — the
 * `wizard-<key>-<ts>` placeholders must never reach the reorder query (they'd
 * trip Postgres' uuid cast). Falls back to the placeholder if anything is off.
 */
function withRealLinkIds(
  links: EditableLink[],
  rawLinkIds: string | undefined,
): EditableLink[] {
  if (!rawLinkIds) return links;
  let ids: unknown;
  try {
    ids = JSON.parse(rawLinkIds);
  } catch {
    return links;
  }
  if (!Array.isArray(ids) || ids.length !== links.length) return links;
  return links.map((link, i) =>
    typeof ids[i] === "string" ? { ...link, id: ids[i] as string } : link,
  );
}

export function ActivationWizard({
  open,
  onClose,
  pageId,
  initialDisplayName,
  initialBio,
  initialAvatarUrl,
  initialAvatarSeed,
  trialEndsAt,
  previewProfile,
  autosaveLinksAction,
  autosaveAvatarAction,
  deleteAvatarAction,
  saveAvatarSeedAction,
  onLinksAdded,
  onProfileUpdated,
  resetDraftRef,
  saveProfileDetails,
}: Props) {
  const { draft, updateDraft, resetDraft } = useActivationDraft(initialDisplayName, initialBio, pageId);

  // If name + bio + avatar are already filled, skip the profile step
  const profileAlreadyFilled =
    initialDisplayName.trim().length >= 2 &&
    initialBio.trim().length >= 2 &&
    (initialAvatarUrl !== null || initialAvatarSeed !== null);

  // Expose resetDraft to parent so it can reset wizard state without remounting
  const resetDraftRefInternal = useRef(resetDraft);
  resetDraftRefInternal.current = resetDraft;
  useEffect(() => {
    if (resetDraftRef) {
      resetDraftRef.current = () => resetDraftRefInternal.current();
    }
  }, [resetDraftRef]);
  const [isSaving, startSaving] = useTransition();
  const [linkErrors, setLinkErrors] = useState<Record<string, string | null>>({});
  // Local avatar state lives here so the profile step renders fresh avatar changes
  const [localAvatarUrl, setLocalAvatarUrl] = useState<string | null>(initialAvatarUrl);
  const [localAvatarSeed, setLocalAvatarSeed] = useState<string | null>(initialAvatarSeed);

  // Sync local avatar when wizard opens (never from draft — avoid cross-profile leak)
  useEffect(() => {
    if (open) {
      setLocalAvatarUrl(initialAvatarUrl);
      setLocalAvatarSeed(initialAvatarSeed);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Hide the layout promo bar + app header while the wizard is open so they
  // don't bleed through the full-screen overlay.
  useEffect(() => {
    if (open) {
      document.body.setAttribute("data-wizard-open", "1");
    } else {
      document.body.removeAttribute("data-wizard-open");
    }
    return () => document.body.removeAttribute("data-wizard-open");
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") handleClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function handleClose() {
    onClose();
  }

  function handleTogglePlatform(key: string) {
    const next = draft.selectedPlatforms.includes(key)
      ? draft.selectedPlatforms.filter((k) => k !== key)
      : [...draft.selectedPlatforms, key];
    updateDraft({ selectedPlatforms: next });
  }

  function handlePlatformValueChange(key: string, value: string) {
    updateDraft({ platformValues: { ...draft.platformValues, [key]: value } });
    const platform = WIZARD_PLATFORMS.find((p) => p.key === key);
    if (platform?.validate) {
      const err = platform.validate(value);
      setLinkErrors((prev) => ({ ...prev, [key]: err }));
    }
  }

  function validateAllLinks(): boolean {
    const errors: Record<string, string | null> = {};
    let hasError = false;
    for (const key of draft.selectedPlatforms) {
      const platform = WIZARD_PLATFORMS.find((p) => p.key === key);
      if (!platform?.validate) continue;
      const err = platform.validate(draft.platformValues[key] ?? "");
      errors[key] = err;
      if (err) hasError = true;
    }
    setLinkErrors(errors);
    return !hasError;
  }

  async function handleAvatarUpload(file: File) {
    const fd = new FormData();
    fd.set("avatar", file);
    const result = await autosaveAvatarAction({ status: "idle" }, fd);
    if (result.status === "error") {
      toast.error(result.message ?? "آپلود نشد.");
      return { ok: false as const };
    }
    const newUrl = (result.values?.avatarUrl as string | undefined) ?? null;
    if (newUrl) {
      setLocalAvatarUrl(newUrl);
      onProfileUpdated({ fullName: draft.displayName, bio: draft.bio, avatarUrl: newUrl, avatarSeed: localAvatarSeed });
    }
    return { ok: true as const };
  }

  async function handleAvatarDelete() {
    const result = await deleteAvatarAction({ status: "idle" }, new FormData());
    if (result.status === "error") {
      toast.error(result.message ?? "حذف نشد.");
      return { ok: false as const };
    }
    setLocalAvatarUrl(null);
    onProfileUpdated({ fullName: draft.displayName, bio: draft.bio, avatarUrl: null, avatarSeed: localAvatarSeed });
    return { ok: true as const };
  }

  async function handleAvatarPickSeed(seed: string) {
    const fd = new FormData();
    fd.set("seed", seed);
    const result = await saveAvatarSeedAction({ status: "idle" }, fd);
    if (result.status === "error") {
      toast.error(result.message ?? "ذخیره نشد.");
      return { ok: false as const };
    }
    setLocalAvatarUrl(null);
    setLocalAvatarSeed(seed);
    onProfileUpdated({ fullName: draft.displayName, bio: draft.bio, avatarUrl: null, avatarSeed: seed });
    return { ok: true as const };
  }

  async function handleNext() {
    if (draft.step >= TOTAL_STEPS - 1) return;
    if (draft.step === 1 && !validateAllLinks()) return;
    const nextStep = draft.step + 1;
    // Skip profile step (2) if already filled — save links and jump to done
    if (nextStep === 2 && profileAlreadyFilled) {
      const newLinks = buildLinksFromDraft(draft.selectedPlatforms, draft.platformValues);
      if (newLinks.length > 0) {
        startSaving(async () => {
          const linksFd = new FormData();
          linksFd.append("links", JSON.stringify(newLinks.map((l, i) => ({
            label: l.label, url: l.url, description: l.description,
            imageUrl: l.imageUrl, iconKey: l.iconKey, iconUrl: l.iconUrl,
            sortOrder: i, isActive: true, spotlight: "none", animationStyle: null,
          }))));
          const linksResult = await autosaveLinksAction({ status: "idle" }, linksFd);
          if (linksResult.status === "error") {
            toast.error(linksResult.message ?? "خطا در ذخیره‌ی لینک‌ها");
            return;
          }
          onLinksAdded(withRealLinkIds(newLinks, linksResult.values?.linkIds));
          clearActivationDraft(pageId);
          updateDraft({ step: STEP_DONE });
        });
      } else {
        clearActivationDraft(pageId);
        updateDraft({ step: STEP_DONE });
      }
    } else {
      updateDraft({ step: nextStep });
    }
  }

  function handleBack() {
    if (draft.step > 0) {
      const prevStep = draft.step - 1;
      // Skip profile step (2) going back if already filled
      if (prevStep === 2 && profileAlreadyFilled) {
        updateDraft({ step: 1 });
      } else {
        updateDraft({ step: prevStep });
      }
    }
  }

  // Step 2 (profile) "ساخت صفحه" — save profile + links, then go straight to done/celebration
  async function handleProfileNext() {
    startSaving(async () => {
      const cleanName = draft.displayName.trim();
      const cleanBio = draft.bio.trim();

      if (cleanName.length >= 2) {
        const profileFd = new FormData();
        profileFd.append("fullName", cleanName);
        profileFd.append("title", previewProfile.title || cleanName);
        profileFd.append("bio", cleanBio.length >= 8 ? cleanBio : (previewProfile.bio || `${cleanName} در کیوآر`));
        profileFd.append("slug", previewProfile.slug);
        profileFd.append("publicPhone", previewProfile.publicPhone ?? "");
        profileFd.append("email", previewProfile.email ?? "");
        const profileResult = await saveProfileDetails({ status: "idle" }, profileFd);
        if (profileResult.status === "error") {
          toast.error(profileResult.message ?? "خطا در ذخیره‌ی پروفایل");
          return;
        }
      }

      let savedLinks = buildLinksFromDraft(draft.selectedPlatforms, draft.platformValues);
      if (savedLinks.length > 0) {
        const linksFd = new FormData();
        linksFd.append("links", JSON.stringify(savedLinks.map((l, i) => ({
          label: l.label, url: l.url, description: l.description,
          imageUrl: l.imageUrl, iconKey: l.iconKey, iconUrl: l.iconUrl,
          sortOrder: i, isActive: true, spotlight: "none", animationStyle: null,
        }))));
        const linksResult = await autosaveLinksAction({ status: "idle" }, linksFd);
        if (linksResult.status === "error") {
          toast.error(linksResult.message ?? "خطا در ذخیره‌ی لینک‌ها");
          return;
        }
        // Replace placeholder ids with the real DB uuids before they enter state.
        savedLinks = withRealLinkIds(savedLinks, linksResult.values?.linkIds);
      }

      onProfileUpdated({ fullName: draft.displayName, bio: draft.bio, avatarUrl: localAvatarUrl, avatarSeed: localAvatarSeed });
      onLinksAdded(savedLinks);
      clearActivationDraft(pageId);
      updateDraft({ step: STEP_DONE });
    });
  }

  const hasAtLeastOneLink = draft.selectedPlatforms.some(
    (key) => (draft.platformValues[key] ?? "").trim().length > 0,
  );
  const hasLinkErrors = Object.values(linkErrors).some(Boolean);
  const canContinue =
    draft.step === 0
      ? draft.selectedPlatforms.length > 0
      : draft.step === 1
        ? hasAtLeastOneLink && !hasLinkErrors
        : draft.step === 2
          ? draft.displayName.trim().length >= 2
          : true;

  // Progress bar: exclude the done step (and profile step if skipped)
  const progressSteps = profileAlreadyFilled ? TOTAL_STEPS - 2 : TOTAL_STEPS - 1;
  function stepDisplayNum(s: number): number {
    if (!profileAlreadyFilled) return s + 1;
    if (s === 0) return 1;
    if (s === 1) return 2;
    return 3;
  }

  const STEP_TITLES: Record<number, string> = {
    0: "کجا حضور داری؟",
    1: "افزودن لینک‌‌ها",
    2: "بایو",
  };

  if (!open) return null;

  const isDoneStep = draft.step === STEP_DONE;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[200] bg-black/50 sm:flex sm:items-center sm:justify-center"
        aria-hidden="true"
        onClick={() => { if (!isDoneStep) handleClose(); }}
      />

      {/* Card: full-screen mobile, centered on desktop */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="ساخت صفحه"
        className={cn(
          "fixed z-[201] flex flex-col bg-background overflow-hidden",
          "inset-0",
          "sm:inset-auto sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2",
          "sm:w-full sm:max-w-md sm:max-h-[88dvh] sm:rounded-3xl sm:shadow-2xl",
        )}
        style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header — hidden on done step */}
        {!isDoneStep && (
          <div className="flex shrink-0 items-center justify-between border-b px-4 pt-3 pb-3">
            {draft.step > 0 ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleBack}
                className="rounded-full px-3 text-muted-foreground"
                aria-label="مرحله قبل"
              >
                <ArrowRightIcon className="size-4" />
              </Button>
            ) : (
              <div className="w-10" />
            )}
            <span className="text-sm font-semibold" aria-live="polite">
              {STEP_TITLES[draft.step] ?? ""}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={handleClose}
              aria-label="بستن"
              className="rounded-full text-muted-foreground"
            >
              <XIcon className="size-4" />
            </Button>
          </div>
        )}

        {/* Progress bar — hidden on done step */}
        {!isDoneStep && (
          <div className="h-1 w-full shrink-0 bg-muted">
            <div
              className="h-full bg-foreground transition-all duration-300"
              style={{ width: `${((stepDisplayNum(draft.step)) / progressSteps) * 100}%` }}
              role="progressbar"
              aria-valuenow={draft.step + 1}
              aria-valuemin={1}
              aria-valuemax={progressSteps}
            />
          </div>
        )}

        {/* Body */}
        <div className={cn(
          "min-h-0 flex-1",
          isDoneStep ? "flex flex-col px-5 py-6" : "overflow-y-auto px-5 py-6",
        )}>
          {draft.step === 0 && (
            <ActivationStepPlatforms
              selected={draft.selectedPlatforms}
              onToggle={handleTogglePlatform}
            />
          )}
          {draft.step === 1 && (
            <ActivationStepLinks
              selectedKeys={draft.selectedPlatforms}
              values={draft.platformValues}
              onChange={handlePlatformValueChange}
              onRemove={handleTogglePlatform}
              errors={linkErrors}
            />
          )}
          {draft.step === 2 && (
            <ActivationStepProfile
              displayName={draft.displayName}
              bio={draft.bio}
              avatarUrl={localAvatarUrl}
              avatarSeed={localAvatarSeed}
              onNameChange={(v) => updateDraft({ displayName: v })}
              onBioChange={(v) => updateDraft({ bio: v })}
              onAvatarChange={setLocalAvatarUrl}
              onSeedChange={setLocalAvatarSeed}
              onAvatarUpload={handleAvatarUpload}
              onAvatarDelete={handleAvatarDelete}
              onAvatarPickSeed={handleAvatarPickSeed}
            />
          )}
          {isDoneStep && (
            <ActivationStepDone
              previewProfile={previewProfile}
              trialEndsAt={trialEndsAt}
              pageId={pageId}
              onClose={() => {
                clearActivationDraft(pageId);
                handleClose();
              }}
            />
          )}
        </div>

        {/* Footer — steps 0, 1, 2 only */}
        {!isDoneStep && (
          <div className="shrink-0 border-t px-5 py-4" style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}>
            <div className="flex flex-col gap-2">
              <Button
                type="button"
                disabled={!canContinue || isSaving}
                onClick={draft.step === 2 ? handleProfileNext : handleNext}
                className="h-11 w-full gap-1.5 rounded-full text-sm font-bold"
              >
                {isSaving ? "در حال ذخیره…" : "ادامه"}
              </Button>
              {draft.step > 0 && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={handleBack}
                  disabled={isSaving}
                  className="h-10 w-full rounded-full text-sm text-muted-foreground"
                >
                  بازگشت
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

