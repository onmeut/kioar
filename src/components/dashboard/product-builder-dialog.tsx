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
import { createPortal } from "react-dom";
import {
  ChevronDownIcon,
  ArrowLeftIcon,
  GripVerticalIcon,
  ImageIcon,
  ImageOffIcon,
  Loader2Icon,
  PencilIcon,
  PlusIcon,
  TrashIcon,
  UploadIcon,
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
import {
  Cropper,
  ImageRestriction,
  type CropperRef,
} from "react-advanced-cropper";
import "react-advanced-cropper/dist/style.css";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

const LAYOUT_DESCRIPTION: Record<ProductBlockLayout, string> = {
  list: "ردیف فشرده با تصویر کوچک — مناسب منو و فهرست‌های طولانی.",
  grid: "شبکه‌ی دو ستونه با تصویر مربعی — مناسب فروشگاه یا گالری.",
  cards: "کارت بزرگ تمام‌عرض با تصویر برجسته — مناسب پکیج‌ها و خدمات شاخص.",
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

function buildPayload(d: ProductBlockDraft): ProductBlockSubmit {
  return {
    id: d.id ?? null,
    name: d.name.trim() || "محصولات",
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

export type ProductBuilderDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: ProductBlockDraft | null;
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
    () => initial ?? defaultDraft(),
  );
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  /** Draft for a brand-new item that hasn't been committed to the list
   * yet. Committed only when the user taps the «اضافه کن» button so a
   * cancel never leaves a half-empty row behind. */
  const [pendingItem, setPendingItem] = useState<ProductItemDraft | null>(null);
  const [tab, setTab] = useState<"items" | "layout" | "settings">("items");
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
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
      setDraft(initial ?? defaultDraft());
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
        : "افزودن محصول / خدمت";

  return (
    <Container open={open} onOpenChange={onOpenChange}>
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
              else if (onBack) onBack();
              else onOpenChange(false);
            }}
            aria-label={
              pendingItem !== null || editingIndex !== null
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
            {pendingItem === null && editingIndex === null ? (
              <span className="text-[10px] text-muted-foreground">
                {savingState === "saving"
                  ? "در حال ذخیره…"
                  : savingState === "saved"
                    ? "ذخیره شد"
                    : "تغییرات به‌صورت خودکار ذخیره می‌شود"}
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
        {pendingItem !== null ? (
          <ItemEditor
            mode="add"
            item={pendingItem}
            currency={draft.currency}
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
                setTab(v as "items" | "layout" | "settings")
              }
              className="flex min-h-0 flex-1 flex-col"
            >
              <div className="border-b px-4 py-2">
                <TabsList className="w-full">
                  <TabsTrigger value="items" className="flex-1">
                    موارد ({toPersianDigits(draft.items.length)})
                  </TabsTrigger>
                  <TabsTrigger value="layout" className="flex-1">
                    چیدمان
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
                  <div className="rounded-2xl bg-muted/40 px-4 py-8 text-center">
                    <p className="text-sm text-muted-foreground">
                      از طریق دکمه‌ی زیر اولین محصول یا خدمت خودتون رو ایجاد
                      کنید.
                    </p>
                  </div>
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
                    </SortableContext>
                  </DndContext>
                )}

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
                    افزودن خدمت/محصول
                  </Button>
                  <span className="ms-auto self-center text-xs text-muted-foreground">
                    {toPersianDigits(draft.items.length)} /{" "}
                    {toPersianDigits(itemsCap)}
                  </span>
                </div>
              </TabsContent>

              <TabsContent
                value="layout"
                className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-4"
              >
                <div className="grid gap-2">
                  <Label>چیدمان لیست</Label>
                  <p className="text-xs text-muted-foreground">
                    شکل نمایش موارد روی صفحه‌ی شما را انتخاب کنید.
                  </p>
                  <div className="grid grid-cols-1 gap-2">
                    {PRODUCT_BLOCK_LAYOUTS.map((l) => (
                      <SelectableCard
                        key={l}
                        title={LAYOUT_LABEL[l]}
                        description={LAYOUT_DESCRIPTION[l]}
                        selected={draft.layout === l}
                        onSelect={() => commit({ ...draft, layout: l })}
                        preview={<LayoutPreview layout={l} />}
                      />
                    ))}
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
                        onSelect={() => commit({ ...draft, displayMode: m })}
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
                      enterKeyHint="done"
                      onChange={(e) =>
                        setDraft((d) => ({ ...d, pillLabel: e.target.value }))
                      }
                      onBlur={() => void autoSave(draft)}
                    />
                  </div>
                ) : null}
              </TabsContent>

              <TabsContent
                value="settings"
                className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4"
              >
                <SettingsPane
                  draft={draft}
                  setDraft={setDraft}
                  onCommit={(d) => void autoSave(d)}
                />
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
  onCommit,
}: {
  draft: ProductBlockDraft;
  setDraft: React.Dispatch<React.SetStateAction<ProductBlockDraft>>;
  onCommit: (d: ProductBlockDraft) => void;
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
            const updated = {
              ...draft,
              iconKey: next.iconKey,
              iconUrl: next.iconUrl,
              imageUrl: next.imageUrl,
            };
            setDraft(updated);
            onCommit(updated);
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
            onBlur={() => onCommit(draft)}
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
          onBlur={() => onCommit(draft)}
          rows={2}
        />
      </div>

      <div className="grid gap-1.5">
        <Label>واحد پول</Label>
        <Select
          value={draft.currency}
          onValueChange={(v) => {
            const updated = {
              ...draft,
              currency: v as ProductBlockCurrency,
            };
            setDraft(updated);
            onCommit(updated);
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
  onChange,
  onCommit,
  onUpdate,
  onUploadImage,
}: {
  mode: "add" | "edit";
  item: ProductItemDraft;
  currency: ProductBlockCurrency;
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

        {!isFreeOrOnRequest ? (
          <div className="grid grid-cols-[1fr_auto] gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="price-amount">
                {item.priceType === "range" ? "از" : "قیمت"} (
                {CURRENCY_LABEL[currency]})
              </Label>
              <Input
                id="price-amount"
                inputMode="decimal"
                placeholder="مثلاً: ۸۵۰۰۰"
                value={item.priceMajor}
                enterKeyHint="done"
                onChange={(e) =>
                  onChange({ ...item, priceMajor: e.target.value })
                }
              />
            </div>
            {item.priceType === "range" ? (
              <div className="grid w-32 gap-1.5">
                <Label htmlFor="price-max">تا</Label>
                <Input
                  id="price-max"
                  inputMode="decimal"
                  placeholder="مثلاً: ۲۰۰۰۰۰"
                  value={item.priceMaxMajor}
                  enterKeyHint="done"
                  onChange={(e) =>
                    onChange({ ...item, priceMaxMajor: e.target.value })
                  }
                />
              </div>
            ) : null}
          </div>
        ) : null}

        {/* Image upload */}
        <ProductImageField
          imageUrl={item.imageUrl}
          onChange={(url) => onChange({ ...item, imageUrl: url })}
          onUploadImage={onUploadImage}
        />

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
              <div className="grid gap-1.5">
                <Label htmlFor="item-desc">توضیح</Label>
                <Textarea
                  id="item-desc"
                  value={item.description ?? ""}
                  maxLength={280}
                  rows={3}
                  placeholder="جزئیات کوتاه — مثلاً «اسپرسو + شیر بخارپز» یا «لوگوی برند با ۳ بازنگری»."
                  onChange={(e) =>
                    onChange({ ...item, description: e.target.value })
                  }
                />
              </div>

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
            </div>
          ) : null}
        </div>
      </div>

      {/* Submit bar — flex sibling sits naturally at the bottom of the flex column */}
      <div className="shrink-0 border-t bg-background px-4 py-3 safe-area-bottom">
        <Button
          type="button"
          onClick={handleSubmit}
          disabled={!item.title.trim() || submitting}
          className="w-full gap-1"
        >
          {submitting ? (
            <Loader2Icon className="size-4 animate-spin" />
          ) : (
            <PlusIcon className="size-4" />
          )}
          {mode === "add" ? "اضافه کن" : "به‌روزرسانی"}
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Image field with built-in 1:1 cropper (react-advanced-cropper)
// ---------------------------------------------------------------------------

function ProductImageField({
  imageUrl,
  onChange,
  onUploadImage,
}: {
  imageUrl: string | null;
  onChange: (url: string | null) => void;
  onUploadImage?: (file: File) => Promise<string | null>;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const cropperRef = useRef<CropperRef>(null);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [cropFileName, setCropFileName] = useState("product.png");
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    return () => {
      if (cropSrc) URL.revokeObjectURL(cropSrc);
    };
  }, [cropSrc]);

  function handleFiles(files: FileList | null) {
    const file = files?.[0];
    if (!file || !onUploadImage) return;
    const src = URL.createObjectURL(file);
    setCropFileName(file.name || "product.png");
    setCropSrc(src);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function handleCropSave() {
    if (!onUploadImage) return;
    const canvas = cropperRef.current?.getCanvas();
    if (!canvas) return;
    setUploading(true);
    canvas.toBlob(
      async (blob) => {
        if (!blob) {
          setUploading(false);
          return;
        }
        const baseName = cropFileName.replace(/\.[^.]+$/, "") || "product";
        const file = new File([blob], `${baseName}.jpg`, {
          type: "image/jpeg",
        });
        try {
          const url = await onUploadImage(file);
          if (cropSrc) URL.revokeObjectURL(cropSrc);
          setCropSrc(null);
          if (url) onChange(url);
        } finally {
          setUploading(false);
        }
      },
      "image/jpeg",
      0.9,
    );
  }

  function handleCropCancel() {
    if (cropSrc) URL.revokeObjectURL(cropSrc);
    setCropSrc(null);
  }

  const cropOverlay =
    cropSrc && typeof document !== "undefined"
      ? createPortal(
          <div
            className="fixed inset-0 flex flex-col bg-black"
            style={{ zIndex: 9999 }}
            dir="ltr"
          >
            <div className="relative min-h-0 flex-1">
              <Cropper
                ref={cropperRef}
                src={cropSrc}
                stencilProps={{ aspectRatio: 1, grid: true }}
                imageRestriction={ImageRestriction.fitArea}
                style={{ width: "100%", height: "100%" }}
                className="size-full"
              />
            </div>
            <div className="flex flex-col gap-2 bg-black px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
              <Button
                type="button"
                variant="outline"
                onClick={handleCropSave}
                disabled={uploading}
                className="h-11 w-full rounded-full border-white/20 bg-white text-sm font-bold text-black hover:bg-white/90"
              >
                {uploading ? (
                  <Loader2Icon className="size-4 animate-spin" />
                ) : null}
                ذخیره
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={handleCropCancel}
                disabled={uploading}
                className="h-11 w-full rounded-full text-sm font-medium text-white hover:bg-white/10 hover:text-white"
              >
                انصراف
              </Button>
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <div className="grid gap-1.5">
      <Label>تصویر محصول</Label>
      {imageUrl ? (
        <div className="relative aspect-square w-full max-w-[180px] overflow-hidden rounded-2xl border bg-muted">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imageUrl} alt="" className="size-full object-cover" />
          <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-black/55 px-3 py-2 text-white">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={uploading || !onUploadImage}
              className="inline-flex items-center gap-1 rounded-full bg-white/15 px-3 py-1.5 text-xs font-bold backdrop-blur hover:bg-white/25"
            >
              <PencilIcon className="size-3.5" />
              تغییر
            </button>
            <button
              type="button"
              onClick={() => onChange(null)}
              disabled={uploading}
              className="grid size-7 place-items-center rounded-full bg-white/15 backdrop-blur hover:bg-white/25"
              aria-label="حذف تصویر"
            >
              <TrashIcon className="size-3.5" />
            </button>
          </div>
          {uploading ? (
            <div className="absolute inset-0 grid place-items-center bg-black/40">
              <Loader2Icon className="size-6 animate-spin text-white" />
            </div>
          ) : null}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={!onUploadImage || uploading}
          className={cn(
            "flex h-28 w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed text-muted-foreground transition-colors",
            "hover:border-primary hover:bg-primary/5 hover:text-primary disabled:opacity-50",
          )}
        >
          {uploading ? (
            <Loader2Icon className="size-6 animate-spin" />
          ) : (
            <>
              <UploadIcon className="size-6" />
              <span className="text-sm font-bold">افزودن تصویر محصول</span>
              <span className="text-[11px] text-muted-foreground">
                نسبت تصویر ۱:۱ — قابل برش پس از انتخاب
              </span>
            </>
          )}
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
      {cropOverlay}
      {!onUploadImage ? (
        <p className="text-[11px] text-muted-foreground">
          <ImageIcon className="me-1 inline size-3" />
          آپلود تصویر در حال حاضر در دسترس نیست.
        </p>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Layout / display-mode selector cards
// ---------------------------------------------------------------------------

function SelectableCard({
  title,
  description,
  selected,
  onSelect,
  preview,
}: {
  title: string;
  description: string;
  selected: boolean;
  onSelect: () => void;
  preview: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        "flex items-start gap-3 rounded-2xl border bg-card p-3 text-start transition",
        selected
          ? "border-foreground ring-2 ring-foreground/10"
          : "hover:border-foreground/20",
      )}
    >
      <span
        className={cn(
          "mt-1 grid size-5 shrink-0 place-items-center rounded-full border-2 transition",
          selected
            ? "border-foreground bg-foreground"
            : "border-muted-foreground/30",
        )}
      >
        {selected ? (
          <span className="size-1.5 rounded-full bg-background" />
        ) : null}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold">{title}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
        <div className="mt-3 grid h-20 place-items-center overflow-hidden rounded-xl bg-muted/40">
          {preview}
        </div>
      </div>
    </button>
  );
}

function LayoutPreview({ layout }: { layout: ProductBlockLayout }) {
  if (layout === "list") {
    return (
      <div className="flex w-full flex-col gap-1.5 px-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="size-4 rounded bg-muted" />
            <div className="h-1.5 flex-1 rounded bg-muted" />
            <div className="h-1.5 w-6 rounded bg-foreground/40" />
          </div>
        ))}
      </div>
    );
  }
  if (layout === "grid") {
    return (
      <div className="grid w-full grid-cols-3 gap-1.5 px-4">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="aspect-square rounded bg-muted" />
        ))}
      </div>
    );
  }
  // cards
  return (
    <div className="flex w-full flex-col gap-1.5 px-4">
      <div className="h-8 rounded-md bg-muted" />
      <div className="h-8 rounded-md bg-muted" />
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
          ? "border-foreground ring-2 ring-foreground/10"
          : "hover:border-foreground/20",
      )}
    >
      <div className="grid h-20 place-items-center overflow-hidden rounded-xl bg-muted/40">
        {mode === "pill" ? (
          <div className="flex flex-col items-center gap-1">
            <div className="h-2 w-16 rounded bg-muted" />
            <div className="h-2 w-12 rounded bg-muted" />
            <div className="mt-1 h-5 w-20 rounded-full bg-foreground/70" />
          </div>
        ) : (
          <div className="flex w-full flex-col gap-1 px-3">
            <div className="flex items-center gap-2">
              <div className="size-4 rounded bg-muted" />
              <div className="h-1.5 flex-1 rounded bg-muted" />
              <div className="h-1.5 w-6 rounded bg-foreground/40" />
            </div>
            <div className="flex items-center gap-2">
              <div className="size-4 rounded bg-muted" />
              <div className="h-1.5 flex-1 rounded bg-muted" />
              <div className="h-1.5 w-6 rounded bg-foreground/40" />
            </div>
            <div className="flex items-center gap-2">
              <div className="size-4 rounded bg-muted" />
              <div className="h-1.5 flex-1 rounded bg-muted" />
              <div className="h-1.5 w-6 rounded bg-foreground/40" />
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

// re-export for any lazy/legacy import paths that referenced the old
// minor→major helpers (none in product code today).
export { minorToMajorString, majorStringToMinor };
