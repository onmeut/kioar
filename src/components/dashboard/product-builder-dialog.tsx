"use client";

// Product builder dialog used by the dashboard for the universal
// "محصولات و خدمات" block (menus, e-commerce items, services, packages,
// portfolio). Mobile uses a bottom Sheet, desktop a centered Dialog —
// matches the form/booking builders.
//
// The builder is a single-surface UX with two tabs:
//   - «موارد»     — list of items (edit / reorder / delete) + bulk paste.
//   - «تنظیمات»  — block-level settings (name, currency, layout, etc.).
//
// On submit the dialog emits a `ProductBlockDraft` to the parent which
// posts it to the server action.

import { useEffect, useState } from "react";
import {
  ChevronRightIcon,
  GripVerticalIcon,
  ImageIcon,
  ImageOffIcon,
  PlusIcon,
  TrashIcon,
  XIcon,
} from "lucide-react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { toPersianDigits } from "@/lib/persian";
import { formatPriceDisplay } from "@/lib/money";
import type { IconKey } from "@/lib/link-icons";
import { LinkIconPickerButton } from "@/components/dashboard/link-icon-picker-button";
import {
  PRODUCT_BLOCK_CURRENCIES,
  PRODUCT_BLOCK_DISPLAY_MODES,
  PRODUCT_BLOCK_LAYOUTS,
  PRODUCT_ITEM_AVAILABILITY,
  PRODUCT_ITEM_PRICE_TYPES,
  PRODUCT_ITEMS_HARD_CAP,
  type ProductBlockCurrency,
  type ProductBlockDisplayMode,
  type ProductBlockLayout,
  type ProductBlockPreset,
  type ProductItemAvailability,
  type ProductItemPriceType,
} from "@/lib/validations";

/** UI-only client draft shape. The server input shape is derived from it. */
export type ProductItemDraft = {
  id?: string | null;
  /** Stable client-side id for list keys. */
  _key: string;
  sectionRef?: string | null;
  title: string;
  description: string | null;
  imageUrl: string | null;
  priceType: ProductItemPriceType;
  /** Major-unit string in the editor; converted to minor on submit. */
  priceMajor: string;
  priceMaxMajor: string;
  availability: ProductItemAvailability;
  externalUrl: string | null;
  badge: string | null;
  sku: string | null;
};

export type ProductSectionDraft = {
  id?: string | null;
  _key: string;
  title: string;
};

export type ProductBlockDraft = {
  id?: string | null;
  name: string;
  description: string | null;
  preset: ProductBlockPreset | null;
  layout: ProductBlockLayout;
  itemLabel: string | null;
  currency: ProductBlockCurrency;
  showPrices: boolean;
  displayMode: ProductBlockDisplayMode;
  pillLabel: string | null;
  iconKey: IconKey | null;
  iconUrl: string | null;
  imageUrl: string | null;
  sections: ProductSectionDraft[];
  items: ProductItemDraft[];
};

/** Server-bound shape (matches `productBlockInputSchema`). */
export type ProductBlockSubmit = {
  id?: string | null;
  name: string;
  description: string | null;
  preset: ProductBlockPreset | null;
  layout: ProductBlockLayout;
  itemLabel: string | null;
  currency: ProductBlockCurrency;
  showPrices: boolean;
  displayMode: ProductBlockDisplayMode;
  pillLabel: string | null;
  iconKey: string | null;
  iconUrl: string | null;
  imageUrl: string | null;
  sections: { id?: string | null; title: string }[];
  items: {
    id?: string | null;
    sectionRef?: string | null;
    title: string;
    description: string | null;
    imageUrl: string | null;
    priceType: ProductItemPriceType;
    priceAmount: number;
    priceAmountMax: number | null;
    availability: ProductItemAvailability;
    externalUrl: string | null;
    badge: string | null;
    sku: string | null;
  }[];
};

const LAYOUT_LABEL: Record<ProductBlockLayout, string> = {
  list: "لیست",
  grid: "شبکه",
  cards: "کارت بزرگ",
};

const PRICE_TYPE_LABEL: Record<ProductItemPriceType, string> = {
  fixed: "ثابت",
  from: "از",
  range: "بازه",
  on_request: "تماس بگیرید",
  free: "رایگان",
};

const AVAILABILITY_LABEL: Record<ProductItemAvailability, string> = {
  available: "موجود",
  sold_out: "ناموجود",
  hidden: "مخفی",
};

const CURRENCY_LABEL: Record<ProductBlockCurrency, string> = {
  IRT: "تومان",
  USD: "دلار ($)",
  EUR: "یورو (€)",
};

const MAJOR_TO_MINOR: Record<ProductBlockCurrency, number> = {
  IRT: 10,
  USD: 100,
  EUR: 100,
};

function newKey() {
  return Math.random().toString(36).slice(2);
}

function emptyItem(): ProductItemDraft {
  return {
    id: null,
    _key: newKey(),
    sectionRef: null,
    title: "",
    description: null,
    imageUrl: null,
    priceType: "fixed",
    priceMajor: "",
    priceMaxMajor: "",
    availability: "available",
    externalUrl: null,
    badge: null,
    sku: null,
  };
}

function defaultDraft(preset: ProductBlockPreset = "shop"): ProductBlockDraft {
  return {
    id: null,
    name: "محصولات",
    description: null,
    preset,
    layout: "list",
    itemLabel: null,
    currency: "IRT",
    showPrices: true,
    displayMode: "pill",
    pillLabel: null,
    iconKey: null,
    iconUrl: null,
    imageUrl: null,
    sections: [],
    items: [],
  };
}

/** Minor-unit (server) → major-unit (editor) string. */
function minorToMajorString(
  minor: number | null | undefined,
  currency: ProductBlockCurrency,
): string {
  if (minor === null || minor === undefined || minor === 0) return "";
  const major = minor / MAJOR_TO_MINOR[currency];
  return String(major);
}

function majorStringToMinor(
  raw: string,
  currency: ProductBlockCurrency,
): number {
  const cleaned = raw.replace(/[,،\s]/g, "");
  const num = Number(cleaned);
  if (!Number.isFinite(num) || num < 0) return 0;
  return Math.round(num * MAJOR_TO_MINOR[currency]);
}

export type ProductBuilderDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: ProductBlockDraft | null;
  itemsCap?: number;
  onSubmit: (draft: ProductBlockSubmit) => Promise<void> | void;
  /** Silent auto-save called for reorder/item add/edit/delete when the block
   * already exists. Does NOT close the modal or show toasts. */
  onAutoSave?: (draft: ProductBlockSubmit) => Promise<void>;
  onUploadItemImage?: (file: File) => Promise<string | null>;
  submitting?: boolean;
};

export function ProductBuilderDialog({
  open,
  onOpenChange,
  initial,
  itemsCap = PRODUCT_ITEMS_HARD_CAP,
  onSubmit,
  onAutoSave,
  onUploadItemImage,
  submitting,
}: ProductBuilderDialogProps) {
  const isMobile = useIsMobile();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );
  const [draft, setDraft] = useState<ProductBlockDraft>(
    () => initial ?? defaultDraft(),
  );
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  /** Draft for a brand-new item that hasn't been committed to the list
   * yet. Committed only when the user taps the «افزودن» button so a
   * cancel never leaves a half-empty row behind. */
  const [pendingItem, setPendingItem] = useState<ProductItemDraft | null>(null);
  const [tab, setTab] = useState<"items" | "settings">("items");
  const [bulkOpen, setBulkOpen] = useState(false);

  useEffect(() => {
    if (open) {
      setDraft(initial ?? defaultDraft());
      setEditingIndex(null);
      setPendingItem(null);
      setTab("items");
      setBulkOpen(false);
    }
  }, [open, initial]);

  const Container = isMobile ? Sheet : Dialog;
  const Content = isMobile ? SheetContent : DialogContent;
  const Title = isMobile ? SheetTitle : DialogTitle;

  const contentProps = isMobile
    ? {
        side: "bottom" as const,
        className:
          "h-[92dvh] rounded-t-3xl p-0 flex flex-col gap-0 bg-background",
        showCloseButton: false,
      }
    : {
        className:
          "p-0 sm:max-w-[560px] max-h-[92vh] flex flex-col gap-0 overflow-hidden",
        showCloseButton: false,
      };

  const canSubmit = draft.name.trim().length > 0 && draft.items.length > 0;

  /** Silent auto-save for in-modal edits (reorder, item add/edit/delete). */
  function autoSaveDraft(d: ProductBlockDraft) {
    if (!d.id || !onAutoSave) return;
    void onAutoSave(buildPayload(d));
  }

  /** Convert a draft into the server payload shape and submit it. */
  async function submitDraft(d: ProductBlockDraft) {
    await onSubmit(buildPayload(d));
  }

  function buildPayload(d: ProductBlockDraft): ProductBlockSubmit {
    return {
      id: d.id ?? null,
      name: d.name.trim(),
      description: d.description?.trim() ? d.description.trim() : null,
      preset: d.preset,
      layout: d.layout,
      itemLabel: d.itemLabel?.trim() ? d.itemLabel.trim() : null,
      currency: d.currency,
      showPrices: true,
      displayMode: d.displayMode,
      pillLabel: d.pillLabel?.trim() ? d.pillLabel.trim() : null,
      iconKey: d.iconKey ?? null,
      iconUrl: d.iconUrl ?? null,
      imageUrl: d.imageUrl ?? null,
      sections: d.sections.map((s) => ({
        id: s.id ?? null,
        title: s.title.trim(),
      })),
      items: d.items.map((it) => ({
        id: it.id ?? null,
        sectionRef: it.sectionRef ?? null,
        title: it.title.trim(),
        description: it.description?.trim() ? it.description.trim() : null,
        imageUrl: it.imageUrl,
        priceType: it.priceType,
        priceAmount: majorStringToMinor(it.priceMajor, d.currency),
        priceAmountMax:
          it.priceType === "range"
            ? majorStringToMinor(it.priceMaxMajor, d.currency)
            : null,
        availability: it.availability,
        externalUrl: it.externalUrl,
        badge: it.badge?.trim() ? it.badge.trim() : null,
        sku: it.sku?.trim() ? it.sku.trim() : null,
      })),
    };
  }

  async function handleDone() {
    if (!canSubmit) return;
    await submitDraft(draft);
  }

  function applyBulk(rows: ProductItemDraft[]) {
    const remaining = itemsCap - draft.items.length;
    const slice = rows.slice(0, Math.max(0, remaining));
    if (slice.length === 0) {
      setBulkOpen(false);
      return;
    }
    const next = { ...draft, items: [...draft.items, ...slice] };
    setDraft(next);
    setBulkOpen(false);
    autoSaveDraft(next);
  }

  const editingItem = editingIndex !== null ? draft.items[editingIndex] : null;

  return (
    <Container open={open} onOpenChange={onOpenChange}>
      <Content {...contentProps}>
        <Title className="sr-only">
          {draft.id ? "ویرایش بلوک محصولات" : "افزودن بلوک محصولات"}
        </Title>

        <header className="flex items-center justify-between border-b px-4 py-3">
          <button
            type="button"
            onClick={() => {
              if (pendingItem !== null) setPendingItem(null);
              else if (editingIndex !== null) setEditingIndex(null);
              else if (bulkOpen) setBulkOpen(false);
              else onOpenChange(false);
            }}
            className="grid size-9 place-items-center rounded-full hover:bg-muted"
            aria-label="بازگشت"
          >
            <ChevronRightIcon className="size-5" />
          </button>
          <h2 className="text-sm font-bold">
            {pendingItem !== null
              ? "افزودن مورد"
              : editingIndex !== null
                ? "ویرایش مورد"
                : bulkOpen
                  ? "افزودن گروهی"
                  : draft.id
                    ? "ویرایش بلوک"
                    : "افزودن بلوک محصولات"}
          </h2>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="grid size-9 place-items-center rounded-full hover:bg-muted"
            aria-label="بستن"
          >
            <XIcon className="size-5" />
          </button>
        </header>

        {/* -------------------------------------------------- ITEM EDITOR */}
        {pendingItem !== null ? (
          <ItemEditor
            mode="add"
            item={pendingItem}
            currency={draft.currency}
            onChange={(next) => setPendingItem(next)}
            onCommit={() => {
              if (!pendingItem.title.trim()) return;
              if (draft.items.length >= itemsCap) return;
              const next = {
                ...draft,
                items: [...draft.items, pendingItem],
              };
              setDraft(next);
              setPendingItem(null);
              // Auto-save: only if the block already exists (autoSaveDraft
              // is a no-op for new blocks).
              autoSaveDraft(next);
            }}
            onUploadImage={onUploadItemImage}
          />
        ) : editingItem && editingIndex !== null ? (
          <ItemEditor
            mode="edit"
            item={editingItem}
            currency={draft.currency}
            onChange={(next) =>
              setDraft((d) => ({
                ...d,
                items: d.items.map((it, i) => (i === editingIndex ? next : it)),
              }))
            }
            onUpdate={() => {
              setEditingIndex(null);
              autoSaveDraft(draft);
            }}
            onDelete={() => {
              const next = {
                ...draft,
                items: draft.items.filter((_, i) => i !== editingIndex),
              };
              setDraft(next);
              setEditingIndex(null);
              autoSaveDraft(next);
            }}
            onUploadImage={
              onUploadItemImage
                ? async (file) => {
                    const url = await onUploadItemImage(file);
                    if (url && draft.id && editingIndex !== null) {
                      // Persist the new image URL immediately so the user
                      // doesn't have to back out and tap Save.
                      const next = {
                        ...draft,
                        items: draft.items.map((it, i) =>
                          i === editingIndex ? { ...it, imageUrl: url } : it,
                        ),
                      };
                      setDraft(next);
                      autoSaveDraft(next);
                    }
                    return url;
                  }
                : undefined
            }
          />
        ) : bulkOpen ? (
          <BulkEditor
            currency={draft.currency}
            remaining={itemsCap - draft.items.length}
            onApply={applyBulk}
          />
        ) : (
          // -------------------------------------------------- MAIN SCREEN
          <div className="flex min-h-0 flex-1 flex-col">
            <Tabs
              value={tab}
              onValueChange={(v) => setTab(v as "items" | "settings")}
              className="flex min-h-0 flex-1 flex-col"
            >
              <div className="border-b px-4 py-2">
                <TabsList className="w-full">
                  <TabsTrigger value="items" className="flex-1">
                    موارد ({toPersianDigits(draft.items.length)})
                  </TabsTrigger>
                  <TabsTrigger value="settings" className="flex-1">
                    تنظیمات
                  </TabsTrigger>
                </TabsList>
              </div>

              <TabsContent
                value="items"
                className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4"
              >
                {draft.items.length === 0 ? (
                  <p className="rounded-2xl bg-muted/40 px-4 py-6 text-center text-sm text-muted-foreground">
                    موردی اضافه نکرده‌اید.
                  </p>
                ) : (
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={(event: DragEndEvent) => {
                      const { active, over } = event;
                      if (!over || active.id === over.id) return;
                      const ids = draft.items.map((it) => it._key);
                      const oldIndex = ids.indexOf(String(active.id));
                      const newIndex = ids.indexOf(String(over.id));
                      if (oldIndex !== -1 && newIndex !== -1) {
                        const next = {
                          ...draft,
                          items: arrayMove(draft.items, oldIndex, newIndex),
                        };
                        setDraft(next);
                        autoSaveDraft(next);
                      }
                    }}
                  >
                    <SortableContext
                      items={draft.items.map((it) => it._key)}
                      strategy={verticalListSortingStrategy}
                    >
                      <ul className="flex flex-col gap-2">
                        {draft.items.map((it, i) => (
                          <SortableItemRow
                            key={it._key}
                            item={it}
                            currency={draft.currency}
                            onEdit={() => setEditingIndex(i)}
                            onDelete={() => {
                              const next = {
                                ...draft,
                                items: draft.items.filter(
                                  (_, idx) => idx !== i,
                                ),
                              };
                              setDraft(next);
                              autoSaveDraft(next);
                            }}
                          />
                        ))}
                      </ul>
                    </SortableContext>
                  </DndContext>
                )}

                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      if (draft.items.length >= itemsCap) return;
                      setPendingItem(emptyItem());
                    }}
                    disabled={draft.items.length >= itemsCap}
                    className="gap-1"
                  >
                    <PlusIcon className="size-4" />
                    افزودن یک مورد
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setBulkOpen(true)}
                    disabled={draft.items.length >= itemsCap}
                  >
                    افزودن گروهی
                  </Button>
                  <span className="ms-auto self-center text-xs text-muted-foreground">
                    {toPersianDigits(draft.items.length)} /{" "}
                    {toPersianDigits(itemsCap)}
                  </span>
                </div>
              </TabsContent>

              <TabsContent
                value="settings"
                className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4"
              >
                <SettingsPane draft={draft} setDraft={setDraft} />
                <div className="pb-2 pt-4">
                  <Button
                    type="button"
                    onClick={handleDone}
                    disabled={!canSubmit || submitting}
                    className="w-full"
                  >
                    {submitting ? "در حال ذخیره..." : "ذخیره"}
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        )}
      </Content>
    </Container>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SortableItemRow({
  item,
  currency,
  onEdit,
  onDelete,
}: {
  item: ProductItemDraft;
  currency: ProductBlockCurrency;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item._key });

  return (
    <li
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
      }}
      className="flex items-center gap-2 rounded-2xl border bg-card px-3 py-2"
    >
      <span
        className="touch-none cursor-grab text-muted-foreground active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <GripVerticalIcon className="size-4" />
      </span>
      <div className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-xl bg-muted text-muted-foreground">
        {item.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.imageUrl} alt="" className="size-full object-cover" />
        ) : (
          <ImageOffIcon className="size-4" />
        )}
      </div>
      <button
        type="button"
        onClick={onEdit}
        className="min-w-0 flex-1 text-start"
      >
        <p className="truncate text-sm font-bold hover:underline">
          {item.title || "(بدون عنوان)"}
        </p>
        <p className="text-xs text-muted-foreground">
          {formatPriceDisplay(
            {
              priceType: item.priceType,
              priceAmount: majorStringToMinor(item.priceMajor, currency),
              priceAmountMax:
                item.priceType === "range"
                  ? majorStringToMinor(item.priceMaxMajor, currency)
                  : null,
            },
            currency,
          )}
          {item.availability !== "available"
            ? ` · ${AVAILABILITY_LABEL[item.availability]}`
            : ""}
        </p>
      </button>
      <div className="flex items-center gap-0.5">
        <button
          type="button"
          onClick={onDelete}
          className="grid size-8 place-items-center rounded-xl text-destructive hover:bg-destructive/10"
          aria-label="حذف"
        >
          <TrashIcon className="size-4" />
        </button>
      </div>
    </li>
  );
}

function SettingsPane({
  draft,
  setDraft,
}: {
  draft: ProductBlockDraft;
  setDraft: React.Dispatch<React.SetStateAction<ProductBlockDraft>>;
}) {
  return (
    <>
      <div className="flex items-center gap-4">
        <LinkIconPickerButton
          url=""
          iconKey={draft.iconKey}
          iconUrl={draft.iconUrl}
          imageUrl={draft.imageUrl}
          size={52}
          onChange={(next) =>
            setDraft((d) => ({
              ...d,
              iconKey: next.iconKey,
              iconUrl: next.iconUrl,
              imageUrl: next.imageUrl,
            }))
          }
        />
        <div className="grid min-w-0 flex-1 gap-1.5">
          <Label htmlFor="prod-name">عنوان بلوک</Label>
          <Input
            id="prod-name"
            value={draft.name}
            maxLength={80}
            onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
          />
        </div>
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="prod-desc">توضیح کوتاه</Label>
        <Textarea
          id="prod-desc"
          value={draft.description ?? ""}
          maxLength={280}
          onChange={(e) =>
            setDraft((d) => ({ ...d, description: e.target.value }))
          }
          rows={2}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1.5">
          <Label>چیدمان</Label>
          <Select
            value={draft.layout}
            onValueChange={(v) =>
              setDraft((d) => ({ ...d, layout: v as ProductBlockLayout }))
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue>
                {(v) => LAYOUT_LABEL[v as ProductBlockLayout]}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {PRODUCT_BLOCK_LAYOUTS.map((l) => (
                <SelectItem key={l} value={l}>
                  {LAYOUT_LABEL[l]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-1.5">
          <Label>واحد پول</Label>
          <Select
            value={draft.currency}
            onValueChange={(v) =>
              setDraft((d) => ({ ...d, currency: v as ProductBlockCurrency }))
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue>
                {(v) => CURRENCY_LABEL[v as ProductBlockCurrency]}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {PRODUCT_BLOCK_CURRENCIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {CURRENCY_LABEL[c]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-2">
        <Label>روش نمایش روی صفحه</Label>
        <div className="grid grid-cols-2 gap-2">
          {PRODUCT_BLOCK_DISPLAY_MODES.map((m) => (
            <DisplayModeCard
              key={m}
              mode={m}
              selected={draft.displayMode === m}
              onSelect={() => setDraft((d) => ({ ...d, displayMode: m }))}
            />
          ))}
        </div>
      </div>

      {draft.displayMode === "pill" ? (
        <div className="grid gap-1.5">
          <Label htmlFor="prod-pill">متن دکمه</Label>
          <Input
            id="prod-pill"
            value={draft.pillLabel ?? ""}
            placeholder="مثلاً: مشاهده منو"
            maxLength={40}
            onChange={(e) =>
              setDraft((d) => ({ ...d, pillLabel: e.target.value }))
            }
          />
        </div>
      ) : null}
    </>
  );
}

function ItemEditor({
  mode,
  item,
  currency,
  onChange,
  onCommit,
  onUpdate,
  onDelete,
  onUploadImage,
}: {
  mode: "add" | "edit";
  item: ProductItemDraft;
  currency: ProductBlockCurrency;
  onChange: (next: ProductItemDraft) => void;
  onCommit?: () => void;
  onUpdate?: () => void;
  onDelete?: () => void;
  onUploadImage?: (file: File) => Promise<string | null>;
}) {
  const [uploading, setUploading] = useState(false);

  async function handleFile(file: File) {
    if (!onUploadImage) return;
    setUploading(true);
    try {
      const url = await onUploadImage(file);
      if (url) onChange({ ...item, imageUrl: url });
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
      <div className="flex items-center gap-3">
        <label
          className={cn(
            "grid size-20 place-items-center overflow-hidden rounded-2xl border-2 border-dashed bg-muted text-muted-foreground",
            onUploadImage ? "cursor-pointer hover:bg-muted/70" : "",
          )}
        >
          {item.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={item.imageUrl}
              alt=""
              className="size-full object-cover"
            />
          ) : (
            <ImageIcon className="size-5" />
          )}
          {onUploadImage ? (
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleFile(f);
              }}
            />
          ) : null}
        </label>
        <div className="flex-1 text-xs text-muted-foreground">
          {uploading
            ? "در حال آپلود..."
            : item.imageUrl
              ? "برای تعویض، تصویر را لمس کنید."
              : "افزودن تصویر (اختیاری)"}
          {item.imageUrl ? (
            <button
              type="button"
              onClick={() => onChange({ ...item, imageUrl: null })}
              className="ms-2 text-destructive"
            >
              حذف
            </button>
          ) : null}
        </div>
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="item-title">عنوان</Label>
        <Input
          id="item-title"
          value={item.title}
          maxLength={120}
          onChange={(e) => onChange({ ...item, title: e.target.value })}
        />
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="item-desc">توضیح</Label>
        <Textarea
          id="item-desc"
          value={item.description ?? ""}
          maxLength={280}
          rows={2}
          onChange={(e) => onChange({ ...item, description: e.target.value })}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1.5">
          <Label>نوع قیمت</Label>
          <Select
            value={item.priceType}
            onValueChange={(v) =>
              onChange({ ...item, priceType: v as ProductItemPriceType })
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue>
                {(v) => PRICE_TYPE_LABEL[v as ProductItemPriceType]}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {PRODUCT_ITEM_PRICE_TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {PRICE_TYPE_LABEL[t]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-1.5">
          <Label>وضعیت</Label>
          <Select
            value={item.availability}
            onValueChange={(v) =>
              onChange({
                ...item,
                availability: v as ProductItemAvailability,
              })
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue>
                {(v) => AVAILABILITY_LABEL[v as ProductItemAvailability]}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {PRODUCT_ITEM_AVAILABILITY.map((a) => (
                <SelectItem key={a} value={a}>
                  {AVAILABILITY_LABEL[a]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {item.priceType !== "free" && item.priceType !== "on_request" ? (
        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="price-amount">
              {item.priceType === "range" ? "از" : "قیمت"} (
              {CURRENCY_LABEL[currency]})
            </Label>
            <Input
              id="price-amount"
              inputMode="decimal"
              value={item.priceMajor}
              onChange={(e) =>
                onChange({ ...item, priceMajor: e.target.value })
              }
            />
          </div>
          {item.priceType === "range" ? (
            <div className="grid gap-1.5">
              <Label htmlFor="price-max">تا</Label>
              <Input
                id="price-max"
                inputMode="decimal"
                value={item.priceMaxMajor}
                onChange={(e) =>
                  onChange({ ...item, priceMaxMajor: e.target.value })
                }
              />
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-1.5">
        <Label htmlFor="item-link">لینک خرید/مرجع (اختیاری)</Label>
        <Input
          id="item-link"
          dir="ltr"
          placeholder="https://..."
          value={item.externalUrl ?? ""}
          onChange={(e) =>
            onChange({
              ...item,
              externalUrl: e.target.value.trim() ? e.target.value.trim() : null,
            })
          }
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="item-badge">برچسب (اختیاری)</Label>
          <Input
            id="item-badge"
            value={item.badge ?? ""}
            maxLength={40}
            placeholder="مثلاً: ویژه"
            onChange={(e) =>
              onChange({
                ...item,
                badge: e.target.value || null,
              })
            }
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="item-sku">کد (اختیاری)</Label>
          <Input
            id="item-sku"
            value={item.sku ?? ""}
            maxLength={64}
            onChange={(e) =>
              onChange({
                ...item,
                sku: e.target.value || null,
              })
            }
          />
        </div>
      </div>

      <div className="mt-2 flex flex-col gap-2">
        {mode === "add" ? (
          <button
            type="button"
            onClick={() => onCommit?.()}
            disabled={!item.title.trim()}
            className="flex items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            <PlusIcon className="size-4" />
            افزودن
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={() => onUpdate?.()}
              disabled={!item.title.trim()}
              className="flex items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              به‌روزرسانی
            </button>
            <button
              type="button"
              onClick={() => onDelete?.()}
              className="flex items-center justify-center gap-2 rounded-2xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm font-bold text-destructive hover:bg-destructive/10"
            >
              <TrashIcon className="size-4" />
              حذف این مورد
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function DisplayModeCard({
  mode,
  selected,
  onSelect,
}: {
  mode: ProductBlockDisplayMode;
  selected: boolean;
  onSelect: () => void;
}) {
  const title = mode === "pill" ? "دکمه‌ای" : "نمایش مستقیم";
  const description =
    mode === "pill"
      ? "یک دکمه روی صفحه نمایش داده می‌شود که با لمس، لیست محصولات در پنجره‌ای باز می‌شود."
      : "تمام محصولات به‌صورت مستقیم روی صفحه نمایش داده می‌شوند.";
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        "flex flex-col gap-2 rounded-2xl border bg-card p-3 text-start transition",
        selected
          ? "border-primary ring-2 ring-primary/20"
          : "hover:border-foreground/20",
      )}
    >
      <div className="grid h-20 place-items-center overflow-hidden rounded-xl bg-muted/40">
        {mode === "pill" ? (
          <div className="flex flex-col items-center gap-1">
            <div className="h-2 w-16 rounded bg-muted" />
            <div className="h-2 w-12 rounded bg-muted" />
            <div className="mt-1 h-5 w-20 rounded-full bg-primary/80" />
          </div>
        ) : (
          <div className="flex w-full flex-col gap-1 px-3">
            <div className="flex items-center gap-2">
              <div className="size-4 rounded bg-muted" />
              <div className="h-1.5 flex-1 rounded bg-muted" />
              <div className="h-1.5 w-6 rounded bg-primary/60" />
            </div>
            <div className="flex items-center gap-2">
              <div className="size-4 rounded bg-muted" />
              <div className="h-1.5 flex-1 rounded bg-muted" />
              <div className="h-1.5 w-6 rounded bg-primary/60" />
            </div>
            <div className="flex items-center gap-2">
              <div className="size-4 rounded bg-muted" />
              <div className="h-1.5 flex-1 rounded bg-muted" />
              <div className="h-1.5 w-6 rounded bg-primary/60" />
            </div>
          </div>
        )}
      </div>
      <div>
        <p className="text-sm font-bold">{title}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
      </div>
    </button>
  );
}

function BulkEditor({
  currency,
  remaining,
  onApply,
}: {
  currency: ProductBlockCurrency;
  remaining: number;
  onApply: (rows: ProductItemDraft[]) => void;
}) {
  type Row = { _key: string; title: string; price: string };
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );
  const [rows, setRows] = useState<Row[]>(() => [
    { _key: newKey(), title: "", price: "" },
    { _key: newKey(), title: "", price: "" },
    { _key: newKey(), title: "", price: "" },
  ]);

  function setRow(key: string, patch: Partial<Row>) {
    setRows((rs) => rs.map((r) => (r._key === key ? { ...r, ...patch } : r)));
  }

  const filled = rows.filter((r) => r.title.trim().length > 0);
  const overflow = filled.length > remaining;

  function handleApply() {
    const drafts: ProductItemDraft[] = filled.slice(0, remaining).map((r) => ({
      id: null,
      _key: newKey(),
      sectionRef: null,
      title: r.title.trim(),
      description: null,
      imageUrl: null,
      priceType: "fixed",
      priceMajor: r.price.trim(),
      priceMaxMajor: "",
      availability: "available",
      externalUrl: null,
      badge: null,
      sku: null,
    }));
    onApply(drafts);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
      <p className="text-xs text-muted-foreground">
        برای هر مورد عنوان و قیمت را وارد کنید. ردیف‌های خالی نادیده گرفته
        می‌شوند.
      </p>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={(event: DragEndEvent) => {
          const { active, over } = event;
          if (!over || active.id === over.id) return;
          const keys = rows.map((r) => r._key);
          const oldIndex = keys.indexOf(String(active.id));
          const newIndex = keys.indexOf(String(over.id));
          if (oldIndex !== -1 && newIndex !== -1) {
            setRows((rs) => arrayMove(rs, oldIndex, newIndex));
          }
        }}
      >
        <SortableContext
          items={rows.map((r) => r._key)}
          strategy={verticalListSortingStrategy}
        >
          <div className="flex flex-col gap-2">
            {rows.map((r) => (
              <BulkRow
                key={r._key}
                row={r}
                currency={currency}
                onChange={(patch) => setRow(r._key, patch)}
                onDelete={() =>
                  setRows((rs) =>
                    rs.length > 1 ? rs.filter((x) => x._key !== r._key) : rs,
                  )
                }
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <Button
        type="button"
        variant="ghost"
        onClick={() =>
          setRows((rs) => [...rs, { _key: newKey(), title: "", price: "" }])
        }
        className="gap-1 self-start"
      >
        <PlusIcon className="size-4" />
        افزودن ردیف جدید
      </Button>

      {overflow ? (
        <p className="rounded-xl border border-destructive/30 bg-destructive/5 p-2 text-xs text-destructive">
          حداکثر {toPersianDigits(remaining)} مورد دیگر می‌توانید اضافه کنید.
        </p>
      ) : null}

      <Button
        type="button"
        onClick={handleApply}
        disabled={filled.length === 0 || remaining <= 0}
        className="mt-2"
      >
        افزودن (
        {toPersianDigits(Math.min(filled.length, Math.max(remaining, 0)))})
      </Button>
    </div>
  );
}

function BulkRow({
  row,
  currency,
  onChange,
  onDelete,
}: {
  row: { _key: string; title: string; price: string };
  currency: ProductBlockCurrency;
  onChange: (patch: { title?: string; price?: string }) => void;
  onDelete: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: row._key });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
      }}
      className="flex items-center gap-2 rounded-2xl border bg-card p-2"
    >
      <span
        className="touch-none cursor-grab text-muted-foreground active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <GripVerticalIcon className="size-4" />
      </span>
      <div className="grid flex-1 grid-cols-[1fr_auto] gap-2">
        <Input
          value={row.title}
          onChange={(e) => onChange({ title: e.target.value })}
          placeholder="عنوان"
          maxLength={120}
          aria-label="عنوان"
        />
        <Input
          value={row.price}
          onChange={(e) => onChange({ price: e.target.value })}
          inputMode="decimal"
          placeholder={`قیمت (${CURRENCY_LABEL[currency]})`}
          className="w-28"
          aria-label="قیمت"
        />
      </div>
      <button
        type="button"
        onClick={onDelete}
        className="grid size-9 place-items-center rounded-xl text-muted-foreground hover:bg-muted"
        aria-label="حذف ردیف"
      >
        <TrashIcon className="size-4" />
      </button>
    </div>
  );
}
