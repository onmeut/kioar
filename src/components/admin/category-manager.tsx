"use client";

import {
  useActionState,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Edit2, GripVertical, Plus, Trash2 } from "lucide-react";

import { LinkIconPicker } from "@/components/dashboard/link-icon-picker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type { AccountType, Category, Industry } from "@/lib/discover";
import { resolveIconEntry } from "@/lib/link-icons";
import type {
  adminCreateCategoryAction,
  adminUpdateCategoryAction,
} from "@/app/admin/categories/actions";

type CreateAction = typeof adminCreateCategoryAction;
type UpdateAction = typeof adminUpdateCategoryAction;

type ActionResult = { ok: boolean; error?: string };

interface CategoryManagerProps {
  industry: Industry;
  industries: Industry[];
  categories: Category[];
  createAction: CreateAction;
  updateAction: UpdateAction;
  deleteAction: (formData: FormData) => Promise<ActionResult>;
  reorderAction: (orderedIds: string[]) => Promise<ActionResult>;
}

function CategoryIcon({ iconKey }: { iconKey: string }) {
  const entry = resolveIconEntry(iconKey, null);
  const Icon = entry.Icon;
  return <Icon className="size-4 shrink-0" style={{ color: entry.color }} />;
}

function SortableCategoryRow({
  category,
  onEdit,
  deleteAction,
}: {
  category: Category;
  onEdit: (c: Category) => void;
  deleteAction: (formData: FormData) => Promise<ActionResult>;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: category.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 rounded-lg border bg-card px-4 py-3"
    >
      <button
        type="button"
        suppressHydrationWarning
        className="cursor-grab touch-none text-muted-foreground hover:text-foreground active:cursor-grabbing"
        {...attributes}
        {...listeners}
        aria-label="جابجایی"
      >
        <GripVertical className="size-4" />
      </button>

      <CategoryIcon iconKey={category.iconKey} />

      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{category.titleFa}</p>
        <p className="text-xs text-muted-foreground" dir="ltr">
          {category.titleEn} • {category.slug}
        </p>
      </div>

      <Badge variant="outline" className="text-xs" dir="ltr">
        {category.accountType}
      </Badge>

      {!category.isActive && (
        <Badge variant="destructive" className="text-xs">
          غیرفعال
        </Badge>
      )}

      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8"
          onClick={() => onEdit(category)}
        >
          <Edit2 className="size-4" />
        </Button>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (
              !confirm(
                `دسته‌بندی «${category.titleFa}» حذف شود؟ این عمل قابل بازگشت نیست.`,
              )
            )
              return;
            const fd = new FormData(e.currentTarget);
            void deleteAction(fd);
          }}
        >
          <input type="hidden" name="id" value={category.id} />
          <Button
            type="submit"
            variant="ghost"
            size="icon"
            className="size-8 text-destructive hover:text-destructive"
          >
            <Trash2 className="size-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}

function CategoryFormDialog({
  open,
  onClose,
  category,
  defaultIndustry,
  industries,
  createAction,
  updateAction,
}: {
  open: boolean;
  onClose: () => void;
  category: Category | null;
  defaultIndustry: Industry;
  industries: Industry[];
  createAction: CreateAction;
  updateAction: UpdateAction;
}) {
  const isEdit = category !== null;

  // Initialise from the category prop (reset guaranteed by `key` on the parent).
  const [industryId, setIndustryId] = useState(
    category?.industryId ?? defaultIndustry.id,
  );
  const [iconKey, setIconKey] = useState(category?.iconKey ?? "t:star");
  const [accountType, setAccountType] = useState<AccountType>(
    category?.accountType ??
      (defaultIndustry.accountTypes.includes("personal")
        ? "personal"
        : "business"),
  );
  const [isActive, setIsActive] = useState(category?.isActive ?? true);

  const action = isEdit ? updateAction : createAction;
  const [state, formAction, pending] = useActionState(action, null);

  // Auto-close on successful save.
  const prevStateRef = useRef(state);
  useEffect(() => {
    if (state !== prevStateRef.current && state && "ok" in state && state.ok) {
      onClose();
    }
    prevStateRef.current = state;
  });

  const selectedIndustry =
    industries.find((i) => i.id === industryId) ?? defaultIndustry;
  const allowedAccountTypes = selectedIndustry.accountTypes;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <DialogContent className="max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "ویرایش دسته‌بندی" : "دسته‌بندی جدید"}
          </DialogTitle>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          {isEdit && <input type="hidden" name="id" value={category.id} />}
          <input type="hidden" name="industryId" value={industryId} />
          <input type="hidden" name="iconKey" value={iconKey} />
          <input type="hidden" name="accountType" value={accountType} />
          <input
            type="hidden"
            name="isActive"
            value={isActive ? "on" : "off"}
          />

          <div className="space-y-1.5">
            <Label>صنف</Label>
            <Select
              value={industryId}
              onValueChange={(v) => {
                if (!v) return;
                setIndustryId(v);
                const ind = industries.find((i) => i.id === v);
                if (ind && !ind.accountTypes.includes(accountType)) {
                  setAccountType(ind.accountTypes[0] ?? "personal");
                }
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="انتخاب صنف" />
              </SelectTrigger>
              <SelectContent>
                {industries.map((ind) => (
                  <SelectItem key={ind.id} value={ind.id}>
                    {ind.titleFa}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cat-fa">نام فارسی</Label>
            <Input
              id="cat-fa"
              name="titleFa"
              defaultValue={category?.titleFa}
              placeholder="مثلاً: رستوران"
              required
              maxLength={80}
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cat-en">نام انگلیسی</Label>
            <Input
              id="cat-en"
              name="titleEn"
              defaultValue={category?.titleEn}
              placeholder="e.g. Restaurant"
              required
              dir="ltr"
              maxLength={80}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cat-slug">شناسه (slug)</Label>
            <Input
              id="cat-slug"
              name="slug"
              defaultValue={category?.slug}
              placeholder="e.g. restaurant"
              required
              dir="ltr"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              maxLength={64}
            />
            {isEdit && (
              <p className="text-xs text-muted-foreground">
                تغییر شناسه، پروفایل‌های وابسته را به‌روزرسانی می‌کند.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label>نوع حساب</Label>
            <RadioGroup
              value={accountType}
              onValueChange={(v) => setAccountType(v as AccountType)}
              className="flex gap-4"
            >
              {(["personal", "business"] as const).map((t) => (
                <label
                  key={t}
                  className={`flex items-center gap-2 text-sm ${
                    allowedAccountTypes.includes(t)
                      ? ""
                      : "pointer-events-none opacity-40"
                  }`}
                >
                  <RadioGroupItem
                    value={t}
                    disabled={!allowedAccountTypes.includes(t)}
                  />
                  {t === "personal" ? "شخصی" : "کسب‌وکار"}
                </label>
              ))}
            </RadioGroup>
          </div>

          <div className="space-y-1.5">
            <Label>آیکون</Label>
            <div className="flex h-64 flex-col overflow-hidden rounded-lg border">
              <LinkIconPicker
                url=""
                value={{ iconKey, iconUrl: null, imageUrl: null }}
                onChange={(v) => setIconKey(v.iconKey ?? "t:star")}
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Switch
              id="cat-active"
              checked={isActive}
              onCheckedChange={setIsActive}
            />
            <Label htmlFor="cat-active">فعال</Label>
          </div>

          {state && !state.ok && (
            <p className="text-sm text-destructive">{state.error}</p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              لغو
            </Button>
            <Button type="submit" disabled={pending}>
              {isEdit ? "ذخیره" : "ایجاد"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function CategoryManager({
  industry,
  industries,
  categories,
  createAction,
  updateAction,
  deleteAction,
  reorderAction,
}: CategoryManagerProps) {
  const [editTarget, setEditTarget] = useState<Category | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [items, setItems] = useState(categories);
  const [, startTransition] = useTransition();

  // Keep local list in sync when server-revalidated props arrive.
  useEffect(() => {
    setItems(categories);
  }, [categories]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 5 },
    }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = items.findIndex((c) => c.id === active.id);
    const newIndex = items.findIndex((c) => c.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(items, oldIndex, newIndex);
    setItems(reordered);
    startTransition(() => {
      void reorderAction(reordered.map((c) => c.id));
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {items.length} دسته‌بندی
        </p>
        <Button type="button" size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="me-1.5 size-4" />
          دسته‌بندی جدید
        </Button>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={items.map((c) => c.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-2">
            {items.map((cat) => (
              <SortableCategoryRow
                key={cat.id}
                category={cat}
                onEdit={setEditTarget}
                deleteAction={deleteAction}
              />
            ))}
            {items.length === 0 && (
              <p className="rounded-lg border border-dashed py-8 text-center text-sm text-muted-foreground">
                دسته‌بندی‌ای برای این صنف ثبت نشده است.
              </p>
            )}
          </div>
        </SortableContext>
      </DndContext>

      {/* Edit dialog — keyed by target id so it fully resets when switching items */}
      <CategoryFormDialog
        key={editTarget?.id ?? "__none__"}
        open={editTarget !== null}
        onClose={() => setEditTarget(null)}
        category={editTarget}
        defaultIndustry={industry}
        industries={industries}
        createAction={createAction}
        updateAction={updateAction}
      />
      {/* Create dialog */}
      <CategoryFormDialog
        key="__create__"
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        category={null}
        defaultIndustry={industry}
        industries={industries}
        createAction={createAction}
        updateAction={updateAction}
      />
    </div>
  );
}
