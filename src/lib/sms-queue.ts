/**
 * Phase 10 SMS queue.
 *
 * `enqueueSms()` writes one row into `sms_queue`. `idempotencyKey` is a
 * UNIQUE column, so retries (callback re-fired, cron re-run) collapse
 * onto a single row via `ON CONFLICT DO NOTHING` — no caller-side dedup
 * needed. The worker (`processSmsQueue`, called from `/api/cron/sms`)
 * picks due `queued` rows with `FOR UPDATE SKIP LOCKED`, dispatches to
 * Kavenegar via `lib/kavenegar.ts`, and either marks the row `sent` or
 * reschedules it with exponential backoff (2m / 4m, max 60m) up to 3
 * attempts before giving up with `failed`.
 *
 * Caller contract (unchanged from the Phase 6 stub):
 *
 *   await enqueueSms({
 *     templateKey: "payment_received",
 *     phone: owner.phone,
 *     idempotencyKey: `payment_received:${invoice.id}`,
 *     variables: { invoice: invoice.number, plan: plan.nameFa },
 *   });
 *
 * Failures inside `enqueueSms` are swallowed at log level — no caller
 * cares whether the SMS made it to disk *right now*; the cron will
 * re-fire on its idempotency key on the next billing run.
 */
import { sql } from "drizzle-orm";

import { getDb } from "@/db";
import { smsQueue, smsTemplates } from "@/db/schema";
import { sendKavenegarLookup } from "@/lib/kavenegar";
import { log } from "@/lib/log";

export type SmsTemplateKey =
  | "welcome"
  | "trial_started"
  | "trial_ending_soon"
  | "trial_ended_invoice_due"
  | "invoice_generated"
  | "renewal_reminder_5d"
  | "renewal_reminder_1d"
  | "payment_received"
  | "payment_failed"
  | "grace_period_started"
  | "subscription_expired"
  | "discount_applied"
  | "plan_changed"
  | "cancellation_confirmed"
  | "referral_referee_rewarded"
  | "referral_referrer_rewarded"
  | "affiliate_application_received"
  | "affiliate_application_approved"
  | "affiliate_application_rejected"
  | "affiliate_application_needs_info"
  | "affiliate_referee_rewarded"
  | "affiliate_commission_earned"
  | "affiliate_payout_requested"
  | "affiliate_payout_paid"
  | "affiliate_payout_rejected";

export type EnqueueSmsInput = {
  templateKey: SmsTemplateKey;
  /** Owner phone in `98...` form (matches the rest of the codebase). */
  phone: string;
  /** Variables passed to the Kavenegar template. */
  variables?: Record<string, string | number>;
  /** UNIQUE dedup key. Stable across retries. */
  idempotencyKey: string;
  /** Defer send until this moment. Defaults to now. */
  scheduledFor?: Date;
  /**
   * Optional owner FK so the admin queue browser can pivot on user.
   * Cron paths that only have a phone leave this undefined.
   */
  userId?: string;
};

export async function enqueueSms(input: EnqueueSmsInput): Promise<void> {
  try {
    const db = getDb();
    await db
      .insert(smsQueue)
      .values({
        userId: input.userId ?? null,
        phone: input.phone,
        templateKey: input.templateKey,
        variables: input.variables ?? {},
        idempotencyKey: input.idempotencyKey,
        scheduledFor: input.scheduledFor ?? new Date(),
      })
      .onConflictDoNothing({ target: smsQueue.idempotencyKey });
  } catch (err) {
    // Never let SMS failures roll back a billing transaction. The cron
    // will pick this up again on the next idempotent invocation.
    log.warn("sms.enqueue.failed", {
      templateKey: input.templateKey,
      idempotencyKey: input.idempotencyKey,
      error: (err as Error).message,
    });
  }
}

// ---------------------------------------------------------------------------
// Worker
// ---------------------------------------------------------------------------

const MAX_ATTEMPTS = 3;
const BACKOFF_CAP_MINUTES = 60;

export type ProcessSmsQueueResult = {
  scanned: number;
  sent: number;
  retried: number;
  failed: number;
  errorDetails: Array<{ id: string; error: string }>;
};

type ClaimedRow = {
  id: string;
  phone: string;
  templateKey: string;
  variables: Record<string, string | number> | null;
  attempts: number;
};

function backoffMinutes(attempts: number): number {
  // attempts is the *new* attempt count after the current failure.
  // 1 → 2m, 2 → 4m, 3+ → handled as `failed` before we reach this.
  const minutes = Math.pow(2, attempts);
  return Math.min(minutes, BACKOFF_CAP_MINUTES);
}

/**
 * Drain up to `limit` due rows from `sms_queue`. Idempotent — running
 * multiple workers concurrently is safe via `FOR UPDATE SKIP LOCKED`.
 */
export async function processSmsQueue(options?: {
  limit?: number;
  now?: Date;
}): Promise<ProcessSmsQueueResult> {
  const limit = options?.limit ?? 50;
  const now = options?.now ?? new Date();
  const db = getDb();

  const result: ProcessSmsQueueResult = {
    scanned: 0,
    sent: 0,
    retried: 0,
    failed: 0,
    errorDetails: [],
  };

  // Atomically claim a batch of due rows: flip `queued` → `sending` and
  // return the rows in one round-trip. `FOR UPDATE SKIP LOCKED` prevents
  // two concurrent workers from claiming the same row. We also flip the
  // status to `sending` so a second worker tick that arrives before
  // dispatch finishes won't re-pick the same id.
  const claimedRowsRaw = (await db.execute(sql`
    UPDATE "sms_queue"
    SET "status" = 'sending', "updated_at" = now()
    WHERE "id" IN (
      SELECT "id" FROM "sms_queue"
      WHERE "status" = 'queued' AND "scheduled_for" <= ${now}
      ORDER BY "scheduled_for" ASC
      LIMIT ${limit}
      FOR UPDATE SKIP LOCKED
    )
    RETURNING "id", "phone", "template_key" AS "templateKey",
              "variables", "attempts"
  `)) as unknown as ClaimedRow[];
  const claimedRows = Array.isArray(claimedRowsRaw)
    ? claimedRowsRaw
    : ((claimedRowsRaw as { rows?: ClaimedRow[] }).rows ?? []);

  result.scanned = claimedRows.length;
  if (claimedRows.length === 0) {
    return result;
  }

  // Pre-load the templates referenced in this batch in one query.
  const templateKeys = Array.from(
    new Set(claimedRows.map((row) => row.templateKey)),
  );
  const templates = await db
    .select({
      key: smsTemplates.key,
      kavenegarTemplate: smsTemplates.kavenegarTemplate,
      variableSchema: smsTemplates.variableSchema,
      isActive: smsTemplates.isActive,
    })
    .from(smsTemplates)
    .where(sql`${smsTemplates.key} = ANY(${templateKeys})`);
  const templateByKey = new Map(templates.map((t) => [t.key, t]));

  for (const row of claimedRows) {
    const template = templateByKey.get(row.templateKey);

    // Hard-fail conditions (no retry — the operator must fix something).
    if (!template) {
      await markFailed(row.id, "template_not_found");
      result.failed += 1;
      result.errorDetails.push({ id: row.id, error: "template_not_found" });
      continue;
    }
    if (!template.isActive) {
      await markFailed(row.id, "template_inactive");
      result.failed += 1;
      result.errorDetails.push({ id: row.id, error: "template_inactive" });
      continue;
    }
    if (!template.kavenegarTemplate) {
      await markFailed(row.id, "template_not_mapped");
      result.failed += 1;
      result.errorDetails.push({ id: row.id, error: "template_not_mapped" });
      continue;
    }

    const tokens = mapVariablesToTokens(
      template.variableSchema,
      row.variables ?? {},
    );

    try {
      await sendKavenegarLookup({
        template: template.kavenegarTemplate,
        phone: row.phone,
        tokens,
      });
      await db.execute(sql`
        UPDATE "sms_queue"
        SET "status" = 'sent', "sent_at" = now(), "updated_at" = now(),
            "attempts" = "attempts" + 1, "last_error" = NULL
        WHERE "id" = ${row.id}
      `);
      result.sent += 1;
    } catch (err) {
      const message = (err as Error).message ?? "unknown_error";
      const newAttempts = row.attempts + 1;
      if (newAttempts >= MAX_ATTEMPTS) {
        await markFailed(row.id, message, newAttempts);
        result.failed += 1;
        result.errorDetails.push({ id: row.id, error: message });
      } else {
        const nextRun = new Date(
          now.getTime() + backoffMinutes(newAttempts) * 60 * 1000,
        );
        await db.execute(sql`
          UPDATE "sms_queue"
          SET "status" = 'queued',
              "attempts" = ${newAttempts},
              "last_error" = ${message},
              "scheduled_for" = ${nextRun},
              "updated_at" = now()
          WHERE "id" = ${row.id}
        `);
        result.retried += 1;
        log.warn("sms.send.retry", {
          id: row.id,
          attempts: newAttempts,
          nextRun: nextRun.toISOString(),
          error: message,
        });
      }
    }
  }

  return result;
}

function mapVariablesToTokens(
  schema: string[] | null,
  variables: Record<string, string | number>,
): Array<string | number> {
  if (Array.isArray(schema) && schema.length > 0) {
    return schema.map((key) => {
      const value = variables[key];
      return value === undefined || value === null ? "" : value;
    });
  }
  // No declared schema: fall back to variable values in insertion order.
  return Object.values(variables);
}

async function markFailed(id: string, message: string, attempts?: number) {
  const db = getDb();
  if (attempts === undefined) {
    await db.execute(sql`
      UPDATE "sms_queue"
      SET "status" = 'failed', "last_error" = ${message},
          "attempts" = "attempts" + 1, "updated_at" = now()
      WHERE "id" = ${id}
    `);
  } else {
    await db.execute(sql`
      UPDATE "sms_queue"
      SET "status" = 'failed', "last_error" = ${message},
          "attempts" = ${attempts}, "updated_at" = now()
      WHERE "id" = ${id}
    `);
  }
}

/**
 * Admin "test send" path. Bypasses the queue (synchronous round-trip)
 * but still requires the template to be mapped + active.
 */
export async function sendSmsTemplateTest(input: {
  templateKey: string;
  phone: string;
  variables?: Record<string, string | number>;
}): Promise<{ ok: true; provider: string } | { ok: false; error: string }> {
  const db = getDb();
  const template = await db.query.smsTemplates.findFirst({
    where: (t, { eq }) => eq(t.key, input.templateKey),
  });
  if (!template) return { ok: false, error: "template_not_found" };
  if (!template.isActive) return { ok: false, error: "template_inactive" };
  if (!template.kavenegarTemplate)
    return { ok: false, error: "template_not_mapped" };

  try {
    const result = await sendKavenegarLookup({
      template: template.kavenegarTemplate,
      phone: input.phone,
      tokens: mapVariablesToTokens(
        template.variableSchema,
        input.variables ?? {},
      ),
    });
    return { ok: true, provider: result.provider };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}
