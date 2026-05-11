"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Loader2Icon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type Initial = {
  fullName: string;
  title: string;
  bio: string;
};

type Result =
  | { ok: true }
  | { ok: false; fieldErrors?: Record<string, string[] | undefined> };

type ProfileTitleBioModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial: Initial;
  onSave: (next: Initial) => Promise<Result>;
};

export function ProfileTitleBioModal({
  open,
  onOpenChange,
  initial,
  onSave,
}: ProfileTitleBioModalProps) {
  const [fullName, setFullName] = useState(initial.fullName);
  const [title, setTitle] = useState(initial.title);
  const [bio, setBio] = useState(initial.bio);
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>(
    {},
  );
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();
  const lastPayload = useRef<string>(
    JSON.stringify({
      fullName: initial.fullName,
      title: initial.title,
      bio: initial.bio,
    }),
  );

  // Reset when opened
  useEffect(() => {
    if (open) {
      setFullName(initial.fullName);
      setTitle(initial.title);
      setBio(initial.bio);
      setErrors({});
      lastPayload.current = JSON.stringify(initial);
    }
  }, [open, initial]);

  // Debounced autosave
  useEffect(() => {
    if (!open) return;
    const payload = JSON.stringify({ fullName, title, bio });
    if (payload === lastPayload.current) return;
    const timer = window.setTimeout(() => {
      const snapshot = { fullName, title, bio };
      startTransition(async () => {
        const result = await onSave(snapshot);
        if (result.ok) {
          lastPayload.current = payload;
          setErrors({});
          setSavedAt(Date.now());
        } else if (result.fieldErrors) {
          setErrors(result.fieldErrors);
        }
      });
    }, 700);
    return () => window.clearTimeout(timer);
  }, [open, fullName, title, bio, onSave]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>ویرایش پروفایل</DialogTitle>
          <DialogDescription>
            تغییرات به‌صورت خودکار ذخیره می‌شوند.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="profile-name">نام</Label>
              <span className="text-[10px] text-muted-foreground">
                {fullName.length}/۸۰
              </span>
            </div>
            <Input
              id="profile-name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              maxLength={80}
              autoComplete="name"
              enterKeyHint="next"
              className="h-11"
            />
            {errors.fullName?.[0] ? (
              <p className="text-xs text-destructive">{errors.fullName[0]}</p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="profile-title">عنوان</Label>
              <span className="text-[10px] text-muted-foreground">
                {title.length}/۸۰
              </span>
            </div>
            <Input
              id="profile-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={80}
              enterKeyHint="next"
              className="h-11"
            />
            {errors.title?.[0] ? (
              <p className="text-xs text-destructive">{errors.title[0]}</p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="profile-bio">بیو</Label>
              <span className="text-[10px] text-muted-foreground">
                {bio.length}/۲۸۰
              </span>
            </div>
            <Textarea
              id="profile-bio"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              maxLength={280}
              rows={4}
              className="min-h-28"
            />
            {errors.bio?.[0] ? (
              <p className="text-xs text-destructive">{errors.bio[0]}</p>
            ) : null}
          </div>

          <div
            className={cn(
              "flex items-center justify-end gap-2 text-xs text-muted-foreground",
              !savedAt && !isPending && "invisible",
            )}
          >
            {isPending ? (
              <>
                <Loader2Icon className="size-3 animate-spin" />
                در حال ذخیره…
              </>
            ) : savedAt ? (
              <span>ذخیره شد</span>
            ) : null}
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            className="h-10"
            onClick={() => onOpenChange(false)}
          >
            انصراف
          </Button>
          <Button
            type="button"
            disabled={isPending}
            className="h-10 px-6"
            onClick={() => {
              const payload = JSON.stringify({ fullName, title, bio });
              startTransition(async () => {
                const result = await onSave({ fullName, title, bio });
                if (result.ok) {
                  lastPayload.current = payload;
                  setErrors({});
                  setSavedAt(Date.now());
                  onOpenChange(false);
                } else if (result.fieldErrors) {
                  setErrors(result.fieldErrors);
                }
              });
            }}
          >
            {isPending ? <Loader2Icon className="size-4 animate-spin" /> : null}
            ذخیره
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
