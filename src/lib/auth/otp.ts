import { Buffer } from "node:buffer";
import { timingSafeEqual } from "node:crypto";

import { and, desc, eq, gt, isNull } from "drizzle-orm";

import { getDb } from "@/db";
import { otpCodes } from "@/db/schema";
import { log } from "@/lib/log";
import { getRedis } from "@/lib/redis";
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

// ---------- resend cooldown (Redis TTL key, fail-open) -----------------------
//
// The cooldown is the SMS-resend throttle. It is a self-expiring Redis key —
// NOT a DB row — so it can never get "stuck" the way an unconsumed/expired
// `otp_codes` row could. Semantics:
//   - `cooldownRemainingMs(phone)`: how long until the next send is allowed
//     (0 = allowed). Returns 0 on any Redis error (fail-open): a Redis outage
//     must never lock out a legitimate signup. Abuse is bounded by the per-
//     phone / per-IP daily caps in `src/app/auth/actions.ts`.
//   - `armCooldown(phone)`: set the key with a TTL of OTP_COOLDOWN_SECONDS,
//     called only AFTER a successful SMS send.

function cooldownKey(phone: string) {
  return `otp:cooldown:sign-in:${phone}`;
}

export async function cooldownRemainingMs(phone: string): Promise<number> {
  const redis = getRedis();
  if (!redis) return 0; // dev without Redis → no cooldown gate, caps still apply
  try {
    const pttl = await redis.pttl(cooldownKey(phone));
    // pttl: -2 = no key, -1 = key without expiry (shouldn't happen here).
    return pttl > 0 ? pttl : 0;
  } catch (err) {
    log.warn("otp.cooldown.read_failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return 0; // fail-open
  }
}

async function armCooldown(phone: string): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  try {
    // SET with PX TTL + NX is unnecessary; we always (re)arm after a send.
    await redis.set(cooldownKey(phone), "1", "EX", OTP_COOLDOWN_SECONDS);
  } catch (err) {
    log.warn("otp.cooldown.arm_failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    // Non-fatal: the SMS already went out; worst case the next resend isn't
    // throttled by cooldown (still bounded by the daily caps).
  }
}

async function clearCooldown(phone: string): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  try {
    await redis.del(cooldownKey(phone));
  } catch (err) {
    log.warn("otp.cooldown.clear_failed", {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

export async function issueSignInOtp(phone: string) {
  const remainingMs = await cooldownRemainingMs(phone);
  if (remainingMs > 0) {
    return {
      ok: false as const,
      reason: "cooldown" as const,
      cooldownUntil: Date.now() + remainingMs,
    };
  }

  const db = getDb();
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

  // Persist the hashed code (expiry-bound), then arm the resend cooldown.
  // Order matters: the row must exist before we advertise a cooldown, and the
  // cooldown is armed only on a *successful* send so a failed SMS leaves the
  // user free to retry immediately.
  await db.insert(otpCodes).values({
    phone,
    purpose: "sign-in",
    codeHash: getOtpHash(phone, code),
    expiresAt: new Date(Date.now() + OTP_TTL_SECONDS * 1000),
  });

  await armCooldown(phone);

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

  // Successful verification ends this auth episode. Drop the resend cooldown so
  // a subsequent legitimate sign-in for the same phone isn't gated by a stale
  // throttle. Fail-open: a Redis error here is harmless (the key self-expires).
  await clearCooldown(phone);

  return {
    ok: true as const,
  };
}
