import { Buffer } from "node:buffer";
import { timingSafeEqual } from "node:crypto";

import { and, desc, eq, gt, isNull } from "drizzle-orm";

import { getDb } from "@/db";
import { otpCodes } from "@/db/schema";
import { sendOtpCode } from "@/lib/sms";

import {
  generateOtpCode,
  getOtpHash,
  OTP_COOLDOWN_SECONDS,
  OTP_MAX_ATTEMPTS,
  OTP_TTL_SECONDS,
} from "./session";

function equalHashes(first: string, second: string) {
  // timingSafeEqual throws when lengths differ, which on its own leaks timing
  // via exception vs non-exception paths. Guard with an explicit length check
  // and only call timingSafeEqual when lengths match.
  const a = Buffer.from(first);
  const b = Buffer.from(second);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function issueSignInOtp(phone: string) {
  const db = getDb();
  // Only unconsumed OTPs count toward cooldown — a consumed row means the
  // prior login succeeded, so there's no reason to block the next request.
  const latestOtp = await db.query.otpCodes.findFirst({
    where: and(
      eq(otpCodes.phone, phone),
      eq(otpCodes.purpose, "sign-in"),
      isNull(otpCodes.consumedAt),
    ),
    orderBy: [desc(otpCodes.createdAt)],
  });

  if (
    latestOtp &&
    latestOtp.createdAt.getTime() + OTP_COOLDOWN_SECONDS * 1000 > Date.now()
  ) {
    return {
      ok: false as const,
      reason: "cooldown" as const,
      cooldownUntil:
        latestOtp.createdAt.getTime() + OTP_COOLDOWN_SECONDS * 1000,
    };
  }

  const code = generateOtpCode();

  try {
    await sendOtpCode({
      phone,
      code,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // Log so we can diagnose Kavenegar / SMS provider issues from server logs.
    console.error("[kioar:otp] sms delivery failed", { phone, error: message });
    return {
      ok: false as const,
      reason: "sms_failed" as const,
      cooldownUntil: Date.now(),
    };
  }

  await db.insert(otpCodes).values({
    phone,
    purpose: "sign-in",
    codeHash: getOtpHash(phone, code),
    expiresAt: new Date(Date.now() + OTP_TTL_SECONDS * 1000),
  });

  return {
    ok: true as const,
    cooldownUntil: Date.now() + OTP_COOLDOWN_SECONDS * 1000,
  };
}

export async function verifySignInOtp(phone: string, code: string) {
  const db = getDb();
  const latestOtp = await db.query.otpCodes.findFirst({
    where: and(
      eq(otpCodes.phone, phone),
      eq(otpCodes.purpose, "sign-in"),
      gt(otpCodes.expiresAt, new Date()),
      isNull(otpCodes.consumedAt),
    ),
    orderBy: [desc(otpCodes.createdAt)],
  });

  if (!latestOtp) {
    return {
      ok: false as const,
      reason: "expired" as const,
    };
  }

  if (latestOtp.attempts >= OTP_MAX_ATTEMPTS) {
    return {
      ok: false as const,
      reason: "locked" as const,
    };
  }

  const incomingHash = getOtpHash(phone, code);

  if (!equalHashes(latestOtp.codeHash, incomingHash)) {
    await db
      .update(otpCodes)
      .set({
        attempts: latestOtp.attempts + 1,
      })
      .where(eq(otpCodes.id, latestOtp.id));

    return {
      ok: false as const,
      reason: "invalid" as const,
    };
  }

  await db
    .update(otpCodes)
    .set({
      consumedAt: new Date(),
    })
    .where(eq(otpCodes.id, latestOtp.id));

  return {
    ok: true as const,
  };
}
