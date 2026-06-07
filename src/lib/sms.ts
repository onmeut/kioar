import { formatPhoneDisplay } from "@/lib/phone";

function toLocalIranianPhone(phone: string) {
  return `0${phone.slice(3)}`;
}

function isPlaceholderApiKey(apiKey: string) {
  return (
    apiKey.length === 0 ||
    apiKey === "your-kavenegar-api-key" ||
    apiKey === "changeme" ||
    apiKey.startsWith("your-")
  );
}

function logDevOtp(phone: string, code: string) {
  console.info(
    `[kioar:otp] dev delivery -> ${formatPhoneDisplay(phone)} | code: ${code}`,
  );
}

function isTestPhone(phone: string): boolean {
  const raw = process.env.OTP_TEST_PHONES?.trim();
  if (!raw) return false;
  return raw
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean)
    .includes(phone);
}

function shouldUseDevFallback(apiKey: string | undefined) {
  // CRITICAL: In production we NEVER fall back to console delivery. Doing so
  // would silently bypass SMS delivery and let anyone with log access sign in
  // as any user. Instead we throw, which surfaces as a loud 500 during
  // misconfiguration and keeps the auth flow closed.
  if (process.env.NODE_ENV === "production") {
    if (!apiKey || isPlaceholderApiKey(apiKey)) {
      throw new Error(
        "KAVENEGAR_API_KEY is missing or is a placeholder in production.",
      );
    }
    return false;
  }

  if (!apiKey) {
    return true;
  }

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

export async function sendOtpCode({
  phone,
  code,
}: {
  phone: string;
  code: string;
}) {
  // OTP_TEST_PHONES: comma-separated allowlist for test accounts.
  // OTP is printed to server logs only — never sent via SMS, never exposed to client.
  // Safe in production: the code still expires normally; only log-access can read it.
  if (isTestPhone(phone)) {
    console.info(
      `[kioar:otp:test] test account ${formatPhoneDisplay(phone)} | code: ${code}`,
    );
    return { provider: "console" as const };
  }

  // DEV ONLY: outside production we never spend SMS credits and never depend on
  // owning the receiving number. Every code is printed to the terminal so any
  // phone you type during local testing is verifiable. This branch is hard-
  // gated on NODE_ENV — production falls straight through to real SMS below and
  // can NEVER reach console delivery (that path would let log-access = account
  // takeover). Set OTP_DEV_REAL_SMS=1 to force real Kavenegar sends in dev.
  if (
    process.env.NODE_ENV !== "production" &&
    process.env.OTP_DEV_REAL_SMS !== "1"
  ) {
    logDevOtp(phone, code);
    return { provider: "console" as const };
  }

  const apiKey = process.env.KAVENEGAR_API_KEY?.trim();

  if (shouldUseDevFallback(apiKey)) {
    logDevOtp(phone, code);
    return {
      provider: "console" as const,
    };
  }

  const receptor = toLocalIranianPhone(phone);
  const template = process.env.KAVENEGAR_TEMPLATE?.trim();
  const isDevelopment = process.env.NODE_ENV !== "production";

  try {
    if (template) {
      const url = new URL(
        `https://api.kavenegar.com/v1/${apiKey}/verify/lookup.json`,
      );

      url.searchParams.set("receptor", receptor);
      url.searchParams.set("token", code);
      url.searchParams.set("template", template);

      const response = await fetch(url, {
        cache: "no-store",
        method: "GET",
      });

      await assertKavenegarResponse(response);

      return {
        provider: "kavenegar-template" as const,
      };
    }

    const sender = process.env.KAVENEGAR_SENDER?.trim();
    const url = new URL(`https://api.kavenegar.com/v1/${apiKey}/sms/send.json`);

    url.searchParams.set("receptor", receptor);
    url.searchParams.set(
      "message",
      `کد ورود کی‌یو‌آر: ${code}\nاین کد تا ۳ دقیقه معتبر است.`,
    );

    if (sender) {
      url.searchParams.set("sender", sender);
    }

    const response = await fetch(url, {
      cache: "no-store",
      method: "GET",
    });

    await assertKavenegarResponse(response);

    return {
      provider: "kavenegar-send" as const,
    };
  } catch (error) {
    if (!isDevelopment) {
      throw error;
    }

    console.warn("[kioar:otp] sms provider unavailable, using dev fallback", {
      error,
    });
    logDevOtp(phone, code);

    return {
      provider: "console" as const,
    };
  }
}
