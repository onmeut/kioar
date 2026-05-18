"use client";

import { useState } from "react";
import { CameraIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { KioarAvatar } from "@/components/shared/kioar-avatar";
import { ProfileAvatarModal } from "@/components/dashboard/profile-avatar-modal";
import { cn } from "@/lib/utils";

const BIO_MAX = 160;

type Props = {
  displayName: string;
  bio: string;
  avatarUrl: string | null;
  avatarSeed: string | null;
  onNameChange: (v: string) => void;
  onBioChange: (v: string) => void;
  onAvatarChange: (url: string | null) => void;
  onSeedChange: (seed: string) => void;
  onAvatarUpload: (file: File) => Promise<{ ok: true } | { ok: false }>;
  onAvatarDelete?: () => Promise<{ ok: true } | { ok: false }>;
  onAvatarPickSeed: (seed: string) => Promise<{ ok: true } | { ok: false }>;
};

export function ActivationStepProfile({
  displayName,
  bio,
  avatarUrl,
  avatarSeed,
  onNameChange,
  onBioChange,
  onAvatarChange,
  onSeedChange,
  onAvatarUpload,
  onAvatarDelete,
  onAvatarPickSeed,
}: Props) {
  const [avatarModalOpen, setAvatarModalOpen] = useState(false);

  return (
    <>
      <div className="flex flex-col gap-6">
        {/* Avatar — reuses the same ProfileAvatarModal from page settings */}
        <div className="flex flex-col items-center gap-3">
          <button
            type="button"
            onClick={() => setAvatarModalOpen(true)}
            className="group relative size-24 overflow-hidden rounded-full border-2 border-border bg-muted transition-colors hover:border-primary"
            aria-label="تغییر تصویر پروفایل"
          >
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatarUrl}
                alt="تصویر پروفایل"
                className="absolute inset-0 size-full object-cover"
              />
            ) : (
              <KioarAvatar seed={avatarSeed ?? "kioar"} size={96} />
            )}
            <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
              <CameraIcon className="size-5 text-white" />
            </span>
          </button>
          <button
            type="button"
            onClick={() => setAvatarModalOpen(true)}
            className="text-xs text-muted-foreground underline-offset-2 hover:underline"
          >
            {avatarUrl ? "تغییر تصویر" : "افزودن تصویر"}
          </button>
        </div>

        {/* Display name */}
        <div className="space-y-1.5">
          <Label htmlFor="wizard-name" className="text-sm font-medium">
            اسم یا نام برند
          </Label>
          <Input
            id="wizard-name"
            type="text"
            inputMode="text"
            autoComplete="name"
            enterKeyHint="next"
            placeholder="مثلاً علی رضایی یا کافه آرام"
            value={displayName}
            onChange={(e) => onNameChange(e.target.value)}
            className="h-11"
            autoFocus
          />
        </div>

        {/* Bio */}
        <div className="space-y-1.5">
          <Label htmlFor="wizard-bio" className="flex items-center justify-between text-sm font-medium">
            <span>بایو</span>
            <span className={cn(
              "text-xs font-normal tabular-nums",
              bio.length > BIO_MAX ? "text-destructive" : "text-muted-foreground",
            )}>
              {bio.length}/{BIO_MAX}
            </span>
          </Label>
          <Textarea
            id="wizard-bio"
            inputMode="text"
            autoComplete="off"
            enterKeyHint="done"
            placeholder="چند جمله درباره خودت یا کارت بنویس…"
            value={bio}
            onChange={(e) => onBioChange(e.target.value)}
            rows={3}
            className="resize-none"
          />
        </div>
      </div>

      <ProfileAvatarModal
        open={avatarModalOpen}
        onOpenChange={setAvatarModalOpen}
        currentUrl={avatarUrl}
        avatarSeed={avatarSeed}
        displayName={displayName}
        onUpload={async (file) => {
          const result = await onAvatarUpload(file);
          if (result.ok) {
            // The upload updates the profile server-side; parent will receive
            // the new URL via onAvatarChange after the action resolves.
          }
          return result;
        }}
        onDelete={onAvatarDelete ? async () => {
          const result = await onAvatarDelete!();
          if (result.ok) onAvatarChange(null);
          return result;
        } : undefined}
        onPickSeed={async (seed) => {
          const result = await onAvatarPickSeed(seed);
          if (result.ok) {
            onAvatarChange(null);
            onSeedChange(seed);
          }
          return result;
        }}
      />
    </>
  );
}
