import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import {
  canTransition,
  computeDiscountedAmount,
  decideInitialStatus,
  type EventConfig,
} from "@/lib/events/state";
import { parseQrTarget } from "@/lib/events/qr-target";

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

describe("parseQrTarget (QR check-in resolution)", () => {
  it("full URL with a plain slug → slug target", () => {
    assert.deepEqual(parseQrTarget("https://kioar.com/maryam"), {
      kind: "slug",
      slug: "maryam",
    });
  });

  it("bare slug (no scheme, no slash) → slug target", () => {
    assert.deepEqual(parseQrTarget("maryam"), { kind: "slug", slug: "maryam" });
  });

  it("slug is lower-cased", () => {
    assert.deepEqual(parseQrTarget("https://kioar.com/Maryam"), {
      kind: "slug",
      slug: "maryam",
    });
  });

  it("/c/{id} card URL → card target, id upper-cased", () => {
    assert.deepEqual(parseQrTarget("https://kioar.com/c/abc2345"), {
      kind: "card",
      cardId: "ABC2345",
    });
  });

  it("structurally-invalid card id → null", () => {
    // contains '1' and 'O' which are not in the card alphabet, wrong length
    assert.equal(parseQrTarget("https://kioar.com/c/1O"), null);
  });

  it("/u/{uuid} → user target", () => {
    const uuid = "11111111-2222-3333-4444-555555555555";
    assert.deepEqual(parseQrTarget(`https://kioar.com/u/${uuid}`), {
      kind: "user",
      userId: uuid,
    });
  });

  it("/u/ with a non-uuid → null", () => {
    assert.equal(parseQrTarget("https://kioar.com/u/not-a-uuid"), null);
  });

  it("reserved app routes are not identity QRs", () => {
    assert.equal(parseQrTarget("https://kioar.com/events"), null);
    assert.equal(parseQrTarget("https://kioar.com/admin"), null);
    assert.equal(parseQrTarget("https://kioar.com/discover"), null);
  });

  it("empty / garbage → null", () => {
    assert.equal(parseQrTarget(""), null);
    assert.equal(parseQrTarget("   "), null);
    assert.equal(parseQrTarget("https://"), null);
  });

  it("foreign (non-Kioar) URL still parses its first segment as a slug", () => {
    // Resolution (DB lookup) is what rejects it; parsing only extracts shape.
    assert.deepEqual(parseQrTarget("https://instagram.com/someone"), {
      kind: "slug",
      slug: "someone",
    });
  });
});
