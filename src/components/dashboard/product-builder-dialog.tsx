"use client";

// Product builder dialog used by the dashboard for the universal
// "محصولات و خدمات" block (menus, e-commerce items, services, packages,
// portfolio). Mobile uses a bottom Sheet, desktop a centered Dialog —
// matches the form/booking builders.
//
// UX is auto-save first: every mutation (item add / edit / delete /
// reorder, every settings/layout change) is persisted silently. There
// is no explicit "Save" button — the user just closes the modal when
// they're done. The first item add CREATES the block, so the row never
// disappears just because the modal was dismissed.
//
// Tabs: «موارد» (items) · «چیدمان» (layout) · «تنظیمات» (settings).

import { useEffect, useRef, useState } from "react";
import {
  ChevronDownIcon,
  ArrowLeftIcon,
  GripVerticalIcon,
  ImageOffIcon,
  LayersIcon,
  Loader2Icon,
  PencilIcon,
  PlusIcon,
  ShoppingBagIcon,
  TagIcon,
  TrashIcon,
  XIcon,
} from "lucide-react";
import { BlockEmptyState } from "@/components/shared/block-empty-state";
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
import { ImageField } from "@/components/shared/image-field";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import { normalizeBlockSlug } from "@/lib/slug";
import { toPersianDigits, toEnglishDigits } from "@/lib/persian";
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
  PRODUCT_SECTIONS_MAX,
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
  isFeatured: boolean;
  externalUrl: string | null;
  badge: string | null;
  sku: string | null;
};

export type ProductSectionDraft = {
  id?: string | null;
  _key: string;
  title: string;
  /** Optional category icon key (registry key or `t:<name>`). */
  iconKey: IconKey | null;
};

export type ProductBlockDraft = {
  id?: string | null;
  name: string;
  description: string | null;
  preset: ProductBlockPreset | null;
  /** Dedicated public-page path (`/USERNAME/{slug}`). Null = inline-only. */
  slug: string | null;
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
  slug: string | null;
  layout: ProductBlockLayout;
  itemLabel: string | null;
  currency: ProductBlockCurrency;
  showPrices: boolean;
  displayMode: ProductBlockDisplayMode;
  pillLabel: string | null;
  iconKey: string | null;
  iconUrl: string | null;
  imageUrl: string | null;
  sections: { id?: string | null; title: string; iconKey: string | null }[];
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
    isFeatured: boolean;
    externalUrl: string | null;
    badge: string | null;
    sku: string | null;
  }[];
};

const LAYOUT_LABEL: Record<ProductBlockLayout, string> = {
  list: "لیست",
  grid: "گرید",
  cards: "کارت",
};

const LAYOUT_SUBLABEL: Record<ProductBlockLayout, string> = {
  list: "منو / فهرست بلند",
  grid: "فروشگاه / گالری",
  cards: "پکیج / خدمات",
};

/** Per-preset defaults applied when a brand-new block is created from the
 * add-link tile. `name` is what shows in the UI; `slug` is the dedicated
 * public-page path (`/USERNAME/{slug}`) — null for the generic shop/product
 * block, which renders inline only. `layout` picks a sensible default view. */
const PRESET_DEFAULTS: Record<
  ProductBlockPreset,
  { name: string; slug: string | null; layout: ProductBlockLayout }
> = {
  shop: { name: "محصولات", slug: null, layout: "grid" },
  menu: { name: "منو", slug: "menu", layout: "list" },
  services: { name: "خدمات", slug: "services", layout: "cards" },
  packages: { name: "پکیج‌ها", slug: null, layout: "cards" },
  portfolio: { name: "نمونه‌کارها", slug: null, layout: "grid" },
  custom: { name: "محصولات", slug: null, layout: "list" },
};

/** Block name shown in the editor + public page, derived from the saved
 * preset when the user hasn't typed a custom name. */
export function presetBlockName(preset: ProductBlockPreset | null): string {
  return PRESET_DEFAULTS[preset ?? "shop"]?.name ?? "محصولات";
}

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
    isFeatured: false,
    externalUrl: null,
    badge: null,
    sku: null,
  };
}

function defaultDraft(preset: ProductBlockPreset = "shop"): ProductBlockDraft {
  const d = PRESET_DEFAULTS[preset] ?? PRESET_DEFAULTS.shop;
  return {
    id: null,
    name: d.name,
    description: null,
    preset,
    slug: d.slug,
    layout: d.layout,
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
  return formatWithCommas(String(major));
}

function majorStringToMinor(
  raw: string,
  currency: ProductBlockCurrency,
): number {
  const cleaned = toEnglishDigits(raw).replace(/[,،\s]/g, "");
  const num = Number(cleaned);
  if (!Number.isFinite(num) || num < 0) return 0;
  return Math.round(num * MAJOR_TO_MINOR[currency]);
}

/** Format a raw digit string with thousand-separator commas: "3500000" → "3,500,000" */
function formatWithCommas(digits: string): string {
  if (!digits) return "";
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/** Accept user price input: normalize Persian digits, strip non-digits, re-format with commas. */
function filterPriceInput(value: string): string {
  const digits = toEnglishDigits(value).replace(/[^\d]/g, "");
  return formatWithCommas(digits);
}

function buildPayload(d: ProductBlockDraft): ProductBlockSubmit {
  // The product-service resolves item.sectionRef via a map keyed by
  // `section.id ?? __new_${index}`. Client drafts identify sections by
  // their stable `_key` (which equals `id` for persisted rows but is a
  // random transient string for newly-created categories). Translate
  // each item's `sectionRef` through that same convention before
  // sending so new categories actually attach to their items.
  const keyToServerRef = new Map<string, string>();
  d.sections.forEach((s, index) => {
    keyToServerRef.set(s._key, s.id ?? `__new_${index}`);
  });

  return {
    id: d.id ?? null,
    name: d.name.trim() || presetBlockName(d.preset),
    description: d.description?.trim() ? d.description.trim() : null,
    preset: d.preset,
    slug: normalizeBlockSlug(d.slug),
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
      iconKey: s.iconKey ?? null,
    })),
    items: d.items.map((it) => ({
      id: it.id ?? null,
      sectionRef:
        it.sectionRef && keyToServerRef.has(it.sectionRef)
          ? keyToServerRef.get(it.sectionRef)!
          : null,
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
      isFeatured: it.isFeatured,
      externalUrl: it.externalUrl,
      badge: it.badge?.trim() ? it.badge.trim() : null,
      sku: it.sku?.trim() ? it.sku.trim() : null,
    })),
  };
}

export type ProductBuilderDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: ProductBlockDraft | null;
  /** Preset to seed a NEW block with (ignored when `initial` is provided).
   * Drives default name + default slug. From the add-link tile. */
  newPreset?: ProductBlockPreset;
  /** The owner's profile slug — used to preview the dedicated page URL
   * (`{profileSlug}/{blockSlug}`) in the slug field. */
  profileSlug?: string;
  itemsCap?: number;
  /** Called when the user presses the back arrow on the main (non-editing) view.
   * If provided, the arrow navigates back (e.g. re-opens the add-links modal).
   * If omitted, the arrow closes the dialog. */
  onBack?: () => void;
  /** Auto-save handler: persists the draft (creates the block on first
   * call when payload.id is null) and returns the resulting block id so
   * the dialog can keep editing the same row. Returns null on failure.
   *
   * The dialog calls this after every meaningful mutation. There is no
   * explicit "Save" button. Closing the modal is purely a dismiss. */
  onAutoSave: (draft: ProductBlockSubmit) => Promise<{ id: string } | null>;
  onUploadItemImage?: (file: File) => Promise<string | null>;
};

export function ProductBuilderDialog({
  open,
  onOpenChange,
  initial,
  newPreset = "shop",
  profileSlug,
  itemsCap = PRODUCT_ITEMS_HARD_CAP,
  onBack,
  onAutoSave,
  onUploadItemImage,
}: ProductBuilderDialogProps) {
  const isMobile = useIsMobile();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );
  const [draft, setDraft] = useState<ProductBlockDraft>(
    () => initial ?? defaultDraft(newPreset),
  );
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  /** Draft for a brand-new item that hasn't been committed to the list
   * yet. Committed only when the user taps the «اضافه کن» button so a
   * cancel never leaves a half-empty row behind. */
  const [pendingItem, setPendingItem] = useState<ProductItemDraft | null>(null);
  /** Stack of rows for the batch "add many at once" flow. Empty array
   * means we're not in batch-add mode. Committed in one autoSave when
   * the user taps «افزودن همه». */
  const [batchRows, setBatchRows] = useState<ProductItemDraft[] | null>(null);
  /** Working copy of all existing items for the group-edit flow. Null
   * when not active. Committed in one autoSave when the user taps
   * «به‌روزرسانی همه». */
  const [groupEditRows, setGroupEditRows] = useState<ProductItemDraft[] | null>(
    null,
  );
  const [tab, setTab] = useState<"items" | "categories" | "settings">("items");
  /** Local working copy for the settings tab — only flushed to `draft` on
   * explicit "ذخیره" press. Items/categories still auto-save separately. */
  const [settingsDraft, setSettingsDraft] = useState<ProductBlockDraft>(
    () => initial ?? defaultDraft(newPreset),
  );
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  /** Index of a category pending delete confirmation. Separate from item
   * delete so the two dialogs never collide. */
  const [confirmDeleteCategory, setConfirmDeleteCategory] = useState<
    number | null
  >(null);
  const [savingState, setSavingState] = useState<"idle" | "saving" | "saved">(
    "idle",
  );
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset state ONLY when the dialog transitions from closed → open. We
  // intentionally do NOT reset on `initial` reference changes — those
  // happen on every parent router.refresh() and would wipe the user's
  // in-flight edit (the user reported the modal "closing" / losing state
  // after switching apps; that was this).
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      const seed = initial ?? defaultDraft(newPreset);
      setDraft(seed);
      setSettingsDraft(seed);
      setEditingIndex(null);
      setPendingItem(null);
      setTab("items");
      setConfirmDelete(null);
      setSavingState("idle");
    }
  }

  useEffect(() => {
    return () => {
      if (savedTimer.current) clearTimeout(savedTimer.current);
    };
  }, []);

  /** Persist `next` immediately and capture the server-assigned id on
   * the first save so subsequent calls update instead of creating. */
  async function autoSave(next: ProductBlockDraft): Promise<ProductBlockDraft> {
    if (next.items.length === 0) return next;
    setSavingState("saving");
    try {
      const result = await onAutoSave(buildPayload(next));
      if (!result) {
        setSavingState("idle");
        return next;
      }
      const withId = next.id === result.id ? next : { ...next, id: result.id };
      setDraft(withId);
      setSavingState("saved");
      if (savedTimer.current) clearTimeout(savedTimer.current);
      savedTimer.current = setTimeout(() => setSavingState("idle"), 1500);
      return withId;
    } catch {
      setSavingState("idle");
      return next;
    }
  }

  /** Update the draft locally and schedule an auto-save. */
  function commit(next: ProductBlockDraft) {
    setDraft(next);
    void autoSave(next);
  }

  const Container = isMobile ? Sheet : Dialog;
  const Content = isMobile ? SheetContent : DialogContent;
  const Title = isMobile ? SheetTitle : DialogTitle;

  const contentProps = isMobile
    ? {
        side: "bottom" as const,
        className:
          "h-[90dvh] rounded-t-3xl p-0 flex flex-col gap-0 bg-background",
        showCloseButton: false,
      }
    : {
        className:
          "p-0 sm:max-w-[640px] h-[92vh] flex flex-col gap-0 overflow-hidden",
        showCloseButton: false,
      };

  const editingItem = editingIndex !== null ? draft.items[editingIndex] : null;
  const headerTitle =
    pendingItem !== null
      ? "افزودن مورد"
      : editingIndex !== null
        ? "ویرایش مورد"
        : batchRows !== null
          ? "افزودن چندتایی"
          : groupEditRows !== null
            ? "ویرایش گروهی"
            : `افزودن ${presetBlockName(draft.preset)}`;

  function handleOpenChange(next: boolean) {
    if (!next) {
      if (pendingItem !== null) {
        setPendingItem(null);
        return;
      }
      if (editingIndex !== null) {
        setEditingIndex(null);
        return;
      }
      if (batchRows !== null) {
        setBatchRows(null);
        return;
      }
      if (groupEditRows !== null) {
        setGroupEditRows(null);
        return;
      }
    }
    onOpenChange(next);
  }

  return (
    <Container open={open} onOpenChange={handleOpenChange}>
      <Content {...contentProps}>
        <Title className="sr-only">{headerTitle}</Title>

        <header className="flex shrink-0 items-center justify-between border-b px-3 py-2.5">
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            className="rounded-full"
            onClick={() => {
              if (pendingItem !== null) setPendingItem(null);
              else if (editingIndex !== null) setEditingIndex(null);
              else if (batchRows !== null) setBatchRows(null);
              else if (groupEditRows !== null) setGroupEditRows(null);
              else if (onBack) onBack();
              else onOpenChange(false);
            }}
            aria-label={
              pendingItem !== null ||
              editingIndex !== null ||
              batchRows !== null ||
              groupEditRows !== null
                ? "بازگشت"
                : onBack
                  ? "بازگشت"
                  : "بستن"
            }
          >
            <ArrowLeftIcon className="size-5 rtl:scale-x-[-1]" />
          </Button>
          <div className="flex flex-col items-center">
            <h2 className="text-sm font-bold">{headerTitle}</h2>
            {pendingItem === null &&
            editingIndex === null &&
            batchRows === null &&
            groupEditRows === null &&
            savingState !== "idle" ? (
              <span className="text-[10px] text-muted-foreground">
                {savingState === "saving" ? "در حال ذخیره…" : "ذخیره شد"}
              </span>
            ) : null}
          </div>
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
        </header>

        {/* -------------------------------------------------- ITEM EDITOR */}
        {batchRows !== null ? (
          <BatchItemsEditor
            mode="add"
            rows={batchRows}
            currency={draft.currency}
            sections={draft.sections}
            itemsCap={itemsCap}
            currentItemsCount={draft.items.length}
            onChange={(next) => setBatchRows(next)}
            onCommit={async () => {
              const valid = batchRows.filter((r) => r.title.trim());
              if (valid.length === 0) {
                setBatchRows(null);
                return;
              }
              const room = itemsCap - draft.items.length;
              const toAdd = valid.slice(0, Math.max(0, room));
              const next = {
                ...draft,
                items: [...draft.items, ...toAdd],
              };
              setBatchRows(null);
              await autoSave(next);
            }}
            onUploadImage={onUploadItemImage}
          />
        ) : groupEditRows !== null ? (
          <BatchItemsEditor
            mode="edit"
            rows={groupEditRows}
            currency={draft.currency}
            sections={draft.sections}
            itemsCap={itemsCap}
            currentItemsCount={0}
            onChange={(next) => setGroupEditRows(next)}
            onCommit={async () => {
              // Drop rows whose title was emptied during edit.
              const cleaned = groupEditRows.filter((r) => r.title.trim());
              const next = { ...draft, items: cleaned };
              setGroupEditRows(null);
              await autoSave(next);
            }}
            onUploadImage={onUploadItemImage}
          />
        ) : pendingItem !== null ? (
          <ItemEditor
            mode="add"
            item={pendingItem}
            currency={draft.currency}
            sections={draft.sections}
            onChange={(next) => setPendingItem(next)}
            onCommit={async () => {
              if (!pendingItem.title.trim()) return;
              if (draft.items.length >= itemsCap) return;
              const next = {
                ...draft,
                items: [...draft.items, pendingItem],
              };
              setPendingItem(null);
              await autoSave(next);
            }}
            onUploadImage={onUploadItemImage}
          />
        ) : editingItem && editingIndex !== null ? (
          <ItemEditor
            mode="edit"
            item={editingItem}
            currency={draft.currency}
            sections={draft.sections}
            onChange={(next) =>
              setDraft((d) => ({
                ...d,
                items: d.items.map((it, i) => (i === editingIndex ? next : it)),
              }))
            }
            onUpdate={async () => {
              setEditingIndex(null);
              await autoSave(draft);
            }}
            onUploadImage={
              onUploadItemImage
                ? async (file) => {
                    const url = await onUploadItemImage(file);
                    if (url && editingIndex !== null) {
                      const next = {
                        ...draft,
                        items: draft.items.map((it, i) =>
                          i === editingIndex ? { ...it, imageUrl: url } : it,
                        ),
                      };
                      setDraft(next);
                      void autoSave(next);
                    }
                    return url;
                  }
                : undefined
            }
          />
        ) : (
          // -------------------------------------------------- MAIN SCREEN
          <div className="flex min-h-0 flex-1 flex-col">
            <Tabs
              value={tab}
              onValueChange={(v) =>
                setTab(v as "items" | "categories" | "settings")
              }
              className="flex min-h-0 flex-1 flex-col"
            >
              <div className="border-b px-4 py-2">
                <TabsList className="w-full">
                  <TabsTrigger value="items" className="flex-1">
                    موارد ({toPersianDigits(draft.items.length)})
                  </TabsTrigger>
                  <TabsTrigger value="categories" className="flex-1">
                    دسته‌بندی‌ها
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
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="default"
                    onClick={() => {
                      if (draft.items.length >= itemsCap) return;
                      setPendingItem(emptyItem());
                    }}
                    disabled={draft.items.length >= itemsCap}
                    className="gap-1"
                  >
                    <PlusIcon className="size-4" />
                    افزودن
                  </Button>
                  {draft.items.length === 0 ? (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        if (draft.items.length >= itemsCap) return;
                        setBatchRows([emptyItem(), emptyItem(), emptyItem()]);
                      }}
                      disabled={draft.items.length >= itemsCap}
                      className="gap-1"
                    >
                      <LayersIcon className="size-4" />
                      افزودن چندتایی
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setGroupEditRows(
                          draft.items.map((it) => ({ ...it })),
                        );
                      }}
                      className="gap-1"
                    >
                      <PencilIcon className="size-4" />
                      ویرایش گروهی
                    </Button>
                  )}
                  <span className="ms-auto text-xs text-muted-foreground">
                    {toPersianDigits(draft.items.length)} /{" "}
                    {toPersianDigits(itemsCap)}
                  </span>
                </div>
                {draft.items.length === 0 ? (
                  <BlockEmptyState icon={ShoppingBagIcon} label="هنوز موردی اضافه نشده" />
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
                        commit({
                          ...draft,
                          items: arrayMove(draft.items, oldIndex, newIndex),
                        });
                      }
                    }}
                  >
                    <SortableContext
                      items={draft.items.map((it) => it._key)}
                      strategy={verticalListSortingStrategy}
                    >
                      {draft.sections.length > 0 ? (
                        <div className="flex flex-col gap-4">
                          {draft.sections.map((section) => {
                            const sectionItems = draft.items.filter(
                              (it) => it.sectionRef === section._key,
                            );
                            return (
                              <div key={section._key} className="flex flex-col gap-2">
                                <div className="flex items-center gap-2">
                                  <TagIcon className="size-3.5 shrink-0 text-muted-foreground" />
                                  <span className="text-xs font-bold text-muted-foreground">
                                    {section.title || "(بدون عنوان)"}
                                  </span>
                                  <span className="text-[10px] text-muted-foreground/60">
                                    ({toPersianDigits(sectionItems.length)})
                                  </span>
                                </div>
                                {sectionItems.length === 0 ? (
                                  <p className="rounded-xl border border-dashed px-3 py-2 text-center text-xs text-muted-foreground">
                                    موردی در این دسته‌بندی نیست
                                  </p>
                                ) : (
                                  <ul className="flex flex-col gap-2">
                                    {sectionItems.map((it) => {
                                      const i = draft.items.indexOf(it);
                                      return (
                                        <SortableItemRow
                                          key={it._key}
                                          item={it}
                                          currency={draft.currency}
                                          onEdit={() => setEditingIndex(i)}
                                          onDelete={() => setConfirmDelete(i)}
                                        />
                                      );
                                    })}
                                  </ul>
                                )}
                              </div>
                            );
                          })}
                          {(() => {
                            const uncategorized = draft.items.filter(
                              (it) =>
                                !it.sectionRef ||
                                !draft.sections.some((s) => s._key === it.sectionRef),
                            );
                            if (uncategorized.length === 0) return null;
                            return (
                              <div className="flex flex-col gap-2">
                                <div className="flex items-center gap-2">
                                  <TagIcon className="size-3.5 shrink-0 text-muted-foreground/50" />
                                  <span className="text-xs font-bold text-muted-foreground/70">
                                    بدون دسته‌بندی
                                  </span>
                                  <span className="text-[10px] text-muted-foreground/50">
                                    ({toPersianDigits(uncategorized.length)})
                                  </span>
                                </div>
                                <ul className="flex flex-col gap-2">
                                  {uncategorized.map((it) => {
                                    const i = draft.items.indexOf(it);
                                    return (
                                      <SortableItemRow
                                        key={it._key}
                                        item={it}
                                        currency={draft.currency}
                                        onEdit={() => setEditingIndex(i)}
                                        onDelete={() => setConfirmDelete(i)}
                                      />
                                    );
                                  })}
                                </ul>
                              </div>
                            );
                          })()}
                        </div>
                      ) : (
                        <ul className="flex flex-col gap-2">
                          {draft.items.map((it, i) => (
                            <SortableItemRow
                              key={it._key}
                              item={it}
                              currency={draft.currency}
                              onEdit={() => setEditingIndex(i)}
                              onDelete={() => setConfirmDelete(i)}
                            />
                          ))}
                        </ul>
                      )}
                    </SortableContext>
                  </DndContext>
                )}

              </TabsContent>

              <TabsContent
                value="categories"
                className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4"
              >
                <CategoriesPane
                  sections={draft.sections}
                  itemsAssignedTo={(sectionId) =>
                    draft.items.filter((it) => it.sectionRef === sectionId)
                      .length
                  }
                  onAdd={(title) => {
                    if (draft.sections.length >= PRODUCT_SECTIONS_MAX) return;
                    commit({
                      ...draft,
                      sections: [
                        ...draft.sections,
                        { id: null, _key: newKey(), title, iconKey: null },
                      ],
                    });
                  }}
                  onRename={(key, title) => {
                    commit({
                      ...draft,
                      sections: draft.sections.map((s) =>
                        s._key === key ? { ...s, title } : s,
                      ),
                    });
                  }}
                  onSetIcon={(key, iconKey) => {
                    commit({
                      ...draft,
                      sections: draft.sections.map((s) =>
                        s._key === key ? { ...s, iconKey } : s,
                      ),
                    });
                  }}
                  onRequestDelete={(index) => setConfirmDeleteCategory(index)}
                  onReorder={(oldIndex, newIndex) => {
                    commit({
                      ...draft,
                      sections: arrayMove(draft.sections, oldIndex, newIndex),
                    });
                  }}
                  sensors={sensors}
                />
              </TabsContent>

              <TabsContent
                value="settings"
                className="flex min-h-0 flex-1 flex-col"
              >
                <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-4">
                  <SettingsPane
                    draft={settingsDraft}
                    setDraft={setSettingsDraft}
                  />

                  <div className="grid gap-1.5">
                    <Label htmlFor="prod-slug">نشانی صفحه اختصاصی</Label>
                    <div
                      dir="ltr"
                      className="flex items-center gap-1 rounded-xl border bg-muted/30 px-3 has-[input:focus-visible]:ring-2 has-[input:focus-visible]:ring-ring"
                    >
                      <span className="shrink-0 text-sm text-muted-foreground">
                        {profileSlug ? `${profileSlug}/` : "/"}
                      </span>
                      <Input
                        id="prod-slug"
                        value={settingsDraft.slug ?? ""}
                        placeholder="menu"
                        maxLength={60}
                        dir="ltr"
                        inputMode="url"
                        autoCapitalize="none"
                        autoCorrect="off"
                        spellCheck={false}
                        enterKeyHint="done"
                        className="border-0 bg-transparent px-0 focus-visible:ring-0"
                        onChange={(e) =>
                          setSettingsDraft((d) => ({ ...d, slug: e.target.value }))
                        }
                        onBlur={() => {
                          const normalized = normalizeBlockSlug(settingsDraft.slug);
                          setSettingsDraft((d) => ({ ...d, slug: normalized }));
                        }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {settingsDraft.slug
                        ? "این بلوک یک صفحه‌ی جدا با این نشانی خواهد داشت."
                        : "خالی بگذارید تا این بلوک فقط داخل پروفایل نمایش داده شود."}
                    </p>
                  </div>

                  <div className="grid gap-2">
                    <Label>نمای محصولات</Label>
                    <div className="grid grid-cols-3 gap-2">
                      {PRODUCT_BLOCK_LAYOUTS.map((l) => (
                        <LayoutTile
                          key={l}
                          layout={l}
                          selected={settingsDraft.layout === l}
                          onSelect={() =>
                            setSettingsDraft((d) => ({ ...d, layout: l }))
                          }
                        />
                      ))}
                    </div>
                  </div>

                  <div className="grid gap-2">
                    <Label>نحوه نمایش در صفحه</Label>
                    <div className="grid grid-cols-2 gap-2">
                      {PRODUCT_BLOCK_DISPLAY_MODES.map((m) => (
                        <DisplayModeTile
                          key={m}
                          mode={m}
                          selected={settingsDraft.displayMode === m}
                          onSelect={() =>
                            setSettingsDraft((d) => ({ ...d, displayMode: m }))
                          }
                        />
                      ))}
                    </div>
                  </div>

                </div>

                <div className="shrink-0 border-t bg-background px-4 pt-3 safe-pb">
                  <Button
                    type="button"
                    onClick={async () => {
                      const normalized = normalizeBlockSlug(settingsDraft.slug);
                      const merged = {
                        ...draft,
                        name: settingsDraft.name,
                        description: settingsDraft.description,
                        currency: settingsDraft.currency,
                        slug: normalized,
                        layout: settingsDraft.layout,
                        displayMode: settingsDraft.displayMode,
                        pillLabel: settingsDraft.pillLabel,
                        iconKey: settingsDraft.iconKey,
                        iconUrl: settingsDraft.iconUrl,
                        imageUrl: settingsDraft.imageUrl,
                      };
                      setSettingsDraft((d) => ({ ...d, slug: normalized }));
                      setSettingsSaving(true);
                      try {
                        const saved = await autoSave(merged);
                        setDraft(saved);
                      } finally {
                        setSettingsSaving(false);
                      }
                    }}
                    disabled={settingsSaving}
                    className="h-12 w-full rounded-full text-base"
                  >
                    {settingsSaving ? (
                      <Loader2Icon className="size-4 animate-spin" />
                    ) : null}
                    ذخیره
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        )}
      </Content>

      <AlertDialog
        open={confirmDelete !== null}
        onOpenChange={(o) => {
          if (!o) setConfirmDelete(null);
        }}
      >
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>حذف مورد</AlertDialogTitle>
            <AlertDialogDescription>
              این مورد از فهرست حذف می‌شود. این عمل قابل بازگشت نیست.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>انصراف</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                if (confirmDelete === null) return;
                const idx = confirmDelete;
                setConfirmDelete(null);
                commit({
                  ...draft,
                  items: draft.items.filter((_, i) => i !== idx),
                });
              }}
            >
              حذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={confirmDeleteCategory !== null}
        onOpenChange={(o) => {
          if (!o) setConfirmDeleteCategory(null);
        }}
      >
        <AlertDialogContent size="sm">
          {(() => {
            const section =
              confirmDeleteCategory !== null
                ? draft.sections[confirmDeleteCategory]
                : null;
            const sectionKey = section?._key ?? null;
            const assignedCount = sectionKey
              ? draft.items.filter((it) => it.sectionRef === sectionKey).length
              : 0;
            return (
              <>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    حذف دسته‌بندی{section ? ` «${section.title}»` : ""}
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    {assignedCount > 0
                      ? `${toPersianDigits(assignedCount)} مورد به این دسته‌بندی اختصاص داده شده. با حذف دسته‌بندی، خود موارد باقی می‌مانند و فقط بدون دسته‌بندی می‌شوند.`
                      : "این دسته‌بندی حذف می‌شود. این عمل قابل بازگشت نیست."}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>انصراف</AlertDialogCancel>
                  <AlertDialogAction
                    variant="destructive"
                    onClick={() => {
                      if (confirmDeleteCategory === null) return;
                      const idx = confirmDeleteCategory;
                      const removedKey = draft.sections[idx]?._key;
                      setConfirmDeleteCategory(null);
                      commit({
                        ...draft,
                        sections: draft.sections.filter((_, i) => i !== idx),
                        items: draft.items.map((it) =>
                          it.sectionRef === removedKey
                            ? { ...it, sectionRef: null }
                            : it,
                        ),
                      });
                    }}
                  >
                    حذف
                  </AlertDialogAction>
                </AlertDialogFooter>
              </>
            );
          })()}
        </AlertDialogContent>
      </AlertDialog>
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

// ---------------------------------------------------------------------------
// Categories pane (formerly "sections" in the data model). Per-block grouping
// surfaced on the public page as a horizontal chip filter. Optional: items
// without an assigned category just appear under «همه» on public.
// ---------------------------------------------------------------------------

function CategoriesPane({
  sections,
  itemsAssignedTo,
  onAdd,
  onRename,
  onSetIcon,
  onRequestDelete,
  onReorder,
  sensors,
}: {
  sections: ProductSectionDraft[];
  /** Returns how many items reference this category by `_key`. Used for
   * the assignment hint on each row. */
  itemsAssignedTo: (sectionKey: string) => number;
  onAdd: (title: string) => void;
  onRename: (key: string, title: string) => void;
  onSetIcon: (key: string, iconKey: IconKey | null) => void;
  onRequestDelete: (index: number) => void;
  onReorder: (oldIndex: number, newIndex: number) => void;
  sensors: ReturnType<typeof useSensors>;
}) {
  const [newTitle, setNewTitle] = useState("");
  const atCap = sections.length >= PRODUCT_SECTIONS_MAX;

  function handleAdd() {
    const trimmed = newTitle.trim();
    if (!trimmed || atCap) return;
    onAdd(trimmed);
    setNewTitle("");
  }

  return (
    <>
      <div className="flex items-end gap-2">
        <div className="grid flex-1 gap-1.5">
          <Label htmlFor="cat-new" className="sr-only">
            عنوان دسته‌بندی
          </Label>
          <Input
            id="cat-new"
            value={newTitle}
            placeholder="مثلاً: خدمات / محصولات / منو"
            maxLength={80}
            enterKeyHint="done"
            disabled={atCap}
            className="rounded-full"
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleAdd();
              }
            }}
          />
        </div>
        <Button
          type="button"
          variant="default"
          onClick={handleAdd}
          disabled={!newTitle.trim() || atCap}
          className="gap-1"
        >
          <PlusIcon className="size-4" />
          افزودن
        </Button>
      </div>

      {atCap ? (
        <p className="text-[11px] text-muted-foreground">
          حداکثر {toPersianDigits(PRODUCT_SECTIONS_MAX)} دسته‌بندی در هر بلوک
          قابل ثبت است.
        </p>
      ) : null}

      {sections.length === 0 ? (
        <BlockEmptyState icon={TagIcon} label="هنوز دسته‌بندی‌ای ندارید" />
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={(event: DragEndEvent) => {
            const { active, over } = event;
            if (!over || active.id === over.id) return;
            const ids = sections.map((s) => s._key);
            const oldIndex = ids.indexOf(String(active.id));
            const newIndex = ids.indexOf(String(over.id));
            if (oldIndex !== -1 && newIndex !== -1) {
              onReorder(oldIndex, newIndex);
            }
          }}
        >
          <SortableContext
            items={sections.map((s) => s._key)}
            strategy={verticalListSortingStrategy}
          >
            <ul className="flex flex-col gap-2">
              {sections.map((s, i) => (
                <SortableCategoryRow
                  key={s._key}
                  section={s}
                  assignedCount={itemsAssignedTo(s._key)}
                  onRename={(title) => onRename(s._key, title)}
                  onSetIcon={(iconKey) => onSetIcon(s._key, iconKey)}
                  onDelete={() => onRequestDelete(i)}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      )}
    </>
  );
}

function SortableCategoryRow({
  section,
  assignedCount,
  onRename,
  onSetIcon,
  onDelete,
}: {
  section: ProductSectionDraft;
  assignedCount: number;
  onRename: (title: string) => void;
  onSetIcon: (iconKey: IconKey | null) => void;
  onDelete: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: section._key });

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
      <LinkIconPickerButton
        url=""
        iconKey={section.iconKey}
        iconUrl={null}
        imageUrl={null}
        size={40}
        showAuto={false}
        onChange={(next) => onSetIcon(next.iconKey)}
      />
      <div className="min-w-0 flex-1">
        <Input
          value={section.title}
          maxLength={80}
          aria-label="عنوان دسته‌بندی"
          enterKeyHint="done"
          onChange={(e) => onRename(e.target.value)}
          className="h-9 border-0 bg-transparent px-1 text-sm font-bold shadow-none focus-visible:bg-muted/50 focus-visible:ring-0"
        />
        <p className="px-1 text-[11px] text-muted-foreground">
          {assignedCount > 0
            ? `${toPersianDigits(assignedCount)} مورد`
            : "بدون مورد"}
        </p>
      </div>
      <button
        type="button"
        onClick={onDelete}
        className="grid size-8 place-items-center rounded-xl text-destructive hover:bg-destructive/10"
        aria-label="حذف دسته‌بندی"
      >
        <TrashIcon className="size-4" />
      </button>
    </li>
  );
}

function SortableBatchRow({
  row,
  currency,
  sections,
  submitting,
  onUpdate,
  onRemove,
  onUploadImage,
}: {
  row: ProductItemDraft;
  currency: ProductBlockCurrency;
  sections: ProductSectionDraft[];
  submitting: boolean;
  onUpdate: (patch: Partial<ProductItemDraft>) => void;
  onRemove: () => void;
  onUploadImage?: (file: File) => Promise<string | null>;
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
    <li
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
      }}
      className="flex flex-col gap-2.5 rounded-2xl border bg-card p-3"
    >
      {/* header: drag handle (right/start) · row number · delete (left/end) */}
      <div className="flex items-center gap-2">
        <span
          className="touch-none cursor-grab text-muted-foreground active:cursor-grabbing"
          {...attributes}
          {...listeners}
        >
          <GripVerticalIcon className="size-4" />
        </span>
        <span className="flex-1" />
<button
          type="button"
          onClick={onRemove}
          disabled={submitting}
          aria-label="حذف ردیف"
          className="grid size-7 place-items-center rounded-lg text-destructive hover:bg-destructive/10"
        >
          <TrashIcon className="size-3.5" />
        </button>
      </div>

      {/* title 50% + price 50% */}
      <div className="grid grid-cols-2 gap-2">
        <Input
          id={`batch-title-${row._key}`}
          value={row.title}
          maxLength={120}
          placeholder="عنوان"
          enterKeyHint="next"
          aria-label="عنوان"
          onChange={(e) => onUpdate({ title: e.target.value })}
        />
        <Input
          id={`batch-price-${row._key}`}
          inputMode="numeric"
          dir="ltr"
          placeholder={`قیمت (${CURRENCY_LABEL[currency]})`}
          value={row.priceMajor}
          enterKeyHint="next"
          aria-label={`قیمت (${CURRENCY_LABEL[currency]})`}
          onChange={(e) => onUpdate({ priceMajor: filterPriceInput(e.target.value) })}
        />
      </div>

      {sections.length > 0 ? (
        <Select
          value={row.sectionRef ?? "__none__"}
          onValueChange={(v) =>
            onUpdate({ sectionRef: v === "__none__" ? null : v })
          }
        >
          <SelectTrigger className="w-full">
            <SelectValue>
              {(v) =>
                v === "__none__"
                  ? "بدون دسته‌بندی"
                  : (sections.find((s) => s._key === v)?.title ??
                    "بدون دسته‌بندی")
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">بدون دسته‌بندی</SelectItem>
            {sections.map((s) => (
              <SelectItem key={s._key} value={s._key}>
                {s.title || "(بدون عنوان)"}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : null}

      {onUploadImage ? (
        <ImageField
          mode="immediate"
          label="تصویر محصول"
          emptyLabel="افزودن تصویر محصول"
          aspectRatio="square"
          imageUrl={row.imageUrl}
          onChange={(url) => onUpdate({ imageUrl: url })}
          onUploadImage={onUploadImage}
        />
      ) : null}
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
          onChange={(next) => {
            setDraft((d) => ({
              ...d,
              iconKey: next.iconKey,
              iconUrl: next.iconUrl,
              imageUrl: next.imageUrl,
            }));
          }}
        />
        <div className="grid min-w-0 flex-1 gap-1.5">
          <Label htmlFor="prod-name">عنوان بلوک</Label>
          <Input
            id="prod-name"
            value={draft.name}
            maxLength={80}
            placeholder="مثلاً: منوی کافه / خدمات طراحی"
            enterKeyHint="done"
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
          placeholder="یک جمله درباره‌ی این بلوک — مثلاً «نوشیدنی‌های فصلی» یا «بسته‌های طراحی لوگو»."
          onChange={(e) =>
            setDraft((d) => ({ ...d, description: e.target.value }))
          }
          rows={2}
        />
      </div>

      <div className="grid gap-1.5">
        <Label>واحد پول</Label>
        <Select
          value={draft.currency}
          onValueChange={(v) => {
            setDraft((d) => ({ ...d, currency: v as ProductBlockCurrency }));
          }}
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
    </>
  );
}

// ---------------------------------------------------------------------------
// Item editor (basic + collapsible advanced section)
// ---------------------------------------------------------------------------

function ItemEditor({
  mode,
  item,
  currency,
  sections,
  onChange,
  onCommit,
  onUpdate,
  onUploadImage,
}: {
  mode: "add" | "edit";
  item: ProductItemDraft;
  currency: ProductBlockCurrency;
  /** Categories defined on this block. When empty, the category select
   * is hidden entirely — the spec says we either show a populated select
   * or nothing. */
  sections: ProductSectionDraft[];
  onChange: (next: ProductItemDraft) => void;
  onCommit?: () => void;
  onUpdate?: () => void;
  onUploadImage?: (file: File) => Promise<string | null>;
}) {
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    if (!item.title.trim()) return;
    setSubmitting(true);
    try {
      if (mode === "add") await onCommit?.();
      else await onUpdate?.();
    } finally {
      setSubmitting(false);
    }
  }

  const isFreeOrOnRequest =
    item.priceType === "free" || item.priceType === "on_request";

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
        <div className="grid gap-1.5">
          <Label htmlFor="item-title">عنوان</Label>
          <Input
            id="item-title"
            value={item.title}
            maxLength={120}
            placeholder="مثلاً: قهوه لاته / طراحی لوگو"
            autoFocus={mode === "add"}
            enterKeyHint="next"
            onChange={(e) => onChange({ ...item, title: e.target.value })}
          />
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="item-desc-main">توضیح (اختیاری)</Label>
          <Textarea
            id="item-desc-main"
            value={item.description ?? ""}
            maxLength={280}
            rows={2}
            placeholder="جزئیات کوتاه — مثلاً «اسپرسو + شیر بخارپز» یا «لوگوی برند با ۳ بازنگری»."
            onChange={(e) =>
              onChange({ ...item, description: e.target.value })
            }
          />
        </div>

        {!isFreeOrOnRequest ? (
          <div className="grid grid-cols-[1fr_auto] gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="price-amount">
                {item.priceType === "range" ? "از" : "قیمت"} (
                {CURRENCY_LABEL[currency]})
              </Label>
              <Input
                id="price-amount"
                inputMode="numeric"
                dir="ltr"
                placeholder="مثلاً: 85,000"
                value={item.priceMajor}
                enterKeyHint="done"
                onChange={(e) =>
                  onChange({ ...item, priceMajor: filterPriceInput(e.target.value) })
                }
              />
            </div>
            {item.priceType === "range" ? (
              <div className="grid w-32 gap-1.5">
                <Label htmlFor="price-max">تا</Label>
                <Input
                  id="price-max"
                  inputMode="numeric"
                  dir="ltr"
                  placeholder="مثلاً: 200,000"
                  value={item.priceMaxMajor}
                  enterKeyHint="done"
                  onChange={(e) =>
                    onChange({ ...item, priceMaxMajor: filterPriceInput(e.target.value) })
                  }
                />
              </div>
            ) : null}
          </div>
        ) : null}

        {sections.length > 0 ? (
          <div className="grid gap-1.5">
            <Label htmlFor="item-section">دسته‌بندی (اختیاری)</Label>
            <Select
              value={item.sectionRef ?? "__none__"}
              onValueChange={(v) =>
                onChange({
                  ...item,
                  sectionRef: v === "__none__" ? null : v,
                })
              }
            >
              <SelectTrigger id="item-section" className="w-full">
                <SelectValue>
                  {(v) =>
                    v === "__none__"
                      ? "بدون دسته‌بندی"
                      : (sections.find((s) => s._key === v)?.title ??
                        "بدون دسته‌بندی")
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">بدون دسته‌بندی</SelectItem>
                {sections.map((s) => (
                  <SelectItem key={s._key} value={s._key}>
                    {s.title || "(بدون عنوان)"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}

        {/* Image upload */}
        {onUploadImage ? (
          <ImageField
            mode="immediate"
            label="تصویر محصول"
            emptyLabel="افزودن تصویر محصول"
            aspectRatio="square"
            imageUrl={item.imageUrl}
            onChange={(url) => onChange({ ...item, imageUrl: url })}
            onUploadImage={onUploadImage}
          />
        ) : null}

        {/* Advanced collapsible */}
        <div className="rounded-2xl border bg-muted/20">
          <button
            type="button"
            onClick={() => setAdvancedOpen((v) => !v)}
            aria-expanded={advancedOpen}
            className="flex w-full items-center justify-between rounded-2xl px-4 py-3 text-sm font-bold hover:bg-muted/40"
          >
            <span>جزئیات بیشتر</span>
            <ChevronDownIcon
              className={cn(
                "size-4 text-muted-foreground transition-transform",
                advancedOpen ? "rotate-180" : "",
              )}
            />
          </button>
          {advancedOpen ? (
            <div className="flex flex-col gap-4 px-4 pt-1 pb-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label>نوع قیمت</Label>
                  <Select
                    value={item.priceType}
                    onValueChange={(v) =>
                      onChange({
                        ...item,
                        priceType: v as ProductItemPriceType,
                      })
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
                        {(v) =>
                          AVAILABILITY_LABEL[v as ProductItemAvailability]
                        }
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

              <div className="grid gap-1.5">
                <Label htmlFor="item-link">لینک محصول (اختیاری)</Label>
                <p className="text-xs text-muted-foreground">
                  لینک خارجی به فروشگاه یا صفحه‌ی محصول. اگر وارد کنید، لمس روی
                  این مورد کاربر را به همین آدرس می‌برد.
                </p>
                <Input
                  id="item-link"
                  dir="ltr"
                  type="url"
                  inputMode="url"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  enterKeyHint="done"
                  placeholder="https://shop.example.com/latte"
                  value={item.externalUrl ?? ""}
                  onChange={(e) =>
                    onChange({
                      ...item,
                      externalUrl: e.target.value.trim()
                        ? e.target.value.trim()
                        : null,
                    })
                  }
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label htmlFor="item-badge">لیبل (اختیاری)</Label>
                  <Input
                    id="item-badge"
                    value={item.badge ?? ""}
                    maxLength={40}
                    placeholder="مثلاً: ویژه / جدید / پرفروش"
                    onChange={(e) =>
                      onChange({
                        ...item,
                        badge: e.target.value || null,
                      })
                    }
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="item-sku">کد کالا (اختیاری)</Label>
                  <Input
                    id="item-sku"
                    value={item.sku ?? ""}
                    maxLength={64}
                    placeholder="مثلاً: COF-101"
                    autoCapitalize="characters"
                    onChange={(e) =>
                      onChange({
                        ...item,
                        sku: e.target.value || null,
                      })
                    }
                  />
                </div>
              </div>

              <label
                htmlFor="item-featured"
                className="flex items-center justify-between gap-3 rounded-xl border bg-muted/30 px-3 py-2.5"
              >
                <span className="grid gap-0.5">
                  <span className="text-sm font-medium">پیشنهاد ویژه</span>
                  <span className="text-xs text-muted-foreground">
                    با نشان «پیشنهاد ما» برجسته می‌شود.
                  </span>
                </span>
                <Switch
                  id="item-featured"
                  checked={item.isFeatured}
                  onCheckedChange={(checked) =>
                    onChange({ ...item, isFeatured: checked })
                  }
                />
              </label>
            </div>
          ) : null}
        </div>
      </div>

      {/* Submit bar — flex sibling sits naturally at the bottom of the flex column */}
      <div className="shrink-0 border-t bg-background px-4 pt-3 safe-pb">
        <Button
          type="button"
          onClick={handleSubmit}
          disabled={!item.title.trim() || submitting}
          className="w-full gap-1"
        >
          {submitting ? (
            <Loader2Icon className="size-4 animate-spin" />
          ) : mode === "add" ? (
            <PlusIcon className="size-4" />
          ) : null}
          {mode === "add" ? "اضافه کن" : "ذخیره تغییرات"}
        </Button>
      </div>
    </div>
  );
}


// ---------------------------------------------------------------------------
// Batch items editor — used by both "add multiple at once" and "group edit".
//
// One stacked card per row exposing the four essentials (title · category ·
// price · image). Per-row delete; "add another row" appends in add-mode.
// A single bottom action commits the whole batch in one autoSave call so
// the server is only hit once per batch.
// ---------------------------------------------------------------------------

function BatchItemsEditor({
  mode,
  rows,
  currency,
  sections,
  itemsCap,
  currentItemsCount,
  onChange,
  onCommit,
  onUploadImage,
}: {
  mode: "add" | "edit";
  rows: ProductItemDraft[];
  currency: ProductBlockCurrency;
  sections: ProductSectionDraft[];
  /** Hard cap on the block as a whole. In add-mode, prevents the user
   * from staging more rows than the block can accept. */
  itemsCap: number;
  /** Items already on the block. In add-mode, `currentItemsCount + rows.length`
   * must stay ≤ itemsCap. In edit-mode, pass 0 (the rows ARE the items). */
  currentItemsCount: number;
  onChange: (next: ProductItemDraft[]) => void;
  onCommit: () => Promise<void> | void;
  onUploadImage?: (file: File) => Promise<string | null>;
}) {
  const [submitting, setSubmitting] = useState(false);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );
  const titledCount = rows.filter((r) => r.title.trim()).length;
  const atCap =
    mode === "add" && currentItemsCount + rows.length >= itemsCap;

  function updateRow(index: number, patch: Partial<ProductItemDraft>) {
    onChange(rows.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  function removeRow(index: number) {
    onChange(rows.filter((_, i) => i !== index));
  }

  function addRow() {
    if (atCap) return;
    onChange([...rows, emptyItem()]);
  }

  async function handleSubmit() {
    setSubmitting(true);
    try {
      await onCommit();
    } finally {
      setSubmitting(false);
    }
  }

  const submitLabel =
    mode === "add"
      ? titledCount > 0
        ? `افزودن (${toPersianDigits(titledCount)})`
        : "افزودن"
      : "به‌روزرسانی همه";

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
        {mode === "add" ? (
          <p className="text-xs text-muted-foreground">
            موارد را پشت سر هم وارد کنید. ردیف‌های بدون عنوان نادیده گرفته
            می‌شوند.
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">
            همه موارد در یک نما — ویرایش هر کدام و در پایان «به‌روزرسانی همه».
          </p>
        )}

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={(event: DragEndEvent) => {
            const { active, over } = event;
            if (!over || active.id === over.id) return;
            const ids = rows.map((r) => r._key);
            const oldIndex = ids.indexOf(String(active.id));
            const newIndex = ids.indexOf(String(over.id));
            if (oldIndex !== -1 && newIndex !== -1) {
              onChange(arrayMove(rows, oldIndex, newIndex));
            }
          }}
        >
          <SortableContext
            items={rows.map((r) => r._key)}
            strategy={verticalListSortingStrategy}
          >
            <ul className="flex flex-col gap-3">
              {rows.map((row, i) => (
                <SortableBatchRow
                  key={row._key}
                  row={row}
                  currency={currency}
                  sections={sections}
                  submitting={submitting}
                  onUpdate={(patch) => updateRow(i, patch)}
                  onRemove={() => removeRow(i)}
                  onUploadImage={onUploadImage}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>

        <Button
          type="button"
          variant="outline"
          onClick={addRow}
          disabled={atCap || submitting}
          className="w-full gap-1"
        >
          <PlusIcon className="size-4" />
          افزودن ردیف دیگر
        </Button>

        {atCap ? (
          <p className="text-[11px] text-muted-foreground">
            به سقف {toPersianDigits(itemsCap)} مورد رسیدید.
          </p>
        ) : null}
      </div>

      <div className="shrink-0 border-t bg-background px-4 pt-3 safe-pb">
        <Button
          type="button"
          onClick={handleSubmit}
          disabled={
            submitting || (mode === "add" && titledCount === 0) || rows.length === 0
          }
          className="w-full gap-1"
        >
          {submitting ? (
            <Loader2Icon className="size-4 animate-spin" />
          ) : (
            <PlusIcon className="size-4" />
          )}
          {submitLabel}
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Layout tile — compact 3-up horizontal selector with distinct skeletons
// ---------------------------------------------------------------------------

function LayoutTile({
  layout,
  selected,
  onSelect,
}: {
  layout: ProductBlockLayout;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        "flex flex-col gap-2 rounded-2xl border bg-card p-2.5 text-center transition",
        selected
          ? "border-foreground bg-foreground/5 ring-2 ring-foreground/10"
          : "hover:border-foreground/20",
      )}
    >
      <div className="grid h-16 w-full place-items-center overflow-hidden rounded-xl bg-muted/50">
        <LayoutSketch layout={layout} active={selected} />
      </div>
      <div>
        <p className={cn("text-xs font-bold leading-tight", selected ? "text-foreground" : "text-foreground/80")}>
          {LAYOUT_LABEL[layout]}
        </p>
        <p className="mt-0.5 text-[10px] leading-tight text-muted-foreground">
          {LAYOUT_SUBLABEL[layout]}
        </p>
      </div>
    </button>
  );
}

function LayoutSketch({ layout, active }: { layout: ProductBlockLayout; active: boolean }) {
  const bar = active ? "bg-foreground/25" : "bg-foreground/12";
  const thumb = active ? "bg-foreground/35" : "bg-foreground/18";
  const price = active ? "bg-foreground/50" : "bg-foreground/30";

  if (layout === "list") {
    return (
      <div className="flex w-full flex-col gap-1.5 px-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex items-center gap-1.5">
            <div className={cn("size-5 shrink-0 rounded-md", thumb)} />
            <div className={cn("h-1.5 flex-1 rounded-full", bar)} />
            <div className={cn("h-1.5 w-5 shrink-0 rounded-full", price)} />
          </div>
        ))}
      </div>
    );
  }

  if (layout === "grid") {
    return (
      <div className="grid w-full grid-cols-3 gap-1 px-3">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex flex-col gap-0.5">
            <div className={cn("aspect-square w-full rounded-md", thumb)} />
            <div className={cn("h-1 w-full rounded-full", bar)} />
          </div>
        ))}
      </div>
    );
  }

  // cards
  return (
    <div className="flex w-full flex-col gap-1.5 px-3">
      {[0, 1].map((i) => (
        <div key={i} className={cn("flex items-center gap-2 rounded-lg p-1.5", thumb)}>
          <div className={cn("size-6 shrink-0 rounded-md", active ? "bg-foreground/20" : "bg-foreground/10")} />
          <div className="flex flex-1 flex-col gap-1">
            <div className={cn("h-1.5 w-3/4 rounded-full", bar)} />
            <div className={cn("h-1 w-1/2 rounded-full", active ? "bg-foreground/35" : "bg-foreground/20")} />
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Display mode tile — "where does the block live on the public page?"
// ---------------------------------------------------------------------------

function DisplayModeTile({
  mode,
  selected,
  onSelect,
}: {
  mode: ProductBlockDisplayMode;
  selected: boolean;
  onSelect: () => void;
}) {
  const isPill = mode === "pill";
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        "flex flex-col gap-1 rounded-2xl border bg-card p-3 text-start transition",
        selected
          ? "border-foreground bg-foreground/5 ring-2 ring-foreground/10"
          : "hover:border-foreground/20",
      )}
    >
      <p className={cn("text-xs font-bold leading-tight", selected ? "text-foreground" : "text-foreground/80")}>
        {isPill ? "دکمه محصولات" : "مستقیم داخل صفحه"}
      </p>
      <p className="text-[10px] leading-tight text-muted-foreground">
        {isPill ? "بعد از کلیک روی دکمه باز می‌شه" : "مستقیم تو پروفایل نمایش داده می‌شه"}
      </p>
    </button>
  );
}

// re-export for any lazy/legacy import paths that referenced the old
// minor→major helpers (none in product code today).
export { minorToMajorString, majorStringToMinor };
