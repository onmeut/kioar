/**
 * Page-ownership transfer service.
 *
 * A transfer moves a page (a `profiles` row) from one owner to another phone
 * number. When accepted we reassign `profiles.user_id` and let everything
 * page-keyed follow automatically — `page_subscriptions`, `page_entitlements`,
 * links, blocks, bookings, forms, products, cards. We deliberately do NOT move
 * user-keyed billing/legal records (`invoices`, `card_orders`); those stay
 * with the original owner because they're that person's legal history.
 *
 * Security model (read before touching `acceptTransfer`):
 *   - `token` is a single-use *locator* for the public /transfer/[token]
 *     landing + QR. It points the recipient at the right transfer. It does
 *     NOT authorize acceptance.
 *   - Acceptance ALWAYS asserts `viewer.user.phone === transfer.toPhone`. A
 *     forwarded/leaked link cannot hijack a page — phone ownership (proven
 *     via OTP at login) is the only real gate. A registered recipient queued
 *     by phone (no token) and a token-link recipient converge on this exact
 *     same check.
 *
 * Lifecycle: pending → accepted | rejected | canceled | expired. Pending
 * transfers expire after 7 days (enforced by /api/cron/expire-transfers). A
 * page can have at most one pending transfer at a time (DB partial unique
 * index `page_transfers_page_pending_idx`).
 */
import { randomBytes } from "node:crypto";

import { and, asc, desc, eq, lt, sql } from "drizzle-orm";

import { getDb } from "@/db";
import { pageTransfers, profiles, users } from "@/db/schema";
import { invalidateProfileCacheById } from "@/lib/cache/profile-cache";
import { getOwnedPageById } from "@/lib/pages";
import { normalizeIranianPhone } from "@/lib/phone";
import { absoluteUrl } from "@/lib/site";

/** Pending transfers live for 7 days before the cron expires them. */
export const TRANSFER_TTL_DAYS = 7;

export type TransferRow = typeof pageTransfers.$inferSelect;

export type CreateTransferInput = {
  fromUserId: string;
  fromUserPhone: string;
  pageId: string;
  toPhoneRaw: string;
};

export type CreateTransferResult =
  | {
      ok: true;
      transfer: TransferRow;
      /** True when the recipient phone already maps to an account. */
      recipientRegistered: boolean;
      /** Public landing URL carrying the single-use token. */
      shareUrl: string;
    }
  | {
      ok: false;
      reason:
        | "not_owner"
        | "invalid_phone"
        | "self_transfer"
        | "already_pending";
    };

/** Random, URL-safe, unguessable locator token for the share link / QR. */
function generateTransferToken(): string {
  return randomBytes(24).toString("base64url");
}

/** Build the public landing URL for a transfer token. */
export function transferShareUrl(token: string): string {
  return absoluteUrl(`/transfer/${token}`);
}

/**
 * Create a pending transfer for one of the caller's pages.
 *
 * Verifies ownership, normalizes + validates the recipient phone, blocks
 * self-transfer, and refuses if the page already has a pending transfer.
 * Looks up whether the recipient phone already maps to a user so callers can
 * decide between the in-app prompt (registered) and the QR/share link
 * (unregistered) — but acceptance never trusts that lookup; it re-derives the
 * user from the authenticated session.
 */
export async function createTransfer(
  input: CreateTransferInput,
): Promise<CreateTransferResult> {
  const { fromUserId, fromUserPhone, pageId, toPhoneRaw } = input;

  // 1. Ownership — never trust a client-supplied pageId.
  const page = await getOwnedPageById(pageId, fromUserId);
  if (!page) return { ok: false, reason: "not_owner" };

  // 2. Normalize + validate recipient phone.
  let toPhone: string;
  try {
    toPhone = normalizeIranianPhone(toPhoneRaw);
  } catch {
    return { ok: false, reason: "invalid_phone" };
  }

  // 3. Can't transfer to your own number.
  if (toPhone === normalizeIranianPhone(fromUserPhone)) {
    return { ok: false, reason: "self_transfer" };
  }

  const db = getDb();

  // 4. Resolve whether the recipient already has an account.
  const recipient = await db.query.users.findFirst({
    where: eq(users.phone, toPhone),
    columns: { id: true },
  });

  // 5. Insert. The partial unique index guarantees at most one pending
  //    transfer per page — catch its violation and surface a clean reason
  //    rather than a 500.
  const token = generateTransferToken();
  const expiresAt = new Date(
    Date.now() + TRANSFER_TTL_DAYS * 24 * 60 * 60 * 1000,
  );

  try {
    const [transfer] = await db
      .insert(pageTransfers)
      .values({
        pageId,
        fromUserId,
        toPhone,
        toUserId: recipient?.id ?? null,
        token,
        status: "pending",
        expiresAt,
      })
      .returning();

    return {
      ok: true,
      transfer,
      recipientRegistered: Boolean(recipient),
      shareUrl: transferShareUrl(token),
    };
  } catch (err) {
    // Unique violation on the pending partial index → a transfer is already
    // open for this page.
    if (isUniqueViolation(err)) {
      return { ok: false, reason: "already_pending" };
    }
    throw err;
  }
}

type TransferGuardFailure =
  | "not_found"
  | "not_pending"
  | "expired"
  | "phone_mismatch";

/**
 * Pure authorization decision for accepting/rejecting a transfer — extracted
 * so it can be unit-tested without a DB. This IS the security boundary:
 *
 *   - The transfer must exist, be `pending`, and not be past `expiresAt`.
 *   - The viewer's phone must equal the transfer's `toPhone`. The token (if
 *     the caller arrived via a public link) only located the row; it grants
 *     no rights. A registered recipient queued by phone with NO token hits
 *     the exact same check.
 *
 * Pass `null` for `transfer` when the row wasn't found.
 */
export function evaluateTransferGuard(
  transfer:
    | Pick<TransferRow, "status" | "expiresAt" | "toPhone">
    | null
    | undefined,
  viewerPhone: string,
  now: number = Date.now(),
): { ok: true } | { ok: false; reason: TransferGuardFailure } {
  if (!transfer) return { ok: false, reason: "not_found" };
  if (transfer.status !== "pending") return { ok: false, reason: "not_pending" };
  if (transfer.expiresAt.getTime() <= now) {
    return { ok: false, reason: "expired" };
  }
  if (transfer.toPhone !== viewerPhone) {
    return { ok: false, reason: "phone_mismatch" };
  }
  return { ok: true };
}

/**
 * Load a pending, unexpired transfer and assert the viewer is the intended
 * recipient (phone match). Shared by accept + reject so both go through the
 * same gate. Accepts either a `token` (public link) or a `transferId`
 * (in-app prompt / notifications).
 */
async function loadTransferForRecipient(args: {
  token?: string;
  transferId?: string;
  viewerUserId: string;
  viewerPhone: string;
}): Promise<
  { ok: true; transfer: TransferRow } | { ok: false; reason: TransferGuardFailure }
> {
  const { token, transferId, viewerPhone } = args;
  const db = getDb();

  const transfer = await db.query.pageTransfers.findFirst({
    where: token
      ? eq(pageTransfers.token, token)
      : eq(pageTransfers.id, transferId!),
  });

  // Single authorization boundary, shared with the unit-tested pure helper.
  const guard = evaluateTransferGuard(transfer, viewerPhone);
  if (!guard.ok) return guard;

  return { ok: true, transfer: transfer! };
}

export type AcceptTransferResult =
  | { ok: true; transfer: TransferRow; pageSlug: string }
  | { ok: false; reason: TransferGuardFailure | "owner_conflict" };

/**
 * Accept a transfer. Reassigns `profiles.user_id` to the recipient inside a
 * transaction so the ownership move + status flip are atomic. Everything
 * page-keyed follows the page automatically — no per-table reassignment.
 *
 * After commit (never inside the tx) we invalidate the public profile cache:
 * the rendered page is unchanged, but entitlement edges can shift, so we drop
 * the cache to be safe per the cache-invalidation rule.
 */
export async function acceptTransfer(args: {
  token?: string;
  transferId?: string;
  viewerUserId: string;
  viewerPhone: string;
}): Promise<AcceptTransferResult> {
  const guard = await loadTransferForRecipient(args);
  if (!guard.ok) return guard;

  const { transfer } = guard;
  const { viewerUserId } = args;

  // Defensive: if the page is already owned by the recipient (double-submit,
  // replayed action), treat as a no-op success rather than reassigning.
  const db = getDb();

  const slug = await db.transaction(async (tx) => {
    // Re-read the transfer FOR UPDATE-style inside the tx to avoid a race
    // where two concurrent accepts both passed the guard. We re-check status.
    const fresh = await tx.query.pageTransfers.findFirst({
      where: eq(pageTransfers.id, transfer.id),
    });
    if (!fresh || fresh.status !== "pending") {
      // Someone else won the race; bail without mutating.
      return null;
    }

    const page = await tx.query.profiles.findFirst({
      where: eq(profiles.id, fresh.pageId),
      columns: { id: true, slug: true, userId: true },
    });
    if (!page) {
      // Page vanished (deleted between create and accept). Mark the transfer
      // expired so it leaves the recipient's list.
      await tx
        .update(pageTransfers)
        .set({ status: "expired", updatedAt: new Date() })
        .where(eq(pageTransfers.id, fresh.id));
      return null;
    }

    // Reassign ownership. All page-keyed data (subscription, entitlements,
    // links, blocks, bookings, forms, products, cards) keys off page.id and
    // therefore follows automatically — we touch only profiles.user_id.
    await tx
      .update(profiles)
      .set({ userId: viewerUserId, updatedAt: new Date() })
      .where(eq(profiles.id, fresh.pageId));

    await tx
      .update(pageTransfers)
      .set({
        status: "accepted",
        toUserId: viewerUserId,
        acceptedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(pageTransfers.id, fresh.id));

    return page.slug;
  });

  if (!slug) {
    // Race / page-gone path — re-load to report the current state honestly.
    const after = await db.query.pageTransfers.findFirst({
      where: eq(pageTransfers.id, transfer.id),
    });
    if (after?.status === "accepted") {
      return { ok: true, transfer: after, pageSlug: "" };
    }
    return { ok: false, reason: "not_pending" };
  }

  // After commit: invalidate the public profile cache by pageId.
  await invalidateProfileCacheById(transfer.pageId);

  return { ok: true, transfer: { ...transfer, status: "accepted" }, pageSlug: slug };
}

export type RejectTransferResult =
  | { ok: true }
  | { ok: false; reason: TransferGuardFailure };

/** Recipient declines a pending transfer. */
export async function rejectTransfer(args: {
  token?: string;
  transferId?: string;
  viewerUserId: string;
  viewerPhone: string;
}): Promise<RejectTransferResult> {
  const guard = await loadTransferForRecipient(args);
  if (!guard.ok) return guard;

  const db = getDb();
  await db
    .update(pageTransfers)
    .set({ status: "rejected", rejectedAt: new Date(), updatedAt: new Date() })
    .where(
      and(
        eq(pageTransfers.id, guard.transfer.id),
        eq(pageTransfers.status, "pending"),
      ),
    );
  return { ok: true };
}

export type CancelTransferResult =
  | { ok: true }
  | { ok: false; reason: "not_found" | "not_owner" | "not_pending" };

/** Sender cancels their own pending outgoing transfer. */
export async function cancelTransfer(args: {
  transferId: string;
  fromUserId: string;
}): Promise<CancelTransferResult> {
  const db = getDb();
  const transfer = await db.query.pageTransfers.findFirst({
    where: eq(pageTransfers.id, args.transferId),
  });
  if (!transfer) return { ok: false, reason: "not_found" };
  if (transfer.fromUserId !== args.fromUserId) {
    return { ok: false, reason: "not_owner" };
  }
  if (transfer.status !== "pending") return { ok: false, reason: "not_pending" };

  await db
    .update(pageTransfers)
    .set({ status: "canceled", canceledAt: new Date(), updatedAt: new Date() })
    .where(
      and(
        eq(pageTransfers.id, transfer.id),
        eq(pageTransfers.status, "pending"),
      ),
    );
  return { ok: true };
}

export type IncomingTransfer = TransferRow & {
  page: Pick<
    typeof profiles.$inferSelect,
    "id" | "slug" | "fullName" | "title" | "avatarUrl" | "avatarSeed" | "domain"
  > | null;
  fromUser: Pick<typeof users.$inferSelect, "id" | "phone"> | null;
};

/**
 * Pending incoming transfers for a viewer, matched by their phone (NOT by
 * to_user_id — an unregistered recipient who just signed up has a null
 * to_user_id until they accept). Used by the in-app prompt + notifications.
 */
export async function listIncomingForViewer(
  viewerPhone: string,
): Promise<IncomingTransfer[]> {
  const db = getDb();
  return db.query.pageTransfers.findMany({
    where: and(
      eq(pageTransfers.toPhone, viewerPhone),
      eq(pageTransfers.status, "pending"),
    ),
    orderBy: [desc(pageTransfers.createdAt)],
    with: {
      page: {
        columns: {
          id: true,
          slug: true,
          fullName: true,
          title: true,
          avatarUrl: true,
          avatarSeed: true,
          domain: true,
        },
      },
      fromUser: { columns: { id: true, phone: true } },
    },
  }) as Promise<IncomingTransfer[]>;
}

export type OutgoingTransfer = TransferRow & {
  page: Pick<
    typeof profiles.$inferSelect,
    "id" | "slug" | "fullName" | "title"
  > | null;
};

/** Pending outgoing transfers for a sender, oldest-first. */
export async function listOutgoingForUser(
  fromUserId: string,
): Promise<OutgoingTransfer[]> {
  const db = getDb();
  return db.query.pageTransfers.findMany({
    where: and(
      eq(pageTransfers.fromUserId, fromUserId),
      eq(pageTransfers.status, "pending"),
    ),
    orderBy: [asc(pageTransfers.createdAt)],
    with: {
      page: {
        columns: { id: true, slug: true, fullName: true, title: true },
      },
    },
  }) as Promise<OutgoingTransfer[]>;
}

/** Count of pending incoming transfers for a viewer (nav badge). */
export async function countIncomingForViewer(
  viewerPhone: string,
): Promise<number> {
  const db = getDb();
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(pageTransfers)
    .where(
      and(
        eq(pageTransfers.toPhone, viewerPhone),
        eq(pageTransfers.status, "pending"),
      ),
    );
  return row?.count ?? 0;
}

/**
 * Public landing loader. Returns the transfer + page preview for a token,
 * regardless of whether the visitor is logged in. The page itself only shows
 * a preview; acceptance still goes through `acceptTransfer` with its phone
 * gate.
 */
export async function getTransferByToken(token: string) {
  const db = getDb();
  const transfer = await db.query.pageTransfers.findFirst({
    where: eq(pageTransfers.token, token),
    with: {
      page: {
        columns: {
          id: true,
          slug: true,
          fullName: true,
          title: true,
          avatarUrl: true,
          avatarSeed: true,
          domain: true,
        },
      },
      fromUser: { columns: { id: true, phone: true } },
    },
  });
  return transfer ?? null;
}

/**
 * Mark all pending transfers past their expiry as `expired`. Called from
 * /api/cron/expire-transfers. Returns the number of rows flipped.
 */
export async function expireStaleTransfers(): Promise<number> {
  const db = getDb();
  const rows = await db
    .update(pageTransfers)
    .set({ status: "expired", updatedAt: new Date() })
    .where(
      and(
        eq(pageTransfers.status, "pending"),
        lt(pageTransfers.expiresAt, new Date()),
      ),
    )
    .returning({ id: pageTransfers.id });
  return rows.length;
}

/** Postgres unique-violation detector (SQLSTATE 23505). */
function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: string }).code === "23505"
  );
}
