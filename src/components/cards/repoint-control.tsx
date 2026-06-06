"use client";

import { useActionState, useState } from "react";

import { repointCardAction, type RepointState } from "@/app/(app)/cards/actions";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type PageOption = { id: string; slug: string; fullName: string | null };

const idle: RepointState = { status: "idle" };

/**
 * Lets the owner re-point an activated card to a different page they own.
 * The chip/QR never change — only the binding.
 */
export function RepointControl({
  cardId,
  currentPageId,
  pages,
}: {
  cardId: string;
  currentPageId: string | null;
  pages: PageOption[];
}) {
  const [state, formAction] = useActionState(repointCardAction, idle);
  const [open, setOpen] = useState(false);
  const [pageId, setPageId] = useState(currentPageId ?? pages[0]?.id ?? "");

  if (pages.length < 2) return null; // nothing to switch between

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-sm font-medium text-primary underline-offset-4 hover:underline"
      >
        تغییر صفحهٔ کارت
      </button>
    );
  }

  return (
    <form action={formAction} className="space-y-3 pt-2">
      <input type="hidden" name="cardId" value={cardId} />
      <input type="hidden" name="pageId" value={pageId} />
      <Select value={pageId} onValueChange={(v) => setPageId(v ?? "")}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {pages.map((p) => (
            <SelectItem key={p.id} value={p.id}>
              {p.fullName || p.slug}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {state.status === "error" && state.message ? (
        <p className="text-sm text-destructive">{state.message}</p>
      ) : null}
      {state.status === "ok" && state.message ? (
        <p className="text-sm text-emerald-600">{state.message}</p>
      ) : null}
      <div className="flex gap-2">
        <Button type="submit" size="sm" className="rounded-full">
          ذخیره
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="rounded-full"
          onClick={() => setOpen(false)}
        >
          انصراف
        </Button>
      </div>
    </form>
  );
}
