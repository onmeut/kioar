import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import {
  evaluateTransferGuard,
  transferShareUrl,
} from "@/lib/transfer-service";

/**
 * These tests pin the *security boundary* of page-ownership transfers: the
 * decision of whether a given viewer may act on a given transfer. The token
 * is only a locator — acceptance is gated on the viewer's phone matching the
 * transfer's `toPhone`. If `evaluateTransferGuard` ever loosens, a leaked
 * link could hijack a page, so these assertions are the canary.
 */

const PHONE = "+989121234567";
const OTHER_PHONE = "+989350000000";

function transfer(overrides: {
  status?: "pending" | "accepted" | "rejected" | "canceled" | "expired";
  toPhone?: string;
  expiresAt?: Date;
}) {
  return {
    status: overrides.status ?? "pending",
    toPhone: overrides.toPhone ?? PHONE,
    expiresAt: overrides.expiresAt ?? new Date(Date.now() + 60_000),
  };
}

describe("transfer guard: authorization boundary", () => {
  const now = Date.now();

  it("allows a pending, unexpired, phone-matched transfer", () => {
    const result = evaluateTransferGuard(transfer({}), PHONE, now);
    assert.equal(result.ok, true);
  });

  it("rejects a missing transfer as not_found", () => {
    assert.deepEqual(evaluateTransferGuard(null, PHONE, now), {
      ok: false,
      reason: "not_found",
    });
    assert.deepEqual(evaluateTransferGuard(undefined, PHONE, now), {
      ok: false,
      reason: "not_found",
    });
  });

  it("rejects a non-pending transfer as not_pending", () => {
    for (const status of ["accepted", "rejected", "canceled", "expired"] as const) {
      const result = evaluateTransferGuard(transfer({ status }), PHONE, now);
      assert.deepEqual(result, { ok: false, reason: "not_pending" }, status);
    }
  });

  it("rejects an expired transfer as expired", () => {
    const result = evaluateTransferGuard(
      transfer({ expiresAt: new Date(now - 1) }),
      PHONE,
      now,
    );
    assert.deepEqual(result, { ok: false, reason: "expired" });
  });

  it("treats expiresAt exactly at now as expired (boundary)", () => {
    const result = evaluateTransferGuard(
      transfer({ expiresAt: new Date(now) }),
      PHONE,
      now,
    );
    assert.deepEqual(result, { ok: false, reason: "expired" });
  });

  it("rejects when the viewer's phone does not match toPhone", () => {
    const result = evaluateTransferGuard(transfer({}), OTHER_PHONE, now);
    assert.deepEqual(result, { ok: false, reason: "phone_mismatch" });
  });

  it("phone mismatch wins over a valid token — locator never authorizes", () => {
    // The function takes no token at all: it cannot be tricked into accepting
    // on the strength of having located the row. Different phone → denied.
    const result = evaluateTransferGuard(
      transfer({ toPhone: PHONE }),
      OTHER_PHONE,
      now,
    );
    assert.equal(result.ok, false);
  });

  it("checks status before phone (a settled transfer never leaks a match)", () => {
    const result = evaluateTransferGuard(
      transfer({ status: "accepted", toPhone: OTHER_PHONE }),
      PHONE,
      now,
    );
    assert.deepEqual(result, { ok: false, reason: "not_pending" });
  });
});

describe("transfer share URL", () => {
  it("builds an absolute /transfer/<token> URL", () => {
    const url = transferShareUrl("abc123");
    assert.match(url, /\/transfer\/abc123$/);
    assert.match(url, /^https?:\/\//);
  });
});
