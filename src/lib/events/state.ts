/**
 * Pure event state-machine + pricing helpers. NO server-only imports so this
 * is unit-testable in isolation (tests/events.test.ts). The DB-touching
 * registration service composes these.
 */

export type RegistrationStatus =
  | "pending_approval"
  | "payment_pending"
  | "payment_submitted"
  | "approved"
  | "waitlisted"
  | "rejected"
  | "cancelled"
  | "attended";

export type EventConfig = {
  approvalRequired: boolean;
  receiptUploadEnabled: boolean;
  waitlistEnabled: boolean;
  priceType: "free" | "paid";
  capacity: number | null;
};

/** Statuses that occupy a confirmed spot (count against capacity). */
export const SPOT_STATUSES: readonly RegistrationStatus[] = [
  "approved",
  "attended",
];

/**
 * Decide the initial registration status from the event config and the current
 * confirmed-spot count.
 *
 *   free  + approval off            → approved        (consumes a spot)
 *   free  + approval on             → pending_approval
 *   paid  + receipt on              → payment_pending
 *   paid  + receipt off             → pending_approval
 *   capacity full + waitlist on     → waitlisted
 *   capacity full + waitlist off    → { full: true }  (caller blocks)
 */
export function decideInitialStatus(
  ev: EventConfig,
  confirmedSpots: number,
): { status: RegistrationStatus } | { full: true } {
  const wouldAutoApprove =
    ev.priceType === "free" ? !ev.approvalRequired : false;

  const atCapacity = ev.capacity != null && confirmedSpots >= ev.capacity;

  if (atCapacity) {
    return ev.waitlistEnabled ? { status: "waitlisted" } : { full: true };
  }

  if (wouldAutoApprove) return { status: "approved" };

  if (ev.priceType === "paid") {
    return ev.receiptUploadEnabled
      ? { status: "payment_pending" }
      : { status: "pending_approval" };
  }
  return { status: "pending_approval" };
}

/**
 * Compute the discounted amount for a (price, code) pair. Percentage codes
 * clamp 1..100; fixed codes subtract toman. Result never goes below zero.
 */
export function computeDiscountedAmount(
  priceToman: number,
  type: "percentage" | "fixed",
  value: number,
): { amountToman: number; discountToman: number } {
  if (priceToman <= 0) return { amountToman: 0, discountToman: 0 };
  let discount: number;
  if (type === "percentage") {
    const pct = Math.min(100, Math.max(0, value));
    discount = Math.round((priceToman * pct) / 100);
  } else {
    discount = Math.max(0, value);
  }
  discount = Math.min(discount, priceToman);
  return { amountToman: priceToman - discount, discountToman: discount };
}

/** Legal transitions enforced server-side (documented + tested). */
export const LEGAL_TRANSITIONS: Record<
  RegistrationStatus,
  RegistrationStatus[]
> = {
  pending_approval: ["approved", "rejected", "cancelled", "waitlisted"],
  payment_pending: ["payment_submitted", "cancelled", "rejected"],
  payment_submitted: ["approved", "rejected", "cancelled"],
  waitlisted: ["approved", "rejected", "cancelled"],
  approved: ["attended", "rejected", "cancelled"],
  rejected: [],
  cancelled: ["pending_approval", "payment_pending", "approved", "waitlisted"],
  attended: [],
};

export function canTransition(
  from: RegistrationStatus,
  to: RegistrationStatus,
): boolean {
  return LEGAL_TRANSITIONS[from]?.includes(to) ?? false;
}
