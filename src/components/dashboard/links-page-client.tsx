"use client";

import {
  useActionState,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  PointerSensor,
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
import {
  CameraIcon,
  Check,
  EyeIcon,
  GripVerticalIcon,
  ImageIcon,
  MousePointerClickIcon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { AddLinkDialog } from "@/components/dashboard/add-link-dialog";
import { BookingBlockRow } from "@/components/dashboard/booking-block-row";
import { BookingFlowDialog } from "@/components/dashboard/booking-flow-dialog";
import type {
  EditableBookingBlockWithId,
  ProviderConnection,
} from "@/components/dashboard/booking.types";
import {
  LinkIconBubble,
  LinkIconPicker,
  type LinkIconPickerValue,
} from "@/components/dashboard/link-icon-picker";
import type { EditableLink } from "@/components/dashboard/links-manager.types";
import { ProfileAvatarModal } from "@/components/dashboard/profile-avatar-modal";
import { ProfilePreviewMock } from "@/components/dashboard/profile-preview-mock";
import { ProfileTitleBioModal } from "@/components/dashboard/profile-title-bio-modal";
import { PublicShareBar } from "@/components/dashboard/public-share-bar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { idleState, type ActionState } from "@/lib/action-state";
import type { LinkMetadata } from "@/lib/link-metadata";
import { toPersianDigits } from "@/lib/persian";
import { cn } from "@/lib/utils";

type ProfileSnapshot = {
  fullName: string;
  title: string;
  bio: string;
  slug: string;
  publicPhone: string;
  email: string;
  avatarUrl: string | null;
};

type LinksPageClientProps = {
  initialProfile: ProfileSnapshot;
  initialLinks: EditableLink[];
  initialBookingBlocks: EditableBookingBlockWithId[];
  providerConnections: ProviderConnection[];
  /** All-time click counts keyed by link id. */
  linkClickCounts: Record<string, number>;
  publicUrl: string;
  fetchMetadataAction: (
    url: string,
  ) => Promise<
    { ok: true; data: LinkMetadata } | { ok: false; message: string }
  >;
  autosaveLinksAction: (
    state: ActionState,
    formData: FormData,
  ) => Promise<ActionState>;
  autosaveProfileDetailsAction: (
    state: ActionState,
    formData: FormData,
  ) => Promise<ActionState>;
  autosaveAvatarAction: (
    state: ActionState,
    formData: FormData,
  ) => Promise<ActionState>;
  autosaveLinkImageAction: (
    state: ActionState & { url?: string | null; folder?: string },
    formData: FormData,
  ) => Promise<ActionState & { url?: string | null; folder?: string }>;
  createBookingBlockAction: (
    state: ActionState & { id?: string },
    formData: FormData,
  ) => Promise<ActionState & { id?: string }>;
  updateBookingBlockAction: (
    state: ActionState,
    formData: FormData,
  ) => Promise<ActionState>;
  deleteBookingBlockAction: (
    state: ActionState,
    formData: FormData,
  ) => Promise<ActionState>;
  toggleBookingBlockActiveAction: (
    state: ActionState,
    formData: FormData,
  ) => Promise<ActionState>;
};

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "·";
  if (parts.length === 1) return parts[0].slice(0, 2);
  return (parts[0][0] + parts[parts.length - 1][0]).slice(0, 2);
}

export function LinksPageClient({
  initialProfile,
  initialLinks,
  initialBookingBlocks,
  providerConnections,
  linkClickCounts,
  publicUrl,
  autosaveLinkImageAction,
  fetchMetadataAction,
  autosaveLinksAction,
  autosaveProfileDetailsAction,
  autosaveAvatarAction,
  createBookingBlockAction,
  updateBookingBlockAction,
  deleteBookingBlockAction,
  toggleBookingBlockActiveAction,
}: LinksPageClientProps) {
  const router = useRouter();

  const [profile, setProfile] = useState<ProfileSnapshot>(initialProfile);
  const [links, setLinks] = useState<EditableLink[]>(initialLinks);
  const [bookingBlocks, setBookingBlocks] =
    useState<EditableBookingBlockWithId[]>(initialBookingBlocks);

  // Re-sync from the server when the parent route revalidates (e.g. after
  // creating a booking block). Without this the UI keeps showing the stale
  // initial list until a hard refresh.
  useEffect(() => {
    setBookingBlocks(initialBookingBlocks);
  }, [initialBookingBlocks]);
  const [addOpen, setAddOpen] = useState(false);
  const [bookingFlowOpen, setBookingFlowOpen] = useState(false);
  const [creatingBooking, setCreatingBooking] = useState(false);
  const [titleBioOpen, setTitleBioOpen] = useState(false);
  const [avatarOpen, setAvatarOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [linksState, linksFormAction] = useActionState(
    autosaveLinksAction,
    idleState,
  );
  const [, startLinksTransition] = useTransition();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const linksPayload = useMemo(
    () =>
      JSON.stringify(
        links.map((link, index) => ({
          label: link.label,
          url: link.url,
          description: link.description,
          iconKey: link.iconKey,
          iconUrl: link.iconUrl,
          imageUrl: link.imageUrl,
          sortOrder: index,
          isActive: link.isActive,
        })),
      ),
    [links],
  );

  // Autosave links (debounced)
  const lastSavedPayload = useRef(linksPayload);
  const firstRun = useRef(true);
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      lastSavedPayload.current = linksPayload;
      return;
    }
    if (lastSavedPayload.current === linksPayload) return;
    const timer = window.setTimeout(() => {
      lastSavedPayload.current = linksPayload;
      const fd = new FormData();
      fd.set("links", linksPayload);
      startLinksTransition(() => {
        linksFormAction(fd);
      });
    }, 500);
    return () => window.clearTimeout(timer);
  }, [linksPayload, linksFormAction]);

  // Toast on server error
  const lastLinksToast = useRef<string | null>(null);
  useEffect(() => {
    if (linksState.status === "error" && linksState.message) {
      const key = `err-${linksState.message}`;
      if (lastLinksToast.current !== key) {
        lastLinksToast.current = key;
        toast.error(linksState.message);
      }
    }
  }, [linksState.status, linksState.message]);

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setLinks((current) => {
      const oldIndex = current.findIndex((item) => item.id === active.id);
      const newIndex = current.findIndex((item) => item.id === over.id);
      return arrayMove(current, oldIndex, newIndex).map((item, index) => ({
        ...item,
        sortOrder: index,
      }));
    });
  }

  function addLink(data: Omit<EditableLink, "id" | "sortOrder">) {
    setLinks((current) => [
      ...current,
      { ...data, id: crypto.randomUUID(), sortOrder: current.length },
    ]);
  }

  function updateLink(id: string, patch: Partial<EditableLink>) {
    setLinks((current) =>
      current.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    );
  }

  function removeLink(id: string) {
    setLinks((current) =>
      current
        .filter((item) => item.id !== id)
        .map((item, index) => ({ ...item, sortOrder: index })),
    );
    if (editingId === id) setEditingId(null);
  }

  // -------- Booking block handlers --------
  async function handleCreateBooking(
    draft: Omit<EditableBookingBlockWithId, "id" | "sortOrder" | "isActive"> & {
      id?: string | null;
    },
  ) {
    setCreatingBooking(true);
    try {
      const fd = new FormData();
      fd.set("payload", JSON.stringify(draft));
      const result = await createBookingBlockAction(
        { status: "idle" as const },
        fd,
      );
      if (result.status === "error") {
        toast.error(result.message ?? "ساخت میتینگ با خطا مواجه شد.");
        return;
      }
      toast.success("میتینگ ساخته شد.");
      setBookingFlowOpen(false);
      router.refresh();
    } finally {
      setCreatingBooking(false);
    }
  }

  async function handleUpdateBooking(next: EditableBookingBlockWithId) {
    // Optimistic update
    setBookingBlocks((curr) => curr.map((b) => (b.id === next.id ? next : b)));
    const fd = new FormData();
    fd.set("blockId", next.id);
    fd.set("payload", JSON.stringify(next));
    const result = await updateBookingBlockAction(idleState, fd);
    if (result.status === "error") {
      toast.error(result.message ?? "ذخیره نشد.");
      router.refresh();
    } else {
      toast.success("ذخیره شد");
      router.refresh();
    }
  }

  async function handleDeleteBooking(id: string) {
    const prev = bookingBlocks;
    setBookingBlocks((curr) => curr.filter((b) => b.id !== id));
    const fd = new FormData();
    fd.set("blockId", id);
    const result = await deleteBookingBlockAction(idleState, fd);
    if (result.status === "error") {
      toast.error(result.message ?? "حذف نشد.");
      setBookingBlocks(prev);
    } else {
      toast.success("حذف شد");
      router.refresh();
    }
  }

  async function handleToggleBookingActive(id: string, isActive: boolean) {
    setBookingBlocks((curr) =>
      curr.map((b) => (b.id === id ? { ...b, isActive } : b)),
    );
    const fd = new FormData();
    fd.set("blockId", id);
    fd.set("isActive", String(isActive));
    const result = await toggleBookingBlockActiveAction(idleState, fd);
    if (result.status === "error") {
      toast.error(result.message ?? "تغییر وضعیت ناموفق بود.");
      router.refresh();
    }
  }

  async function handleProfileDetailsSave(next: {
    fullName: string;
    title: string;
    bio: string;
  }) {
    setProfile((p) => ({ ...p, ...next }));

    const fd = new FormData();
    fd.set("fullName", next.fullName);
    fd.set("title", next.title);
    fd.set("bio", next.bio);
    fd.set("slug", profile.slug);
    fd.set("publicPhone", profile.publicPhone);
    fd.set("email", profile.email);

    const result = await autosaveProfileDetailsAction(idleState, fd);
    if (result.status === "error") {
      toast.error(result.message ?? "ذخیره نشد.");
      return { ok: false as const, fieldErrors: result.fieldErrors };
    }
    router.refresh();
    return { ok: true as const };
  }

  async function handleAvatarSave(file: File) {
    const fd = new FormData();
    fd.set("avatar", file);
    const result = await autosaveAvatarAction(idleState, fd);
    if (result.status === "error") {
      toast.error(result.message ?? "آپلود نشد.");
      return { ok: false as const };
    }
    router.refresh();
    return { ok: true as const };
  }

  async function uploadLinkImage(
    file: File,
    folder: "link-covers" | "link-icons",
  ): Promise<string | null> {
    const fd = new FormData();
    fd.set("file", file);
    fd.set("folder", folder);
    const result = await autosaveLinkImageAction(idleState, fd);
    if (result.status === "error" || !result.url) {
      toast.error(result.message ?? "آپلود نشد.");
      return null;
    }
    return result.url;
  }

  const canAdd = links.length < 8;
  const initials = getInitials(profile.fullName);
  const activeLinks = links.filter((l) => l.isActive);
  const previewProfile = {
    fullName: profile.fullName,
    title: profile.title,
    bio: profile.bio,
    slug: profile.slug,
    publicPhone: profile.publicPhone,
    email: profile.email,
    avatarUrl: profile.avatarUrl,
    links: activeLinks.map((l) => ({
      id: l.id,
      label: l.label || "بدون عنوان",
      iconKey: l.iconKey,
      iconUrl: l.iconUrl,
      url: l.url,
      description: l.description,
      imageUrl: l.imageUrl,
    })),
  };

  return (
    <div className="grid w-full min-w-0 min-h-[calc(100dvh-var(--header-h,4rem))] lg:grid-cols-[minmax(0,1fr)_minmax(340px,420px)]">
      {/* Editor column */}
      <div className="min-w-0 border-b lg:border-b-0 lg:border-e">
        <div className="section-shell space-y-6 py-6">
          {/* Profile summary */}
          <section className="space-y-4">
            <div className="flex items-start gap-4">
              <button
                type="button"
                onClick={() => setAvatarOpen(true)}
                aria-label="ویرایش تصویر"
                className="group relative size-20 shrink-0 overflow-hidden rounded-full bg-primary/90 text-primary-foreground ring-2 ring-background"
              >
                {profile.avatarUrl ? (
                  <Image
                    src={profile.avatarUrl}
                    alt=""
                    fill
                    className="object-cover"
                    sizes="80px"
                  />
                ) : (
                  <span className="flex h-full w-full items-center justify-center text-base font-bold">
                    {initials}
                  </span>
                )}
                <span className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                  <CameraIcon className="size-5 text-white" />
                </span>
              </button>

              <div className="min-w-0 flex-1">
                <button
                  type="button"
                  onClick={() => setTitleBioOpen(true)}
                  className="group flex w-full items-start gap-2 rounded-3xl p-1 text-start transition-colors hover:bg-muted/60"
                >
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="truncate text-lg font-bold">
                      {profile.fullName || "نام شما"}
                    </p>
                    {profile.title ? (
                      <p className="truncate text-sm text-muted-foreground">
                        {profile.title}
                      </p>
                    ) : null}
                    {profile.bio ? (
                      <p className="line-clamp-2 text-xs leading-6 text-muted-foreground">
                        {profile.bio}
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        توضیح کوتاهی درباره خود بنویسید.
                      </p>
                    )}
                  </div>
                  <PencilIcon className="mt-1 size-4 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground" />
                </button>
              </div>
            </div>
          </section>

          {/* Compact share pill (shown on all breakpoints, tight). */}
          <PublicShareBar
            publicUrl={publicUrl}
            slug={profile.slug}
            displayName={profile.fullName || "کارت"}
            className="lg:hidden"
          />

          {/* Add button */}
          <div>
            <Button
              type="button"
              onClick={() => setAddOpen(true)}
              disabled={!canAdd}
              className="h-12 w-full text-sm font-bold"
            >
              <PlusIcon className="size-4" />
              افزودن لینک
            </Button>
            {!canAdd ? (
              <p className="mt-2 text-center text-xs text-muted-foreground">
                حداکثر ۸ لینک قابل ثبت است.
              </p>
            ) : null}
          </div>

          {/* Sortable list */}
          {links.length ? (
            <DndContext
              id="dashboard-links-dnd"
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={links.map((l) => l.id)}
                strategy={verticalListSortingStrategy}
              >
                <ul className="space-y-2.5">
                  {links.map((link) => (
                    <SortableLinkRow
                      key={link.id}
                      link={link}
                      clickCount={linkClickCounts[link.id] ?? 0}
                      isEditing={editingId === link.id}
                      onToggleEdit={() =>
                        setEditingId((curr) =>
                          curr === link.id ? null : link.id,
                        )
                      }
                      onChange={(patch) => updateLink(link.id, patch)}
                      onRemove={() => removeLink(link.id)}
                      uploadImage={uploadLinkImage}
                    />
                  ))}
                </ul>
              </SortableContext>
            </DndContext>
          ) : (
            <button
              type="button"
              onClick={() => setAddOpen(true)}
              className="flex w-full flex-col items-center gap-2 rounded-4xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground transition-colors hover:border-primary hover:bg-primary/5"
            >
              <PlusIcon className="size-5 text-primary" />
              اولین لینک خود را اضافه کنید.
            </button>
          )}

          {linksState.status === "success" ? (
            <p className="flex items-center justify-center gap-1 text-[11px] text-muted-foreground">
              <Check className="size-3" />
              ذخیره شد
            </p>
          ) : null}

          {/* Booking blocks */}
          {bookingBlocks.length ? (
            <section className="space-y-2.5 pt-2">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-muted-foreground">
                  میتینگ‌ها
                </h2>
                <span className="text-xs text-muted-foreground">
                  {toPersianDigits(bookingBlocks.length)} بلوک
                </span>
              </div>
              <ul className="space-y-2.5">
                {bookingBlocks.map((block) => (
                  <BookingBlockRow
                    key={block.id}
                    block={block}
                    providerConnections={providerConnections}
                    onUpdate={handleUpdateBooking}
                    onDelete={() => handleDeleteBooking(block.id)}
                    onToggleActive={(v) =>
                      handleToggleBookingActive(block.id, v)
                    }
                  />
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      </div>

      {/* Desktop preview column */}
      <aside className="hidden lg:block bg-sidebar-accent/30">
        <div className="sticky top-0 flex h-[calc(100dvh-var(--promo-bar-height,0px)-4rem)] flex-col">
          <div className="flex justify-center p-3">
            <PublicShareBar
              publicUrl={publicUrl}
              slug={profile.slug}
              displayName={profile.fullName || "کارت"}
            />
          </div>
          <div className="flex flex-1 items-start justify-center overflow-y-auto px-6 pb-6">
            <div className="w-full max-w-88">
              <ProfilePreviewMock profile={previewProfile} />
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile floating Preview button (above bottom nav). */}
      <button
        type="button"
        onClick={() => setPreviewOpen(true)}
        aria-label="پیش‌نمایش کارت"
        className="fixed inset-e-4 z-30 inline-flex items-center gap-1.5 rounded-full border border-black/8 bg-card px-4 py-2.5 text-sm font-bold text-foreground shadow-[0_18px_36px_-18px_rgba(15,23,42,0.4)] backdrop-blur transition-colors hover:bg-primary/10 lg:hidden"
        style={{
          bottom: "calc(5.25rem + env(safe-area-inset-bottom))",
        }}
      >
        <EyeIcon className="size-4" />
        پیش‌نمایش
      </button>

      {/* Mobile Preview sheet — renders the REAL public profile card. */}
      <Sheet open={previewOpen} onOpenChange={setPreviewOpen}>
        <SheetContent
          side="bottom"
          className="max-h-[92dvh] rounded-t-[2rem] bg-background p-0"
        >
          <SheetHeader className="border-b px-4 pt-4 pb-3">
            <SheetTitle>پیش‌نمایش زنده</SheetTitle>
            <SheetDescription>
              دقیقاً همان چیزی که بازدیدکنندگان می‌بینند.
            </SheetDescription>
          </SheetHeader>
          <div className="overflow-y-auto px-3 pt-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
            <div className="mx-auto w-full max-w-md">
              <ProfilePreviewMock profile={previewProfile} />
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <AddLinkDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onSubmit={addLink}
        fetchMetadataAction={fetchMetadataAction}
        uploadImage={uploadLinkImage}
        onAddBooking={() => {
          setAddOpen(false);
          setBookingFlowOpen(true);
        }}
      />

      <BookingFlowDialog
        open={bookingFlowOpen}
        onOpenChange={setBookingFlowOpen}
        title="میتینگ"
        submitting={creatingBooking}
        providerConnections={providerConnections}
        onSubmit={handleCreateBooking}
      />

      <ProfileAvatarModal
        open={avatarOpen}
        onOpenChange={setAvatarOpen}
        currentUrl={profile.avatarUrl}
        displayName={profile.fullName ?? ""}
        onUpload={handleAvatarSave}
      />

      <ProfileTitleBioModal
        open={titleBioOpen}
        onOpenChange={setTitleBioOpen}
        initial={{
          fullName: profile.fullName,
          title: profile.title,
          bio: profile.bio,
        }}
        onSave={handleProfileDetailsSave}
      />
    </div>
  );
}

function SortableLinkRow({
  link,
  clickCount,
  isEditing,
  onToggleEdit,
  onChange,
  onRemove,
  uploadImage,
}: {
  link: EditableLink;
  clickCount: number;
  isEditing: boolean;
  onToggleEdit: () => void;
  onChange: (patch: Partial<EditableLink>) => void;
  onRemove: () => void;
  uploadImage: (
    file: File,
    folder: "link-covers" | "link-icons",
  ) => Promise<string | null>;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: link.id });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "min-w-0 rounded-3xl border border-border bg-background/80",
        isDragging && "shadow-lg",
        !link.isActive && "opacity-60",
      )}
    >
      <div className="flex min-w-0 items-center gap-1.5 p-2 sm:gap-2 sm:p-3">
        <button
          type="button"
          className="tap-target shrink-0 rounded-2xl text-muted-foreground"
          aria-label="جابه‌جایی"
          {...attributes}
          {...listeners}
        >
          <GripVerticalIcon className="size-4" />
        </button>

        <LinkIconBubble
          iconKey={link.iconKey}
          iconUrl={link.iconUrl}
          imageUrl={link.imageUrl}
          url={link.url}
          size={40}
          className="rounded-2xl"
        />
        <div className="min-w-0 flex-1 overflow-hidden">
          <span className="truncate text-sm font-bold">
            {link.label || "بدون عنوان"}
          </span>
          <span className="truncate text-xs text-muted-foreground" dir="ltr">
            {link.url || "—"}
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <span
            className="inline-flex items-center gap-1 rounded-xl bg-muted px-2 py-1 text-[11px] font-bold text-muted-foreground"
            title="تعداد کلیک"
          >
            <MousePointerClickIcon className="size-3" />
            {clickCount}
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-0.5">
          <Switch
            checked={link.isActive}
            onCheckedChange={(v) => onChange({ isActive: v })}
            aria-label={link.isActive ? "غیرفعال کردن" : "فعال کردن"}
          />
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            className="rounded-2xl"
            onClick={onToggleEdit}
            aria-label="ویرایش"
          >
            <PencilIcon className="size-4" />
          </Button>
          <ConfirmDialog
            title="حذف لینک؟"
            description="این لینک برای همیشه حذف می‌شود."
            confirmLabel="حذف"
            destructive
            onConfirm={onRemove}
          >
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              className="rounded-2xl text-muted-foreground hover:text-destructive"
              aria-label="حذف"
            >
              <Trash2Icon className="size-4" />
            </Button>
          </ConfirmDialog>
        </div>
      </div>

      {isEditing ? (
        <div className="grid min-w-0 gap-3 border-t border-border/70 p-3">
          <div className="min-w-0 space-y-1.5">
            <Label>عنوان</Label>
            <Input
              value={link.label}
              onChange={(event) => onChange({ label: event.target.value })}
              enterKeyHint="next"
              className="h-11"
            />
          </div>
          <div className="min-w-0 space-y-1.5">
            <Label>لینک</Label>
            <Input
              value={link.url}
              onChange={(event) => onChange({ url: event.target.value })}
              type="url"
              inputMode="url"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              dir="ltr"
              className="h-11"
            />
          </div>
          <div className="min-w-0 space-y-1.5">
            <Label>توضیحات (اختیاری)</Label>
            <Textarea
              value={link.description ?? ""}
              onChange={(event) =>
                onChange({ description: event.target.value || null })
              }
              className="min-h-16"
              maxLength={160}
            />
          </div>
          <div className="min-w-0 space-y-1.5">
            <Label>آیکون</Label>
            <LinkIconPicker
              url={link.url}
              value={{ iconKey: link.iconKey, iconUrl: link.iconUrl }}
              onChange={(next: LinkIconPickerValue) => onChange(next)}
              uploadIcon={(file) => uploadImage(file, "link-icons")}
            />
          </div>
          <div className="min-w-0 space-y-1.5">
            <Label>کاور (اختیاری)</Label>
            <LinkCoverField
              value={link.imageUrl}
              onChange={(next) => onChange({ imageUrl: next })}
              uploadCover={(file) => uploadImage(file, "link-covers")}
            />
          </div>
        </div>
      ) : null}
    </li>
  );
}

function LinkCoverField({
  value,
  onChange,
  uploadCover,
}: {
  value: string | null;
  onChange: (next: string | null) => void;
  uploadCover: (file: File) => Promise<string | null>;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);

  async function handleFile(file: File) {
    setUploading(true);
    try {
      const url = await uploadCover(file);
      if (url) onChange(url);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      <div className="relative inline-flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-muted">
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt="" className="size-full object-cover" />
        ) : (
          <ImageIcon className="size-5 text-muted-foreground" />
        )}
      </div>
      <div className="flex flex-col gap-1.5">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-9"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? "در حال آپلود…" : "بارگذاری کاور"}
        </Button>
        {value ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-8 text-muted-foreground"
            onClick={() => onChange(null)}
          >
            حذف کاور
          </Button>
        ) : null}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => {
          const f = event.target.files?.[0];
          event.target.value = "";
          if (f) handleFile(f);
        }}
      />
    </div>
  );
}
