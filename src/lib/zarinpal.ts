/**
 * Phase 6 — Zarinpal payment gateway client.
 *
 * Two operations:
 *
 *   1. `requestPayment` — POST to `/pg/v4/payment/request.json`. Returns
 *      `{ authority, redirectUrl }`. We persist `authority` immediately in
 *      `payments` so the callback handler can resolve the row even if the
 *      user takes hours to return (or never returns).
 *
 *   2. `verifyPayment` — POST to `/pg/v4/payment/verify.json` with the
 *      `authority` echoed back by the gateway. Returns `{ refId, status }`.
 *      The callback handler MUST run this inside the same TX that flips the
 *      invoice to `paid` and advances the subscription period — Zarinpal's
 *      verify endpoint is itself idempotent (status code 101 = "already
 *      verified") so re-running it is safe.
 *
 * Currency: Zarinpal v4 takes amounts in IRR (rials). All Kioar money is
 * stored in toman. We convert at the boundary: `rial = toman * 10`. This
 * is the only place in the codebase that knows about rials.
 *
 * Sandbox vs production:
 *   `ZARINPAL_SANDBOX=1` swaps both the API base and the gateway redirect
 *   to `sandbox.zarinpal.com`. Use the documented sandbox merchant ID for
 *   local development.
 */

const PROD_API = "https://api.zarinpal.com/pg/v4/payment";
const PROD_GW = "https://www.zarinpal.com/pg/StartPay";
const SANDBOX_API = "https://sandbox.zarinpal.com/pg/v4/payment";
const SANDBOX_GW = "https://sandbox.zarinpal.com/pg/StartPay";

function isSandbox() {
  const raw = process.env.ZARINPAL_SANDBOX?.trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes";
}

function getMerchantId() {
  const id = process.env.ZARINPAL_MERCHANT_ID?.trim();
  if (!id) {
    throw new Error("ZARINPAL_MERCHANT_ID is not configured.");
  }
  return id;
}

function tomanToRial(toman: number): number {
  if (!Number.isInteger(toman) || toman < 0) {
    throw new Error(`invalid toman amount: ${toman}`);
  }
  return toman * 10;
}

export type ZarinpalRequestInput = {
  /** Amount in toman. Converted to rial at the gateway boundary. */
  amountToman: number;
  callbackUrl: string;
  description: string;
  /** Iranian mobile in `09xxxxxxxxx` form (Zarinpal expects local format). */
  mobile?: string;
  email?: string;
  metadata?: Record<string, string>;
};

export type ZarinpalRequestResult = {
  authority: string;
  redirectUrl: string;
};

type RawRequestResponse = {
  data?: {
    code?: number;
    message?: string;
    authority?: string;
    fee_type?: string;
    fee?: number;
  };
  errors?: unknown;
};

export async function requestPayment(
  input: ZarinpalRequestInput,
): Promise<ZarinpalRequestResult> {
  const merchantId = getMerchantId();
  const sandbox = isSandbox();
  const apiBase = sandbox ? SANDBOX_API : PROD_API;
  const gwBase = sandbox ? SANDBOX_GW : PROD_GW;

  const body = {
    merchant_id: merchantId,
    amount: tomanToRial(input.amountToman),
    callback_url: input.callbackUrl,
    description: input.description,
    metadata: {
      ...(input.mobile ? { mobile: input.mobile } : {}),
      ...(input.email ? { email: input.email } : {}),
      ...(input.metadata ?? {}),
    },
  };

  const response = await fetch(`${apiBase}/request.json`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  const payload = (await response.json().catch(() => ({}))) as RawRequestResponse;

  if (!response.ok || payload.data?.code !== 100 || !payload.data.authority) {
    throw new Error(
      `Zarinpal request failed: code=${payload.data?.code ?? "?"} message=${
        payload.data?.message ?? response.statusText
      }`,
    );
  }

  return {
    authority: payload.data.authority,
    redirectUrl: `${gwBase}/${payload.data.authority}`,
  };
}

export type ZarinpalVerifyInput = {
  authority: string;
  /** Original invoice amount in toman; Zarinpal echoes this back. */
  amountToman: number;
};

export type ZarinpalVerifyResult =
  | {
      status: "verified";
      /** Zarinpal RefID — what we surface to support / receipts. */
      refId: string;
      /** Whether Zarinpal said "already verified" (101) vs "first verify" (100). */
      alreadyVerified: boolean;
      raw: unknown;
    }
  | {
      status: "failed";
      code: number;
      message: string;
      raw: unknown;
    };

type RawVerifyResponse = {
  data?: {
    code?: number;
    message?: string;
    ref_id?: number | string;
    card_pan?: string;
    card_hash?: string;
    fee_type?: string;
    fee?: number;
  };
  errors?: unknown;
};

export async function verifyPayment(
  input: ZarinpalVerifyInput,
): Promise<ZarinpalVerifyResult> {
  const merchantId = getMerchantId();
  const sandbox = isSandbox();
  const apiBase = sandbox ? SANDBOX_API : PROD_API;

  const body = {
    merchant_id: merchantId,
    authority: input.authority,
    amount: tomanToRial(input.amountToman),
  };

  const response = await fetch(`${apiBase}/verify.json`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  const payload = (await response.json().catch(() => ({}))) as RawVerifyResponse;
  const code = payload.data?.code;
  const refId = payload.data?.ref_id;

  // 100 = first verify, 101 = already verified. Both are success and both
  // include a valid ref_id we can surface to the user.
  if ((code === 100 || code === 101) && refId !== undefined && refId !== null) {
    return {
      status: "verified",
      refId: String(refId),
      alreadyVerified: code === 101,
      raw: payload,
    };
  }

  return {
    status: "failed",
    code: typeof code === "number" ? code : -1,
    message: payload.data?.message ?? response.statusText ?? "verify failed",
    raw: payload,
  };
}
