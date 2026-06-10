import { LinksPageClient } from "@/components/dashboard/links-page-client";
import { coerceAppearance } from "@/lib/appearance/types";
import { requireCompletedProfile } from "@/lib/auth/session";
import { getBookingBlocksByUserId } from "@/lib/booking-data";
import { getLinkClickCounts, getProfileWithLinksByUserId } from "@/lib/data";
import { isIconKey } from "@/lib/link-icons";
import { getProviderConnections } from "@/lib/oauth/connections";
import { absoluteUrl } from "@/lib/site";
import { getAllActiveCategories, getIndustries } from "@/lib/discover";

import { fetchLinkMetadataAction } from "./actions";
import {
  autosaveAvatarAction,
  autosaveLinksAction,
  autosaveProfileDetailsAction,
  deleteAvatarAction,
  reorderBlocksAction,
  saveAvatarSeedAction,
  savePageSettingsAction,
  saveQrStyleAction,
} from "./autosave-actions";
import { setBlockSpotlightAction } from "./spotlight-actions";
import {
  createBookingBlockAction,
  deleteBookingBlockAction,
  toggleBookingBlockActiveAction,
  updateBookingBlockAction,
} from "@/app/(app)/bookings/actions";
import {
  createFormBlockAction,
  deleteFormBlockAction,
  toggleFormBlockActiveAction,
  updateFormBlockAction,
} from "@/app/(app)/forms/actions";
import { getFormBlocksByUserId } from "@/lib/form-service";
import {
  getProductBlocksByUserId,
  type FullProductBlock,
} from "@/lib/product-service";
import {
  createProductBlockAction,
  deleteProductBlockAction,
  toggleProductBlockActiveAction,
  updateProductBlockAction,
  uploadProductItemImageAction,
} from "@/app/(app)/products/actions";
import {
  createTextBlockAction,
  deleteTextBlockAction,
  toggleTextBlockActiveAction,
  updateTextBlockAction,
  uploadTextBlockImageAction,
} from "@/app/(app)/text-blocks/actions";
import {
  getTextBlocksByUserId,
  type TextBlockRow,
} from "@/lib/text-block-service";
import type { EditableTextBlockWithId } from "@/components/dashboard/text-block-row";
import type { IconKey } from "@/lib/link-icons";
import { getDb } from "@/db";
import { bookings, formSubmissions } from "@/db/schema";
import { inArray, sql } from "drizzle-orm";
import {
  getFeatureLockTier,
  getPageEntitlementLimit,
  pageHasFeature,
} from "@/lib/entitlements";
import { blockKindToFeatureKey } from "@/lib/block-features";
import { listOwnedPagesWithPlan } from "@/lib/pages";
import type {
  ProductBlockCurrency,
  ProductBlockDisplayMode,
  ProductBlockLayout,
  ProductBlockPreset,
  ProductItemAvailability,
  ProductItemPriceType,
} from "@/lib/validations";
import {
  PRODUCT_ITEMS_HARD_CAP,
  PRODUCT_BLOCK_CURRENCIES,
  PRODUCT_BLOCK_DISPLAY_MODES,
  PRODUCT_BLOCK_LAYOUTS,
  PRODUCT_BLOCK_PRESETS,
  PRODUCT_ITEM_AVAILABILITY,
  PRODUCT_ITEM_PRICE_TYPES,
} from "@/lib/validations";

const MAJOR_DIVISOR: Record<ProductBlockCurrency, number> = {
  IRT: 10,
  USD: 100,
  EUR: 100,
};

function minorToMajorString(
  minor: number | null | undefined,
  currency: ProductBlockCurrency,
): string {
  if (minor === null || minor === undefined || minor === 0) return "";
  const digits = String(minor / MAJOR_DIVISOR[currency]);
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/** Map a server `FullProductBlock` to the editable client shape used by
 * `LinksPageClient`. Accepts the raw row currency/preset/etc. as `string`
 * and narrows to the validated unions; unknown values fall back to safe
 * defaults so a malformed row never crashes the editor. */
function toEditableTextBlock(b: TextBlockRow): EditableTextBlockWithId {
  return {
    id: b.id,
    title: b.title,
    iconKey: (b.iconKey as IconKey | null) ?? null,
    iconUrl: b.iconUrl,
    body: b.body,
    photoUrl: b.photoUrl,
    isActive: b.isActive,
    sortOrder: b.sortOrder,
    spotlight: b.spotlight,
    animationStyle: b.animationStyle,
  };
}

function toEditableProductBlock(b: FullProductBlock) {
  const currency: ProductBlockCurrency = (
    PRODUCT_BLOCK_CURRENCIES as readonly string[]
  ).includes(b.currency)
    ? (b.currency as ProductBlockCurrency)
    : "IRT";
  const layout: ProductBlockLayout = (
    PRODUCT_BLOCK_LAYOUTS as readonly string[]
  ).includes(b.layout)
    ? (b.layout as ProductBlockLayout)
    : "list";
  const displayMode: ProductBlockDisplayMode = (
    PRODUCT_BLOCK_DISPLAY_MODES as readonly string[]
  ).includes(b.displayMode)
    ? (b.displayMode as ProductBlockDisplayMode)
    : "pill";
  const preset: ProductBlockPreset | null =
    b.preset && (PRODUCT_BLOCK_PRESETS as readonly string[]).includes(b.preset)
      ? (b.preset as ProductBlockPreset)
      : null;

  return {
    id: b.id,
    name: b.name,
    description: b.description,
    preset,
    slug: b.slug ?? null,
    layout,
    itemLabel: b.itemLabel,
    currency,
    showPrices: b.showPrices,
    displayMode,
    pillLabel: b.pillLabel,
    iconKey: (b.iconKey as import("@/lib/link-icons").IconKey | null) ?? null,
    iconUrl: b.iconUrl ?? null,
    imageUrl: b.imageUrl ?? null,
    isActive: b.isActive,
    sortOrder: b.sortOrder,
    spotlight: b.spotlight,
    animationStyle: b.animationStyle,
    sections: b.sections.map((s) => ({
      id: s.id,
      _key: s.id,
      title: s.title,
    })),
    items: b.items.map((it) => {
      const priceType: ProductItemPriceType = (
        PRODUCT_ITEM_PRICE_TYPES as readonly string[]
      ).includes(it.priceType)
        ? (it.priceType as ProductItemPriceType)
        : "fixed";
      const availability: ProductItemAvailability = (
        PRODUCT_ITEM_AVAILABILITY as readonly string[]
      ).includes(it.availability)
        ? (it.availability as ProductItemAvailability)
        : "available";
      return {
        id: it.id,
        _key: it.id,
        sectionRef: it.sectionId ?? null,
        title: it.title,
        description: it.description,
        imageUrl: it.imageUrl,
        priceType,
        priceMajor: minorToMajorString(it.priceAmount, currency),
        priceMaxMajor: minorToMajorString(it.priceAmountMax, currency),
        availability,
        isFeatured: it.isFeatured ?? false,
        externalUrl: it.externalUrl,
        badge: it.badge,
        sku: it.sku,
      };
    }),
  };
}

export default async function DashboardLinksPage() {
  const viewer = await requireCompletedProfile();
  const profile = await getProfileWithLinksByUserId(viewer.user.id);

  const slug = profile?.slug ?? viewer.profile.slug;
  const profileDomain = profile?.domain ?? "kioar.com";
  const publicUrl =
    process.env.NODE_ENV === "production"
      ? `https://${profileDomain}/${slug}`
      : absoluteUrl(`/${slug}`);

  const links =
    profile?.links.map((link) => ({
      id: link.id,
      label: link.label,
      url: link.url,
      description: link.description,
      imageUrl: link.imageUrl,
      iconKey: isIconKey(link.iconKey) ? link.iconKey : null,
      iconUrl: link.iconUrl,
      sortOrder: link.sortOrder,
      isActive: link.isActive,
      spotlight: link.spotlight,
      animationStyle: link.animationStyle,
    })) ?? [];

  const clickCounts = await getLinkClickCounts(links.map((l) => l.id));

  const rawBookingBlocks = await getBookingBlocksByUserId(viewer.user.id);
  const bookingBlockIds = rawBookingBlocks.map((b) => b.id);
  const bookingCounts: Record<string, number> = {};
  if (bookingBlockIds.length) {
    const rows = await getDb()
      .select({
        blockId: bookings.blockId,
        count: sql<number>`COUNT(*)::int`,
      })
      .from(bookings)
      .where(inArray(bookings.blockId, bookingBlockIds))
      .groupBy(bookings.blockId);
    for (const row of rows) {
      bookingCounts[row.blockId] = Number(row.count);
    }
  }
  const bookingBlocks = rawBookingBlocks.map((b) => ({
    id: b.id,
    name: b.name,
    description: b.description,
    avatarUrl: b.avatarUrl,
    timezone: b.timezone,
    locationType: b.locationType,
    locationAddress: b.locationAddress,
    locationLat: b.locationLat,
    locationLng: b.locationLng,
    locationPlaceId: b.locationPlaceId,
    meetingProvider: b.meetingProvider,
    meetingLink: b.meetingLink,
    skyroomApiKey: b.skyroomApiKey,
    skyroomRoomNamePrefix: b.skyroomRoomNamePrefix,
    bufferBeforeMin: b.bufferBeforeMin,
    bufferAfterMin: b.bufferAfterMin,
    calendarEmail: b.calendarEmail,
    isActive: b.isActive,
    sortOrder: b.sortOrder,
    spotlight: b.spotlight,
    animationStyle: b.animationStyle,
    bookingsCount: bookingCounts[b.id] ?? 0,
    availability: b.availability.map((a) => ({
      dayOfWeek: a.dayOfWeek,
      startMinute: a.startMinute,
      endMinute: a.endMinute,
    })),
    types: b.types.map((t) => ({
      id: t.id,
      title: t.title,
      durationMin: t.durationMin,
      priceAmount: t.priceAmount,
      priceCurrency: t.priceCurrency,
    })),
  }));

  const providerConnections = await getProviderConnections(viewer.user.id);

  const rawFormBlocks = await getFormBlocksByUserId(viewer.user.id);
  const formBlockIds = rawFormBlocks.map((b) => b.id);
  const submissionCounts: Record<string, number> = {};
  if (formBlockIds.length) {
    const rows = await getDb()
      .select({
        blockId: formSubmissions.blockId,
        count: sql<number>`COUNT(*)::int`,
      })
      .from(formSubmissions)
      .where(inArray(formSubmissions.blockId, formBlockIds))
      .groupBy(formSubmissions.blockId);
    for (const row of rows) {
      submissionCounts[row.blockId] = Number(row.count);
    }
  }
  const formBlocks = rawFormBlocks.map((b) => ({
    id: b.id,
    name: b.name,
    intro: b.intro,
    outro: b.outro,
    isActive: b.isActive,
    sortOrder: b.sortOrder,
    spotlight: b.spotlight,
    animationStyle: b.animationStyle,
    submissionsCount: submissionCounts[b.id] ?? 0,
    fields: b.fields.map((f) => ({
      id: f.id,
      kind: f.kind,
      label: f.label,
      required: f.required,
      options: f.options ?? [],
    })),
  }));

  // Phase 5: page-level entitlement flags. We still load and render the
  // owner's existing config; lock state simply switches the editor row to
  // read-only with an upgrade CTA so they can see exactly what they'd
  // recover by upgrading.
  const pageId = profile?.id;
  const bookingFeature = blockKindToFeatureKey("booking");
  const formFeature = blockKindToFeatureKey("form");
  const productFeature = blockKindToFeatureKey("product");
  const eventFeature = blockKindToFeatureKey("event");
  const textFeature = blockKindToFeatureKey("text");
  const bookingsLocked =
    pageId && bookingFeature
      ? !(await pageHasFeature(pageId, bookingFeature))
      : false;
  const formsLocked =
    pageId && formFeature
      ? !(await pageHasFeature(pageId, formFeature))
      : false;
  const productsLocked =
    pageId && productFeature
      ? !(await pageHasFeature(pageId, productFeature))
      : false;
  const eventsLocked =
    pageId && eventFeature
      ? !(await pageHasFeature(pageId, eventFeature))
      : false;
  const textLocked =
    pageId && textFeature
      ? !(await pageHasFeature(pageId, textFeature))
      : false;

  // Phase 5 + admin matrix: each locked block row needs to know which
  // tier currently grants its feature so the lock chip can render in
  // the right colour (Pro=emerald, Business=purple). We read the live
  // `plan_features` matrix instead of trusting the seed naming convention
  // — admins can move e.g. `products_block` to Business-only via
  // /admin/plans and the chip must follow.
  const bookingsRequiredPlan =
    bookingsLocked && bookingFeature
      ? ((await getFeatureLockTier(bookingFeature)) ?? "business")
      : "business";
  const formsRequiredPlan =
    formsLocked && formFeature
      ? ((await getFeatureLockTier(formFeature)) ?? "business")
      : "business";
  const productsRequiredPlan =
    productsLocked && productFeature
      ? ((await getFeatureLockTier(productFeature)) ?? "pro")
      : "pro";
  const eventsRequiredPlan =
    eventsLocked && eventFeature
      ? ((await getFeatureLockTier(eventFeature)) ?? "business")
      : "business";
  const textRequiredPlan =
    textLocked && textFeature
      ? ((await getFeatureLockTier(textFeature)) ?? "pro")
      : "pro";

  const rawProductBlocks = pageId
    ? await getProductBlocksByUserId(viewer.user.id)
    : [];
  const productBlocks = rawProductBlocks.map(toEditableProductBlock);

  const rawTextBlocks = pageId
    ? await getTextBlocksByUserId(viewer.user.id)
    : [];
  const textBlocks: EditableTextBlockWithId[] =
    rawTextBlocks.map(toEditableTextBlock);

  const productItemsLimit = pageId
    ? await getPageEntitlementLimit(pageId, "products_max_items_per_block")
    : null;
  const productItemsCap = productItemsLimit
    ? Number(productItemsLimit)
    : PRODUCT_ITEMS_HARD_CAP;

  // Phase 6: Spotlight gating. `featured_links` covers pin/auto-expand;
  // `link_animations` covers the looping animation styles.
  const pinAllowed = pageId
    ? await pageHasFeature(pageId, "featured_links")
    : false;
  const animateAllowed = pageId
    ? await pageHasFeature(pageId, "link_animations")
    : false;
  const canCustomizeQr = pageId
    ? await pageHasFeature(pageId, "qr_code_customization").catch(() => false)
    : false;

  const [industries, allCategories, ownedPages] = await Promise.all([
    getIndustries(),
    getAllActiveCategories(),
    listOwnedPagesWithPlan(viewer.user.id).catch(() => []),
  ]);

  // Find the trial end date for the page currently being edited.
  const currentPageTrial = ownedPages.find((p) => p.id === pageId);
  const trialEndsAt =
    currentPageTrial?.isOnTrial && currentPageTrial.trialEndsAt
      ? currentPageTrial.trialEndsAt.toISOString()
      : null;

  return (
    <LinksPageClient
      // Remount the entire editor when the active page changes so all
      // local React state (links draft, dialogs, autosave dedupe refs,
      // etc.) is rebuilt from the freshly-fetched server props. Without
      // this key, switching pages via the sidebar dropdown leaves the
      // previous page's state in the client component while the layout
      // around it shows the new page — which is what caused the "I
      // switched but the editor still shows the old page" bug.
      key={profile?.id ?? "no-page"}
      initialProfile={{
        id: profile?.id ?? "",
        fullName: profile?.fullName ?? "",

        title: profile?.title ?? "",
        bio: profile?.bio ?? "",
        slug,
        publicPhone: profile?.publicPhone ?? "",
        showPublicPhone: profile?.showPublicPhone ?? false,
        email: profile?.email ?? "",
        showPublicEmail: profile?.showPublicEmail ?? false,
        avatarUrl: profile?.avatarUrl ?? null,
        avatarSeed: profile?.avatarSeed ?? null,
        domain: profileDomain,
        seoTitle: profile?.seoTitle ?? "",
        seoDescription: profile?.seoDescription ?? "",
        ogImageUrl: profile?.ogImageUrl ?? null,
        indexEnabled: profile?.indexEnabled ?? true,
        appIconKey: profile?.appIconKey ?? null,
        appIconColor: profile?.appIconColor ?? "",
        discoverEnabled: profile?.discoverEnabled ?? false,
        discoverCategory: profile?.discoverCategory ?? null,
        city: profile?.city ?? null,
        pageType: profile?.pageType ?? null,
        appearance: profile?.appearance ? coerceAppearance(profile.appearance) : null,
      }}
      initialLinks={links}
      initialBookingBlocks={bookingBlocks}
      initialFormBlocks={formBlocks}
      initialProductBlocks={productBlocks}
      initialTextBlocks={textBlocks}
      linkClickCounts={clickCounts}
      publicUrl={publicUrl}
      fetchMetadataAction={fetchLinkMetadataAction}
      autosaveLinksAction={autosaveLinksAction}
      savePageSettingsAction={savePageSettingsAction}
      autosaveAvatarAction={autosaveAvatarAction}
      deleteAvatarAction={deleteAvatarAction}
      saveAvatarSeedAction={saveAvatarSeedAction}
      reorderBlocksAction={reorderBlocksAction}
      createBookingBlockAction={createBookingBlockAction}
      updateBookingBlockAction={updateBookingBlockAction}
      deleteBookingBlockAction={deleteBookingBlockAction}
      toggleBookingBlockActiveAction={toggleBookingBlockActiveAction}
      createFormBlockAction={createFormBlockAction}
      updateFormBlockAction={updateFormBlockAction}
      deleteFormBlockAction={deleteFormBlockAction}
      toggleFormBlockActiveAction={toggleFormBlockActiveAction}
      createProductBlockAction={createProductBlockAction}
      updateProductBlockAction={updateProductBlockAction}
      deleteProductBlockAction={deleteProductBlockAction}
      toggleProductBlockActiveAction={toggleProductBlockActiveAction}
      uploadProductItemImageAction={uploadProductItemImageAction}
      createTextBlockAction={createTextBlockAction}
      updateTextBlockAction={updateTextBlockAction}
      deleteTextBlockAction={deleteTextBlockAction}
      toggleTextBlockActiveAction={toggleTextBlockActiveAction}
      uploadTextBlockImageAction={uploadTextBlockImageAction}
      bookingsLocked={bookingsLocked}
      formsLocked={formsLocked}
      productsLocked={productsLocked}
      eventsLocked={eventsLocked}
      textLocked={textLocked}
      bookingsRequiredPlan={bookingsRequiredPlan}
      formsRequiredPlan={formsRequiredPlan}
      productsRequiredPlan={productsRequiredPlan}
      eventsRequiredPlan={eventsRequiredPlan}
      textRequiredPlan={textRequiredPlan}
      productItemsCap={productItemsCap}
      pinAllowed={pinAllowed}
      animateAllowed={animateAllowed}
      canCustomizeQr={canCustomizeQr}
      savedQrStyle={
        (profile?.qrStyle as import("@/lib/qr/types").QrStyle | null) ?? null
      }
      saveQrStyleAction={saveQrStyleAction}
      industries={industries}
      categories={allCategories}
      setBlockSpotlightAction={setBlockSpotlightAction}
      trialEndsAt={trialEndsAt}
      autosaveProfileDetailsAction={autosaveProfileDetailsAction}
    />
  );
}
