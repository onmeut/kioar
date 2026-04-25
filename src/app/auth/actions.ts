"use server";

import { redirect } from "next/navigation";

import { idleState, type ActionState } from "@/lib/action-state";
import { issueSignInOtp, verifySignInOtp } from "@/lib/auth/otp";
import {
  continuePendingEventRegistrationOrRedirect,
  createSessionForUser,
  findOrCreateUserByPhone,
} from "@/lib/auth/session";
import { log } from "@/lib/log";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp, ipRateKey, phoneRateKey } from "@/lib/request-ip";
import { authRequestSchema, verifyOtpSchema } from "@/lib/validations";

// Rate limits for OTP issuance. These are deliberately strict because every
// successful call sends an SMS we pay for and because OTP endpoints are the
// most common enumeration / spam target.
const OTP_PER_IP_LIMIT = 10;
const OTP_PER_IP_WINDOW_SEC = 60 * 60; // 1 hour
const OTP_PER_PHONE_DAILY_LIMIT = 10;
const OTP_PER_PHONE_DAILY_WINDOW_SEC = 60 * 60 * 24;
const VERIFY_PER_IP_LIMIT = 30;
const VERIFY_PER_IP_WINDOW_SEC = 60 * 60;

async function enforceOtpRequestLimits(
  phone: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const ip = await getClientIp();
  const [ipBucket, phoneBucket] = await Promise.all([
    checkRateLimit(
      ipRateKey("otp", ip),
      OTP_PER_IP_LIMIT,
      OTP_PER_IP_WINDOW_SEC,
    ),
    checkRateLimit(
      phoneRateKey("otp", phone),
      OTP_PER_PHONE_DAILY_LIMIT,
      OTP_PER_PHONE_DAILY_WINDOW_SEC,
    ),
  ]);

  if (!ipBucket.allowed) {
    log.warn("otp.rate_limit.ip", { ip, count: ipBucket.count });
    return {
      ok: false,
      message: "تعداد درخواست‌ها از این شبکه زیاد است. بعداً دوباره تلاش کنید.",
    };
  }
  if (!phoneBucket.allowed) {
    log.warn("otp.rate_limit.phone", { phone, count: phoneBucket.count });
    return {
      ok: false,
      message:
        "تعداد درخواست‌های کد برای این شماره امروز به حد مجاز رسیده است.",
    };
  }
  return { ok: true };
}

export async function requestOtpAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = authRequestSchema.safeParse({
    phone: formData.get("phone"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      fieldErrors: parsed.error.flatten().fieldErrors,
      message: "شماره موبایل معتبر نیست.",
    };
  }

  const limit = await enforceOtpRequestLimits(parsed.data.phone);
  if (!limit.ok) {
    return { status: "error", message: limit.message };
  }

  const result = await issueSignInOtp(parsed.data.phone);

  if (!result.ok) {
    return {
      status: "error",
      cooldownUntil: result.cooldownUntil,
      message: "برای درخواست مجدد، کمی صبر کنید.",
    };
  }

  const searchParams = new URLSearchParams({
    phone: parsed.data.phone,
    cooldownUntil: String(result.cooldownUntil),
  });

  redirect(`/auth/verify?${searchParams.toString()}`);
}

export async function resendOtpAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = authRequestSchema.safeParse({
    phone: formData.get("phone"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: "شماره موبایل معتبر نیست.",
    };
  }

  const limit = await enforceOtpRequestLimits(parsed.data.phone);
  if (!limit.ok) {
    return { status: "error", message: limit.message };
  }

  const result = await issueSignInOtp(parsed.data.phone);

  if (!result.ok) {
    return {
      status: "error",
      cooldownUntil: result.cooldownUntil,
      message: "هنوز زمان ارسال مجدد نرسیده است.",
    };
  }

  return {
    status: "success",
    cooldownUntil: result.cooldownUntil,
    message: "کد جدید ارسال شد.",
  };
}

export async function verifyOtpAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = verifyOtpSchema.safeParse({
    phone: formData.get("phone"),
    code: formData.get("code"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      fieldErrors: parsed.error.flatten().fieldErrors,
      message: "کد تایید معتبر نیست.",
    };
  }

  // Brute-force guard: cap verify attempts per IP and per phone, in addition
  // to the per-code attempt counter already enforced inside verifySignInOtp.
  const ip = await getClientIp();
  const [ipBucket, phoneBucket] = await Promise.all([
    checkRateLimit(
      ipRateKey("otp-verify", ip),
      VERIFY_PER_IP_LIMIT,
      VERIFY_PER_IP_WINDOW_SEC,
    ),
    checkRateLimit(
      phoneRateKey("otp-verify", parsed.data.phone),
      VERIFY_PER_IP_LIMIT,
      VERIFY_PER_IP_WINDOW_SEC,
    ),
  ]);
  if (!ipBucket.allowed || !phoneBucket.allowed) {
    log.warn("otp.verify.rate_limit", {
      ip,
      phone: parsed.data.phone,
      ipCount: ipBucket.count,
      phoneCount: phoneBucket.count,
    });
    return {
      status: "error",
      message:
        "تعداد تلاش‌های بررسی کد زیاد است. چند دقیقه دیگر دوباره تلاش کنید.",
    };
  }

  const result = await verifySignInOtp(parsed.data.phone, parsed.data.code);

  if (!result.ok) {
    if (result.reason === "invalid") {
      return {
        status: "error",
        fieldErrors: {
          code: ["کد واردشده صحیح نیست."],
        },
        message: "کد واردشده صحیح نیست.",
      };
    }

    if (result.reason === "locked") {
      return {
        status: "error",
        message: "این کد دیگر قابل استفاده نیست. لطفاً دوباره کد دریافت کنید.",
      };
    }

    return {
      status: "error",
      message: "کد منقضی شده است. دوباره درخواست کد بدهید.",
    };
  }

  const user = await findOrCreateUserByPhone(parsed.data.phone);

  if (user.bannedAt) {
    log.warn("auth.blocked.banned", { userId: user.id });
    return {
      status: "error",
      message:
        "این حساب مسدود شده است. برای اطلاعات بیشتر با پشتیبانی تماس بگیرید.",
    };
  }

  await createSessionForUser(user.id);

  if (!user.profile?.isComplete) {
    redirect("/onboarding");
  }

  await continuePendingEventRegistrationOrRedirect(user.id);

  return idleState;
}
