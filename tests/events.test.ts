import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import {
  canTransition,
  computeDiscountedAmount,
  decideInitialStatus,
  type EventConfig,
} from "@/lib/events/state";

function cfg(over: Partial<EventConfig> = {}): EventConfig {
  return {
    approvalRequired: false,
    receiptUploadEnabled: false,
    waitlistEnabled: false,
    priceType: "free",
    capacity: null,
    ...over,
  };
}

describe("decideInitialStatus", () => {
  it("free + approval off → approved", () => {
    assert.deepEqual(decideInitialStatus(cfg(), 0), { status: "approved" });
  });

  it("free + approval on → pending_approval", () => {
    assert.deepEqual(
      decideInitialStatus(cfg({ approvalRequired: true }), 0),
      { status: "pending_approval" },
    );
  });

  it("paid + receipt on → payment_pending", () => {
    assert.deepEqual(
      decideInitialStatus(
        cfg({ priceType: "paid", receiptUploadEnabled: true }),
        0,
      ),
      { status: "payment_pending" },
    );
  });

  it("paid + receipt off → pending_approval", () => {
    assert.deepEqual(
      decideInitialStatus(cfg({ priceType: "paid" }), 0),
      { status: "pending_approval" },
    );
  });

  it("capacity full + waitlist off → full (blocked)", () => {
    assert.deepEqual(
      decideInitialStatus(cfg({ capacity: 2 }), 2),
      { full: true },
    );
  });

  it("capacity full + waitlist on → waitlisted", () => {
    assert.deepEqual(
      decideInitialStatus(cfg({ capacity: 2, waitlistEnabled: true }), 2),
      { status: "waitlisted" },
    );
  });

  it("under capacity, free auto-approve → approved", () => {
    assert.deepEqual(
      decideInitialStatus(cfg({ capacity: 10 }), 3),
      { status: "approved" },
    );
  });

  it("full diverts even non-auto-approve paths to waitlist", () => {
    assert.deepEqual(
      decideInitialStatus(
        cfg({
          priceType: "paid",
          receiptUploadEnabled: true,
          capacity: 1,
          waitlistEnabled: true,
        }),
        1,
      ),
      { status: "waitlisted" },
    );
  });
});

describe("computeDiscountedAmount", () => {
  it("percentage discount", () => {
    assert.deepEqual(computeDiscountedAmount(100_000, "percentage", 20), {
      amountToman: 80_000,
      discountToman: 20_000,
    });
  });

  it("fixed discount", () => {
    assert.deepEqual(computeDiscountedAmount(100_000, "fixed", 30_000), {
      amountToman: 70_000,
      discountToman: 30_000,
    });
  });

  it("fixed discount never goes below zero", () => {
    assert.deepEqual(computeDiscountedAmount(50_000, "fixed", 80_000), {
      amountToman: 0,
      discountToman: 50_000,
    });
  });

  it("percentage clamps above 100", () => {
    assert.deepEqual(computeDiscountedAmount(100_000, "percentage", 150), {
      amountToman: 0,
      discountToman: 100_000,
    });
  });

  it("free event ignores discount", () => {
    assert.deepEqual(computeDiscountedAmount(0, "percentage", 50), {
      amountToman: 0,
      discountToman: 0,
    });
  });

  it("rounds percentage to whole toman", () => {
    const { amountToman, discountToman } = computeDiscountedAmount(
      99_999,
      "percentage",
      33,
    );
    assert.equal(discountToman, 33_000); // round(99999*0.33=32999.67)=33000
    assert.equal(amountToman, 66_999);
  });
});

describe("canTransition", () => {
  it("allows approve from pending", () => {
    assert.equal(canTransition("pending_approval", "approved"), true);
  });
  it("allows check-in (attended) from approved", () => {
    assert.equal(canTransition("approved", "attended"), true);
  });
  it("rejects re-approving an attended registration", () => {
    assert.equal(canTransition("attended", "approved"), false);
  });
  it("rejected is terminal", () => {
    assert.equal(canTransition("rejected", "approved"), false);
  });
  it("cancelled can re-register", () => {
    assert.equal(canTransition("cancelled", "approved"), true);
  });
  it("payment_pending → payment_submitted", () => {
    assert.equal(canTransition("payment_pending", "payment_submitted"), true);
  });
});
