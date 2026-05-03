"use server";

import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";

import { getDb } from "@/db";
import { profileFormBlocks } from "@/db/schema";
import { eq } from "drizzle-orm";

import { idleState, type ActionState } from "@/lib/action-state";
import { blockKindToFeatureKey } from "@/lib/block-features";
import { pageHasFeature } from "@/lib/entitlements";
import { submitFormPublic } from "@/lib/form-service";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp, ipRateKey } from "@/lib/request-ip";

void idleState;

export async function submitFormAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const blockId = String(formData.get("blockId") || "");
  if (!blockId) {
    return { status: "error", message: "شناسه فرم نامعتبر است." };
  }

  // Phase 5 — gate by entitlement BEFORE any DB write. If the page's
  // current plan no longer grants this feature, the endpoint disappears
  // (404) — public surfaces never reveal "you must upgrade".
  const featureKey = blockKindToFeatureKey("form");
  if (featureKey) {
    const block = await getDb().query.profileFormBlocks.findFirst({
      where: eq(profileFormBlocks.id, blockId),
      columns: { id: true, profileId: true },
    });
    if (!block) notFound();
    const granted = await pageHasFeature(block.profileId, featureKey);
    if (!granted) notFound();
  }

  const ip = await getClientIp();
  const limit = await checkRateLimit(ipRateKey("form-submit", ip), 10, 60);
  if (!limit.allowed) {
    return {
      status: "error",
      message: "تعداد ارسال زیاد است. کمی بعد دوباره تلاش کنید.",
    };
  }

  const valuesRaw = String(formData.get("values") || "{}");
  let values: Record<string, unknown>;
  try {
    values = JSON.parse(valuesRaw);
    if (!values || typeof values !== "object" || Array.isArray(values)) {
      throw new Error("invalid");
    }
  } catch {
    return { status: "error", message: "ورودی نامعتبر است." };
  }

  const ipHash = ip
    ? createHash("sha256").update(ip).digest("hex").slice(0, 32)
    : null;

  const result = await submitFormPublic(blockId, values, ipHash);
  if (!result.ok) {
    return { status: "error", message: result.message };
  }

  // Revalidate the dashboard submissions list so the owner sees the new row
  // on next visit. Public profile doesn't need revalidation here.
  revalidatePath("/forms");

  return { status: "success", message: "ارسال شد." };
}
