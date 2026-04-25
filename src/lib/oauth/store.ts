import { and, eq } from "drizzle-orm";

import { getDb } from "@/db";
import { oauthAccounts } from "@/db/schema";
import { decryptToken, encryptToken } from "./crypto";

export type OAuthProviderId = "google" | "zoom";

export type StoredOAuthAccount = {
  id: string;
  userId: string;
  provider: OAuthProviderId;
  providerAccountId: string;
  accountEmail: string | null;
  accessToken: string;
  refreshToken: string | null;
  expiresAt: Date | null;
  scope: string | null;
};

export async function upsertOAuthAccount(input: {
  userId: string;
  provider: OAuthProviderId;
  providerAccountId: string;
  accountEmail: string | null;
  accessToken: string;
  refreshToken: string | null;
  expiresAt: Date | null;
  scope: string | null;
}) {
  const db = getDb();
  const enc = encryptToken(input.accessToken);
  const refreshEnc = input.refreshToken
    ? encryptToken(input.refreshToken)
    : null;

  await db
    .insert(oauthAccounts)
    .values({
      userId: input.userId,
      provider: input.provider,
      providerAccountId: input.providerAccountId,
      accountEmail: input.accountEmail,
      accessToken: enc,
      refreshToken: refreshEnc,
      expiresAt: input.expiresAt,
      scope: input.scope,
    })
    .onConflictDoUpdate({
      target: [oauthAccounts.userId, oauthAccounts.provider],
      set: {
        providerAccountId: input.providerAccountId,
        accountEmail: input.accountEmail,
        accessToken: enc,
        // Only overwrite refresh token if we got a new one — Google only
        // returns it on first consent or `prompt=consent`.
        ...(refreshEnc ? { refreshToken: refreshEnc } : {}),
        expiresAt: input.expiresAt,
        scope: input.scope,
        updatedAt: new Date(),
      },
    });
}

export async function getOAuthAccount(
  userId: string,
  provider: OAuthProviderId,
): Promise<StoredOAuthAccount | null> {
  const db = getDb();
  const row = await db.query.oauthAccounts.findFirst({
    where: and(
      eq(oauthAccounts.userId, userId),
      eq(oauthAccounts.provider, provider),
    ),
  });
  if (!row) return null;
  return {
    id: row.id,
    userId: row.userId,
    provider: row.provider as OAuthProviderId,
    providerAccountId: row.providerAccountId,
    accountEmail: row.accountEmail,
    accessToken: decryptToken(row.accessToken),
    refreshToken: row.refreshToken ? decryptToken(row.refreshToken) : null,
    expiresAt: row.expiresAt,
    scope: row.scope,
  };
}

export async function listOAuthAccounts(userId: string) {
  const db = getDb();
  const rows = await db.query.oauthAccounts.findMany({
    where: eq(oauthAccounts.userId, userId),
    columns: {
      provider: true,
      accountEmail: true,
      providerAccountId: true,
      expiresAt: true,
    },
  });
  return rows;
}

export async function deleteOAuthAccount(
  userId: string,
  provider: OAuthProviderId,
) {
  const db = getDb();
  await db
    .delete(oauthAccounts)
    .where(
      and(
        eq(oauthAccounts.userId, userId),
        eq(oauthAccounts.provider, provider),
      ),
    );
}

export async function updateAccessToken(
  userId: string,
  provider: OAuthProviderId,
  next: {
    accessToken: string;
    expiresAt: Date | null;
    refreshToken?: string | null;
  },
) {
  const db = getDb();
  await db
    .update(oauthAccounts)
    .set({
      accessToken: encryptToken(next.accessToken),
      expiresAt: next.expiresAt,
      ...(next.refreshToken
        ? { refreshToken: encryptToken(next.refreshToken) }
        : {}),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(oauthAccounts.userId, userId),
        eq(oauthAccounts.provider, provider),
      ),
    );
}
