import { redirect } from "next/navigation";

import { DesignEditor } from "@/components/appearance/design-editor";
import { requireCompletedProfile } from "@/lib/auth/session";
import { coerceAppearance } from "@/lib/appearance/types";
import { getProfileWithLinksByUserId } from "@/lib/data";
import { getBookingBlocksByUserId } from "@/lib/booking-data";
import { getFormBlocksByUserId } from "@/lib/form-service";
import { getProductBlocksByUserId } from "@/lib/product-service";
import { isIconKey } from "@/lib/link-icons";

import {
  updatePageAppearanceAction,
  uploadWallpaperFromFormDataAction,
} from "../../../(app)/me/appearance-actions";

export const dynamic = "force-dynamic";

export default async function DesignPage() {
  const viewer = await requireCompletedProfile();
  const profile = await getProfileWithLinksByUserId(viewer.user.id);
  if (!profile) redirect("/me");

  const [bookingBlocks, formBlocks, productBlocks] = await Promise.all([
    getBookingBlocksByUserId(viewer.user.id),
    getFormBlocksByUserId(viewer.user.id),
    getProductBlocksByUserId(viewer.user.id),
  ]);

  const previewProfile = {
    fullName: profile.fullName,
    title: profile.title,
    bio: profile.bio,
    slug: profile.slug,
    publicPhone: profile.showPublicPhone ? profile.publicPhone : null,
    email: profile.showPublicEmail ? profile.email : null,
    avatarUrl: profile.avatarUrl,
    avatarSeed: profile.avatarSeed,
    city: profile.city ?? null,
    links: profile.links
      .filter((l) => l.isActive)
      .map((l) => ({
        id: l.id,
        label: l.label || "بدون عنوان",
        iconKey: isIconKey(l.iconKey) ? l.iconKey : null,
        iconUrl: l.iconUrl,
        url: l.url,
        description: l.description,
        imageUrl: l.imageUrl,
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
        sortOrder: b.sortOrder,
        types: b.types.map((t) => ({
          id: t.id,
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
        sortOrder: f.sortOrder,
        fields: f.fields.map((field) => ({
          id: field.id,
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
        preset: p.preset as never,
        slug: p.slug ?? null,
        layout: p.layout as never,
        itemLabel: p.itemLabel,
        currency: p.currency as never,
        showPrices: p.showPrices,
        displayMode: p.displayMode as never,
        pillLabel: p.pillLabel,
        iconKey: p.iconKey as never,
        iconUrl: p.iconUrl ?? null,
        imageUrl: p.imageUrl ?? null,
        sortOrder: p.sortOrder,
        sections: p.sections.map((s) => ({
          id: s.id,
          title: s.title,
          iconKey: s.iconKey ?? null,
        })),
        items: p.items.map((it) => ({
          id: it.id,
          sectionId: it.sectionId ?? null,
          title: it.title,
          description: it.description,
          imageUrl: it.imageUrl,
          priceType: it.priceType as never,
          priceAmount: it.priceAmount,
          priceAmountMax: it.priceAmountMax,
          availability: it.availability as never,
          isFeatured: it.isFeatured ?? false,
          externalUrl: it.externalUrl,
          badge: it.badge,
          sku: it.sku,
        })),
      })),
  };

  return (
    <DesignEditor
      initial={coerceAppearance(profile.appearance ?? null)}
      previewProfile={previewProfile}
      saveAction={updatePageAppearanceAction}
      uploadWallpaperAction={uploadWallpaperFromFormDataAction}
    />
  );
}
