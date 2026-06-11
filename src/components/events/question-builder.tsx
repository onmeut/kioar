"use client";

import { PlusIcon, Trash2Icon, XIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

export type DraftQuestion = {
  id: string | null;
  kind: "short_text" | "long_text" | "single_select" | "multi_select";
  label: string;
  required: boolean;
  options: string[] | null;
};

const KIND_LABELS: Record<DraftQuestion["kind"], string> = {
  short_text: "متن کوتاه",
  long_text: "متن بلند",
  single_select: "تک‌انتخابی",
  multi_select: "چندانتخابی",
};

function needsOptions(kind: DraftQuestion["kind"]) {
  return kind === "single_select" || kind === "multi_select";
}

/**
 * Self-contained custom-question builder for events. Inspired by the form
 * block's field pattern but deliberately NOT coupled to it — events own their
 * own draft shape so the form block can never break events and vice versa.
 */
export function QuestionBuilder({
  questions,
  onChange,
}: {
  questions: DraftQuestion[];
  onChange: (next: DraftQuestion[]) => void;
}) {
  function update(index: number, patch: Partial<DraftQuestion>) {
    onChange(questions.map((q, i) => (i === index ? { ...q, ...patch } : q)));
  }

  function addQuestion() {
    onChange([
      ...questions,
      {
        id: null,
        kind: "short_text",
        label: "",
        required: false,
        options: null,
      },
    ]);
  }

  return (
    <div className="space-y-3">
      {questions.length === 0 ? (
        <p className="rounded-3xl border border-dashed border-border/70 p-4 text-center text-sm text-muted-foreground">
          هنوز سؤالی اضافه نکرده‌اید.
        </p>
      ) : null}

      {questions.map((q, i) => (
        <div
          key={i}
          className="space-y-3 rounded-3xl border border-border bg-muted/20 p-3"
        >
          <div className="flex items-start gap-2">
            <Input
              value={q.label}
              onChange={(e) => update(i, { label: e.target.value })}
              placeholder="متن سؤال"
              className="flex-1"
              enterKeyHint="next"
            />
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="size-11 shrink-0 text-muted-foreground hover:text-rose-600"
              onClick={() => onChange(questions.filter((_, j) => j !== i))}
              aria-label="حذف سؤال"
            >
              <Trash2Icon className="size-4" />
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {(Object.keys(KIND_LABELS) as DraftQuestion["kind"][]).map(
              (kind) => (
                <button
                  key={kind}
                  type="button"
                  onClick={() =>
                    update(i, {
                      kind,
                      options: needsOptions(kind)
                        ? (q.options ?? ["", ""])
                        : null,
                    })
                  }
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
                    q.kind === kind
                      ? "border-foreground bg-foreground text-background"
                      : "border-border bg-background text-muted-foreground hover:bg-muted",
                  )}
                >
                  {KIND_LABELS[kind]}
                </button>
              ),
            )}
            <label className="ms-auto flex items-center gap-2 text-xs text-muted-foreground">
              اجباری
              <Switch
                checked={q.required}
                onCheckedChange={(c) => update(i, { required: c })}
              />
            </label>
          </div>

          {needsOptions(q.kind) ? (
            <div className="space-y-2">
              {(q.options ?? []).map((opt, oi) => (
                <div key={oi} className="flex items-center gap-2">
                  <Input
                    value={opt}
                    onChange={(e) => {
                      const next = [...(q.options ?? [])];
                      next[oi] = e.target.value;
                      update(i, { options: next });
                    }}
                    placeholder={`گزینه ${oi + 1}`}
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="size-11 shrink-0 text-muted-foreground"
                    onClick={() =>
                      update(i, {
                        options: (q.options ?? []).filter((_, j) => j !== oi),
                      })
                    }
                    aria-label="حذف گزینه"
                  >
                    <XIcon className="size-4" />
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-9 rounded-full"
                onClick={() =>
                  update(i, { options: [...(q.options ?? []), ""] })
                }
              >
                <PlusIcon className="size-3.5" />
                افزودن گزینه
              </Button>
            </div>
          ) : null}
        </div>
      ))}

      <Button
        type="button"
        variant="outline"
        className="h-11 w-full rounded-2xl"
        onClick={addQuestion}
      >
        <PlusIcon className="size-4" />
        افزودن سؤال
      </Button>
    </div>
  );
}
