"use client";

import Link from "next/link";
import type { Route } from "next";
import { useActionState, useState } from "react";
import {
  ChevronDown,
  ChevronLeft,
  ChevronUp,
  Edit2,
  Plus,
  Trash2,
} from "lucide-react";

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
  moveAction: (formData: FormData) => Promise<ActionResult>;
}

function IndustryIcon({ iconKey }: { iconKey: string }) {
  const entry = resolveIconEntry(iconKey, null);
  const Icon = entry.Icon;
  return <Icon className="size-4 shrink-0" style={{ color: entry.color }} />;
}

function IndustryRow({
  industry,
  isFirst,
  isLast,
  onEdit,
  moveAction,
  deleteAction,
}: {
  industry: Industry;
  isFirst: boolean;
  isLast: boolean;
  onEdit: (i: Industry) => void;
  moveAction: (formData: FormData) => Promise<ActionResult>;
  deleteAction: (formData: FormData) => Promise<ActionResult>;
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
          <input type="hidden" name="id" value={industry.id} />
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
          <input type="hidden" name="id" value={industry.id} />
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
                `صنف «${industry.titleFa}» و تمام دسته‌بندی‌های آن غیرفعال شود؟`,
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

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <DialogContent key={industry?.id ?? "new"} className="max-w-md" dir="rtl">
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
  moveAction,
}: IndustryManagerProps) {
  const [editTarget, setEditTarget] = useState<Industry | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{industries.length} صنف</p>
        <Button type="button" size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="me-1.5 size-4" />
          صنف جدید
        </Button>
      </div>

      <div className="space-y-2">
        {industries.map((ind, idx) => (
          <IndustryRow
            key={ind.id}
            industry={ind}
            isFirst={idx === 0}
            isLast={idx === industries.length - 1}
            onEdit={setEditTarget}
            moveAction={moveAction}
            deleteAction={deleteAction}
          />
        ))}
      </div>

      <IndustryFormDialog
        open={editTarget !== null}
        onClose={() => setEditTarget(null)}
        industry={editTarget}
        createAction={createAction}
        updateAction={updateAction}
      />
      <IndustryFormDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        industry={null}
        createAction={createAction}
        updateAction={updateAction}
      />
    </div>
  );
}
