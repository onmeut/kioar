# Kioar — Billing & Entitlements

> Operator + contributor reference for the billing/feature/multi-page system that shipped in Phases 1–14 of [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md). Persian/RTL/light-theme product, Iran-only payments via Zarinpal, self-hosted Postgres, no Stripe.

---

## 1. Mental model

A **page** (physical table: `profiles`) is the billing unit. One user can own many pages; each page has exactly one **subscription** ([page_subscriptions](drizzle/0017_page_subscriptions.sql)) that points at one **plan** ([plans](drizzle/0016_plan_registry.sql)) and produces a denormalized **entitlement cache** (`page_entitlements`) — one row per `(page_id, feature_key)` for fast, single-probe gating.

```
plans (3) ──┐
            ├──< plan_features (101) >── features (52)
            │
page_subscriptions (1 per page) ──► page_entitlements (rebuilt on every state change)
```

Product code never asks "is this Pro?" — it asks "does this page have feature `business_bookings`?" via [`pageHasFeature(pageId, key)`](src/lib/entitlements.ts). Plan shape is allowed to change. `feature_key` strings are forever.

### Source of truth

- Plan/feature matrix: [scripts/seed-plans.ts](scripts/seed-plans.ts) — insert-only seeder, idempotent, never updates or deletes existing rows. Production matrix edits happen via `/admin/plans` and survive re-seeding.
- Feature key compile-time union: [`FeatureKey`](src/lib/entitlements.ts) — keep in sync with the seeder.
- Workflow rule for adding new gateable features: [CLAUDE.md → "Feature Registry Workflow"](CLAUDE.md). Read before adding any new capability that could plausibly be plan-gated.

---

## 2. Data model

| Table                       | Purpose                                                                                     | PK / Uniqueness                                  |
| --------------------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| `plans`                     | 3 rows: `free`, `pro`, `business`. Prices in **integer toman**. `trial_days` per plan.      | `id` PK, `key` unique                            |
| `features`                  | 52 rows. `lookup_key` is the stable contract.                                               | `id` PK, `key` unique                            |
| `plan_features`             | 101 rows mapping `(plan_id, feature_id)` with optional `limit_value` (bigint) for caps.     | `(plan_id, feature_id)` PK                       |
| `page_subscriptions`        | One row per page. State machine fields below.                                               | `page_id` UNIQUE                                 |
| `page_entitlements`         | Denormalized cache. `source` ∈ `subscription \| admin_grant \| promo`.                      | `(page_id, feature_key)` PK                      |
| `invoices`                  | All money fields are `integer` toman. `status` ∈ `pending \| paid \| canceled \| refunded`. | `id` PK; `(fiscal_year, sequence)` unique number |
| `payments`                  | Idempotency on `authority` (Zarinpal token).                                                | `authority` UNIQUE                               |
| `billing_invoice_sequences` | Per-fiscal-year monotonic counter. Held under `pg_advisory_xact_lock`.                      | `fiscal_year` PK                                 |
| `billing_transitions_log`   | Cron idempotency log.                                                                       | `(page_id, transition_type, key_date)` PK        |
| `discount_codes`            | Admin-managed. `code_normalized` unique.                                                    | `id` PK                                          |
| `discount_redemptions`      | One row per applied use. Recurring redemptions carry forward.                               | `id` PK                                          |
| `sms_templates`             | 14 rows. `key` unique.                                                                      | `id` PK                                          |
| `sms_queue`                 | `idempotency_key` unique → safe to enqueue twice.                                           | `idempotency_key` UNIQUE                         |
| `admin_audit_log`           | Every admin mutation writes here.                                                           | `id` PK                                          |

### Subscription state machine

States: `trialing`, `active`, `grace`, `expired`, `canceled`. Transitions are evaluated nightly by `/api/cron/billing` and applied per row inside a transaction with idempotency via `billing_transitions_log`. The seven transitions:

| `transition_type`              | Trigger                                     | Effect                                                                |
| ------------------------------ | ------------------------------------------- | --------------------------------------------------------------------- |
| `trial_ending_in_3d`           | trial ends in 3 days                        | enqueue `trial_ending_soon` SMS                                       |
| `trial_ending_today`           | trial ends today                            | enqueue `trial_ended_invoice_due` SMS, generate invoice (no Zarinpal) |
| `period_ending_in_5d`          | active period ends in 5 days                | enqueue `renewal_reminder_5d` SMS                                     |
| `period_ending_in_1d`          | active period ends in 1 day                 | enqueue `renewal_reminder_1d` SMS                                     |
| `period_ended_to_grace`        | period over, no payment                     | flip → `grace`, enqueue `grace_period_started`                        |
| `cancel_at_period_end_applied` | period ends + `cancelAtPeriodEnd=true`      | flip → `canceled` → Free, `rebuildEntitlements`                       |
| `pending_plan_change_applied`  | period ends + `pendingPlanChangePlanId` set | flip plan, `rebuildEntitlements`                                      |
| `grace_ended_to_expired`       | grace exhausted                             | flip → `expired` → Free, `rebuildEntitlements`. **Config preserved.** |

See [src/lib/billing-state.ts](src/lib/billing-state.ts) and the unit tests in [tests/billing-state.test.ts](tests/billing-state.test.ts).

---

## 3. Entitlement gating

```ts
import {
  pageHasFeature,
  requireFeature,
  getPageEntitlementLimit,
} from "@/lib/entitlements";

// Render branch — graceful degradation
if (await pageHasFeature(pageId, "business_bookings")) {
  // render the bookings block
}

// Hard gate — throws FeatureGateError, caller maps to 404
await requireFeature(pageId, "business_form_submissions_dashboard");

// Numeric cap — null = unlimited (boolean feature) or no plan cap
const cap = await getPageEntitlementLimit(pageId, "storage_image_uploads");
```

Rules:

- **Never** compare plan keys (`plan === "pro"`) in product code. Only compare in registry-aware code (`lib/trial.ts`, `lib/pricing-registry.ts`, billing UI).
- `getPageEntitlements` is wrapped in React `cache()` — same render collapses to one DB query. There is no cross-request cache; subscription mutations call `rebuildEntitlements` inside the same TX so observers can never see a stale `(plan, entitlements)` pair.
- `rebuildEntitlements(tx, pageId)` deletes only `source = 'subscription'` rows. Admin grants and live promos are preserved.
- Reads of stored data are never gated. Only writes / new renders are. A page that loses `business_bookings` still has its booking history visible — just no new bookings can come in and the public block is hidden.

---

## 4. Checkout flow

```
client                 /api/billing/checkout                 Zarinpal               /api/billing/callback
  │  POST {planKey,             │                                │                          │
  │       cycle, code?}         │                                │                          │
  │ ─────────────────────────── │                                │                          │
  │                             │  validateDiscountCode          │                          │
  │                             │  computeTotals (banker's VAT)  │                          │
  │                             │  if total === 0:               │                          │
  │                             │     ─ INSERT invoice (paid)    │                          │
  │                             │     ─ advance period           │                          │
  │                             │     ─ rebuildEntitlements      │                          │
  │                             │     ─ enqueue payment_received │                          │
  │                             │  else:                         │                          │
  │                             │     ─ INSERT invoice (pending) │                          │
  │                             │     ─ requestPayment ─────────►│                          │
  │                             │     ─ INSERT payment(authority)│                          │
  │ ◄ {redirectUrl}             │                                │                          │
  │ ──────────────────────── browser redirect ─────────────────► │                          │
  │                                                              │  user pays / cancels     │
  │ ◄────────────────────────────────────────────────────────── redirect with Authority,Status
  │                                                                                         │
  │                                                              verifyPayment ────────────►│
  │                                                              (TX:                       │
  │                                                                ─ flip invoice → paid    │
  │                                                                ─ flip payment → ok      │
  │                                                                ─ advance period         │
  │                                                                ─ rebuildEntitlements    │
  │                                                                ─ enqueue SMS)           │
```

Idempotency:

- **Checkout duplicates** are absorbed by `payments.authority` UNIQUE.
- **Verify duplicates** (user reloads callback URL, network retry) are absorbed by Zarinpal status code 101 ("already verified") which we treat as success and short-circuit before re-mutating the invoice. See [tests/zarinpal.test.ts](tests/zarinpal.test.ts).
- **Free-total checkout** (e.g. `free_months: 12` discount) skips Zarinpal entirely — the route writes a paid invoice and extends the period inside one TX.

Invoice numbering: `lib/invoice-numbering.ts` takes `pg_advisory_xact_lock` keyed on the fiscal year, increments `billing_invoice_sequences`, and returns a stable per-year monotonic number. No collisions across concurrent checkouts.

---

## 5. Trial flow

- One trial **per plan** **ever** per page. Sentinels: `page_subscriptions.hasUsedTrialPro`, `hasUsedTrialBusiness`.
- Trial length comes from `plans.trial_days` (currently 7d for Pro & Business). Never hardcode 7.
- Onboarding redirects first-page owners directly to `/dashboard/pages/[pageId]/trial`.
- `POST /api/billing/trial/start` runs eligibility + state flip + `rebuildEntitlements` in one TX.

See [src/lib/trial.ts](src/lib/trial.ts).

---

## 6. Plan changes

| User intent        | Endpoint                   | Server behaviour                                                                                                                       |
| ------------------ | -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Free → paid        | `/api/billing/change-plan` | Treated as a fresh checkout. Redirects to Zarinpal.                                                                                    |
| Paid → higher paid | `/api/billing/change-plan` | Prorated upgrade via [`computeProration`](src/lib/billing-math.ts). New invoice for the delta. Charged at Zarinpal.                    |
| Paid → lower paid  | `/api/billing/change-plan` | `pendingPlanChangePlanId` set; applied at next period end by cron (`pending_plan_change_applied`). No immediate charge.                |
| Paid → Free        | `/api/billing/change-plan` | Immediate flip to Free + `rebuildEntitlements`. Sentinel value records this was a paid→Free downgrade. No refund (period is paid-out). |
| Cancel             | `/api/billing/cancel`      | `cancelAtPeriodEnd = true`. User keeps access to end of period, then cron applies `cancel_at_period_end_applied`. Rejected on Free.    |
| Reactivate         | `/api/billing/reactivate`  | Clears `cancelAtPeriodEnd`.                                                                                                            |

Proration uses banker's rounding (half-to-even) on integer toman. See [tests/billing-math.test.ts](tests/billing-math.test.ts) for the matrix (upgrade / downgrade / expired-period guard / negative cases).

---

## 7. Discount codes

[src/lib/discounts.ts](src/lib/discounts.ts) validates and applies. The validator runs at checkout time and returns one of these stable error codes (used by the discount UI for Persian copy):

`not_found`, `inactive`, `not_started_yet`, `expired`, `max_redemptions_reached`, `max_per_user_reached`, `not_first_purchase`, `wrong_plan`, `wrong_cycle`, `free_months_requires_monthly`.

Discount kinds:

- **`percent`** — applied to subtotal, integer-floored.
- **`fixed_amount`** — clamped at subtotal (never produces a negative invoice).
- **`free_months: N`** — produces zero-total, skips Zarinpal, extends period by `N` months via `addMonthsUtc`. Monthly-only (validator rejects on annual cycle).

Recurring discounts (`is_recurring=true`, `recurring_cycles=N`) carry forward across renewals as long as the subscription stays active. Cancel + reactivate breaks the chain (the redemption row is not auto-relinked).

`computeDiscountAmount` is pure-math and unit-tested in [tests/discounts.test.ts](tests/discounts.test.ts). The DB-bound branches of `validateDiscountCode` (`first_time_only`, `max_redemptions`, `max_per_user`, plan/cycle resolution) are covered by integration testing — see "Known gaps" below.

---

## 8. SMS

- Provider: Kavenegar. 14 templates seeded by [scripts/seed-sms-templates.ts](scripts/seed-sms-templates.ts).
- Enqueue: `enqueueSms({ pageId, templateKey, recipient, params, idempotencyKey })`. The `idempotency_key` UNIQUE constraint absorbs duplicates.
- Worker: `/api/cron/sms` claims rows with `FOR UPDATE SKIP LOCKED`, retries up to 3× with exponential backoff, marks `failed` on exhaustion.

Templates fired by the system:

| Event                                            | Template key              |
| ------------------------------------------------ | ------------------------- |
| Successful first checkout                        | `welcome`                 |
| Trial start                                      | `trial_started`           |
| 3 days before trial end                          | `trial_ending_soon`       |
| Trial end (invoice generated)                    | `trial_ended_invoice_due` |
| 5 days / 1 day before active period end          | `renewal_reminder_5d/1d`  |
| Successful payment                               | `payment_received`        |
| Failed payment                                   | `payment_failed`          |
| Discount applied                                 | `discount_applied`        |
| Plan change applied                              | `plan_changed`            |
| Cancel scheduled                                 | `cancellation_confirmed`  |
| Grace started                                    | `grace_period_started`    |
| Subscription expired                             | `subscription_expired`    |
| Invoice generated (manual paths, e.g. trial-end) | `invoice_generated`       |

---

## 9. Cron

Two systemd timers hit two routes nightly. Both routes are bearer-protected, fail-closed if `CRON_SECRET` is missing (503 `cron_disabled`), and use `pg_try_advisory_lock` so a stuck run can't be doubled.

| Route               | Lock key           | Purpose                                  |
| ------------------- | ------------------ | ---------------------------------------- |
| `/api/cron/billing` | `7427301519462396` | Apply billing transitions for all pages. |
| `/api/cron/sms`     | `7427301519462397` | Drain `sms_queue`.                       |

Operator setup: see [docs/cron.md](docs/cron.md).

---

## 10. Admin

`/admin` (requires `ADMIN_PHONE_NUMBERS` membership):

- **`/admin/billing`** — MRR, status buckets, recent invoices, top discount codes.
- **`/admin/billing/pages`** — search by name, slug, owner phone, Zarinpal `ref_id`.
- **`/admin/billing/pages/[pageId]`** — full drill-down: subscription state, invoices, payments, entitlements, manual actions.
- **`/admin/plans`** — plan/feature matrix editor. The "rebuild for all pages on this plan" button (`adminRebuildPlanEntitlementsAction`) is **explicit** — matrix edits do NOT auto-cascade. This is intentional: a sloppy click should not silently reshape thousands of rows.
- **`/admin/discounts`** — create / toggle / list redemptions.
- **`/admin/sms`** — template editor, test send, queue browser.
- **`/admin/billing/invoices`** — global invoice browser with manual mark-paid + cancel.

Every admin mutation writes to `admin_audit_log` via [`src/lib/admin-audit.ts`](src/lib/admin-audit.ts).

---

## 11. Environment variables

Required for billing:

| Var                    | Required where | Notes                                              |
| ---------------------- | -------------- | -------------------------------------------------- |
| `DATABASE_URL`         | always         | —                                                  |
| `CRON_SECRET`          | production     | Without it, both cron routes return 503.           |
| `ZARINPAL_MERCHANT_ID` | checkout       | `lib/zarinpal.ts` throws if missing.               |
| `ZARINPAL_SANDBOX`     | local dev      | `1` / `true` / `yes` swaps API base + redirect.    |
| `BILLING_VAT_RATE`     | optional       | Decimal in `[0, 0.5]`. Default 0. `0.09` = 9٪.     |
| `KAVENEGAR_API_KEY`    | SMS send       | Worker logs + retries on missing.                  |
| `KAVENEGAR_TEMPLATE`   | SMS send       | —                                                  |
| `KAVENEGAR_SENDER`     | SMS send       | —                                                  |
| `NEXT_PUBLIC_APP_URL`  | callback URLs  | Used to build Zarinpal callback + OAuth redirects. |
| `ADMIN_PHONE_NUMBERS`  | admin access   | Comma-separated E.164 list.                        |

A working template lives at [.env.example](.env.example).

---

## 12. Testing

Pure-logic suites (run via `pnpm test`):

- [tests/billing-pricing.test.ts](tests/billing-pricing.test.ts) — totals, VAT, period_end.
- [tests/billing-math.test.ts](tests/billing-math.test.ts) — proration matrix, banker's rounding.
- [tests/billing-state.test.ts](tests/billing-state.test.ts) — every cron transition, no-fire on expired/canceled.
- [tests/zarinpal.test.ts](tests/zarinpal.test.ts) — verify HTTP-shape idempotency.
- [tests/discounts.test.ts](tests/discounts.test.ts) — `computeDiscountAmount` matrix.

### Known gaps (carried over from Phase 14)

The following paths are not covered by automated tests and rely on staging walkthroughs:

1. `pageHasFeature` per `source` (subscription / admin_grant / promo) — needs DB harness.
2. Full DB-bound `validateDiscountCode` matrix (`first_time_only`, `max_redemptions`, `max_per_user`, recurring auto-apply).
3. `verifyPayment` callback-route TX dedupe (verify code 101 path inside the route, not just the lib).
4. Expiry preserves config (render assertion that links/blocks/forms remain after `grace_ended_to_expired`).
5. Public renderer hides / editor locks render-level assertions.
6. End-to-end happy path: signup → trial → upgrade → SMS → schedule downgrade → period end → preserved data.

Track with the audit document in [PHASE_AUDIT.md](PHASE_AUDIT.md).

---

## 13. Operating playbook

| Situation                                              | What to do                                                                                                                                                                               |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Customer reports payment took but plan didn't activate | Search `/admin/billing/pages` by Zarinpal `ref_id`. If invoice is `pending` and payment row has `verified_at`, use manual mark-paid. The audit log captures who/when.                    |
| Customer needs a comp                                  | `/admin/billing/pages/[id]` → manual entitlement grant (`source = admin_grant`) for specific features, or manual plan change + manual period extension. Both bypass billing transitions. |
| Need to add a new gateable feature                     | Follow the **Feature Registry Workflow** in [CLAUDE.md](CLAUDE.md). Stop and ask the user for plan mapping before writing code.                                                          |
| Need to change Pro/Business price                      | Edit via `/admin/plans`. Do NOT edit `seed-plans.ts` and re-seed — the seeder is insert-only.                                                                                            |
| Cron didn't run last night                             | Re-run is safe — `billing_transitions_log` PK absorbs duplicates per row.                                                                                                                |
| Postgres restore from backup                           | Re-run `pnpm db:migrate` then `pnpm db:seed:plans` and `pnpm db:seed:sms`. Both are idempotent.                                                                                          |
| Zarinpal sandbox not redirecting                       | Confirm `ZARINPAL_SANDBOX=1` and you're using the documented sandbox merchant ID, not a production one.                                                                                  |
