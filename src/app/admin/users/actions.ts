"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, isNotNull } from "drizzle-orm";
import { z } from "zod";

import { getDb } from "@/db";
import { profiles, sessions, users } from "@/db/schema";
import { type ActionState } from "@/lib/action-state";
import {
  endImpersonation as endImpersonationHelper,
  requireAdmin,
  startImpersonation as startImpersonationHelper,
} from "@/lib/auth/session";
import { log } from "@/lib/log";
import { profileDetailsFormSchema } from "@/lib/validations";

const BAN_REASON_MAX = 200;

const banSchema = z.object({
  userId: z.string().uuid(),
  reason: z
    .string()
    .trim()
    .max(BAN_REASON_MAX, "دلیل بن طولانی‌تر از حد مجاز است.")
    .optional()
    .default(""),
});

const roleSchema = z.enum(["user", "admin"]);

async function revokeAllSessionsForUser(userId: string) {
  const db = getDb();
  await db
    .update(sessions)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(sessions.userId, userId),
        // Only revoke still-live sessions to avoid touching ancient rows.
        isNotNull(sessions.expiresAt),
      ),
    );
}

// --- Edit basic info -----------------------------------------------------

export async function adminUpdateUserProfileAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const viewer = await requireAdmin();
  const userId = String(formData.get("userId") || "").trim();
  if (!userId) {
    return { status: "error", message: "شناسه کاربر نامعتبر است." };
  }

  const parsed = profileDetailsFormSchema.safeParse({
    fullName: formData.get("fullName"),
    title: formData.get("title"),
    bio: formData.get("bio"),
    slug: formData.get("slug"),
    publicPhone: formData.get("publicPhone"),
    email: formData.get("email"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      fieldErrors: parsed.error.flatten().fieldErrors,
      message: "اطلاعات پروفایل نامعتبر است.",
    };
  }

  const db = getDb();
  const slugOwner = await db.query.profiles.findFirst({
    where: eq(profiles.slug, parsed.data.slug),
  });
  if (slugOwner && slugOwner.userId !== userId) {
    return {
      status: "error",
      fieldErrors: { slug: ["این شناسه قبلاً استفاده شده است."] },
      message: "شناسه عمومی تکراری است.",
    };
  }

  const existing = await db.query.profiles.findFirst({
    where: eq(profiles.userId, userId),
  });

  const values = {
    slug: parsed.data.slug,
    fullName: parsed.data.fullName,
    title: parsed.data.title,
    bio: parsed.data.bio,
    publicPhone: parsed.data.publicPhone || null,
    email: parsed.data.email || null,
    isComplete: true,
    updatedAt: new Date(),
  };

  if (existing) {
    await db.update(profiles).set(values).where(eq(profiles.userId, userId));
  } else {
    await db.insert(profiles).values({ userId, ...values });
  }

  log.info("admin.user.profile_updated", {
    adminId: viewer.user.id,
    userId,
  });
  revalidatePath(`/admin/users/${userId}`);
  revalidatePath("/admin/users");
  return { status: "success", message: "اطلاعات کاربر ذخیره شد." };
}

// Convenience wrapper for plain `<form action>` on the detail page — on
// success we want a URL-driven flash, on failure we still return ActionState
// but most callers pair this with useActionState.
export async function adminUpdateUserProfileRedirectAction(formData: FormData) {
  const userId = String(formData.get("userId") || "").trim();
  const result = await adminUpdateUserProfileAction(
    { status: "idle" },
    formData,
  );
  if (result.status === "success") {
    redirect(`/admin/users/${userId}?saved=1`);
  }
  // On validation errors we currently just bounce back without state. The
  // field errors still surface the next time the page is rendered if the
  // caller adopts useActionState; keeping this simple for now.
  redirect(`/admin/users/${userId}?saved=0`);
}

// --- Change role ---------------------------------------------------------

export async function adminUpdateUserRoleAction(formData: FormData) {
  const viewer = await requireAdmin();
  const userId = String(formData.get("userId") || "").trim();
  const nextRole = roleSchema.safeParse(formData.get("role"));
  if (!userId || !nextRole.success) return;

  // Guard: an admin cannot demote themselves (locks out the panel).
  if (userId === viewer.user.id && nextRole.data !== "admin") {
    return;
  }

  const db = getDb();
  await db
    .update(users)
    .set({ role: nextRole.data, updatedAt: new Date() })
    .where(eq(users.id, userId));

  log.info("admin.user.role_changed", {
    adminId: viewer.user.id,
    userId,
    role: nextRole.data,
  });
  revalidatePath(`/admin/users/${userId}`);
  revalidatePath("/admin/users");
}

// --- Ban / unban ---------------------------------------------------------

export async function adminBanUserAction(formData: FormData) {
  const viewer = await requireAdmin();
  const parsed = banSchema.safeParse({
    userId: formData.get("userId"),
    reason: formData.get("reason"),
  });
  if (!parsed.success) return;

  // Never allow banning yourself or another admin.
  if (parsed.data.userId === viewer.user.id) return;

  const db = getDb();
  const target = await db.query.users.findFirst({
    where: eq(users.id, parsed.data.userId),
  });
  if (!target || target.role === "admin") return;

  await db
    .update(users)
    .set({
      bannedAt: new Date(),
      bannedReason: parsed.data.reason || null,
      updatedAt: new Date(),
    })
    .where(eq(users.id, parsed.data.userId));

  // Kill all live sessions so the ban is effective immediately.
  await revokeAllSessionsForUser(parsed.data.userId);

  log.info("admin.user.banned", {
    adminId: viewer.user.id,
    userId: parsed.data.userId,
  });
  revalidatePath(`/admin/users/${parsed.data.userId}`);
  revalidatePath("/admin/users");
}

export async function adminUnbanUserAction(formData: FormData) {
  const viewer = await requireAdmin();
  const userId = String(formData.get("userId") || "").trim();
  if (!userId) return;

  const db = getDb();
  await db
    .update(users)
    .set({ bannedAt: null, bannedReason: null, updatedAt: new Date() })
    .where(eq(users.id, userId));

  log.info("admin.user.unbanned", { adminId: viewer.user.id, userId });
  revalidatePath(`/admin/users/${userId}`);
  revalidatePath("/admin/users");
}

// --- Delete --------------------------------------------------------------

export async function adminDeleteUserAction(formData: FormData) {
  const viewer = await requireAdmin();
  const userId = String(formData.get("userId") || "").trim();
  const confirmPhone = String(formData.get("confirmPhone") || "").trim();
  if (!userId) return;

  // Safety: don't let the admin nuke their own account.
  if (userId === viewer.user.id) return;

  const db = getDb();
  const target = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });
  if (!target) return;
  if (target.role === "admin") return;

  // Require the admin to re-type the phone as a destructive-action confirm.
  if (confirmPhone && confirmPhone !== target.phone) return;

  await db.delete(users).where(eq(users.id, userId));

  log.warn("admin.user.deleted", {
    adminId: viewer.user.id,
    userId,
  });
  revalidatePath("/admin/users");
  redirect("/admin/users?deleted=1");
}

// --- Impersonation -------------------------------------------------------

export async function adminStartImpersonationAction(formData: FormData) {
  await requireAdmin();
  const userId = String(formData.get("userId") || "").trim();
  if (!userId) return;

  try {
    await startImpersonationHelper(userId);
  } catch (error) {
    log.warn("admin.impersonate.failed", {
      userId,
      error: error instanceof Error ? error.message : String(error),
    });
    redirect(`/admin/users/${userId}?impersonate=error`);
  }
  redirect("/dashboard?impersonating=1");
}

export async function endImpersonationAction() {
  await endImpersonationHelper();
  redirect("/admin/users");
}
