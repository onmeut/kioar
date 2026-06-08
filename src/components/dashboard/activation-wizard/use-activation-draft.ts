"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const DRAFT_KEY_PREFIX = "kioar:activation-draft:";

function draftKey(pageId: string) {
  return `${DRAFT_KEY_PREFIX}${pageId}`;
}

export type ActivationDraft = {
  step: number;
  selectedPlatforms: string[];
  platformValues: Record<string, string>;
  displayName: string;
  bio: string;
  avatarUrl: string | null;
};

const EMPTY_DRAFT: ActivationDraft = {
  step: 0,
  selectedPlatforms: [],
  platformValues: {},
  displayName: "",
  bio: "",
  avatarUrl: null,
};

function readDraft(pageId: string): ActivationDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(draftKey(pageId));
    if (!raw) return null;
    return JSON.parse(raw) as ActivationDraft;
  } catch {
    return null;
  }
}

export function hasSavedDraft(pageId: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    return Boolean(localStorage.getItem(draftKey(pageId)));
  } catch {
    return false;
  }
}

export function clearActivationDraft(pageId: string) {
  try {
    if (typeof window !== "undefined") localStorage.removeItem(draftKey(pageId));
  } catch {
    // ignore — private browsing
  }
}

export function useActivationDraft(initialDisplayName: string, initialBio: string, pageId: string) {
  const [draft, setDraftState] = useState<ActivationDraft>(() => {
    const saved = readDraft(pageId);
    if (saved) {
      // Never restore avatarUrl from draft — it would leak across profiles.
      // Always use the current server-side name/bio: the user may have updated
      // them via page settings between wizard sessions, and a stale draft
      // displayName would override the real value (e.g. show "Name 2").
      return {
        ...saved,
        avatarUrl: null,
        displayName: initialDisplayName || saved.displayName,
        bio: initialBio || saved.bio,
      };
    }
    return { ...EMPTY_DRAFT, displayName: initialDisplayName, bio: initialBio };
  });

  const pendingWrite = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (pendingWrite.current) clearTimeout(pendingWrite.current);
    pendingWrite.current = setTimeout(() => {
      try {
        // Never persist avatarUrl — would leak across profiles
        const toSave: ActivationDraft = { ...draft, avatarUrl: null };
        localStorage.setItem(draftKey(pageId), JSON.stringify(toSave));
      } catch {
        // quota exceeded or private browsing
      }
    }, 300);
    return () => {
      if (pendingWrite.current) clearTimeout(pendingWrite.current);
    };
  }, [draft, pageId]);

  const updateDraft = useCallback((patch: Partial<ActivationDraft>) => {
    setDraftState((prev) => ({ ...prev, ...patch }));
  }, []);

  const resetDraft = useCallback(
    (fresh?: Partial<ActivationDraft>) => {
      clearActivationDraft(pageId);
      setDraftState({ ...EMPTY_DRAFT, displayName: initialDisplayName, bio: initialBio, ...fresh });
    },
    [initialDisplayName, initialBio, pageId],
  );

  return { draft, updateDraft, resetDraft };
}
