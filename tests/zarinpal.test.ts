import { strict as assert } from "node:assert";
import { afterEach, beforeEach, describe, it } from "node:test";

import { verifyPayment } from "@/lib/zarinpal";

type FetchFn = typeof globalThis.fetch;

describe("verifyPayment", () => {
  const originalFetch = globalThis.fetch;
  const originalMerchant = process.env.ZARINPAL_MERCHANT_ID;
  const originalSandbox = process.env.ZARINPAL_SANDBOX;

  beforeEach(() => {
    process.env.ZARINPAL_MERCHANT_ID = "00000000-0000-0000-0000-000000000000";
    process.env.ZARINPAL_SANDBOX = "1";
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    if (originalMerchant === undefined) delete process.env.ZARINPAL_MERCHANT_ID;
    else process.env.ZARINPAL_MERCHANT_ID = originalMerchant;
    if (originalSandbox === undefined) delete process.env.ZARINPAL_SANDBOX;
    else process.env.ZARINPAL_SANDBOX = originalSandbox;
  });

  function mockResponse(data: unknown): FetchFn {
    return (async () =>
      new Response(JSON.stringify({ data }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })) as unknown as FetchFn;
  }

  it("treats code 100 as first-time verified", async () => {
    globalThis.fetch = mockResponse({
      code: 100,
      message: "ok",
      ref_id: 1234567890,
    });
    const r = await verifyPayment({
      authority: "A0000000000000000000000000000",
      amountToman: 149_000,
    });
    assert.equal(r.status, "verified");
    if (r.status === "verified") {
      assert.equal(r.refId, "1234567890");
      assert.equal(r.alreadyVerified, false);
    }
  });

  it("treats code 101 as already-verified (idempotent re-call)", async () => {
    globalThis.fetch = mockResponse({
      code: 101,
      message: "verified before",
      ref_id: 9876543210,
    });
    const r = await verifyPayment({
      authority: "A0000000000000000000000000000",
      amountToman: 149_000,
    });
    assert.equal(r.status, "verified");
    if (r.status === "verified") {
      assert.equal(r.refId, "9876543210");
      assert.equal(r.alreadyVerified, true);
    }
  });

  it("returns failed for any other code", async () => {
    globalThis.fetch = mockResponse({
      code: -54,
      message: "transaction failed",
    });
    const r = await verifyPayment({
      authority: "A0000000000000000000000000000",
      amountToman: 149_000,
    });
    assert.equal(r.status, "failed");
    if (r.status === "failed") {
      assert.equal(r.code, -54);
    }
  });

  it("returns failed when the response is empty / malformed", async () => {
    globalThis.fetch = (async () =>
      new Response("not json", { status: 500 })) as unknown as FetchFn;
    const r = await verifyPayment({
      authority: "A0000000000000000000000000000",
      amountToman: 149_000,
    });
    assert.equal(r.status, "failed");
  });

  it("returns failed when ref_id is missing on a 100", async () => {
    globalThis.fetch = mockResponse({ code: 100, message: "ok" });
    const r = await verifyPayment({
      authority: "A0000000000000000000000000000",
      amountToman: 149_000,
    });
    assert.equal(r.status, "failed");
  });
});
