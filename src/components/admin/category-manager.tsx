"use client";

import { useActionState, useState } from "react";
import { ChevronDown, ChevronUp, Edit2, Plus, Trash2 } from "lucide-react";

import type { DiscoverCategory } from "@/lib/discover";
import { resolveIconEntry } from "@/lib/link-icons";
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
import { LinkIconPicker } from "@/components/dashboard/link-icon-picker";
import type {
  adminCreateCategoryAction,
  adminUpdateCategoryAction,
} from "@/app/admin/categories/actions";

// ---- types ---------------------------------------------------------------

type CreateAction = typeof adminCreateCategoryAction;
type UpdateAction = typeof adminUpdateCategoryAction;

interface CategoryManagerProps {
  categories: DiscoverCategory[];
  createAction: CreateAction;
  updateAction: UpdateAction;
  deleteAction: (formData: FormData) => Promise<{ ok: boolean; error?: string }>;
  moveAction: (formData: FormData) => Promise<{ ok: boolean; error?: string }>;
}

function CategoryIcon({ iconKey }: { iconKey: string }) {
  const entry = resolveIconEntry(iconKey, null);
  const Icon = entry.Icon;
  return <Icon className="size-4 shrink-0" style={{ color: entry.color }} />;
}

// ---- row -----------------------------------------------------------------

function CategoryRow({
  category,
  isFirst,
  isLast,
  onEdit,
  moveAction,
  deleteAction,
}: {
  category: DiscoverCategory;
  isFirst: boolean;
  isLast: boolean;
  onEdit: (c: DiscoverCategory) => void;
  moveAction: (formData: FormData) => Promise<{ ok: boolean; error?: string }>;
  deleteAction: (formData: FormData) => Promise<{ ok: boolean; error?: string }>;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border bg-card px-4 py-3">
      <div className="flex flex-col gap-0.5">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            fd.set("direction", "up");
            void moveAction(fd);
          }}
        >
          <input type="hidden" name="id" value={category.id} />
          <Button
            type="submit"
            variant="ghost"
            size="icon"
            className="size-6"
            disabled={isFirst}
          >
            <ChevronUp className="size-3.5" />
          </Button>
        </form>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            fd.set("direction", "down");
            void moveAction(fd);
          }}
        >
          <input type="hidden" name="id" value={category.id} />
          <Button
            type="submit"
            variant="ghost"
            size="icon"
            className="size-6"
            disabled={isLast}
          >
            <ChevronDown className="size-3.5" />
          </Button>
        </form>
      </div>

      <CategoryIcon iconKey={category.iconKey} />

      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{category.label}</p>
        <p className="text-xs text-muted-foreground" dir="ltr">
          {category.slug}
        </p>
      </div>

      {!category.isActive && (
        <Badge variant="secondary" className="text-xs">
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
            if (!confirm(`دسته‌بندی "${category.label}" غیرفعال شود؟`)) return;
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

// ---- form dialog ---------------------------------------------------------

function CategoryFormDialog({
  open,
  onClose,
  category,
  createAction,
  updateAction,
}: {
  open: boolean;
  onClose: () => void;
  category: DiscoverCategory | null; // null = create mode
  createAction: CreateAction;
  updateAction: UpdateAction;
}) {
  const isEdit = category !== null;

  const [iconKey, setIconKey] = useState(category?.iconKey ?? "t:star");
  const [isActive, setIsActive] = useState(category?.isActive ?? true);

  const action = isEdit ? updateAction : createAction;
  const [state, formAction, pending] = useActionState(action, null);

  // Reset local state when dialog opens for a new category
  const handleOpenChange = (open: boolean) => {
    if (!open) onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "ویرایش دسته‌بندی" : "دسته‌بندی جدید"}
          </DialogTitle>
        </DialogHeader>

        <form action={formAction} className="space-y-4">
          {isEdit && <input type="hidden" name="id" value={category.id} />}
          <input type="hidden" name="iconKey" value={iconKey} />
          <input type="hidden" name="isActive" value={isActive ? "on" : "off"} />

          <div className="space-y-1.5">
            <Label htmlFor="cat-label">نام نمایشی (فارسی)</Label>
            <Input
              id="cat-label"
              name="label"
              defaultValue={category?.label}
              placeholder="مثلاً: موسیقی"
              required
              maxLength={60}
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cat-slug">شناسه (slug)</Label>
            <Input
              id="cat-slug"
              name="slug"
              defaultValue={category?.slug}
              placeholder="مثلاً: music"
              required
              dir="ltr"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              maxLength={64}
            />
            {isEdit && (
              <p className="text-xs text-muted-foreground">
                تغییر شناسه تمام پروفایل‌های دارای این دسته‌بندی را به‌روزرسانی می‌کند.
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>آیکون</Label>
            <LinkIconPicker
              url=""
              value={{ iconKey, iconUrl: null, imageUrl: null }}
              onChange={(v) => setIconKey(v.iconKey ?? "t:star")}
            />
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

// ---- main export ---------------------------------------------------------

export function CategoryManager({
  categories,
  createAction,
  updateAction,
  deleteAction,
  moveAction,
}: CategoryManagerProps) {
  const [editTarget, setEditTarget] = useState<DiscoverCategory | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {categories.length} دسته‌بندی ثبت شده
        </p>
        <Button
          type="button"
          size="sm"
          onClick={() => setCreateOpen(true)}
        >
          <Plus className="me-1.5 size-4" />
          دسته‌بندی جدید
        </Button>
      </div>

      <div className="space-y-2">
        {categories.map((cat, idx) => (
          <CategoryRow
            key={cat.id}
            category={cat}
            isFirst={idx === 0}
            isLast={idx === categories.length - 1}
            onEdit={setEditTarget}
            moveAction={moveAction}
            deleteAction={deleteAction}
          />
        ))}
      </div>

      {/* Edit dialog */}
      <CategoryFormDialog
        open={editTarget !== null}
        onClose={() => setEditTarget(null)}
        category={editTarget}
        createAction={createAction}
        updateAction={updateAction}
      />

      {/* Create dialog */}
      <CategoryFormDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        category={null}
        createAction={createAction}
        updateAction={updateAction}
      />
    </div>
  );
}
