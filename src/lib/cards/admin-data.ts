import "server-only";

import { desc, eq } from "drizzle-orm";

import { getDb } from "@/db";
import { cardOrders, cards, profiles, users } from "@/db/schema";

/**
 * Admin order list with joined page + user + linked-card NFC state, newest
 * first. Used by `/admin/cards`.
 */
export async function getAdminCardOrders() {
  const db = getDb();
  return db
    .select({
      id: cardOrders.id,
      status: cardOrders.status,
      source: cardOrders.source,
      material: cardOrders.material,
      color: cardOrders.color,
      nameOnCard: cardOrders.nameOnCard,
      province: cardOrders.province,
      city: cardOrders.city,
      address: cardOrders.address,
      postalCode: cardOrders.postalCode,
      amountToman: cardOrders.amountToman,
      cardId: cardOrders.cardId,
      createdAt: cardOrders.createdAt,
      pageSlug: profiles.slug,
      pageName: profiles.fullName,
      userPhone: users.phone,
      nfcWrittenAt: cards.nfcWrittenAt,
      nfcLockedAt: cards.nfcLockedAt,
    })
    .from(cardOrders)
    .leftJoin(profiles, eq(cardOrders.pageId, profiles.id))
    .leftJoin(users, eq(cardOrders.userId, users.id))
    .leftJoin(cards, eq(cardOrders.cardId, cards.id))
    .orderBy(desc(cardOrders.createdAt));
}

export type AdminCardOrder = Awaited<
  ReturnType<typeof getAdminCardOrders>
>[number];
