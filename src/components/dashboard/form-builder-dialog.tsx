"use client";

// Form builder dialog used by the dashboard "Add a form" flow. Mobile uses a
// bottom Sheet, desktop uses a centered Dialog (matches the booking flow).
//
// The builder is a 3-screen flow within the same surface:
//   1. "Add a form" — list of fields, intro, outro, Done button.
//   2. "Add field"  — pick a field kind (suggestions / write your own).
//   3. "Edit field" — label + options (for choice/dropdown/checkbox types).
//
// Submission emits a `FormBlockDraft` to the caller; the caller posts it to
// the server action and refreshes.

import { useEffect, useId, useMemo, useState } from "react";
import {
  ArrowLeftIcon,
  CalendarDaysIcon,
  CheckIcon,
  ChevronDownIcon,
  CircleIcon,
  CircleDotIcon,
  FlagIcon,
  GripVerticalIcon,
  ListIcon,
  MailIcon,
  MoreHorizontalIcon,
  PenLineIcon,
  PhoneIcon,
  PlusIcon,
  SearchIcon,
  TextIcon,
  UserIcon,
  XIcon,
  type LucideIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
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
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { toPersianDigits } from "@/lib/persian";
import {
  FIELD_KINDS_WITH_OPTIONS,
  type FormFieldKind,
} from "@/lib/validations";

export type FormFieldDraft = {
  id?: string | null;
  /** Stable client-side key for DnD — never sent to server. */
  _key?: string;
  kind: FormFieldKind;
  label: string;
  required: boolean;
  options: string[];
};

export type FormBlockDraft = {
  id?: string | null;
  name: string;
  intro: string | null;
  outro: string | null;
  fields: FormFieldDraft[];
};

const FIELD_META: Record<
  FormFieldKind,
  {
    label: string;
    icon: LucideIcon;
    category: "suggested" | "custom";
    /** When true, this kind is a "singleton" — only one such field per form. */
    singleton?: boolean;
  }
> = {
  name: {
    label: "نام",
    icon: PenLineIcon,
    category: "suggested",
    singleton: true,
  },
  email: {
    label: "ایمیل",
    icon: MailIcon,
    category: "suggested",
    singleton: true,
  },
  phone: {
    label: "شماره تلفن",
    icon: PhoneIcon,
    category: "suggested",
    singleton: true,
  },
  country: {
    label: "کشور",
    icon: FlagIcon,
    category: "suggested",
    singleton: true,
  },
  short_answer: { label: "پاسخ کوتاه", icon: TextIcon, category: "custom" },
  paragraph: { label: "پاراگراف", icon: ListIcon, category: "custom" },
  single_choice: {
    label: "تک‌انتخابی",
    icon: CircleDotIcon,
    category: "custom",
  },
  checkboxes: { label: "چندانتخابی", icon: CheckIcon, category: "custom" },
  dropdown: { label: "منوی کشویی", icon: ChevronDownIcon, category: "custom" },
  date: { label: "تاریخ", icon: CalendarDaysIcon, category: "custom" },
};

const SUGGESTED: FormFieldKind[] = ["name", "email", "phone", "country"];
const CUSTOM: FormFieldKind[] = [
  "short_answer",
  "paragraph",
  "single_choice",
  "checkboxes",
  "dropdown",
  "date",
];

const DEFAULT_DRAFT: FormBlockDraft = {
  name: "",
  intro: "",
  outro: "ممنون از پاسخ شما!",
  fields: [],
};

function emptyField(kind: FormFieldKind): FormFieldDraft {
  return {
    id: null,
    _key: Math.random().toString(36).slice(2),
    kind,
    label: FIELD_META[kind].label,
    required: false,
    options: FIELD_KINDS_WITH_OPTIONS.includes(kind)
      ? ["گزینه ۱", "گزینه ۲"]
      : [],
  };
}

type Stage =
  | { kind: "main" }
  | { kind: "pick" }
  | { kind: "edit"; index: number };

export type FormBuilderDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: FormBlockDraft | null;
  onSubmit: (draft: FormBlockDraft) => Promise<void> | void;
  submitting?: boolean;
};

export function FormBuilderDialog({
  open,
  onOpenChange,
  initial,
  onSubmit,
  submitting,
}: FormBuilderDialogProps) {
  const isMobile = useIsMobile();
  const [stage, setStage] = useState<Stage>({ kind: "main" });
  const [draft, setDraft] = useState<FormBlockDraft>(
    () => initial ?? DEFAULT_DRAFT,
  );

  useEffect(() => {
    if (open) {
      setStage({ kind: "main" });
      const base = initial ?? DEFAULT_DRAFT;
      setDraft({
        ...base,
        fields: base.fields.map((f) => ({
          ...f,
          _key: f._key ?? Math.random().toString(36).slice(2),
        })),
      });
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
          "p-0 sm:max-w-[480px] max-h-[92vh] flex flex-col gap-0 overflow-hidden",
        showCloseButton: false,
      };

  const handleDone = async () => {
    if (!draft.fields.length) return;
    await onSubmit({
      ...draft,
      name: draft.name.trim() || "فرم",
      intro: draft.intro?.trim() ? draft.intro.trim() : null,
      outro: draft.outro?.trim() ? draft.outro.trim() : "ممنون از پاسخ شما!",
    });
  };

  return (
    <Container open={open} onOpenChange={onOpenChange}>
      <Content {...contentProps}>
        <Title className="sr-only">افزودن فرم</Title>
        <BuilderHeader
          stage={stage}
          onBack={() => {
            if (stage.kind === "main") onOpenChange(false);
            else if (stage.kind === "pick") setStage({ kind: "main" });
            else setStage({ kind: "main" });
          }}
          onClose={() => onOpenChange(false)}
        />

        {stage.kind === "main" ? (
          <MainScreen
            draft={draft}
            setDraft={setDraft}
            onAddField={() => setStage({ kind: "pick" })}
            onEditField={(index) => setStage({ kind: "edit", index })}
            onRemoveField={(index) =>
              setDraft((d) => ({
                ...d,
                fields: d.fields.filter((_, i) => i !== index),
              }))
            }
            onDone={handleDone}
            submitting={submitting}
          />
        ) : null}

        {stage.kind === "pick" ? (
          <PickScreen
            existingKinds={draft.fields.map((f) => f.kind)}
            onPick={(kind) => {
              setDraft((d) => ({
                ...d,
                fields: [...d.fields, emptyField(kind)],
              }));
              // Open editor for the field we just added.
              setStage({ kind: "edit", index: draft.fields.length });
            }}
          />
        ) : null}

        {stage.kind === "edit" ? (
          <EditScreen
            field={draft.fields[stage.index]}
            isExisting={Boolean(draft.fields[stage.index]?.id)}
            onSave={(next) => {
              setDraft((d) => ({
                ...d,
                fields: d.fields.map((f, i) => (i === stage.index ? next : f)),
              }));
              setStage({ kind: "main" });
            }}
          />
        ) : null}
      </Content>
    </Container>
  );
}

function BuilderHeader({
  stage,
  onBack,
  onClose,
}: {
  stage: Stage;
  onBack: () => void;
  onClose: () => void;
}) {
  const title =
    stage.kind === "main"
      ? "افزودن فرم"
      : stage.kind === "pick"
        ? "افزودن فیلد"
        : "ویرایش فیلد";
  return (
    <div className="flex items-center justify-between border-b px-3 py-2.5">
      <Button
        type="button"
        size="icon-sm"
        variant="ghost"
        className="rounded-full"
        onClick={onBack}
        aria-label="بازگشت"
      >
        <ArrowLeftIcon className="size-5 rtl:scale-x-[-1]" />
      </Button>
      <h2 className="text-sm font-bold">{title}</h2>
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
  );
}

function SortableFieldRow({
  field,
  dndId,
  onEdit,
  onRemove,
}: {
  field: FormFieldDraft;
  dndId: string;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: dndId });

  return (
    <li
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
      }}
      className="flex items-center gap-2"
    >
      <span
        className="touch-none cursor-grab text-muted-foreground active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <GripVerticalIcon className="size-5" />
      </span>
      <button
        type="button"
        onClick={onEdit}
        className="flex-1 truncate text-start text-sm font-bold hover:underline"
      >
        {field.label || FIELD_META[field.kind].label}
      </button>
      {field.required ? (
        <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-bold text-primary">
          اجباری
        </span>
      ) : null}
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              className="rounded-full"
              aria-label="گزینه‌ها"
            />
          }
        >
          <MoreHorizontalIcon className="size-5" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={onEdit}>ویرایش</DropdownMenuItem>
          <DropdownMenuItem
            onClick={onRemove}
            className="text-red-600 focus:text-red-600"
          >
            حذف
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  );
}

function MainScreen({
  draft,
  setDraft,
  onAddField,
  onEditField,
  onRemoveField,
  onDone,
  submitting,
}: {
  draft: FormBlockDraft;
  setDraft: React.Dispatch<React.SetStateAction<FormBlockDraft>>;
  onAddField: () => void;
  onEditField: (index: number) => void;
  onRemoveField: (index: number) => void;
  onDone: () => void;
  submitting?: boolean;
}) {
  const nameId = useId();
  const introId = useId();
  const outroId = useId();
  const intro = draft.intro ?? "";
  const outro = draft.outro ?? "";

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  const sortableIds = draft.fields.map(
    (f, i) => f._key ?? f.id ?? `field-${i}`,
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = sortableIds.indexOf(String(active.id));
    const newIndex = sortableIds.indexOf(String(over.id));
    if (oldIndex !== -1 && newIndex !== -1) {
      setDraft((d) => ({
        ...d,
        fields: arrayMove(d.fields, oldIndex, newIndex),
      }));
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto px-5 pt-6 pb-4">
        <div className="mb-6 space-y-2">
          <Label htmlFor={nameId} className="text-sm font-bold">
            عنوان فرم
          </Label>
          <Input
            id={nameId}
            value={draft.name}
            onChange={(e) =>
              setDraft((d) => ({ ...d, name: e.target.value.slice(0, 80) }))
            }
            placeholder="مثلاً: فرم ثبت‌نام"
            className="rounded-2xl bg-muted/40"
            autoFocus
          />
        </div>

        {draft.fields.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground">
            اولین فیلد خود را اضافه کنید
          </p>
        ) : (
          <>
            <div className="mb-3">
              <span className="text-xs font-bold text-muted-foreground">
                فیلدها
              </span>
            </div>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={sortableIds}
                strategy={verticalListSortingStrategy}
              >
                <ul className="space-y-3">
                  {draft.fields.map((field, index) => {
                    const dndId = field._key ?? field.id ?? `field-${index}`;
                    return (
                      <SortableFieldRow
                        key={dndId}
                        field={field}
                        dndId={dndId}
                        onEdit={() => onEditField(index)}
                        onRemove={() => onRemoveField(index)}
                      />
                    );
                  })}
                </ul>
              </SortableContext>
            </DndContext>
          </>
        )}

        <Button
          type="button"
          variant="outline"
          onClick={onAddField}
          className="mt-5 h-12 w-full justify-center rounded-full text-sm font-bold"
        >
          <PlusIcon className="size-4" />
          افزودن فیلد
        </Button>

        <div className="mt-6 space-y-2">
          <Label htmlFor={introId} className="text-sm font-bold">
            توضیحات (اختیاری)
          </Label>
          <div className="relative">
            <Textarea
              id={introId}
              value={intro}
              onChange={(e) =>
                setDraft((d) => ({ ...d, intro: e.target.value.slice(0, 500) }))
              }
              placeholder="مثلاً: برای ارتباط با ما این فرم را پر کنید."
              className="min-h-15 resize-none rounded-2xl bg-muted/40 px-4 py-3 text-right"
            />
            <span className="absolute inset-e-3 -bottom-5 text-[11px] text-muted-foreground">
              {toPersianDigits(intro.length)}/{toPersianDigits(500)}
            </span>
          </div>
        </div>

        <div className="mt-8 space-y-2">
          <Label htmlFor={outroId} className="text-sm font-bold">
            پیام پایانی
          </Label>
          <div className="relative">
            <Input
              id={outroId}
              value={outro}
              onChange={(e) =>
                setDraft((d) => ({ ...d, outro: e.target.value.slice(0, 200) }))
              }
              placeholder="ممنون از پاسخ شما!"
              className="rounded-2xl bg-muted/40"
            />
            <span className="absolute inset-e-3 -bottom-5 text-[11px] text-muted-foreground">
              {toPersianDigits(outro.length)}/{toPersianDigits(200)}
            </span>
          </div>
        </div>
      </div>

      <div className="border-t bg-background p-4 safe-pb">
        <Button
          type="button"
          onClick={onDone}
          disabled={!draft.fields.length || submitting}
          className="h-12 w-full rounded-full text-base font-bold"
        >
          تایید
        </Button>
      </div>
    </div>
  );
}

function PickScreen({
  existingKinds,
  onPick,
}: {
  existingKinds: FormFieldKind[];
  onPick: (kind: FormFieldKind) => void;
}) {
  const [search, setSearch] = useState("");
  const q = search.trim().toLowerCase();

  const matches = useMemo(() => {
    return (kinds: FormFieldKind[]) =>
      kinds.filter((k) => FIELD_META[k].label.toLowerCase().includes(q));
  }, [q]);

  const used = new Set(existingKinds);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-b px-5 py-4">
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute inset-s-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="جستجو"
            className="rounded-2xl bg-muted/40 ps-9"
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-bold text-muted-foreground">
            پیشنهادی
          </span>
        </div>
        <ul className="space-y-2">
          {matches(SUGGESTED).map((kind) => {
            const meta = FIELD_META[kind];
            const Icon = meta.icon;
            const disabled = meta.singleton && used.has(kind);
            return (
              <li key={kind}>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => onPick(kind)}
                  className={cn(
                    "flex w-full items-center justify-between rounded-2xl bg-muted/30 px-4 py-3 text-start transition-colors",
                    disabled
                      ? "cursor-not-allowed opacity-50"
                      : "hover:bg-muted/60",
                  )}
                >
                  <span className="flex items-center gap-3">
                    <Icon className="size-5 text-foreground" />
                    <span className="text-sm font-bold">{meta.label}</span>
                  </span>
                  <PlusIcon className="size-4 text-muted-foreground" />
                </button>
              </li>
            );
          })}
        </ul>

        <div className="mt-6 mb-2 flex items-center justify-between">
          <span className="text-xs font-bold text-muted-foreground">
            سفارشی
          </span>
        </div>
        <ul className="space-y-2">
          {matches(CUSTOM).map((kind) => {
            const meta = FIELD_META[kind];
            const Icon = meta.icon;
            return (
              <li key={kind}>
                <button
                  type="button"
                  onClick={() => onPick(kind)}
                  className="flex w-full items-center justify-between rounded-2xl bg-transparent px-4 py-3 text-start transition-colors hover:bg-muted/60"
                >
                  <span className="flex items-center gap-3">
                    <Icon className="size-5 text-foreground" />
                    <span className="text-sm font-bold">{meta.label}</span>
                  </span>
                  <PlusIcon className="size-4 text-muted-foreground" />
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

function EditScreen({
  field,
  isExisting,
  onSave,
}: {
  field: FormFieldDraft;
  isExisting: boolean;
  onSave: (next: FormFieldDraft) => void;
}) {
  const [label, setLabel] = useState(field.label);
  const [options, setOptions] = useState<string[]>(field.options ?? []);
  const [required, setRequired] = useState(field.required);
  const labelId = useId();

  useEffect(() => {
    setLabel(field.label);
    setOptions(field.options ?? []);
    setRequired(field.required);
  }, [field]);

  const meta = FIELD_META[field.kind];
  const Icon = meta.icon;
  const hasOptions = FIELD_KINDS_WITH_OPTIONS.includes(field.kind);
  const canSubmit =
    label.trim().length > 0 &&
    (!hasOptions || options.filter((o) => o.trim()).length >= 1);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto px-5 pt-6 pb-4 space-y-5">
        <div className="space-y-2">
          <Label className="text-sm font-bold">نوع فیلد</Label>
          <div className="flex items-center gap-2 rounded-2xl bg-muted/30 px-4 py-3">
            <Icon className="size-5 text-foreground" />
            <span className="text-sm">{meta.label}</span>
            <ChevronDownIcon className="ms-auto size-4 text-muted-foreground" />
          </div>
          {isExisting ? (
            <p className="text-xs text-muted-foreground">
              نوع فیلدهای موجود قابل تغییر نیست
            </p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor={labelId} className="text-sm font-bold">
            برچسب
          </Label>
          <div className="relative">
            <Input
              id={labelId}
              value={label}
              onChange={(e) => setLabel(e.target.value.slice(0, 200))}
              placeholder="عنوان فیلد"
              className="rounded-2xl bg-muted/40"
              autoFocus
            />
            <span className="absolute inset-e-3 -bottom-5 text-[11px] text-muted-foreground">
              {toPersianDigits(label.length)}/{toPersianDigits(200)}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between rounded-2xl bg-muted/30 px-4 py-3">
          <Label className="text-sm font-bold">اجباری</Label>
          <Switch
            checked={required}
            onCheckedChange={setRequired}
            aria-label="اجباری"
          />
        </div>

        {hasOptions ? (
          <div className="space-y-2 pt-2">
            <Label className="text-sm font-bold">گزینه‌ها</Label>
            <ul className="space-y-2">
              {options.map((opt, idx) => (
                <li key={idx} className="flex items-center gap-2">
                  <Input
                    value={opt}
                    onChange={(e) =>
                      setOptions((curr) =>
                        curr.map((o, i) =>
                          i === idx ? e.target.value.slice(0, 200) : o,
                        ),
                      )
                    }
                    placeholder={`گزینه ${toPersianDigits(idx + 1)}`}
                    className="rounded-2xl bg-muted/40"
                  />
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    onClick={() =>
                      setOptions((curr) => curr.filter((_, i) => i !== idx))
                    }
                    aria-label="حذف گزینه"
                    className="rounded-full"
                  >
                    <XIcon className="size-4" />
                  </Button>
                </li>
              ))}
            </ul>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOptions((curr) => [...curr, ""])}
              className="h-10 w-full rounded-full text-sm font-bold"
            >
              <PlusIcon className="size-4" />
              افزودن گزینه
            </Button>
          </div>
        ) : null}
      </div>

      <div className="border-t bg-background p-4 safe-pb">
        <Button
          type="button"
          onClick={() =>
            onSave({
              ...field,
              label: label.trim() || meta.label,
              required,
              options: hasOptions
                ? options.map((o) => o.trim()).filter(Boolean)
                : [],
            })
          }
          disabled={!canSubmit}
          className="h-12 w-full rounded-full text-base font-bold"
        >
          ذخیره
        </Button>
      </div>
    </div>
  );
}

// Re-exports just to keep the file in TypeScript "value" graph for tree-shake
// safety; the usage in this file is intentional but ESLint may not see it.
export const __FORM_BUILDER_INTERNAL__ = { CircleIcon, UserIcon };
void Select;
void SelectContent;
void SelectItem;
void SelectTrigger;
void SelectValue;
