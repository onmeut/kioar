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
      `کد ورود کیوآر: ${code}\nاین کد تا ۳ دقیقه معتبر است.`,
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
