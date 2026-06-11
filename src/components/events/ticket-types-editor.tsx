"use client";

import { PlusIcon, Trash2Icon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export type DraftTicketType = {
  id: string | null;
  name: string;
  description: string | null;
  isFree: boolean;
  priceToman: number;
  capacity: number | null;
};

export function emptyTicketType(name = ""): DraftTicketType {
  return {
    id: null,
    name,
    description: null,
    isFree: true,
    priceToman: 0,
    capacity: null,
  };
}

export function TicketTypesEditor({
  ticketTypes,
  onChange,
}: {
  ticketTypes: DraftTicketType[];
  onChange: (next: DraftTicketType[]) => void;
}) {
  function update(index: number, patch: Partial<DraftTicketType>) {
    onChange(ticketTypes.map((t, i) => (i === index ? { ...t, ...patch } : t)));
  }

  return (
    <div className="space-y-3">
      {ticketTypes.map((t, i) => (
        <div
          key={i}
          className="space-y-3 rounded-3xl border border-border bg-muted/20 p-3"
        >
          <div className="flex items-start gap-2">
            <Input
              value={t.name}
              onChange={(e) => update(i, { name: e.target.value })}
              placeholder="نام بلیت (مثلاً استاندارد)"
              className="flex-1"
              enterKeyHint="next"
            />
            {ticketTypes.length > 1 ? (
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="size-11 shrink-0 text-muted-foreground hover:text-rose-600"
                onClick={() => onChange(ticketTypes.filter((_, j) => j !== i))}
                aria-label="حذف بلیت"
              >
                <Trash2Icon className="size-4" />
              </Button>
            ) : null}
          </div>

          <Input
            value={t.description ?? ""}
            onChange={(e) =>
              update(i, { description: e.target.value || null })
            }
            placeholder="توضیح کوتاه (اختیاری)"
          />

          {/* Price row: amount field + free switch */}
          <div className="flex items-center gap-3">
            <Input
              value={t.isFree ? "" : (t.priceToman ? String(t.priceToman) : "")}
              onChange={(e) =>
                update(i, {
                  priceToman: Number(e.target.value.replace(/\D/g, "")) || 0,
                  isFree: false,
                })
              }
              disabled={t.isFree}
              placeholder="قیمت (تومان)"
              inputMode="numeric"
              dir="ltr"
              className="flex-1 text-end font-mono"
            />
            <label className="flex shrink-0 items-center gap-2 text-sm text-muted-foreground">
              رایگان
              <Switch
                checked={t.isFree}
                onCheckedChange={(c) =>
                  update(i, { isFree: c, priceToman: c ? 0 : t.priceToman })
                }
              />
            </label>
          </div>

          {/* Capacity */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">
              ظرفیت (خالی = نامحدود)
            </Label>
            <Input
              value={t.capacity != null ? String(t.capacity) : ""}
              onChange={(e) => {
                const n = Number(e.target.value.replace(/\D/g, ""));
                update(i, { capacity: n > 0 ? n : null });
              }}
              placeholder="نامحدود"
              inputMode="numeric"
              dir="ltr"
              className="w-40 text-end font-mono"
            />
          </div>
        </div>
      ))}

      <Button
        type="button"
        variant="outline"
        className="h-11 w-full rounded-2xl"
        onClick={() => onChange([...ticketTypes, emptyTicketType()])}
      >
        <PlusIcon className="size-4" />
        افزودن نوع بلیت
      </Button>
    </div>
  );
}
