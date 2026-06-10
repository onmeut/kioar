"use client";

import { useState } from "react";
import { GlobeIcon, Loader2Icon, SparklesIcon, XIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { isSafeLinkUrl, normalizeLinkUrl } from "@/lib/validations";
import { detectIconKey } from "@/lib/link-icons";
import type { LinkMetadata } from "@/lib/link-metadata";

import type { EditableLink } from "./links-manager.types";
import { type LinkIconPickerValue } from "./link-icon-picker";
import { LinkIconPickerButton } from "./link-icon-picker-button";

type EditLinkDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  link: EditableLink | null;
  fetchMetadataAction: (
    url: string,
  ) => Promise<{ ok: true; data: LinkMetadata } | { ok: false; message: string }>;
  onSubmit: (patch: Partial<EditableLink>) => void;
};

export function EditLinkDialog({
  open,
  onOpenChange,
  link,
  fetchMetadataAction,
  onSubmit,
}: EditLinkDialogProps) {
  const isMobile = useIsMobile();

  const body = link ? (
    <EditLinkBody
      key={link.id}
      link={link}
      fetchMetadataAction={fetchMetadataAction}
      onSubmit={(patch) => {
        onSubmit(patch);
        onOpenChange(false);
      }}
      onClose={() => onOpenChange(false)}
    />
  ) : null;

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="bottom"
          className="max-h-[92dvh] overflow-hidden rounded-t-3xl p-0"
          showCloseButton={false}
        >
          <SheetTitle className="sr-only">ویرایش لینک</SheetTitle>
          {body}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="w-full max-w-xl p-0 sm:max-w-2xl"
        showCloseButton={false}
      >
        <DialogTitle className="sr-only">ویرایش لینک</DialogTitle>
        {body}
      </DialogContent>
    </Dialog>
  );
}

function EditLinkBody({
  link,
  fetchMetadataAction,
  onSubmit,
  onClose,
}: {
  link: EditableLink;
  fetchMetadataAction: EditLinkDialogProps["fetchMetadataAction"];
  onSubmit: (patch: Partial<EditableLink>) => void;
  onClose: () => void;
}) {
  const [url, setUrl] = useState(link.url ?? "");
  const [label, setLabel] = useState(link.label ?? "");
  const [description, setDescription] = useState(link.description ?? "");
  const [iconKey, setIconKey] = useState<import("@/lib/link-icons").IconKey | null>(link.iconKey ?? detectIconKey(link.url ?? "") ?? "auto");
  const [iconUrl, setIconUrl] = useState(link.iconUrl ?? null);
  const [imageUrl, setImageUrl] = useState(link.imageUrl ?? null);
  const [isFetching, setIsFetching] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [lastFetchedUrl, setLastFetchedUrl] = useState<string | null>(null);

  const normalizedUrl = normalizeLinkUrl(url);
  const urlValid = isSafeLinkUrl(normalizedUrl);
  const canSubmit = urlValid && Boolean(label.trim());

  async function runMetadataFetch(opts: { force?: boolean } = {}) {
    const trimmed = normalizeLinkUrl(url);
    if (!trimmed || !/^https?:\/\//i.test(trimmed)) return;
    if (!opts.force && trimmed === lastFetchedUrl) return;
    setLastFetchedUrl(trimmed);
    setFetchError(null);
    setIsFetching(true);
    try {
      const result = await fetchMetadataAction(trimmed);
      if (!result.ok) {
        setFetchError(result.message);
        return;
      }
      const data = result.data;
      if (data.title) setLabel(data.title);
      if (data.description) setDescription(data.description);
      if (data.image) setImageUrl(data.image);
      if (!data.title && !data.description && !data.image) {
        setFetchError("اطلاعاتی از این لینک پیدا نکردیم.");
      }
    } catch {
      setFetchError("دریافت اطلاعات با خطا مواجه شد.");
    } finally {
      setIsFetching(false);
    }
  }

  function handleSubmit() {
    if (!canSubmit) return;
    onSubmit({
      label: label.trim(),
      url: normalizedUrl,
      description: description.trim() || null,
      iconKey,
      iconUrl,
      imageUrl,
    });
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Header */}
      <div className="grid shrink-0 grid-cols-[40px_1fr_40px] items-center border-b px-4 py-3 sm:px-5 sm:py-4">
        <div />
        <h2 className="text-center text-lg font-bold">ویرایش لینک</h2>
        <div className="flex justify-end">
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            className="rounded-full"
            onClick={onClose}
            aria-label="بستن"
          >
            <XIcon className="size-5" />
          </Button>
        </div>
      </div>

      {/* Scrollable body */}
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 sm:p-5">
        {/* URL field */}
        <div className="space-y-2">
          <Label htmlFor="edit-link-url">نشانی</Label>
          <div
            dir="ltr"
            className="flex h-14 items-center gap-2 rounded-2xl border border-border bg-transparent px-4 transition-colors duration-200 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/20"
          >
            <GlobeIcon className="size-5 shrink-0 text-muted-foreground" aria-hidden />
            <input
              id="edit-link-url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              type="url"
              inputMode="url"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              dir="ltr"
              placeholder="https://example.com"
              className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground"
            />
            {isFetching ? (
              <Loader2Icon className="size-4 shrink-0 animate-spin text-muted-foreground" aria-hidden />
            ) : urlValid ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => runMetadataFetch({ force: true })}
                className="h-9 shrink-0 gap-1.5 rounded-full px-3 text-xs font-semibold"
              >
                <SparklesIcon className="size-3.5" />
                دریافت خودکار
              </Button>
            ) : null}
          </div>
          {fetchError && !isFetching ? (
            <p className="text-xs text-muted-foreground">{fetchError}</p>
          ) : null}
        </div>

        {/* Icon + title preview */}
        <div className={cn("rounded-4xl bg-muted/30 p-3 border border-border")}>
          <div className="flex items-center gap-3">
            <LinkIconPickerButton
              url={normalizedUrl}
              iconKey={iconKey}
              iconUrl={iconUrl}
              imageUrl={imageUrl}
              size={56}
              onChange={(next: LinkIconPickerValue) => {
                setIconKey(next.iconKey);
                setIconUrl(next.iconUrl);
                setImageUrl(next.imageUrl);
              }}
              onRefetch={() => runMetadataFetch({ force: true })}
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold">{label || "عنوان لینک"}</p>
              {description ? (
                <p className="line-clamp-2 text-xs text-muted-foreground">{description}</p>
              ) : (
                <p className="text-[11px] text-muted-foreground">برای تغییر آیکون روی تصویر بزنید</p>
              )}
            </div>
          </div>
        </div>

        {/* Title */}
        <div className="space-y-2">
          <Label htmlFor="edit-link-label">عنوان</Label>
          <Input
            id="edit-link-label"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            enterKeyHint="next"
            placeholder="مثلاً کانال تلگرام من"
          />
        </div>

        {/* Description */}
        <div className="space-y-2">
          <Label htmlFor="edit-link-description">توضیح کوتاه (اختیاری)</Label>
          <Textarea
            id="edit-link-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="در یک جمله بگویید مخاطب در این لینک چه می‌بیند."
            className="min-h-20"
            maxLength={160}
          />
          <p className="text-xs text-muted-foreground">{description.length}/۱۶۰</p>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-end gap-2 border-t p-4 sm:p-5">
        <Button type="button" variant="outline" className="h-11" onClick={onClose}>
          انصراف
        </Button>
        <Button type="button" className="h-11 px-6" disabled={!canSubmit} onClick={handleSubmit}>
          ویرایش لینک
        </Button>
      </div>
    </div>
  );
}
