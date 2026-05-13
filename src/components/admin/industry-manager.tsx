"use client";

import Link from "next/link";
import type { Route } from "next";
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
import { ChevronLeft, Edit2, GripVertical, Plus, Trash2 } from "lucide-react";

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
import { Switch } from "@/components/ui/switch";
import type { Industry } from "@/lib/discover";
import { resolveIconEntry } from "@/lib/link-icons";
import type {
  adminCreateIndustryAction,
  adminUpdateIndustryAction,
} from "@/app/admin/categories/actions";

type CreateAction = typeof adminCreateIndustryAction;
type UpdateAction = typeof adminUpdateIndustryAction;

type ActionResult = { ok: boolean; error?: string };

interface IndustryManagerProps {
  industries: Industry[];
  createAction: CreateAction;
  updateAction: UpdateAction;
  deleteAction: (formData: FormData) => Promise<ActionResult>;
  reorderAction: (orderedIds: string[]) => Promise<ActionResult>;
}

function IndustryIcon({ iconKey }: { iconKey: string }) {
  const entry = resolveIconEntry(iconKey, null);
  const Icon = entry.Icon;
  return <Icon className="size-4 shrink-0" style={{ color: entry.color }} />;
}

function SortableIndustryRow({
  industry,
  onEdit,
  deleteAction,
}: {
  industry: Industry;
  onEdit: (i: Industry) => void;
  deleteAction: (formData: FormData) => Promise<ActionResult>;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: industry.id });

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

      <IndustryIcon iconKey={industry.iconKey} />

      <Link
        href={`/admin/categories/${industry.slug}` as Route}
        className="min-w-0 flex-1 hover:opacity-80"
      >
        <p className="text-sm font-medium">{industry.titleFa}</p>
        <p className="text-xs text-muted-foreground" dir="ltr">
          {industry.titleEn} • {industry.slug}
        </p>
      </Link>

      <Badge variant="secondary" className="text-xs">
        {industry.categoryCount ?? 0} دسته‌بندی
      </Badge>
      <div className="flex gap-1">
        {industry.accountTypes.map((t) => (
          <Badge key={t} variant="outline" className="text-xs" dir="ltr">
            {t}
          </Badge>
        ))}
      </div>

      {!industry.isActive && (
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
          onClick={() => onEdit(industry)}
        >
          <Edit2 className="size-4" />
        </Button>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (
              !confirm(
                `صنف «${industry.titleFa}» و تمام دسته‌بندی‌های آن حذف شود؟ این عمل قابل بازگشت نیست.`,
              )
            )
              return;
            const fd = new FormData(e.currentTarget);
            void deleteAction(fd);
          }}
        >
          <input type="hidden" name="id" value={industry.id} />
          <Button
            type="submit"
            variant="ghost"
            size="icon"
            className="size-8 text-destructive hover:text-destructive"
          >
            <Trash2 className="size-4" />
          </Button>
        </form>
        <Link
          href={`/admin/categories/${industry.slug}` as Route}
          className="text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-5" />
        </Link>
      </div>
    </div>
  );
}

function IndustryFormDialog({
  open,
  onClose,
  industry,
  createAction,
  updateAction,
}: {
  open: boolean;
  onClose: () => void;
  industry: Industry | null;
  createAction: CreateAction;
  updateAction: UpdateAction;
}) {
  const isEdit = industry !== null;

  const [iconKey, setIconKey] = useState(industry?.iconKey ?? "t:star");
  const [isActive, setIsActive] = useState(industry?.isActive ?? true);
  const [personal, setPersonal] = useState(
    industry?.accountTypes.includes("personal") ?? true,
  );
  const [business, setBusiness] = useState(
    industry?.accountTypes.includes("business") ?? true,
  );

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

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <DialogContent className="max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle>{isEdit ? "ویرایش صنف" : "صنف جدید"}</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          {isEdit && <input type="hidden" name="id" value={industry.id} />}
          <input type="hidden" name="iconKey" value={iconKey} />
          <input
            type="hidden"
            name="isActive"
            value={isActive ? "on" : "off"}
          />
          {personal && (
            <input type="hidden" name="accountTypes" value="personal" />
          )}
          {business && (
            <input type="hidden" name="accountTypes" value="business" />
          )}

          <div className="space-y-1.5">
            <Label htmlFor="ind-fa">نام فارسی</Label>
            <Input
              id="ind-fa"
              name="titleFa"
              defaultValue={industry?.titleFa}
              placeholder="مثلاً: غذا و نوشیدنی"
              required
              maxLength={80}
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ind-en">نام انگلیسی</Label>
            <Input
              id="ind-en"
              name="titleEn"
              defaultValue={industry?.titleEn}
              placeholder="e.g. Food & Beverage"
              required
              dir="ltr"
              maxLength={80}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ind-slug">شناسه (slug)</Label>
            <Input
              id="ind-slug"
              name="slug"
              defaultValue={industry?.slug}
              placeholder="e.g. food-beverage"
              required
              dir="ltr"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              maxLength={64}
            />
          </div>

          <div className="space-y-2">
            <Label>نوع حساب</Label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="size-4"
                  checked={personal}
                  onChange={(e) => setPersonal(e.target.checked)}
                />
                شخصی (Personal)
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="size-4"
                  checked={business}
                  onChange={(e) => setBusiness(e.target.checked)}
                />
                کسب‌وکار (Business)
              </label>
            </div>
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
              id="ind-active"
              checked={isActive}
              onCheckedChange={setIsActive}
            />
            <Label htmlFor="ind-active">فعال</Label>
          </div>

          {state && !state.ok && (
            <p className="text-sm text-destructive">{state.error}</p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              لغو
            </Button>
            <Button
              type="submit"
              disabled={pending || (!personal && !business)}
            >
              {isEdit ? "ذخیره" : "ایجاد"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function IndustryManager({
  industries,
  createAction,
  updateAction,
  deleteAction,
  reorderAction,
}: IndustryManagerProps) {
  const [editTarget, setEditTarget] = useState<Industry | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [items, setItems] = useState(industries);
  const [, startTransition] = useTransition();

  // Keep local list in sync when server-revalidated props arrive.
  useEffect(() => {
    setItems(industries);
  }, [industries]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 5 },
    }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = items.findIndex((i) => i.id === active.id);
    const newIndex = items.findIndex((i) => i.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(items, oldIndex, newIndex);
    setItems(reordered);
    startTransition(() => {
      void reorderAction(reordered.map((i) => i.id));
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{items.length} صنف</p>
        <Button type="button" size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="me-1.5 size-4" />
          صنف جدید
        </Button>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={items.map((i) => i.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-2">
            {items.map((ind) => (
              <SortableIndustryRow
                key={ind.id}
                industry={ind}
                onEdit={setEditTarget}
                deleteAction={deleteAction}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {/* Edit dialog — keyed by target id so it fully resets when switching items */}
      <IndustryFormDialog
        key={editTarget?.id ?? "__none__"}
        open={editTarget !== null}
        onClose={() => setEditTarget(null)}
        industry={editTarget}
        createAction={createAction}
        updateAction={updateAction}
      />
      {/* Create dialog */}
      <IndustryFormDialog
        key="__create__"
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        industry={null}
        createAction={createAction}
        updateAction={updateAction}
      />
    </div>
  );
}
