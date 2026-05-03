/**
 * Kavenegar verify/lookup adapter.
 *
 * The OTP path (`lib/sms.ts`) talks to the same provider but via a
 * single hardcoded template (`KAVENEGAR_TEMPLATE`). Phase 10 needs a
 * per-template dispatcher for transactional notifications (trial,
 * billing, plan-change) where the template name is admin-editable per
 * `sms_templates.kavenegarTemplate`. This module is the thin HTTP layer;
 * queue management lives in `lib/sms-queue.ts`.
 *
 * Variables are mapped onto Kavenegar's `token`, `token2`, `token3`
 * positional slots in the order they appear in `variableSchema`. Up to
 * 10 tokens are supported (Kavenegar's published limit).
 */
import { log } from "@/lib/log";

export type KavenegarSendInput = {
  /** Kavenegar template name (e.g. `kioarTrialStarted`). */
  template: string;
  /** Receptor in `98...` form (matches the rest of the codebase). */
  phone: string;
  /** Ordered token values. Index 0 → `token`, 1 → `token2`, … */
  tokens: Array<string | number>;
};

export type KavenegarSendResult =
  | { provider: "kavenegar-template" }
  | { provider: "console" };

const TOKEN_PARAMS = [
  "token",
  "token2",
  "token3",
  "token4",
  "token5",
  "token6",
  "token7",
  "token8",
  "token9",
  "token10",
] as const;

function toLocalIranianPhone(phone: string) {
  return phone.startsWith("98") ? `0${phone.slice(2)}` : phone;
}

function isPlaceholderApiKey(apiKey: string) {
  return (
    apiKey.length === 0 ||
    apiKey === "your-kavenegar-api-key" ||
    apiKey === "changeme" ||
    apiKey.startsWith("your-")
  );
}

function shouldUseDevFallback(apiKey: string | undefined) {
  // Mirrors `lib/sms.ts`: in production we NEVER silently fall back to
  // console delivery; mismatched env throws so it surfaces loudly.
  if (process.env.NODE_ENV === "production") {
    if (!apiKey || isPlaceholderApiKey(apiKey)) {
      throw new Error(
        "KAVENEGAR_API_KEY is missing or is a placeholder in production.",
      );
    }
    return false;
  }
  if (!apiKey) return true;
  return isPlaceholderApiKey(apiKey);
}

async function assertKavenegarResponse(response: Response) {
  const payload = (await response.json()) as {
    return?: {
      status?: number;
      message?: string;
    };
  };
  if (!response.ok || payload.return?.status !== 200) {
    throw new Error(payload.return?.message || "ارسال پیامک ناموفق بود.");
  }
}

export async function sendKavenegarLookup(
  input: KavenegarSendInput,
): Promise<KavenegarSendResult> {
  const apiKey = process.env.KAVENEGAR_API_KEY?.trim();

  if (shouldUseDevFallback(apiKey)) {
    log.info("sms.kavenegar.dev_fallback", {
      template: input.template,
      phone: input.phone,
      tokenCount: input.tokens.length,
    });
    return { provider: "console" };
  }

  if (input.tokens.length > TOKEN_PARAMS.length) {
    throw new Error(
      `Kavenegar lookup supports up to ${TOKEN_PARAMS.length} tokens, got ${input.tokens.length}.`,
    );
  }

  const url = new URL(
    `https://api.kavenegar.com/v1/${apiKey}/verify/lookup.json`,
  );
  url.searchParams.set("receptor", toLocalIranianPhone(input.phone));
  url.searchParams.set("template", input.template);
  input.tokens.forEach((value, index) => {
    const param = TOKEN_PARAMS[index];
    if (!param) return;
    url.searchParams.set(param, String(value));
  });

  const response = await fetch(url, {
    cache: "no-store",
    method: "GET",
  });

  await assertKavenegarResponse(response);

  return { provider: "kavenegar-template" };
}
