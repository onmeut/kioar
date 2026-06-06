import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { and, desc, eq, inArray, ne } from "drizzle-orm";

import { CardStudio } from "@/components/cards/card-studio";
import { requireCompletedProfile } from "@/lib/auth/session";
import { getCardStudioSettings } from "@/lib/cards/settings";
import { getRedeemableCardEntitlements } from "@/lib/cards/gifting";
import { transliterateName } from "@/lib/cards/transliterate";
import { resolveCurrentPageForOwner, listPagesForOwner } from "@/lib/pages";
import { getDb } from "@/db";
import { cardOrders } from "@/db/schema";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "کارت‌ها" };

// Statuses that mean "order is actively in progress — no need to re-order".
const ACTIVE_STATUSES = ["paid", "processing", "shipped", "fulfilled"] as const;

export default async function CardsPage() {
  const viewer = await requireCompletedProfile();
  const db = getDb();

  // Resolve the page the user is currently working on (cookie-based switcher).
  const currentPage = await resolveCurrentPageForOwner(viewer.user.id);
  if (!currentPage) redirect("/start");

  // Check for an active order specifically for THIS page.
  // pending_payment and cancelled are NOT redirected — show the studio.
  const activeOrderForPage = await db
    .select({ id: cardOrders.id })
    .from(cardOrders)
    .where(
      and(
        eq(cardOrders.userId, viewer.user.id),
        eq(cardOrders.pageId, currentPage.id),
        inArray(cardOrders.status, [...ACTIVE_STATUSES]),
      ),
    )
    .limit(1);

  if (activeOrderForPage.length > 0) {
    redirect("/cards/orders");
  }

  // Pre-fill shipping address from the most recent completed order across
  // any of the user's pages — address is a user detail, not page-specific.
  const lastOrderWithAddress = await db
    .select({
      province: cardOrders.province,
      city: cardOrders.city,
      address: cardOrders.address,
      postalCode: cardOrders.postalCode,
    })
    .from(cardOrders)
    .where(
      and(
        eq(cardOrders.userId, viewer.user.id),
        ne(cardOrders.province, ""),
      ),
    )
    .orderBy(desc(cardOrders.createdAt))
    .limit(1);

  const savedAddress = lastOrderWithAddress[0] ?? null;

  const [pagesRaw, settings, entitlements] = await Promise.all([
    listPagesForOwner(viewer.user.id),
    getCardStudioSettings(),
    getRedeemableCardEntitlements(viewer.user.id),
  ]);

  const pages = pagesRaw.map((p) => ({
    id: p.id,
    slug: p.slug,
    fullName: p.fullName,
    suggestedName: transliterateName(p.fullName || p.slug),
  }));

  // Put the current page first so CardStudio always uses it.
  const sortedPages = [
    ...pages.filter((p) => p.id === currentPage.id),
    ...pages.filter((p) => p.id !== currentPage.id),
  ];

  return (
    <CardStudio
      pages={sortedPages}
      settings={{
        prices: settings.prices,
        colors: settings.colors,
        materialEnabled: settings.materialEnabled,
        copyCardIncludesPlan: settings.copyCardIncludesPlan,
        purchaseGrantsPlan: settings.purchaseGrantsPlan,
        shippingCost: settings.shippingCost,
      }}
      entitlements={entitlements.map((e) => ({
        id: e.id,
        material: e.material,
        source: e.source,
      }))}
      savedAddress={savedAddress}
    />
  );
}
