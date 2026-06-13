"use client";

import {
  useActionState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
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
  Check,
  MousePointerClickIcon,
  PencilIcon,
  PlusIcon,
  SparklesIcon,
} from "lucide-react";
import { toast } from "sonner";

import { AddLinkDialog } from "@/components/dashboard/add-link-dialog";
import { EditLinkDialog } from "@/components/dashboard/edit-link-dialog";
import { BookingBlockRow } from "@/components/dashboard/booking-block-row";
import { BlockCard } from "@/components/dashboard/block-card";
import { BookingFlowDialog } from "@/components/dashboard/booking-flow-dialog";
import type {
  EditableBookingBlock,
  EditableBookingBlockWithId,
} from "@/components/dashboard/booking.types";
import {
  FormBuilderDialog,
  type FormBlockDraft,
} from "@/components/dashboard/form-builder-dialog";
import {
  FormBlockRow,
  type EditableFormBlockWithId,
} from "@/components/dashboard/form-block-row";
import {
  ProductBuilderDialog,
  type ProductBlockSubmit,
} from "@/components/dashboard/product-builder-dialog";
import {
  ProductBlockRow,
  type EditableProductBlockWithId,
} from "@/components/dashboard/product-block-row";
import {
  TextBlockDialog,
  type TextBlockDraft,
} from "@/components/dashboard/text-block-dialog";
import {
  TextBlockRow,
  type EditableTextBlockWithId,
} from "@/components/dashboard/text-block-row";
import {
  MediaBuilderDialog,
  type MediaBlockDraft,
  type MediaPanelCopy,
} from "@/components/dashboard/media-builder-dialog";
import {
  MediaBlockRow,
  type EditableMediaBlockWithId,
} from "@/components/dashboard/media-block-row";
import {
  EventBlockRow,
  type EditableEventBlockWithId,
} from "@/components/dashboard/event-block-row";
import { EventBuilderDialog } from "@/components/dashboard/event-builder-dialog";
import type { EventFormInitial } from "@/components/events/event-form";
import { type LinkIconPickerValue } from "@/components/dashboard/link-icon-picker";
import { LinkIconPickerButton } from "@/components/dashboard/link-icon-picker-button";
import { SpotlightStarButton } from "@/components/dashboard/spotlight-star-button";
import type {
  BlockAnimationStyle,
  BlockSpotlight,
} from "@/lib/block-spotlight";
import type { EditableLink } from "@/components/dashboard/links-manager.types";
import { PhoneMockupFrame } from "@/components/dashboard/phone-mockup-frame";
import { ProfilePreviewMock } from "@/components/dashboard/profile-preview-mock";
import {
  PageSettingsSheet,
  type PageSettingsValues,
} from "@/components/dashboard/page-settings-sheet";
import { CustomizeButton } from "@/components/appearance/design-editor";
import { PageThemeProvider } from "@/components/public-page/page-theme-provider";
import { coerceAppearance } from "@/lib/appearance/types";
import { PublicShareBar } from "@/components/dashboard/public-share-bar";
import { Button } from "@/components/ui/button";
import type { Category, Industry } from "@/lib/discover";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { idleState, type ActionState } from "@/lib/action-state";
import type { LinkMetadata } from "@/lib/link-metadata";
import { submitFormAction as publicSubmitFormAction } from "@/lib/public-form-actions";
import { isSafeLinkUrl, type ProductBlockPreset } from "@/lib/validations";
import { ActivationWizard } from "@/components/dashboard/activation-wizard/activation-wizard";
import { hasSavedDraft, clearActivationDraft } from "@/components/dashboard/activation-wizard/use-activation-draft";
import { NewPageCelebration } from "@/components/dashboard/new-page-celebration";

type ProfileSnapshot = {
  id: string;
  fullName: string;
  title: string;
  bio: string;
  slug: string;
  publicPhone: string;
  showPublicPhone: boolean;
  email: string;
  showPublicEmail: boolean;
  avatarUrl: string | null;
  /** Seed for the DiceBear avatar fallback when `avatarUrl` is null. */
  avatarSeed: string | null;
  domain: string;
  seoTitle: string;
  seoDescription: string;
  ogImageUrl: string | null;
  indexEnabled: boolean;
  appIconKey: string | null;
  appIconColor: string;
  discoverEnabled: boolean;
  discoverCategory: string | null;
  city: string | null;
  pageType: string | null;
  appearance: import("@/lib/appearance/types").PageAppearance | null;
};

type LinksPageClientProps = {
  initialProfile: ProfileSnapshot;
  initialLinks: EditableLink[];
  initialBookingBlocks: EditableBookingBlockWithId[];
  initialFormBlocks: EditableFormBlockWithId[];
  initialProductBlocks: EditableProductBlockWithId[];
  initialTextBlocks: EditableTextBlockWithId[];
  initialMediaBlocks: EditableMediaBlockWithId[];
  initialEventBlocks: EditableEventBlockWithId[];
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
  savePageSettingsAction: (
    state: ActionState,
    formData: FormData,
  ) => Promise<ActionState>;
  autosaveAvatarAction: (
    state: ActionState,
    formData: FormData,
  ) => Promise<ActionState>;
  deleteAvatarAction: (
    state: ActionState,
    formData: FormData,
  ) => Promise<ActionState>;
  saveAvatarSeedAction: (
    state: ActionState,
    formData: FormData,
  ) => Promise<ActionState>;
  reorderBlocksAction: (
    state: ActionState,
    formData: FormData,
  ) => Promise<ActionState>;
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
  createFormBlockAction: (
    state: ActionState & { id?: string },
    formData: FormData,
  ) => Promise<ActionState & { id?: string }>;
  updateFormBlockAction: (
    state: ActionState,
    formData: FormData,
  ) => Promise<ActionState>;
  deleteFormBlockAction: (
    state: ActionState,
    formData: FormData,
  ) => Promise<ActionState>;
  toggleFormBlockActiveAction: (
    state: ActionState,
    formData: FormData,
  ) => Promise<ActionState>;
  createProductBlockAction: (
    state: ActionState & { id?: string },
    formData: FormData,
  ) => Promise<ActionState & { id?: string }>;
  updateProductBlockAction: (
    state: ActionState,
    formData: FormData,
  ) => Promise<ActionState>;
  deleteProductBlockAction: (
    state: ActionState,
    formData: FormData,
  ) => Promise<ActionState>;
  toggleProductBlockActiveAction: (
    state: ActionState,
    formData: FormData,
  ) => Promise<ActionState>;
  uploadProductItemImageAction: (
    state: ActionState & { url?: string | null },
    formData: FormData,
  ) => Promise<ActionState & { url?: string | null }>;
  createTextBlockAction: (
    state: ActionState & { id?: string },
    formData: FormData,
  ) => Promise<ActionState & { id?: string }>;
  updateTextBlockAction: (
    state: ActionState,
    formData: FormData,
  ) => Promise<ActionState>;
  deleteTextBlockAction: (
    state: ActionState,
    formData: FormData,
  ) => Promise<ActionState>;
  toggleTextBlockActiveAction: (
    state: ActionState,
    formData: FormData,
  ) => Promise<ActionState>;
  uploadTextBlockImageAction: (
    state: ActionState & { url?: string | null },
    formData: FormData,
  ) => Promise<ActionState & { url?: string | null }>;
  createMediaBlockAction: (
    state: ActionState & { id?: string },
    formData: FormData,
  ) => Promise<ActionState & { id?: string }>;
  updateMediaBlockAction: (
    state: ActionState,
    formData: FormData,
  ) => Promise<ActionState>;
  deleteMediaBlockAction: (
    state: ActionState,
    formData: FormData,
  ) => Promise<ActionState>;
  toggleMediaBlockActiveAction: (
    state: ActionState,
    formData: FormData,
  ) => Promise<ActionState>;
  uploadMediaImageAction: (
    state: ActionState & { url?: string | null; byteSize?: number },
    formData: FormData,
  ) => Promise<ActionState & { url?: string | null; byteSize?: number }>;
  uploadMediaFileAction: (
    state: ActionState & { url?: string | null; byteSize?: number },
    formData: FormData,
  ) => Promise<ActionState & { url?: string | null; byteSize?: number }>;
  /** Inline event create/update from the builder dialog — returns the event
   *  id + slug on success instead of redirecting. */
  saveEventBlockAction: (
    state: ActionState & { id?: string; slug?: string },
    formData: FormData,
  ) => Promise<ActionState & { id?: string; slug?: string }>;
  deleteEventBlockAction: (
    state: ActionState,
    formData: FormData,
  ) => Promise<ActionState>;
  toggleEventBlockActiveAction: (
    state: ActionState,
    formData: FormData,
  ) => Promise<ActionState>;
  /** Full event data for the edit flow, keyed by event id. Loaded server-side
   *  so opening "edit" doesn't need a round-trip. */
  eventFormInitials?: Record<string, EventFormInitial>;
  /** Phase 5: when the page lacks the booking entitlement, render existing
   * booking blocks read-only with an upgrade CTA instead of editable rows. */
  bookingsLocked?: boolean;
  /** Phase 5: same idea for form blocks (`business_lead_capture_form`). */
  formsLocked?: boolean;
  /** Phase 5: same idea for product blocks (`products_block`). */
  productsLocked?: boolean;
  /** Events block gating (`business_events`). When locked, the picker card
   *  shows a lock badge and opens the upgrade modal instead of navigating. */
  eventsLocked?: boolean;
  /** Text block gating (`link_text_block`, Pro+). */
  textLocked?: boolean;
  textRequiredPlan?: "pro" | "business";
  /** Media block gating (`media_block`). Granted on every plan today, so this
   * is normally false; threaded through for symmetry + future gating. */
  mediaLocked?: boolean;
  mediaRequiredPlan?: "pro" | "business";
  /** Lowest paid plan that currently grants the feature — drives the lock
   * chip colour (Pro=emerald, Business=purple). Sourced from the live
   * `plan_features` matrix, not the seed naming convention. */
  bookingsRequiredPlan?: "pro" | "business";
  formsRequiredPlan?: "pro" | "business";
  productsRequiredPlan?: "pro" | "business";
  eventsRequiredPlan?: "pro" | "business";
  /** Per-block items cap from the page's entitlement
   * (`products_max_items_per_block`). Falls back to the absolute hard cap
   * (300) when unset. */
  productItemsCap?: number;
  /** Phase 6 — Spotlight gating. */
  pinAllowed?: boolean;
  animateAllowed?: boolean;
  /** When true, the share modal lets the user save QR colour/style. */
  canCustomizeQr?: boolean;
  /** DB-persisted QR style — single source of truth. */
  savedQrStyle?: import("@/lib/qr/types").QrStyle | null;
  /** Persists QR style to DB. */
  saveQrStyleAction?: (
    style: import("@/lib/qr/types").QrStyle,
  ) => Promise<{ status: string; message?: string }>;
  /** DB-backed industries for the page-settings picker. */
  industries: Industry[];
  /** DB-backed categories for the page-settings picker. */
  categories: Category[];
  setBlockSpotlightAction: (
    state: ActionState,
    formData: FormData,
  ) => Promise<ActionState>;
  /** ISO string of trial end date. Null = no active trial (free plan). */
  trialEndsAt?: string | null;
  /** Profile details autosave — used by the activation wizard step 3. */
  autosaveProfileDetailsAction: (
    state: ActionState,
    formData: FormData,
  ) => Promise<ActionState>;
};

/** Stable dnd-kit id for an item in the unified blocks list. */
function itemKey(ref: { kind: string; id: string }) {
  return `${ref.kind}:${ref.id}`;
}

export function LinksPageClient({
  initialProfile,
  initialLinks,
  initialBookingBlocks,
  initialFormBlocks,
  initialProductBlocks,
  initialTextBlocks,
  linkClickCounts,
  publicUrl,
  fetchMetadataAction,
  autosaveLinksAction,
  savePageSettingsAction,
  autosaveAvatarAction,
  deleteAvatarAction,
  saveAvatarSeedAction,
  reorderBlocksAction,
  createBookingBlockAction,
  updateBookingBlockAction,
  deleteBookingBlockAction,
  toggleBookingBlockActiveAction,
  createFormBlockAction,
  updateFormBlockAction,
  deleteFormBlockAction,
  toggleFormBlockActiveAction,
  createProductBlockAction,
  updateProductBlockAction,
  deleteProductBlockAction,
  toggleProductBlockActiveAction,
  uploadProductItemImageAction,
  createTextBlockAction,
  updateTextBlockAction,
  deleteTextBlockAction,
  toggleTextBlockActiveAction,
  uploadTextBlockImageAction,
  createMediaBlockAction,
  updateMediaBlockAction,
  deleteMediaBlockAction,
  toggleMediaBlockActiveAction,
  uploadMediaImageAction,
  uploadMediaFileAction,
  saveEventBlockAction,
  deleteEventBlockAction,
  toggleEventBlockActiveAction,
  eventFormInitials,
  initialEventBlocks,
  initialMediaBlocks,
  bookingsLocked = false,
  formsLocked = false,
  productsLocked = false,
  eventsLocked = false,
  textLocked = false,
  bookingsRequiredPlan = "business",
  formsRequiredPlan = "business",
  productsRequiredPlan = "pro",
  eventsRequiredPlan = "business",
  textRequiredPlan = "pro",
  mediaLocked = false,
  mediaRequiredPlan = "pro",
  productItemsCap,
  pinAllowed = false,
  animateAllowed = false,
  canCustomizeQr = false,
  savedQrStyle,
  saveQrStyleAction,
  industries,
  categories,
  setBlockSpotlightAction,
  trialEndsAt = null,
  autosaveProfileDetailsAction,
}: LinksPageClientProps) {
  const router = useRouter();

  const [profile, setProfile] = useState<ProfileSnapshot>(initialProfile);
  const [links, setLinks] = useState<EditableLink[]>(initialLinks);
  const [bookingBlocks, setBookingBlocks] =
    useState<EditableBookingBlockWithId[]>(initialBookingBlocks);
  const [formBlocks, setFormBlocks] =
    useState<EditableFormBlockWithId[]>(initialFormBlocks);
  const [productBlocks, setProductBlocks] =
    useState<EditableProductBlockWithId[]>(initialProductBlocks);
  const [textBlocks, setTextBlocks] =
    useState<EditableTextBlockWithId[]>(initialTextBlocks);
  const [mediaBlocks, setMediaBlocks] =
    useState<EditableMediaBlockWithId[]>(initialMediaBlocks);
  const [eventBlocks, setEventBlocks] =
    useState<EditableEventBlockWithId[]>(initialEventBlocks);

  // Re-sync from the server when the parent route revalidates (e.g. after
  // creating a booking block). Without this the UI keeps showing the stale
  // initial list until a hard refresh.
  useEffect(() => {
    setBookingBlocks(initialBookingBlocks);
  }, [initialBookingBlocks]);
  useEffect(() => {
    setFormBlocks(initialFormBlocks);
  }, [initialFormBlocks]);
  useEffect(() => {
    setProductBlocks(initialProductBlocks);
  }, [initialProductBlocks]);
  useEffect(() => {
    setTextBlocks(initialTextBlocks);
  }, [initialTextBlocks]);
  useEffect(() => {
    setMediaBlocks(initialMediaBlocks);
  }, [initialMediaBlocks]);
  useEffect(() => {
    setEventBlocks(initialEventBlocks);
  }, [initialEventBlocks]);
  const [wizardOpen, setWizardOpen] = useState(false);
  // Ref to wizard's resetDraft so we can reset its in-memory state without remounting
  const wizardResetDraftRef = useRef<(() => void) | null>(null);
  // Read draft existence once on mount (SSR-safe: hasSavedDraft is client-only).
  const [draftExists, setDraftExists] = useState(false);
  useEffect(() => {
    setDraftExists(hasSavedDraft(profile.id));
  }, [profile.id]);

  const [addOpen, setAddOpen] = useState(false);
  const [bookingFlowOpen, setBookingFlowOpen] = useState(false);
  const [creatingBooking, setCreatingBooking] = useState(false);
  const [formBuilderOpen, setFormBuilderOpen] = useState(false);
  const [editingFormBlock, setEditingFormBlock] =
    useState<EditableFormBlockWithId | null>(null);
  const [savingForm, setSavingForm] = useState(false);
  const [productBuilderOpen, setProductBuilderOpen] = useState(false);
  const [productBuilderFromAdd, setProductBuilderFromAdd] = useState(false);
  // Preset chosen from the add-link tile (محصول → shop, منو → menu, سرویس‌ها →
  // services). Seeds the new block's preset, default name, and default slug.
  const [productBuilderPreset, setProductBuilderPreset] =
    useState<ProductBlockPreset>("shop");
  const [editingProductBlock, setEditingProductBlock] =
    useState<EditableProductBlockWithId | null>(null);
  const [textDialogOpen, setTextDialogOpen] = useState(false);
  const [editingTextBlock, setEditingTextBlock] =
    useState<EditableTextBlockWithId | null>(null);
  const [savingText, setSavingText] = useState(false);
  // Media builder: the variant card sets the initial mode/preset/copy for a
  // new block; editing pre-fills from the existing block.
  const [mediaDialogOpen, setMediaDialogOpen] = useState(false);
  const [editingMediaBlock, setEditingMediaBlock] =
    useState<EditableMediaBlockWithId | null>(null);
  const [mediaNewMode, setMediaNewMode] =
    useState<MediaBlockDraft["mode"]>("photos");
  const [mediaNewPreset, setMediaNewPreset] =
    useState<MediaBlockDraft["preset"]>(null);
  const [mediaCopy, setMediaCopy] = useState<MediaPanelCopy | undefined>(
    undefined,
  );
  const [savingMedia, setSavingMedia] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [eventBuilderOpen, setEventBuilderOpen] = useState(false);
  // The event currently being edited (null = creating a new one).
  const [editingEventInitial, setEditingEventInitial] =
    useState<EventFormInitial | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    const handler = () => setSettingsOpen(true);
    window.addEventListener("open-page-settings", handler);
    return () => window.removeEventListener("open-page-settings", handler);
  }, []);

  // Mobile header "پیش‌نمایش" button (rendered in the dashboard
  // top-bar by `MeHeaderActions`) dispatches this event. Keeping the
  // sheet state colocated with the editor lets us preview the live
  // in-memory profile without prop-drilling state up to the layout.
  useEffect(() => {
    const handler = () => setPreviewOpen(true);
    window.addEventListener("open-page-preview", handler);
    return () => window.removeEventListener("open-page-preview", handler);
  }, []);

  // Handle quick actions dispatched by the command palette (either live via
  // custom event when already on /me, or via sessionStorage when navigating
  // from another route).
  const openPaletteAction = useCallback((action: string) => {
    if (action === "add-block") {
      setAddOpen(true);
    } else if (action === "add-booking") {
      setBookingFlowOpen(true);
    } else if (action === "add-form") {
      setEditingFormBlock(null);
      setFormBuilderOpen(true);
    } else if (action === "add-product") {
      setEditingProductBlock(null);
      setProductBuilderOpen(true);
    } else if (action === "add-text") {
      setEditingTextBlock(null);
      setTextDialogOpen(true);
    }
  }, []);

  useEffect(() => {
    // On mount: consume a pending action stored by the command palette when
    // it navigated here from another route.
    const pending = sessionStorage.getItem("kioar:pending-palette-action");
    if (pending) {
      sessionStorage.removeItem("kioar:pending-palette-action");
      openPaletteAction(pending);
    }
  }, [openPaletteAction]);

  useEffect(() => {
    // When already on /me: respond to the live custom event dispatched by
    // the command palette without a full navigation.
    const handler = (e: Event) => {
      const action = (e as CustomEvent<string>).detail;
      openPaletteAction(action);
    };
    window.addEventListener("cmd-palette-action", handler);
    return () => window.removeEventListener("cmd-palette-action", handler);
  }, [openPaletteAction]);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [editingLink, setEditingLink] = useState<EditableLink | null>(null);

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
          spotlight: link.spotlight,
          animationStyle: link.animationStyle,
        })),
      ),
    [links],
  );

  // Autosave links (debounced). We skip the save when *any* link in the
  // draft has an invalid URL — the user is mid-typing inline and the
  // server schema would reject the whole array. Without this the toast
  // spams "نشانی لینک معتبر نیست" on every keystroke and `lastSavedPayload`
  // never advances, leaving newly-added valid links unpersisted on refresh.
  const lastSavedPayload = useRef(linksPayload);
  const firstRun = useRef(true);
  const linksPayloadValid = useMemo(
    () => links.every((l) => isSafeLinkUrl((l.url ?? "").trim())),
    [links],
  );
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      lastSavedPayload.current = linksPayload;
      return;
    }
    if (lastSavedPayload.current === linksPayload) return;
    if (!linksPayloadValid) return;
    const timer = window.setTimeout(() => {
      lastSavedPayload.current = linksPayload;
      const fd = new FormData();
      fd.set("links", linksPayload);
      startLinksTransition(() => {
        linksFormAction(fd);
      });
    }, 500);
    return () => window.clearTimeout(timer);
  }, [linksPayload, linksPayloadValid, linksFormAction]);

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

  /* ---------- Unified blocks order (links + bookings + forms + products + text) ---------- */
  type BlockRef = {
    kind:
      | "link"
      | "booking"
      | "form"
      | "product"
      | "text"
      | "media"
      | "event";
    id: string;
  };

  function buildInitialOrder(): BlockRef[] {
    const all: Array<BlockRef & { sortOrder: number }> = [
      ...links.map((l, i) => ({
        kind: "link" as const,
        id: l.id,
        sortOrder: l.sortOrder ?? i,
      })),
      ...bookingBlocks.map((b, i) => ({
        kind: "booking" as const,
        id: b.id,
        // Public card uses 1_000_000+i for unsorted bookings; mirror that
        // to keep ordering deterministic until first reorder.
        sortOrder: b.sortOrder ?? 1_000_000 + i,
      })),
      ...formBlocks.map((f, i) => ({
        kind: "form" as const,
        id: f.id,
        sortOrder: f.sortOrder ?? 2_000_000 + i,
      })),
      ...productBlocks.map((p, i) => ({
        kind: "product" as const,
        id: p.id,
        sortOrder: p.sortOrder ?? 3_000_000 + i,
      })),
      ...textBlocks.map((t, i) => ({
        kind: "text" as const,
        id: t.id,
        sortOrder: t.sortOrder ?? 5_000_000 + i,
      })),
      ...mediaBlocks.map((m, i) => ({
        kind: "media" as const,
        id: m.id,
        sortOrder: m.sortOrder ?? 6_000_000 + i,
      })),
      ...eventBlocks.map((e, i) => ({
        kind: "event" as const,
        id: e.id,
        sortOrder: e.sortOrder ?? 7_000_000 + i,
      })),
    ];
    all.sort((a, b) => a.sortOrder - b.sortOrder);
    return all.map(({ kind, id }) => ({ kind, id }));
  }

  const [blocksOrder, setBlocksOrder] = useState<BlockRef[]>(buildInitialOrder);

  // Reconcile when underlying lists change (add / remove). Preserves the
  // existing relative order; new items are appended; deleted items drop.
  useEffect(() => {
    setBlocksOrder((current) => {
      const linkIds = new Set(links.map((l) => l.id));
      const bookingIds = new Set(bookingBlocks.map((b) => b.id));
      const formIds = new Set(formBlocks.map((f) => f.id));
      const productIds = new Set(productBlocks.map((p) => p.id));
      const textIds = new Set(textBlocks.map((t) => t.id));
      const mediaIds = new Set(mediaBlocks.map((m) => m.id));
      const eventIds = new Set(eventBlocks.map((e) => e.id));

      const seen = new Set<string>();
      const kept: BlockRef[] = [];
      for (const ref of current) {
        const owns =
          (ref.kind === "link" && linkIds.has(ref.id)) ||
          (ref.kind === "booking" && bookingIds.has(ref.id)) ||
          (ref.kind === "form" && formIds.has(ref.id)) ||
          (ref.kind === "product" && productIds.has(ref.id)) ||
          (ref.kind === "text" && textIds.has(ref.id)) ||
          (ref.kind === "media" && mediaIds.has(ref.id)) ||
          (ref.kind === "event" && eventIds.has(ref.id));
        if (owns) {
          kept.push(ref);
          seen.add(`${ref.kind}:${ref.id}`);
        }
      }
      const append = (kind: BlockRef["kind"], id: string) => {
        if (!seen.has(`${kind}:${id}`)) kept.push({ kind, id });
      };
      for (const l of links) append("link", l.id);
      for (const b of bookingBlocks) append("booking", b.id);
      for (const f of formBlocks) append("form", f.id);
      for (const p of productBlocks) append("product", p.id);
      for (const t of textBlocks) append("text", t.id);
      for (const m of mediaBlocks) append("media", m.id);
      for (const e of eventBlocks) append("event", e.id);
      return kept;
    });
  }, [
    links,
    bookingBlocks,
    formBlocks,
    productBlocks,
    textBlocks,
    mediaBlocks,
    eventBlocks,
  ]);

  // Persist global order (debounced). Skip on first run.
  const [, startReorderTransition] = useTransition();
  const lastSavedOrder = useRef<string>(JSON.stringify(buildInitialOrder()));
  const firstOrderRun = useRef(true);
  useEffect(() => {
    if (firstOrderRun.current) {
      firstOrderRun.current = false;
      lastSavedOrder.current = JSON.stringify(blocksOrder);
      return;
    }
    const serialized = JSON.stringify(blocksOrder);
    if (serialized === lastSavedOrder.current) return;
    const timer = window.setTimeout(() => {
      lastSavedOrder.current = serialized;
      const fd = new FormData();
      fd.set("items", serialized);
      startReorderTransition(() => {
        reorderBlocksAction({ status: "idle" }, fd).catch(() => {
          /* surfaced via toast below if needed */
        });
      });
    }, 500);
    return () => window.clearTimeout(timer);
  }, [blocksOrder, reorderBlocksAction]);

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setBlocksOrder((current) => {
      const oldIndex = current.findIndex((it) => itemKey(it) === active.id);
      const newIndex = current.findIndex((it) => itemKey(it) === over.id);
      if (oldIndex < 0 || newIndex < 0) return current;
      return arrayMove(current, oldIndex, newIndex);
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
    let becameEmpty = false;
    setLinks((current) => {
      const next = current
        .filter((item) => item.id !== id)
        .map((item, index) => ({ ...item, sortOrder: index }));
      if (next.length === 0) becameEmpty = true;
      return next;
    });
    if (editingLink?.id === id) setEditingLink(null);
    // After the state update is scheduled, reset the wizard draft if the list is now empty.
    if (becameEmpty) {
      clearActivationDraft(profile.id);
      setDraftExists(false);
      wizardResetDraftRef.current?.();
    }
  }

  // -------- Spotlight handler (links + bookings + forms + products + text) --------
  async function handleSpotlightChange(
    blockKind: "link" | "form" | "booking" | "product" | "text" | "media",
    blockId: string,
    next: {
      spotlight: import("@/lib/block-spotlight").BlockSpotlight;
      animationStyle:
        | import("@/lib/block-spotlight").BlockAnimationStyle
        | null;
    },
  ) {
    // Optimistic local update
    if (blockKind === "link") {
      setLinks((curr) =>
        curr.map((l) =>
          l.id === blockId
            ? {
                ...l,
                spotlight: next.spotlight,
                animationStyle: next.animationStyle,
              }
            : l,
        ),
      );
    } else if (blockKind === "booking") {
      setBookingBlocks((curr) =>
        curr.map((b) =>
          b.id === blockId
            ? {
                ...b,
                spotlight: next.spotlight,
                animationStyle: next.animationStyle,
              }
            : b,
        ),
      );
    } else if (blockKind === "product") {
      setProductBlocks((curr) =>
        curr.map((p) =>
          p.id === blockId
            ? {
                ...p,
                spotlight: next.spotlight,
                animationStyle: next.animationStyle,
              }
            : p,
        ),
      );
    } else if (blockKind === "text") {
      setTextBlocks((curr) =>
        curr.map((t) =>
          t.id === blockId
            ? {
                ...t,
                spotlight: next.spotlight,
                animationStyle: next.animationStyle,
              }
            : t,
        ),
      );
    } else if (blockKind === "media") {
      setMediaBlocks((curr) =>
        curr.map((m) =>
          m.id === blockId
            ? {
                ...m,
                spotlight: next.spotlight,
                animationStyle: next.animationStyle,
              }
            : m,
        ),
      );
    } else {
      setFormBlocks((curr) =>
        curr.map((f) =>
          f.id === blockId
            ? {
                ...f,
                spotlight: next.spotlight,
                animationStyle: next.animationStyle,
              }
            : f,
        ),
      );
    }
    const fd = new FormData();
    fd.set("blockKind", blockKind);
    fd.set("blockId", blockId);
    fd.set("spotlight", next.spotlight);
    if (next.animationStyle) fd.set("animationStyle", next.animationStyle);
    const result = await setBlockSpotlightAction(idleState, fd);
    if (result.status === "error") {
      toast.error(result.message ?? "ذخیره نشد.");
      router.refresh();
    } else {
      toast.success("ذخیره شد");
    }
  }

  // -------- Booking block handlers --------
  async function handleCreateBooking(draft: EditableBookingBlock) {
    setCreatingBooking(true);
    try {
      const fd = new FormData();
      fd.set(
        "payload",
        JSON.stringify({
          ...draft,
          spotlight: "none",
          animationStyle: null,
        }),
      );
      const result = await createBookingBlockAction(
        { status: "idle" as const },
        fd,
      );
      if (result.status === "error") {
        if (process.env.NODE_ENV !== "production" && result.fieldErrors) {
          console.error("[booking] field errors:", result.fieldErrors);
        }
        toast.error(result.message ?? "ساخت هماهنگ با خطا مواجه شد.");
        return;
      }
      toast.success("هماهنگ ساخته شد.");
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
      // Roll back the optimistic update by re-pulling server truth.
      router.refresh();
    } else {
      // Optimistic state already matches the server; no refetch needed.
      toast.success("ذخیره شد");
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
      // Block already removed from local state; no refetch needed.
      toast.success("حذف شد");
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

  // -------- Form block handlers --------
  async function handleSaveForm(draft: FormBlockDraft) {
    setSavingForm(true);
    try {
      const fd = new FormData();
      fd.set(
        "payload",
        JSON.stringify({
          name: draft.name,
          intro: draft.intro,
          outro: draft.outro,
          fields: draft.fields.map((f, idx) => ({
            id: f.id ?? null,
            kind: f.kind,
            label: f.label,
            required: f.required,
            options: f.options,
            sortOrder: idx,
          })),
        }),
      );
      if (editingFormBlock) {
        fd.set("blockId", editingFormBlock.id);
        const result = await updateFormBlockAction(idleState, fd);
        if (result.status === "error") {
          toast.error(result.message ?? "ذخیره نشد.");
          return;
        }
        toast.success("فرم به‌روز شد.");
      } else {
        const result = await createFormBlockAction(
          { status: "idle" as const },
          fd,
        );
        if (result.status === "error") {
          toast.error(result.message ?? "ساخت فرم با خطا مواجه شد.");
          return;
        }
        toast.success("فرم ساخته شد.");
      }
      setFormBuilderOpen(false);
      setEditingFormBlock(null);
      router.refresh();
    } finally {
      setSavingForm(false);
    }
  }

  async function handleDeleteFormBlock(id: string) {
    const prev = formBlocks;
    setFormBlocks((curr) => curr.filter((b) => b.id !== id));
    const fd = new FormData();
    fd.set("blockId", id);
    const result = await deleteFormBlockAction(idleState, fd);
    if (result.status === "error") {
      toast.error(result.message ?? "حذف نشد.");
      setFormBlocks(prev);
    } else {
      // Block already removed from local state; no refetch needed.
      toast.success("حذف شد");
    }
  }

  async function handleToggleFormActive(id: string, isActive: boolean) {
    setFormBlocks((curr) =>
      curr.map((b) => (b.id === id ? { ...b, isActive } : b)),
    );
    const fd = new FormData();
    fd.set("blockId", id);
    fd.set("isActive", String(isActive));
    const result = await toggleFormBlockActiveAction(idleState, fd);
    if (result.status === "error") {
      toast.error(result.message ?? "تغییر وضعیت ناموفق بود.");
      router.refresh();
    }
  }

  // -------- Product block handlers --------
  /** Unified auto-save: creates the block on first call (returns the new
   * id so the dialog can keep editing the same row) or updates the
   * existing block. Optimistic UI: closing the modal triggers a refresh
   * to pick up canonical server state. */
  async function handleAutoSaveProduct(
    payload: ProductBlockSubmit,
  ): Promise<{ id: string } | null> {
    const fd = new FormData();
    fd.set("payload", JSON.stringify(payload));
    if (payload.id) {
      fd.set("blockId", payload.id);
      const result = await updateProductBlockAction(idleState, fd);
      if (result.status === "error") {
        toast.error(result.message ?? "ذخیره نشد.");
        return null;
      }
      return { id: payload.id };
    }
    const result = await createProductBlockAction(
      { status: "idle" as const },
      fd,
    );
    if (result.status === "error" || !result.id) {
      toast.error(result.message ?? "ساخت بلوک با خطا مواجه شد.");
      return null;
    }
    toast.success("بلوک ساخته شد.");
    return { id: result.id };
  }

  async function handleDeleteProductBlock(id: string) {
    const prev = productBlocks;
    setProductBlocks((curr) => curr.filter((b) => b.id !== id));
    const fd = new FormData();
    fd.set("blockId", id);
    const result = await deleteProductBlockAction(idleState, fd);
    if (result.status === "error") {
      toast.error(result.message ?? "حذف نشد.");
      setProductBlocks(prev);
    } else {
      // Block already removed from local state; no refetch needed.
      toast.success("حذف شد");
    }
  }

  async function handleToggleProductActive(id: string, isActive: boolean) {
    setProductBlocks((curr) =>
      curr.map((b) => (b.id === id ? { ...b, isActive } : b)),
    );
    const fd = new FormData();
    fd.set("blockId", id);
    fd.set("isActive", String(isActive));
    const result = await toggleProductBlockActiveAction(idleState, fd);
    if (result.status === "error") {
      toast.error(result.message ?? "تغییر وضعیت ناموفق بود.");
      router.refresh();
    }
  }

  async function handleUploadProductImage(file: File): Promise<string | null> {
    const fd = new FormData();
    fd.set("file", file);
    const result = await uploadProductItemImageAction(
      { status: "idle" as const, url: null },
      fd,
    );
    if (result.status === "error" || !result.url) {
      toast.error(result.message ?? "آپلود ناموفق بود.");
      return null;
    }
    return result.url;
  }

  // -------- Text block handlers --------
  async function handleSaveText(draft: TextBlockDraft) {
    setSavingText(true);
    try {
      const payload = {
        title: draft.title,
        iconKey: draft.iconKey,
        iconUrl: draft.iconUrl,
        body: draft.body,
        photoUrl: draft.photoUrl,
        // Preserve spotlight/animation on edit; default to none on create.
        spotlight: editingTextBlock?.spotlight ?? "none",
        animationStyle: editingTextBlock?.animationStyle ?? null,
      };
      const fd = new FormData();
      fd.set("payload", JSON.stringify(payload));
      if (draft.id) {
        fd.set("blockId", draft.id);
        const result = await updateTextBlockAction(idleState, fd);
        if (result.status === "error") {
          toast.error(result.message ?? "ذخیره نشد.");
          return;
        }
        toast.success("ذخیره شد.");
      } else {
        const result = await createTextBlockAction(
          { status: "idle" as const },
          fd,
        );
        if (result.status === "error" || !result.id) {
          toast.error(result.message ?? "ساخت بلوک با خطا مواجه شد.");
          return;
        }
        toast.success("بلوک متن ساخته شد.");
      }
      setTextDialogOpen(false);
      setEditingTextBlock(null);
      router.refresh();
    } finally {
      setSavingText(false);
    }
  }

  async function handleDeleteTextBlock(id: string) {
    const prev = textBlocks;
    setTextBlocks((curr) => curr.filter((b) => b.id !== id));
    const fd = new FormData();
    fd.set("blockId", id);
    const result = await deleteTextBlockAction(idleState, fd);
    if (result.status === "error") {
      toast.error(result.message ?? "حذف نشد.");
      setTextBlocks(prev);
    } else {
      toast.success("حذف شد");
    }
  }

  async function handleToggleTextActive(id: string, isActive: boolean) {
    setTextBlocks((curr) =>
      curr.map((b) => (b.id === id ? { ...b, isActive } : b)),
    );
    const fd = new FormData();
    fd.set("blockId", id);
    fd.set("isActive", String(isActive));
    const result = await toggleTextBlockActiveAction(idleState, fd);
    if (result.status === "error") {
      toast.error(result.message ?? "تغییر وضعیت ناموفق بود.");
      router.refresh();
    }
  }

  /* ---------- Media block handlers ---------- */

  async function handleUploadMediaImage(
    file: File,
  ): Promise<{ url: string; byteSize: number } | null> {
    const fd = new FormData();
    fd.set("file", file);
    const result = await uploadMediaImageAction(
      { status: "idle" as const, url: null },
      fd,
    );
    if (result.status === "error" || !result.url) {
      toast.error(result.message ?? "آپلود ناموفق بود.");
      return null;
    }
    return { url: result.url, byteSize: result.byteSize ?? file.size };
  }

  async function handleUploadMediaFile(
    file: File,
    kind: "video" | "file",
  ): Promise<{ url: string; byteSize: number; mime: string | null } | null> {
    const fd = new FormData();
    fd.set("file", file);
    fd.set("kind", kind);
    const result = await uploadMediaFileAction(
      { status: "idle" as const, url: null },
      fd,
    );
    if (result.status === "error" || !result.url) {
      toast.error(result.message ?? "آپلود ناموفق بود.");
      return null;
    }
    return {
      url: result.url,
      byteSize: result.byteSize ?? file.size,
      mime: kind === "video" ? "video/mp4" : "application/pdf",
    };
  }

  async function handleSaveMedia(draft: MediaBlockDraft) {
    setSavingMedia(true);
    setMediaError(null);
    try {
      const payload = {
        mode: draft.mode,
        preset: draft.preset,
        name: draft.name,
        caption: draft.caption,
        videoUrl: draft.videoUrl,
        items: draft.items,
        // Preserve spotlight/animation on edit; default to none on create.
        spotlight: editingMediaBlock?.spotlight ?? "none",
        animationStyle: editingMediaBlock?.animationStyle ?? null,
      };
      const fd = new FormData();
      fd.set("payload", JSON.stringify(payload));
      if (draft.id) {
        fd.set("blockId", draft.id);
        const result = await updateMediaBlockAction(idleState, fd);
        if (result.status === "error") {
          setMediaError(result.message ?? "ذخیره نشد.");
          return;
        }
        toast.success("ذخیره شد.");
      } else {
        const result = await createMediaBlockAction(
          { status: "idle" as const },
          fd,
        );
        if (result.status === "error" || !result.id) {
          setMediaError(result.message ?? "ساخت بلوک با خطا مواجه شد.");
          return;
        }
        toast.success("بلوک مدیا ساخته شد.");
      }
      setMediaDialogOpen(false);
      setEditingMediaBlock(null);
      router.refresh();
    } finally {
      setSavingMedia(false);
    }
  }

  async function handleDeleteMediaBlock(id: string) {
    const prev = mediaBlocks;
    setMediaBlocks((curr) => curr.filter((b) => b.id !== id));
    const fd = new FormData();
    fd.set("blockId", id);
    const result = await deleteMediaBlockAction(idleState, fd);
    if (result.status === "error") {
      toast.error(result.message ?? "حذف نشد.");
      setMediaBlocks(prev);
    } else {
      toast.success("حذف شد");
    }
  }

  async function handleToggleMediaActive(id: string, isActive: boolean) {
    setMediaBlocks((curr) =>
      curr.map((b) => (b.id === id ? { ...b, isActive } : b)),
    );
    const fd = new FormData();
    fd.set("blockId", id);
    fd.set("isActive", String(isActive));
    const result = await toggleMediaBlockActiveAction(idleState, fd);
    if (result.status === "error") {
      toast.error(result.message ?? "تغییر وضعیت ناموفق بود.");
      router.refresh();
    }
  }

  /* ---------- Event block handlers ---------- */

  function handleOpenNewEvent() {
    setEditingEventInitial(null);
    setEventBuilderOpen(true);
  }

  function handleEditEvent(id: string) {
    // Full form data is preloaded server-side keyed by event id. If it's
    // missing (e.g. created this session before a refresh), fall back to a
    // refresh so the next open has it.
    const initial = eventFormInitials?.[id] ?? null;
    if (!initial) {
      router.refresh();
      return;
    }
    setEditingEventInitial(initial);
    setEventBuilderOpen(true);
  }

  function handleEventSaved() {
    setEventBuilderOpen(false);
    setEditingEventInitial(null);
    // The action revalidated /me; pull the fresh server props so the new /
    // edited event appears as a row with its real id + counts.
    router.refresh();
  }

  async function handleDeleteEvent(id: string) {
    const prev = eventBlocks;
    setEventBlocks((curr) => curr.filter((b) => b.id !== id));
    const fd = new FormData();
    fd.set("eventId", id);
    const result = await deleteEventBlockAction(idleState, fd);
    if (result.status === "error") {
      toast.error(result.message ?? "حذف نشد.");
      setEventBlocks(prev);
    } else {
      toast.success("رویداد حذف شد");
    }
  }

  async function handleToggleEventActive(id: string, isActive: boolean) {
    setEventBlocks((curr) =>
      curr.map((b) => (b.id === id ? { ...b, isActive } : b)),
    );
    const fd = new FormData();
    fd.set("eventId", id);
    fd.set("isActive", String(isActive));
    const result = await toggleEventBlockActiveAction(idleState, fd);
    if (result.status === "error") {
      toast.error(result.message ?? "تغییر وضعیت ناموفق بود.");
      router.refresh();
    }
  }

  async function handleUploadTextImage(file: File): Promise<string | null> {
    const fd = new FormData();
    fd.set("file", file);
    const result = await uploadTextBlockImageAction(
      { status: "idle" as const, url: null },
      fd,
    );
    if (result.status === "error" || !result.url) {
      toast.error(result.message ?? "آپلود ناموفق بود.");
      return null;
    }
    return result.url;
  }

  async function handleAvatarSave(file: File) {
    const fd = new FormData();
    fd.set("avatar", file);
    const result = await autosaveAvatarAction(idleState, fd);
    if (result.status === "error") {
      toast.error(result.message ?? "آپلود نشد.");
      return { ok: false as const };
    }
    const newUrl = result.values?.avatarUrl ?? null;
    if (newUrl) {
      setProfile((p) => ({ ...p, avatarUrl: newUrl }));
    }
    // Optimistic profile update already reflects the server; no refetch.
    return { ok: true as const };
  }

  async function handleAvatarDelete() {
    const result = await deleteAvatarAction(idleState, new FormData());
    if (result.status === "error") {
      toast.error(result.message ?? "حذف نشد.");
      return { ok: false as const };
    }
    setProfile((p) => ({ ...p, avatarUrl: null }));
    // Optimistic profile update already reflects the server; no refetch.
    return { ok: true as const };
  }

  async function handleAvatarPickSeed(seed: string) {
    const fd = new FormData();
    fd.set("seed", seed);
    const result = await saveAvatarSeedAction(idleState, fd);
    if (result.status === "error") {
      toast.error(result.message ?? "ذخیره نشد.");
      return { ok: false as const };
    }
    // Picking a seed clears any uploaded photo on the server; mirror that
    // optimistically so the editor avatar swaps immediately.
    setProfile((p) => ({ ...p, avatarSeed: seed, avatarUrl: null }));
    // Optimistic profile update already reflects the server; no refetch.
    return { ok: true as const };
  }

  async function handleSettingsSave(
    next: PageSettingsValues & {
      ogImageFile?: File | null;
      ogImageRemove?: boolean;
    },
  ) {
    const fd = new FormData();
    fd.set("fullName", next.fullName);
    fd.set("title", next.title);
    fd.set("bio", next.bio);
    fd.set("slug", next.slug);
    fd.set("domain", next.domain);
    fd.set("seoTitle", next.seoTitle);
    fd.set("seoDescription", next.seoDescription);
    fd.set("indexEnabled", next.indexEnabled ? "on" : "off");
    fd.set("appIconKey", next.appIconKey ?? "");
    fd.set("appIconColor", next.appIconColor ?? "");
    fd.set("discoverEnabled", next.discoverEnabled ? "on" : "off");
    fd.set("discoverCategory", next.discoverCategory ?? "");
    fd.set("city", next.city ?? "");
    fd.set("pageType", next.pageType ?? "");
    fd.set("publicPhone", next.publicPhone ?? "");
    fd.set("showPublicPhone", next.showPublicPhone ? "on" : "off");
    fd.set("email", next.email ?? "");
    fd.set("showPublicEmail", next.showPublicEmail ? "on" : "off");
    if (next.ogImageRemove) fd.set("ogImageRemove", "1");
    if (next.ogImageFile) fd.set("ogImage", next.ogImageFile);

    const result = await savePageSettingsAction(idleState, fd);
    if (result.status === "error") {
      toast.error(result.message ?? "ذخیره نشد.");
      return { ok: false as const, fieldErrors: result.fieldErrors };
    }

    setProfile((p) => ({
      ...p,
      fullName: next.fullName,
      title: next.title,
      bio: next.bio,
      slug: next.slug,
      domain: next.domain,
      seoTitle: next.seoTitle,
      seoDescription: next.seoDescription,
      ogImageUrl: next.ogImageRemove
        ? null
        : next.ogImageFile
          ? result.values?.ogImageUrl || p.ogImageUrl // use server-returned S3 URL
          : p.ogImageUrl,
      indexEnabled: next.indexEnabled,
      appIconKey: next.appIconKey,
      appIconColor: next.appIconColor,
      discoverEnabled: next.discoverEnabled,
      discoverCategory: next.discoverCategory,
      city: next.city,
      pageType: next.pageType,
      publicPhone: next.publicPhone,
      showPublicPhone: next.showPublicPhone,
      email: next.email,
      showPublicEmail: next.showPublicEmail,
    }));
    // Optimistic profile update already reflects the server (including the
    // returned OG image URL); no refetch needed.
    return { ok: true as const };
  }

  const canAdd = true;
  // The activation CTA is visible only when the user has zero blocks/links.
  const hasAnyBlocks = blocksOrder.length > 0 || links.length > 0;
  // Captured once on mount so the preview's "upcoming" filter stays pure
  // across renders (calling Date.now() during render is non-idempotent).
  const [previewNowMs] = useState(() => Date.now());
  const previewAppearance = {
    ...coerceAppearance(profile.appearance),
    wallpaper: { type: "fill" as const, color: "var(--card)" },
  };

  // Build a sortOrder map from blocksOrder so the live preview reflects
  // drag-reorder immediately (without waiting for the server round-trip).
  const liveOrderMap = useMemo(() => {
    const m = new Map<string, number>();
    blocksOrder.forEach((ref, i) => m.set(`${ref.kind}:${ref.id}`, i));
    return m;
  }, [blocksOrder]);

  const previewProfile = useMemo(() => ({
    fullName: profile.fullName,
    title: profile.title,
    bio: profile.bio,
    slug: profile.slug,
    publicPhone: profile.showPublicPhone ? profile.publicPhone : null,
    email: profile.showPublicEmail ? profile.email : null,
    avatarUrl: profile.avatarUrl,
    avatarSeed: profile.avatarSeed,
    links: links
      .filter((l) => l.isActive)
      .map((l) => ({
        id: l.id,
        label: l.label || "بدون عنوان",
        iconKey: l.iconKey,
        iconUrl: l.iconUrl,
        url: l.url,
        description: l.description,
        imageUrl: l.imageUrl,
        sortOrder: liveOrderMap.get(`link:${l.id}`) ?? l.sortOrder,
      })),
    bookingBlocks: bookingBlocks
      .filter((b) => b.isActive)
      .map((b) => ({
        id: b.id,
        name: b.name,
        description: b.description,
        avatarUrl: b.avatarUrl,
        locationType: b.locationType,
        locationAddress: b.locationAddress,
        meetingLink: b.meetingLink,
        timezone: b.timezone,
        sortOrder: liveOrderMap.get(`booking:${b.id}`) ?? b.sortOrder,
        types: b.types.map((t) => ({
          id: t.id ?? "",
          title: t.title,
          durationMin: t.durationMin,
          priceAmount: t.priceAmount,
          priceCurrency: t.priceCurrency,
        })),
      })),
    formBlocks: formBlocks
      .filter((f) => f.isActive)
      .map((f) => ({
        id: f.id,
        name: f.name,
        intro: f.intro,
        outro: f.outro,
        sortOrder: liveOrderMap.get(`form:${f.id}`) ?? f.sortOrder,
        fields: f.fields.map((field) => ({
          id: field.id ?? "",
          kind: field.kind,
          label: field.label,
          required: field.required,
          options: field.options ?? [],
        })),
      })),
    productBlocks: productBlocks
      .filter((p) => p.isActive)
      .map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        preset: p.preset,
        slug: p.slug ?? null,
        layout: p.layout,
        itemLabel: p.itemLabel,
        currency: p.currency,
        showPrices: p.showPrices,
        displayMode: p.displayMode,
        pillLabel: p.pillLabel,
        iconKey: p.iconKey ?? null,
        iconUrl: p.iconUrl ?? null,
        imageUrl: p.imageUrl ?? null,
        sortOrder: liveOrderMap.get(`product:${p.id}`) ?? p.sortOrder,
        sections: p.sections.map((s) => ({
          id: s.id ?? "",
          title: s.title,
          iconKey: s.iconKey ?? null,
        })),
        items: p.items.map((it) => ({
          id: it.id ?? "",
          sectionId: null,
          title: it.title,
          description: it.description,
          imageUrl: it.imageUrl,
          priceType: it.priceType,
          priceAmount: 0,
          priceAmountMax: null,
          availability: it.availability,
          isFeatured: it.isFeatured,
          externalUrl: it.externalUrl,
          badge: it.badge,
          sku: it.sku,
        })),
      })),
    textBlocks: textBlocks
      .filter((t) => t.isActive)
      .map((t) => ({
        id: t.id,
        title: t.title,
        iconKey: t.iconKey,
        iconUrl: t.iconUrl,
        body: t.body,
        photoUrl: t.photoUrl,
        sortOrder: liveOrderMap.get(`text:${t.id}`) ?? t.sortOrder,
        spotlight: t.spotlight,
        animationStyle: t.animationStyle,
      })),
    mediaBlocks: mediaBlocks
      .filter((m) => m.isActive && (m.items.length > 0 || Boolean(m.videoUrl)))
      .map((m) => ({
        id: m.id,
        mode: m.mode,
        name: m.name,
        caption: m.caption,
        videoUrl: m.videoUrl,
        items: m.items.map((it) => ({
          id: it.id ?? it.url,
          kind: it.kind,
          url: it.url,
          byteSize: it.byteSize,
          mime: it.mime,
          displayName: it.displayName,
          thumbnailUrl: it.thumbnailUrl,
          aspectRatioW: it.aspectRatioW ?? null,
          aspectRatioH: it.aspectRatioH ?? null,
          cropX: it.cropX ?? null,
          cropY: it.cropY ?? null,
          cropW: it.cropW ?? null,
          cropH: it.cropH ?? null,
        })),
        sortOrder: liveOrderMap.get(`media:${m.id}`) ?? m.sortOrder,
        spotlight: m.spotlight,
        animationStyle: m.animationStyle,
      })),
    // Preview mirrors the public renderer: only published + active +
    // upcoming events appear. Price fields aren't carried on the editor row,
    // so the preview card shows them as free/0 — accurate enough for layout
    // (the real public page reads the full row).
    eventBlocks: eventBlocks
      .filter(
        (e) =>
          e.isActive &&
          e.status === "published" &&
          new Date(e.endsAt ?? e.startsAt).getTime() >= previewNowMs,
      )
      .map((e) => ({
        id: e.id,
        slug: e.slug,
        pageSlug: profile.slug,
        title: e.title,
        coverUrl: e.coverUrl,
        locationType: "physical" as const,
        priceType: "free" as const,
        priceToman: 0,
        startsAt: e.startsAt,
        endsAt: e.endsAt,
        timezone: e.timezone,
        spotsRemaining: null,
        isFull: false,
        sortOrder: liveOrderMap.get(`event:${e.id}`) ?? e.sortOrder,
        spotlight: e.spotlight,
        animationStyle: e.animationStyle,
      })),
  }), [profile, links, bookingBlocks, formBlocks, productBlocks, textBlocks, mediaBlocks, eventBlocks, liveOrderMap, previewNowMs]);

  return (
    <div className="grid w-full min-w-0 min-h-[calc(100dvh-var(--header-h,4rem))] lg:grid-cols-[minmax(0,1fr)_minmax(340px,420px)]">
      {/* Editor column */}
      <div className="min-w-0 border-b lg:border-b-0 lg:border-e">
        <div className="section-shell space-y-6 py-6">
          {/* Mobile: profile summary card removed — page identity now
              lives in the dashboard header (page switcher) and page
              settings open via the gear button on the header. */}

          {/* ─────────────────────────────────────────────────────────
              DESKTOP — action row only.
              The avatar + name was deliberately removed: on desktop the
              live preview (right panel) already shows the page header,
              so duplicating the avatar above the editor was redundant.
              The two buttons share size/padding/typography; only color
              differs. "ویرایش" keeps its natural width, "+ افزودن بلاک"
              fills the rest with `flex-1`.
             ────────────────────────────────────────────────────────── */}
          {/* ── Mobile action buttons — stacked with no gap between them ── */}
          <div className="flex flex-col gap-2 lg:hidden">
            {!hasAnyBlocks && (
              <Button
                type="button"
                onClick={() => setWizardOpen(true)}
                className="h-12 w-full gap-2 rounded-full text-sm font-bold"
                style={{
                  backgroundColor: "var(--brand)",
                  color: "var(--brand-foreground)",
                }}
              >
                <SparklesIcon className="size-4" />
                {draftExists ? "ادامه ساخت صفحه" : "شروع ساخت صفحه"}
              </Button>
            )}
            <Button
              type="button"
              onClick={() => setAddOpen(true)}
              disabled={!canAdd}
              className={hasAnyBlocks ? "h-12 w-full rounded-full text-sm font-bold" : "h-12 rounded-full px-6 text-sm font-bold"}
              variant={!hasAnyBlocks ? "outline" : "default"}
            >
              <PlusIcon className="size-4" />
              افزودن بلوک
            </Button>
          </div>

          {/* Desktop action row */}
          <section className="hidden lg:block">
            <div className="flex items-stretch gap-2">
              {!hasAnyBlocks && (
                <Button
                  type="button"
                  onClick={() => setWizardOpen(true)}
                  className="h-12 flex-1 gap-1.5 rounded-full text-sm font-bold"
                  style={{
                    backgroundColor: "var(--brand)",
                    color: "var(--brand-foreground)",
                  }}
                >
                  <SparklesIcon className="size-4" />
                  {draftExists ? "ادامه ساخت صفحه" : "شروع ساخت صفحه"}
                </Button>
              )}
              <Button
                type="button"
                onClick={() => setAddOpen(true)}
                disabled={!canAdd}
                className={hasAnyBlocks ? "h-12 flex-1 gap-1.5 rounded-full text-sm font-bold" : "h-12 gap-1.5 rounded-full px-6 text-sm font-bold"}
                variant={hasAnyBlocks ? "default" : "outline"}
              >
                <PlusIcon className="size-4" />
                افزودن بلوک
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setSettingsOpen(true)}
                className="h-12 gap-1.5 rounded-full px-5 text-sm font-bold"
              >
                <PencilIcon className="size-4" />
                تنظیمات صفحه
              </Button>
              <CustomizeButton />
            </div>
          </section>

          {/* Unified blocks list (links + bookings + forms in one order) */}
          {blocksOrder.length ? (
            <DndContext
              id="dashboard-blocks-dnd"
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={blocksOrder.map(itemKey)}
                strategy={verticalListSortingStrategy}
              >
                <ul className="space-y-2.5">
                  {blocksOrder.map((ref) => {
                    if (ref.kind === "link") {
                      const link = links.find((l) => l.id === ref.id);
                      if (!link) return null;
                      return (
                        <SortableLinkBlock
                          key={itemKey(ref)}
                          itemId={itemKey(ref)}
                          link={link}
                          clickCount={linkClickCounts[link.id] ?? 0}
                          onEdit={() => setEditingLink(link)}
                          onRemove={() => removeLink(link.id)}
                          onChange={(patch) => updateLink(link.id, patch)}
                          pinAllowed={pinAllowed}
                          animateAllowed={animateAllowed}
                          onSpotlightChange={(next) =>
                            handleSpotlightChange("link", link.id, next)
                          }
                        />
                      );
                    }
                    if (ref.kind === "booking") {
                      const block = bookingBlocks.find((b) => b.id === ref.id);
                      if (!block) return null;
                      return (
                        <SortableBookingBlock
                          key={itemKey(ref)}
                          itemId={itemKey(ref)}
                          block={block}
                          onUpdate={handleUpdateBooking}
                          onDelete={() => handleDeleteBooking(block.id)}
                          onToggleActive={(v) =>
                            handleToggleBookingActive(block.id, v)
                          }
                          locked={bookingsLocked}
                          lockedPlan={bookingsRequiredPlan}
                          pinAllowed={pinAllowed}
                          animateAllowed={animateAllowed}
                          onSpotlightChange={(next) =>
                            handleSpotlightChange("booking", block.id, next)
                          }
                        />
                      );
                    }
                    if (ref.kind === "form") {
                      const block = formBlocks.find((f) => f.id === ref.id);
                      if (!block) return null;
                      return (
                        <SortableFormBlock
                          key={itemKey(ref)}
                          itemId={itemKey(ref)}
                          block={block}
                          submissionsCount={block.submissionsCount}
                          onEdit={() => {
                            setEditingFormBlock(block);
                            setFormBuilderOpen(true);
                          }}
                          onDelete={() => handleDeleteFormBlock(block.id)}
                          onToggleActive={(v) =>
                            handleToggleFormActive(block.id, v)
                          }
                          locked={formsLocked}
                          lockedPlan={formsRequiredPlan}
                          pinAllowed={pinAllowed}
                          animateAllowed={animateAllowed}
                          onSpotlightChange={(next) =>
                            handleSpotlightChange("form", block.id, next)
                          }
                        />
                      );
                    }
                    if (ref.kind === "product") {
                      const product = productBlocks.find(
                        (p) => p.id === ref.id,
                      );
                      if (!product) return null;
                      return (
                        <SortableProductBlock
                          key={itemKey(ref)}
                          itemId={itemKey(ref)}
                          block={product}
                          onEdit={() => {
                            setEditingProductBlock(product);
                            setProductBuilderOpen(true);
                          }}
                          onDelete={() => handleDeleteProductBlock(product.id)}
                          onToggleActive={(v) =>
                            handleToggleProductActive(product.id, v)
                          }
                          locked={productsLocked}
                          lockedPlan={productsRequiredPlan}
                          pinAllowed={pinAllowed}
                          animateAllowed={animateAllowed}
                          onSpotlightChange={(next) =>
                            handleSpotlightChange("product", product.id, next)
                          }
                        />
                      );
                    }
                    if (ref.kind === "text") {
                      const text = textBlocks.find((t) => t.id === ref.id);
                      if (!text) return null;
                      return (
                        <SortableTextBlock
                          key={itemKey(ref)}
                          itemId={itemKey(ref)}
                          block={text}
                          onEdit={() => {
                            setEditingTextBlock(text);
                            setTextDialogOpen(true);
                          }}
                          onDelete={() => handleDeleteTextBlock(text.id)}
                          onToggleActive={(v) =>
                            handleToggleTextActive(text.id, v)
                          }
                          locked={textLocked}
                          lockedPlan={textRequiredPlan}
                          pinAllowed={pinAllowed}
                          animateAllowed={animateAllowed}
                          onSpotlightChange={(next) =>
                            handleSpotlightChange("text", text.id, next)
                          }
                        />
                      );
                    }
                    if (ref.kind === "media") {
                      const media = mediaBlocks.find((m) => m.id === ref.id);
                      if (!media) return null;
                      return (
                        <SortableMediaBlock
                          key={itemKey(ref)}
                          itemId={itemKey(ref)}
                          block={media}
                          onEdit={() => {
                            setEditingMediaBlock(media);
                            setMediaCopy(undefined);
                            setMediaDialogOpen(true);
                          }}
                          onDelete={() => handleDeleteMediaBlock(media.id)}
                          onToggleActive={(v) =>
                            handleToggleMediaActive(media.id, v)
                          }
                          locked={mediaLocked}
                          lockedPlan={mediaRequiredPlan}
                          pinAllowed={pinAllowed}
                          animateAllowed={animateAllowed}
                          onSpotlightChange={(next) =>
                            handleSpotlightChange("media", media.id, next)
                          }
                        />
                      );
                    }
                    const eventBlock = eventBlocks.find(
                      (e) => e.id === ref.id,
                    );
                    if (!eventBlock) return null;
                    return (
                      <SortableEventBlock
                        key={itemKey(ref)}
                        itemId={itemKey(ref)}
                        block={eventBlock}
                        onEdit={() => handleEditEvent(eventBlock.id)}
                        onDelete={() => handleDeleteEvent(eventBlock.id)}
                        onToggleActive={(v) =>
                          handleToggleEventActive(eventBlock.id, v)
                        }
                        locked={eventsLocked}
                        lockedPlan={eventsRequiredPlan}
                      />
                    );
                  })}
                </ul>
              </SortableContext>
            </DndContext>
          ) : (
            <button
              type="button"
              onClick={() => setWizardOpen(true)}
              className="flex w-full flex-col items-center gap-2 rounded-4xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground transition-colors hover:border-primary hover:bg-primary/5"
            >
              <SparklesIcon className="size-5 text-primary" />
              اولین بلوک خود را اضافه کنید.
            </button>
          )}

          {linksState.status === "success" ? (
            <p className="flex items-center justify-center">
              <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-1 text-[11px] font-medium text-muted-foreground">
                <Check className="size-3" />
                ذخیره شد
              </span>
            </p>
          ) : null}
        </div>
      </div>

      {/* Desktop preview column */}
      <aside className="hidden lg:sticky lg:top-0 lg:flex lg:h-[calc(100dvh-var(--promo-bar-height,0)-4rem)] lg:flex-col bg-sidebar-accent/30">
        {/* Share pill — centered above the phone mockup */}
        <div className="shrink-0 flex justify-center px-6 pt-6 pb-6">
          <PublicShareBar
            publicUrl={publicUrl}
            slug={profile.slug}
            displayName={profile.fullName || "کارت"}
            host={`${profile.domain}/${profile.slug}`}
            pageId={profile.id}
            canCustomizeQr={canCustomizeQr}
            savedQrStyle={savedQrStyle}
            saveQrStyleAction={saveQrStyleAction}
            variant="pill"
            className="w-auto max-w-none"
          />
        </div>
        <div className="flex min-h-0 flex-1 flex-col items-center overflow-hidden px-6 pb-6">
          {/* Phone frame — fills remaining column height (flex-1 in a flex-col
              parent is cross-browser reliable; h-full against items-stretch
              breaks in WebKit). translateZ(0) makes it the containing block
              for position:fixed portaled modals. */}
          <PhoneMockupFrame>
            <PageThemeProvider appearance={previewAppearance} className="h-full" preview>
              <ProfilePreviewMock
                profile={previewProfile}
                formSubmitAction={publicSubmitFormAction}
              />
            </PageThemeProvider>
          </PhoneMockupFrame>
        </div>
      </aside>

      {/* Floating mobile share/preview bar was removed — these
          actions now live in the dashboard header (see
          `MeHeaderActions`) so they don't crowd the viewport above
          the bottom nav. */}

      {/* Mobile Preview sheet — renders the REAL public profile card. */}
      <Sheet open={previewOpen} onOpenChange={setPreviewOpen}>
        <SheetContent
          side="bottom"
          className="h-[90dvh] rounded-t-[2rem] bg-background p-0"
        >
          <SheetHeader className="shrink-0 border-b px-4 pt-4 pb-4 text-center">
            <SheetTitle className="text-center">پیش‌نمایش زنده</SheetTitle>
          </SheetHeader>
          <div className="min-h-0 flex-1 overflow-y-auto">
            <PageThemeProvider appearance={previewAppearance} preview>
              <ProfilePreviewMock
                profile={previewProfile}
                formSubmitAction={publicSubmitFormAction}
              />
            </PageThemeProvider>
          </div>
        </SheetContent>
      </Sheet>

      <EditLinkDialog
        open={editingLink !== null}
        onOpenChange={(o) => { if (!o) setEditingLink(null); }}
        link={editingLink}
        fetchMetadataAction={fetchMetadataAction}
        onSubmit={(patch) => {
          if (editingLink) updateLink(editingLink.id, patch);
        }}
      />

      <AddLinkDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onSubmit={addLink}
        fetchMetadataAction={fetchMetadataAction}
        onAddBooking={() => {
          setAddOpen(false);
          setBookingFlowOpen(true);
        }}
        onAddForm={() => {
          setAddOpen(false);
          setEditingFormBlock(null);
          setFormBuilderOpen(true);
        }}
        onAddProduct={(preset) => {
          setAddOpen(false);
          setEditingProductBlock(null);
          setProductBuilderPreset(preset);
          setProductBuilderFromAdd(true);
          setProductBuilderOpen(true);
        }}
        onAddEvent={() => {
          setAddOpen(false);
          // Events are created inline like every other block. Registration
          // management + QR check-in still live on /my-events (opened from the
          // event row's manage action), but creation happens right here.
          handleOpenNewEvent();
        }}
        onAddText={() => {
          setAddOpen(false);
          setEditingTextBlock(null);
          setTextDialogOpen(true);
        }}
        onAddMedia={(config) => {
          setAddOpen(false);
          setEditingMediaBlock(null);
          setMediaNewMode(config.mode);
          setMediaNewPreset(config.preset);
          setMediaCopy(config.copy);
          setMediaError(null);
          setMediaDialogOpen(true);
        }}
        bookingsLocked={bookingsLocked}
        bookingsRequiredPlan={bookingsRequiredPlan}
        formsLocked={formsLocked}
        formsRequiredPlan={formsRequiredPlan}
        productsLocked={productsLocked}
        productsRequiredPlan={productsRequiredPlan}
        eventsLocked={eventsLocked}
        eventsRequiredPlan={eventsRequiredPlan}
        textLocked={textLocked}
        textRequiredPlan={textRequiredPlan}
        mediaLocked={mediaLocked}
        mediaRequiredPlan={mediaRequiredPlan}
      />

      <TextBlockDialog
        open={textDialogOpen}
        onOpenChange={(o) => {
          setTextDialogOpen(o);
          if (!o) setEditingTextBlock(null);
        }}
        onBack={
          editingTextBlock === null
            ? () => {
                setTextDialogOpen(false);
                setAddOpen(true);
              }
            : undefined
        }
        initial={
          editingTextBlock
            ? {
                id: editingTextBlock.id,
                title: editingTextBlock.title,
                iconKey: editingTextBlock.iconKey,
                iconUrl: editingTextBlock.iconUrl,
                body: editingTextBlock.body,
                photoUrl: editingTextBlock.photoUrl,
              }
            : null
        }
        onSubmit={handleSaveText}
        onUploadImage={handleUploadTextImage}
        submitting={savingText}
      />

      <MediaBuilderDialog
        open={mediaDialogOpen}
        onOpenChange={(o) => {
          setMediaDialogOpen(o);
          if (!o) {
            setEditingMediaBlock(null);
            setMediaError(null);
          }
        }}
        onBack={
          editingMediaBlock === null
            ? () => {
                setMediaDialogOpen(false);
                setMediaError(null);
                setAddOpen(true);
              }
            : undefined
        }
        mode={editingMediaBlock?.mode ?? mediaNewMode}
        preset={editingMediaBlock?.preset ?? mediaNewPreset}
        copy={mediaCopy}
        initial={
          editingMediaBlock
            ? {
                id: editingMediaBlock.id,
                mode: editingMediaBlock.mode,
                preset: editingMediaBlock.preset,
                name: editingMediaBlock.name,
                caption: editingMediaBlock.caption,
                videoUrl: editingMediaBlock.videoUrl,
                items: editingMediaBlock.items,
              }
            : null
        }
        onSubmit={handleSaveMedia}
        onUploadImage={handleUploadMediaImage}
        onUploadFile={handleUploadMediaFile}
        submitting={savingMedia}
        errorMessage={mediaError}
      />

      <EventBuilderDialog
        open={eventBuilderOpen}
        onOpenChange={(o) => {
          setEventBuilderOpen(o);
          if (!o) setEditingEventInitial(null);
        }}
        pageId={profile.id}
        initial={editingEventInitial}
        saveAction={saveEventBlockAction}
        onSaved={handleEventSaved}
        onBack={() => {
          setEventBuilderOpen(false);
          setEditingEventInitial(null);
          setAddOpen(true);
        }}
      />

      <FormBuilderDialog
        open={formBuilderOpen}
        onOpenChange={(o) => {
          setFormBuilderOpen(o);
          if (!o) setEditingFormBlock(null);
        }}
        onBack={
          editingFormBlock === null
            ? () => {
                setFormBuilderOpen(false);
                setAddOpen(true);
              }
            : undefined
        }
        initial={
          editingFormBlock
            ? {
                id: editingFormBlock.id,
                name: editingFormBlock.name,
                intro: editingFormBlock.intro,
                outro: editingFormBlock.outro,
                fields: editingFormBlock.fields.map((f) => ({
                  id: f.id ?? null,
                  kind: f.kind,
                  label: f.label,
                  required: f.required,
                  options: f.options,
                })),
              }
            : null
        }
        onSubmit={handleSaveForm}
        submitting={savingForm}
      />

      <ProductBuilderDialog
        open={productBuilderOpen}
        onOpenChange={(o) => {
          setProductBuilderOpen(o);
          if (!o) {
            setProductBuilderFromAdd(false);
            setEditingProductBlock(null);
            // Refresh once on close to pick up canonical server state
            // (item ids, sort order). We deliberately do NOT refresh
            // during the modal session so the in-flight draft isn't
            // wiped by a parent re-render.
            router.refresh();
          }
        }}
        initial={editingProductBlock}
        newPreset={productBuilderPreset}
        profileSlug={profile.slug}
        itemsCap={productItemsCap}
        onBack={
          productBuilderFromAdd
            ? () => {
                setProductBuilderOpen(false);
                setProductBuilderFromAdd(false);
                setAddOpen(true);
              }
            : undefined
        }
        onAutoSave={handleAutoSaveProduct}
        onUploadItemImage={handleUploadProductImage}
      />

      <BookingFlowDialog
        open={bookingFlowOpen}
        onOpenChange={setBookingFlowOpen}
        title="هماهنگ"
        submitting={creatingBooking}
        onSubmit={handleCreateBooking}
        onBack={() => {
          setBookingFlowOpen(false);
          setAddOpen(true);
        }}
      />

      <PageSettingsSheet
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        pageId={profile.id}
        initial={{
          fullName: profile.fullName ?? "",
          title: profile.title ?? "",
          bio: profile.bio ?? "",
          slug: profile.slug,
          // ProfileSnapshot.domain is a string; PageSettings expects ProfileDomain.
          // Caller (server) ensures it's one of PROFILE_DOMAINS.
          domain: profile.domain as PageSettingsValues["domain"],
          seoTitle: profile.seoTitle,
          seoDescription: profile.seoDescription,
          ogImageUrl: profile.ogImageUrl,
          indexEnabled: profile.indexEnabled,
          appIconKey: profile.appIconKey,
          appIconColor: profile.appIconColor,
          discoverEnabled: profile.discoverEnabled,
          discoverCategory: profile.discoverCategory,
          city: profile.city,
          pageType: profile.pageType,
          publicPhone: profile.publicPhone,
          showPublicPhone: profile.showPublicPhone,
          email: profile.email,
          showPublicEmail: profile.showPublicEmail,
        }}
        preview={{
          fullName: profile.fullName,
          title: profile.title,
          avatarUrl: profile.avatarUrl,
          avatarSeed: profile.avatarSeed,
        }}
        onSave={handleSettingsSave}
        industries={industries}
        categories={categories}
        onAvatarUpload={handleAvatarSave}
        onAvatarDelete={handleAvatarDelete}
        onAvatarPickSeed={handleAvatarPickSeed}
      />

      {/* New-page celebration overlay — shown once after account creation (?new=1) */}
      <NewPageCelebration
        previewProfile={previewProfile}
        onComplete={() => setWizardOpen(true)}
      />

      {/* Activation wizard — always rendered so it never remounts when blocks change */}
      <ActivationWizard
        open={wizardOpen}
        onClose={() => {
          setWizardOpen(false);
          setDraftExists(hasSavedDraft(profile.id));
        }}
        pageId={profile.id}
        resetDraftRef={wizardResetDraftRef}
        initialDisplayName={profile.fullName ?? ""}
        initialBio={profile.bio ?? ""}
        initialAvatarUrl={profile.avatarUrl}
        initialAvatarSeed={profile.avatarSeed}
        trialEndsAt={trialEndsAt ?? null}
        previewProfile={previewProfile}
        autosaveLinksAction={autosaveLinksAction}
        autosaveAvatarAction={autosaveAvatarAction}
        deleteAvatarAction={deleteAvatarAction}
        saveAvatarSeedAction={saveAvatarSeedAction}
        saveProfileDetails={autosaveProfileDetailsAction}
        onLinksAdded={(newLinks) => {
          setLinks((prev) => [...prev, ...newLinks]);
          setDraftExists(false);
        }}
        onProfileUpdated={(patch) => {
          setProfile((prev) => ({
            ...prev,
            fullName: patch.fullName,
            bio: patch.bio,
            ...(patch.avatarUrl !== null ? { avatarUrl: patch.avatarUrl } : {}),
            ...(patch.avatarSeed !== null ? { avatarSeed: patch.avatarSeed } : {}),
          }));
        }}
      />
    </div>
  );
}

/** Sortable wrapper around a single link block. */
function SortableLinkBlock({
  itemId,
  link,
  clickCount,
  onEdit,
  onChange,
  onRemove,
  pinAllowed,
  animateAllowed,
  onSpotlightChange,
}: {
  itemId: string;
  link: EditableLink;
  clickCount: number;
  onEdit: () => void;
  onChange: (patch: Partial<EditableLink>) => void;
  onRemove: () => void;
  pinAllowed: boolean;
  animateAllowed: boolean;
  onSpotlightChange: (next: {
    spotlight: BlockSpotlight;
    animationStyle: BlockAnimationStyle | null;
  }) => Promise<void> | void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: itemId });

  const dragProps = {
    ...attributes,
    ...listeners,
  } as React.HTMLAttributes<HTMLButtonElement>;

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className="min-w-0"
    >
      <BlockCard
        dragProps={dragProps}
        isDragging={isDragging}
        icon={
          <LinkIconPickerButton
            url={link.url}
            iconKey={link.iconKey}
            iconUrl={link.iconUrl}
            imageUrl={link.imageUrl}
            size={40}
            onChange={(next: LinkIconPickerValue) => onChange(next)}
            onRefetch={() => {}}
          />
        }
        title={link.label || "بدون عنوان"}
        meta={undefined}
        trailing={
          <span
            className="inline-flex items-center gap-1 rounded-xl bg-muted px-2 py-1 text-[11px] font-bold text-muted-foreground"
            title="تعداد کلیک"
          >
            <MousePointerClickIcon className="size-3" />
            <span className="mt-0.5">{clickCount}</span>
          </span>
        }
        spotlightSlot={
          <SpotlightStarButton
            blockKind="link"
            spotlight={link.spotlight}
            animationStyle={link.animationStyle}
            pinAllowed={pinAllowed}
            animateAllowed={animateAllowed}
            onChange={onSpotlightChange}
          />
        }
        isActive={link.isActive}
        onToggleActive={(v) => onChange({ isActive: v })}
        onEdit={onEdit}
        onDelete={onRemove}
        deleteTitle="حذف لینک؟"
        deleteDescription="این لینک برای همیشه حذف می‌شود."
      />
    </li>
  );
}

/** Sortable wrapper around {@link BookingBlockRow}. */
function SortableBookingBlock({
  itemId,
  block,
  onUpdate,
  onDelete,
  onToggleActive,
  locked,
  lockedPlan,
  pinAllowed,
  animateAllowed,
  onSpotlightChange,
}: {
  itemId: string;
  block: EditableBookingBlockWithId;
  onUpdate: (next: EditableBookingBlockWithId) => Promise<void> | void;
  onDelete: () => Promise<void> | void;
  onToggleActive: (next: boolean) => Promise<void> | void;
  locked?: boolean;
  lockedPlan?: "pro" | "business";
  pinAllowed: boolean;
  animateAllowed: boolean;
  onSpotlightChange: (next: {
    spotlight: BlockSpotlight;
    animationStyle: BlockAnimationStyle | null;
  }) => Promise<void> | void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: itemId });
  const dragProps = {
    ...attributes,
    ...listeners,
  } as React.HTMLAttributes<HTMLButtonElement>;
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className="min-w-0"
    >
      <BookingBlockRow
        block={block}
        onUpdate={onUpdate}
        onDelete={onDelete}
        onToggleActive={onToggleActive}
        dragProps={dragProps}
        isDragging={isDragging}
        locked={locked}
        lockedPlan={lockedPlan}
        pinAllowed={pinAllowed}
        animateAllowed={animateAllowed}
        onSpotlightChange={onSpotlightChange}
      />
    </li>
  );
}

/** Sortable wrapper around {@link FormBlockRow}. */
function SortableFormBlock({
  itemId,
  block,
  submissionsCount,
  onEdit,
  onDelete,
  onToggleActive,
  locked,
  lockedPlan,
  pinAllowed,
  animateAllowed,
  onSpotlightChange,
}: {
  itemId: string;
  block: EditableFormBlockWithId;
  submissionsCount?: number;
  onEdit: () => void;
  onDelete: () => void;
  onToggleActive: (next: boolean) => void;
  locked?: boolean;
  lockedPlan?: "pro" | "business";
  pinAllowed: boolean;
  animateAllowed: boolean;
  onSpotlightChange: (next: {
    spotlight: BlockSpotlight;
    animationStyle: BlockAnimationStyle | null;
  }) => Promise<void> | void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: itemId });
  const dragProps = {
    ...attributes,
    ...listeners,
  } as React.HTMLAttributes<HTMLButtonElement>;
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className="min-w-0"
    >
      <FormBlockRow
        block={block}
        submissionsCount={submissionsCount}
        onEdit={onEdit}
        onDelete={onDelete}
        onToggleActive={onToggleActive}
        dragProps={dragProps}
        isDragging={isDragging}
        locked={locked}
        lockedPlan={lockedPlan}
        pinAllowed={pinAllowed}
        animateAllowed={animateAllowed}
        onSpotlightChange={onSpotlightChange}
      />
    </li>
  );
}

function SortableProductBlock({
  itemId,
  block,
  onEdit,
  onDelete,
  onToggleActive,
  locked,
  lockedPlan,
  pinAllowed,
  animateAllowed,
  onSpotlightChange,
}: {
  itemId: string;
  block: EditableProductBlockWithId;
  onEdit: () => void;
  onDelete: () => void;
  onToggleActive: (next: boolean) => void;
  locked?: boolean;
  lockedPlan?: "pro" | "business";
  pinAllowed: boolean;
  animateAllowed: boolean;
  onSpotlightChange: (next: {
    spotlight: BlockSpotlight;
    animationStyle: BlockAnimationStyle | null;
  }) => Promise<void> | void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: itemId });
  const dragProps = {
    ...attributes,
    ...listeners,
  } as React.HTMLAttributes<HTMLButtonElement>;
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className="min-w-0"
    >
      <ProductBlockRow
        block={block}
        onEdit={onEdit}
        onDelete={onDelete}
        onToggleActive={onToggleActive}
        dragProps={dragProps}
        isDragging={isDragging}
        locked={locked}
        lockedPlan={lockedPlan}
        pinAllowed={pinAllowed}
        animateAllowed={animateAllowed}
        onSpotlightChange={onSpotlightChange}
      />
    </li>
  );
}

function SortableTextBlock({
  itemId,
  block,
  onEdit,
  onDelete,
  onToggleActive,
  locked,
  lockedPlan,
  pinAllowed,
  animateAllowed,
  onSpotlightChange,
}: {
  itemId: string;
  block: EditableTextBlockWithId;
  onEdit: () => void;
  onDelete: () => void;
  onToggleActive: (next: boolean) => void;
  locked?: boolean;
  lockedPlan?: "pro" | "business";
  pinAllowed: boolean;
  animateAllowed: boolean;
  onSpotlightChange: (next: {
    spotlight: BlockSpotlight;
    animationStyle: BlockAnimationStyle | null;
  }) => Promise<void> | void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: itemId });
  const dragProps = {
    ...attributes,
    ...listeners,
  } as React.HTMLAttributes<HTMLButtonElement>;
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className="min-w-0"
    >
      <TextBlockRow
        block={block}
        onEdit={onEdit}
        onDelete={onDelete}
        onToggleActive={onToggleActive}
        dragProps={dragProps}
        isDragging={isDragging}
        locked={locked}
        lockedPlan={lockedPlan}
        pinAllowed={pinAllowed}
        animateAllowed={animateAllowed}
        onSpotlightChange={onSpotlightChange}
      />
    </li>
  );
}

function SortableMediaBlock({
  itemId,
  block,
  onEdit,
  onDelete,
  onToggleActive,
  locked,
  lockedPlan,
  pinAllowed,
  animateAllowed,
  onSpotlightChange,
}: {
  itemId: string;
  block: EditableMediaBlockWithId;
  onEdit: () => void;
  onDelete: () => void;
  onToggleActive: (next: boolean) => void;
  locked?: boolean;
  lockedPlan?: "pro" | "business";
  pinAllowed: boolean;
  animateAllowed: boolean;
  onSpotlightChange: (next: {
    spotlight: BlockSpotlight;
    animationStyle: BlockAnimationStyle | null;
  }) => Promise<void> | void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: itemId });
  const dragProps = {
    ...attributes,
    ...listeners,
  } as React.HTMLAttributes<HTMLButtonElement>;
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className="min-w-0"
    >
      <MediaBlockRow
        block={block}
        onEdit={onEdit}
        onDelete={onDelete}
        onToggleActive={onToggleActive}
        dragProps={dragProps}
        isDragging={isDragging}
        locked={locked}
        lockedPlan={lockedPlan}
        pinAllowed={pinAllowed}
        animateAllowed={animateAllowed}
        onSpotlightChange={onSpotlightChange}
      />
    </li>
  );
}

function SortableEventBlock({
  itemId,
  block,
  onEdit,
  onDelete,
  onToggleActive,
  locked,
  lockedPlan,
}: {
  itemId: string;
  block: EditableEventBlockWithId;
  onEdit: () => void;
  onDelete: () => void;
  onToggleActive: (next: boolean) => void;
  locked?: boolean;
  lockedPlan?: "pro" | "business";
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: itemId });
  const dragProps = {
    ...attributes,
    ...listeners,
  } as React.HTMLAttributes<HTMLButtonElement>;
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className="min-w-0"
    >
      <EventBlockRow
        block={block}
        onEdit={onEdit}
        onDelete={onDelete}
        onToggleActive={onToggleActive}
        dragProps={dragProps}
        isDragging={isDragging}
        locked={locked}
        lockedPlan={lockedPlan}
      />
    </li>
  );
}
