# Kioar — Subscription, Plan, Feature & Multi-Page System

> **Status:** Draft, awaiting user confirmation before Phase 1.
> **Owner:** Amir
> **Stack baseline:** Next.js 16 (App Router) · Drizzle + Postgres · Shadcn/ui · IRANYekanXVF · Self-hosted (Docker + Caddy) · Kavenegar SMS · Zarinpal (to be added)
> **Locale:** Persian-only UI, RTL, **light theme** for all new surfaces.
> **No Stripe / Supabase / PaaS. No auto-charge. No custom domains. No teams. No password-gated links.**

---

## 0. Findings from the codebase audit (what exists today)

| Area                      | Today                                                                                                                                                                                                                                                                     |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Auth**                  | Phone + OTP (Kavenegar). `users` (uuid, phone, role enum `user`/`admin`), `sessions`, `otp_codes`, `oauth_accounts`. Admin role bootstrapped from `ADMIN_PHONE_NUMBERS`.                                                                                                  |
| **Profile = page**        | One `profiles` row per user (unique `userId`). Slug routed at `/[slug]`. There is **no** first-class `pages` entity; the user **is** the page.                                                                                                                            |
| **Blocks**                | `profileLinks` (max 8), `profileBookingBlocks` (+ types, availability, bookings), `profileFormBlocks` (+ fields, submissions), events live separately.                                                                                                                    |
| **Analytics**             | `profileStatsByDay`, `linkStatsByDay`. No 7-day/unlimited gating today.                                                                                                                                                                                                   |
| **Branding**              | Avatar, fullName, bio, SEO meta, OG image, app icon. **No** custom colors / fonts / themes / pixels / UTM yet — these are in the matrix but **not built**, so the registry will list them and the editor will surface them as Pro/Business features (locked) until built. |
| **SMS**                   | `src/lib/sms.ts` (Kavenegar lookup). One env template (`KAVENEGAR_TEMPLATE`).                                                                                                                                                                                             |
| **Cron**                  | One endpoint `POST/GET /api/cron/cleanup` with `Bearer CRON_SECRET` + `pg_advisory_lock`. Hit by external timer (systemd / Caddy). **Reuse this pattern**, do not introduce BullMQ/pg_cron.                                                                               |
| **Rate limit / Redis**    | `src/lib/rate-limit.ts` + `src/lib/redis.ts` already in place.                                                                                                                                                                                                            |
| **Admin**                 | `/admin` shell exists with users / events / requests sections. Gated by `requireAdmin()`.                                                                                                                                                                                 |
| **Pricing UI**            | `/pro` is a marketing page + plan selector (no backend). `pro-promo-bar.tsx` has a hardcoded "5 days" countdown — to be replaced with real trial state.                                                                                                                   |
| **Hardcoded plan checks** | **None.** Greenfield for entitlements (great — nothing to rip out).                                                                                                                                                                                                       |
| **Tests**                 | None apparent. We will add lightweight Node-runner tests only for critical paths (Phase 14).                                                                                                                                                                              |

### Key inferences this plan rests on

1. **`profiles` → `pages` rename + multi-page is a _real_ refactor.** Every reference (`profileLinks`, `profileBookingBlocks`, `profileFormBlocks`, `profile_stats_by_day`, `getPublicProfileBySlug`, etc.) needs to swap from `userId` ownership semantics to `pageId` ownership while keeping `userId` as owner. We will keep table names backward-compatible where possible (`profiles` stays, but `userId` becomes non-unique and a `pages` view/alias is introduced) — see Phase 1 below for the exact strategy.
2. **There is no money or billing code to migrate.** Net-new.
3. **Persian-only, light theme.** All new components: `bg-white` / `bg-zinc-50` shells, no dark variants, copy in Farsi, numerals via `toPersianDigits`, prices via `formatToman`.

---

## Open questions (please confirm before Phase 1)

1. **Multi-page strategy on existing `profiles`:** preferred path is **(A) rename `profiles` → `pages` via Drizzle migration + drop the `unique(userId)` constraint + add `ownerId`** (clean). Alternative **(B)** keep `profiles` table and add a thin `pages` table that 1:1-points at `profiles` for now. I recommend (A). Confirm?
2. **Trial length for Pro/Business:** screenshots show 7-day Linktree trial; previous `/pro` UI says 7-day. **Default to 7 days** for both Pro and Business, configurable per plan. OK?
3. **Pricing (toman):** seed values for Pro & Business monthly/annual? My proposal, matching current `/pro` copy:
   - Pro: ۱۴۹٬۰۰۰ /mo · ۱٬۴۹۹٬۰۰۰ /yr (≈16٪ off)
   - Business: ۲۹۹٬۰۰۰ /mo · ۲٬۹۹۹٬۰۰۰ /yr (≈16٪ off)
     These are admin-editable from day one. Confirm or override.
4. **VAT default:** 0٪ in `invoices.vat_amount`, configurable via `BILLING_VAT_RATE` env, no hardcoding. OK?
5. **Existing cron host:** confirm we keep using a systemd timer hitting `/api/cron/*` with `Bearer CRON_SECRET`. We will add `/api/cron/billing` and `/api/cron/sms` endpoints that follow the same auth + advisory-lock pattern.
6. **Free trial eligibility:** one trial per page per plan, ever. Confirm.
7. **Newly-created pages and the trial screen:** screenshots show a "Claim a free 7-day Pro trial" timeline shown right after creating a page (Phase 8 UI). Should this appear **only for the first page a user creates**, or **for every new page**? Default: **every new page**, with a "Skip" link. Confirm.

---

## High-level architecture

```
                ┌────────────────┐
                │     users      │  (existing — unchanged)
                └────────┬───────┘
                         │ 1
                         │
                         │ N
                ┌────────▼───────┐
                │     pages      │  (formerly `profiles`; many per user)
                └────────┬───────┘
            ┌────────────┼────────────┬──────────────┐
            ▼            ▼            ▼              ▼
   page_subscriptions  page_     page_*_blocks   invoices
                       entitlements                │
                                                   ▼
                                                payments (Zarinpal)
                                                   │
                                                   └── discount_redemptions ── discount_codes

  plans ── plan_features ── features    (registry, source of truth)

  sms_templates ── sms_queue (worker → Kavenegar lookup)
```

**Two-layer gating** is enforced everywhere via `pageHasFeature(pageId, key)`:

- **Public renderer** → feature off ⇒ block is filtered out _before_ serialization. Invisible.
- **Editor** → feature off ⇒ block is rendered with `<LockedFeatureCard featureKey>`, the user's existing config visible read-only, with an upgrade CTA.
- **Inbound endpoints** (form submit, booking create) → feature off ⇒ HTTP 404 _before_ any DB write.
- **Read endpoints** (submissions list, bookings list) → always allowed for the owner so users can recover their data.

---

## Phase plan

Each phase is a single PR-sized commit (or a small chain of commits) on `main`. After each phase: `pnpm typecheck` + `pnpm build` must be green.

### Phase 1 — Multi-page foundation

**Goal:** turn the user→profile 1:1 into user→pages 1:N without losing data.

- Migration `0015_pages_foundation.sql`:
  - Rename `profiles` → `pages`.
  - Add `pages.ownerId uuid not null references users(id) on delete cascade` (copy from `userId`, drop the old unique).
  - Add `pages.isPublished bool default true`, keep `slug unique`, keep all existing columns.
  - Recreate FKs: `profile_links.profileId → pages.id`, `profile_booking_blocks.profileId → pages.id`, `profile_form_blocks.profileId → pages.id`, `profile_stats_by_day.profileId → pages.id`, `link_stats_by_day` unchanged (FK via link), `bookings`/`form_submissions` unchanged.
  - Backfill: every existing user → exactly one `pages` row (already 1:1 today).
- Code changes:
  - Rename `profile-service.ts` exports to `page-service.ts` (keep a re-export shim for one commit to avoid touching every importer in a single diff).
  - Rename `getPublicProfileBySlug` → `getPublicPageBySlug` (slug resolution unchanged).
  - Add `lib/pages.ts`: `listPagesForOwner(userId)`, `getPageById`, `requirePageOwnership(pageId, userId)`.
  - Update middleware/auth: dashboard now needs a "current page" concept. Add a `currentPageId` cookie scoped to the dashboard shell with a `<PageSwitcher>` in the sidebar header.
  - Onboarding becomes "create your first page" → seeds a `pages` row + Free `page_subscription` + Free `page_entitlements`.
  - Add `/dashboard/pages` (list + `+ صفحه جدید`).
- Definition of done: existing dev DB migrates cleanly; every test slug still loads; user can create a 2nd page; `/admin` keeps working.

### Phase 2 — Plan + feature registry

- Migration `0016_plan_registry.sql`:
  - `plans` (`id`, `key` enum `free|pro|business`, `name_fa`, `description_fa`, `price_monthly_toman int`, `price_annual_toman int`, `trial_days int default 7`, `display_order`, `is_active`, `is_default bool`, timestamps).
  - `features` (`id`, `key text unique`, `name_fa`, `description_fa`, `category`, `created_at`).
  - `plan_features` (`plan_id`, `feature_id`, `limit_value bigint nullable`, primary key composite).
- Seeder `scripts/seed-plans.ts`: idempotent, reads the matrix at the bottom of this file. Run after each migration.
- Definition of done: 3 plans + ~50 features seeded; `pnpm db:seed:plans` is idempotent.

### Phase 3 — Page subscription + entitlement cache

- Migration `0017_page_subscriptions.sql`:
  - `page_subscriptions` (`id`, `pageId unique`, `planId`, `billingCycle enum monthly|annual`, `status enum active|trialing|pending_renewal|grace|expired|canceled`, `currentPeriodStart`, `currentPeriodEnd`, `trialEndsAt`, `hasUsedTrialPro bool`, `hasUsedTrialBusiness bool`, `cancelAtPeriodEnd bool`, `pendingPlanChangePlanId`, `updatedAt`).
  - `page_entitlements` (`pageId`, `featureKey`, `source enum subscription|admin_grant|promo`, `grantedAt`, `expiresAt nullable`, primary key (`pageId`, `featureKey`)).
- Backfill: every existing page → Free subscription + Free entitlement set.
- Trigger on `pages` insert: auto-create Free subscription + entitlements (in app code, transactional; no SQL trigger).
- Definition of done: every page has exactly one `page_subscription` row.

### Phase 4 — Entitlement helper + audit

- `lib/entitlements.ts`:
  - `getPageEntitlements(pageId): Promise<Set<FeatureKey>>` (per-request cached via React `cache()`).
  - `pageHasFeature(pageId, key): Promise<boolean>`.
  - `requireFeature(pageId, key)` (throws `FeatureLockedError`).
  - `rebuildEntitlements(pageId)`: clears subscription-sourced entitlements + re-grants from current plan (preserves `admin_grant` + non-expired `promo`).
  - `getPlanLimit(pageId, key): number | null`.
- Type-safe `FeatureKey` union derived from the seeded keys.
- Audit: even though there are 0 hardcoded gates today, **migrate UX surfaces**: links count limit, bookings limit, forms gating, analytics window, etc., all to `pageHasFeature` / `getPlanLimit`.
- Bust cache on: subscription change, manual grant, plan-feature toggle (with explicit admin "rebuild" action).

### Phase 5 — Graceful degradation in renderers

- `getPublicPageBySlug`: filter `links`, `bookingBlocks`, `formBlocks`, scheduled-link visibility, custom theme application by entitlement before returning the DTO.
- Editor (`links-page-client.tsx` + child block editors): wrap each block with `<EntitlementBoundary featureKey>`; renders existing config + `LockedFeatureCard` (light, with `قفل شده — ارتقا به Pro/Business` CTA) when feature off.
- Inbound:
  - `POST /[slug]/forms/[formBlockId]/submit` → 404 if feature off.
  - `POST /[slug]/bookings/...` → 404 if feature off.
- Read endpoints (dashboard `submissions`, `bookings`) keep working regardless of entitlements.
- All on-page state mutations preserved — no DELETE on degradation.

> **Phase 5 scope note (deferred):** This phase only enforces _boolean_ feature
> visibility/availability (e.g. `business_bookings`, `business_lead_capture_form`).
> Numeric-cap entitlements — `storage_image_uploads`, `form_submissions_unlimited`,
> per-day-rate features, and any future quota — are **out of scope here** and
> intentionally not enforced. They will be wired up in a later phase that can
> reason about counts/quotas atomically (likely alongside Phase 9 plan changes
> or a dedicated quotas phase). Do not bolt cap checks onto Phase 5 surfaces.

### Phase 6 — Invoices + Zarinpal ✅ DONE

- Migration `0018_invoices_payments.sql`:
  - `invoices` (`id uuid`, `number text unique` like `KIOAR-1404-000001`, `userId`, `pageId`, `planId`, `billingCycle`, `subtotalToman int`, `discountCodeId nullable`, `discountAmountToman int default 0`, `vatToman int default 0`, `totalToman int`, `status enum unpaid|paid|expired|canceled`, `dueAt`, `paidAt nullable`, `metadata jsonb`, `createdAt`).
  - `payments` (`id`, `invoiceId`, `provider enum zarinpal`, `authority text unique`, `refId text nullable`, `amountToman`, `status enum initiated|verified|failed`, `verifiedAt`, `rawResponse jsonb`, `createdAt`).
  - `billing_invoice_sequences` (`year pk`, `last_seq`, `updated_at`) for per-fiscal-year numbering.
- Invoice numbering: Persian fiscal year prefix + monotonically incrementing per-year sequence (`pg_advisory_xact_lock` to prevent races). See `src/lib/invoice-numbering.ts`.
- `src/lib/zarinpal.ts`:
  - `requestPayment({ amountToman, callbackUrl, description, mobile, metadata })` → `{ authority, redirectUrl }`.
  - `verifyPayment({ authority, amountToman })` → `{ status: "verified", refId, alreadyVerified } | { status: "failed", code, message }`.
  - Sandbox/prod URL switch via `ZARINPAL_MERCHANT_ID` + `ZARINPAL_SANDBOX=1`.
- Routes:
  - `POST /api/billing/checkout` (auth) — body: `{ pageId, planKey, billingCycle, discountCode? }` → creates invoice + initiates Zarinpal → returns `{ redirectUrl }`. **Free-total invoices skip Zarinpal**, mark paid, extend period in same TX.
  - `GET /api/billing/callback` (Zarinpal returns here) — verify, mark invoice paid, advance subscription, rebuild entitlements, queue `payment_received` SMS — all in one TX. Idempotent against `payments.authority` unique and verified-payment short-circuit.
- Env: `ZARINPAL_MERCHANT_ID`, `ZARINPAL_SANDBOX`, `BILLING_VAT_RATE` (default `0`).
- **Deferred / cross-phase notes:**
  - SMS enqueueing uses `src/lib/sms-queue.ts` stub — log-only with the full call shape Phase 10 will swap in. No DB rows yet. Call sites are forward-compatible.
  - `discountCode` is accepted by `POST /api/billing/checkout` but ignored (logged). Real validation + `discount_codes` table land in Phase 11. `invoices.discount_code_id` column is added without an FK; the FK is added alongside the table in Phase 11.
  - `rebuildEntitlements(tx, pageId)` was a Phase 4 deliverable that hadn't shipped; added in `src/lib/entitlements.ts` because Phase 6's apply path requires it.
  - Pre-existing JSX breakage in `src/components/navigation/page-switcher.tsx` was unrelated; no fix shipped here (typecheck shows clean against current file state).

### Phase 7 — Subscription state machine + daily cron ✅ DONE

- Migration `0019_billing_transitions_log.sql`:
  - `billing_transitions_log` table with composite PK `(page_id, transition_type, key_date)`. `key_date` is a `date` (not `timestamp`) so two cron runs on the same calendar day collapse onto one row.
  - `transition_type` is plain text (no enum) so adding a new transition is a code change in `lib/billing-state.ts`, not a follow-up migration.
  - FK on `page_id` cascades from `profiles`.
- New endpoint `POST/GET /api/cron/billing` — auth (`Bearer CRON_SECRET`), `pg_try_advisory_lock` (key distinct from cleanup), constant-time secret compare, fail-closed when env missing. Same shape as `/api/cron/cleanup`. Returns `{ ok, scanned, applied, skipped, errors, transitions, errorDetails }`.
- `src/lib/billing-state.ts`:
  - `evaluateTransitions(sub, now)` — pure decision function (exported for unit tests in Phase 14).
  - `transitionForToday(now)` — loads candidates with `plans.key <> 'free'` (free-plan sentinel filter from 0017), evaluates each, applies side effects in per-transition TX so a single bad row can't poison the run.
  - Per-transition idempotency claim: `INSERT … ON CONFLICT DO NOTHING RETURNING 1` against `billing_transitions_log`. Zero rows returned ⇒ already applied, skip side effects.
- Transitions handled:
  - `trial_ending_in_3d` → enqueue SMS `trial_ending_soon`.
  - `trial_ending_today` → generate unpaid invoice (via `computeBillingTotals` + `allocateInvoiceNumber`, `dueAt = now + 24h`), SMS `trial_ended_invoice_due`. **No Zarinpal call** — the cron never talks to a payment gateway; the user pays the invoice from the dashboard.
  - `period_ending_in_5d` / `_1d` → SMS `renewal_reminder_5d` / `_1d`.
  - `period_ended_to_grace` → status='grace', anchor `current_period_end` to `trial_ends_at` for trialing rows so grace is computed from a single column afterwards. SMS `grace_period_started`.
  - `grace_ended_to_expired` (after `GRACE_PERIOD_DAYS = 7`) → plan→Free, status='expired', sentinel period_end (`computePeriodEnd × 100y`), `rebuildEntitlements`, SMS `subscription_expired`.
  - `cancel_at_period_end_applied` → plan→Free, status='canceled', sentinel, `rebuildEntitlements`, SMS `cancellation_confirmed`.
  - `pending_plan_change_applied` → only the **downgrade-to-Free** branch is auto-applied (no payment required). A pending change to a paid plan that reaches the boundary without a checkout drops the sub to grace and clears the pending intent so the user can re-elect from billing settings.
- Operational docs: `docs/cron.md` documents both `/api/cron/cleanup` and `/api/cron/billing` with a templated `kioar-cron@<name>.service`, `OnCalendar=*-*-* 03:00:00` for the daily billing timer, and a `Persistent=true` rationale (combined with per-row idempotency, missed days backfill safely on next boot).
- Cron is daily; running it twice a day is a no-op (advisory-lock guards perf, `billing_transitions_log` PK guards correctness).
- **Files added/changed:**
  - `drizzle/0019_billing_transitions_log.sql` (new)
  - `drizzle/meta/_journal.json` (entry added)
  - `src/db/schema.ts` (+ `billingTransitionsLog` + relation)
  - `src/lib/billing-state.ts` (new)
  - `src/app/api/cron/billing/route.ts` (new)
  - `docs/cron.md` (new)
  - `IMPLEMENTATION_PLAN.md` (this update)
- **Deferred / cross-phase notes:**
  - SMS still routes through `lib/sms-queue.ts` log-only stub. Phase 10 swaps in the real `sms_queue` INSERT — no caller changes needed.
  - Trial-end invoice has no Zarinpal authority/payment row. Phase 9/12 is responsible for the "pay invoice" flow that initiates Zarinpal against an existing unpaid invoice.
  - Paid pending plan change at a boundary the user didn't pay through is intentionally drop-to-grace. A real "scheduled paid upgrade applied at period rollover" needs an auto-charge mechanic, which is out of scope per product rules ("no auto-charge").
  - Numeric-cap entitlements (`storage_image_uploads`, `form_submissions_unlimited`, etc.) remain deferred from Phase 5; not touched here.

### Phase 8 — Trial flow (matches Linktree screenshot, **Persian, light**) ✅ DONE

- After page creation, redirect to `/dashboard/pages/{id}/trial` showing the timeline screen:
  - "ادعای آزمایش رایگان ۷ روزه Pro" — three timeline rows (امروز / در ۵ روز / در ۷ روز) with the user's own `kioar.com/{slug}` substituted in.
  - Primary CTA "شروع آزمایش رایگان" → calls `POST /api/billing/trial/start` (no payment, no Zarinpal, sets status `trialing`, `trialEndsAt = now + 7d`, `hasUsedTrialPro = true`, rebuild entitlements, SMS `trial_started`).
  - Secondary "رد کردن" → stays Free.
- Same screen reused for Business trial entry from `/dashboard/pages/{id}/billing`.
- Eligibility guard: `hasUsedTrialPro` (or Business) blocks re-trial.

**Implementation summary:**

- `lib/trial.ts` — `getTrialEligibility(pageId)` (read model for screen + billing settings) and `startTrial({pageId, planKey, ownerId})` (single-TX write that flips `pageSubscriptions` to `trialing`, sets `trialEndsAt = now + plan.trialDays * 1d`, marks the per-plan `hasUsedTrial*` sentinel, calls `rebuildEntitlements`, enqueues `trial_started` SMS via `sms-queue` stub).
- `POST /api/billing/trial/start` — thin transport wrapping `startTrial`. Body `{ pageId, planKey: "pro" | "business" }`. Status code map: 200 / 400 invalid_body / 403 forbidden / 404 page_not_found / 404 invalid_plan / 409 already_used_trial · page_in_trial · page_on_paid_plan · page_not_active · subscription_missing.
- `/dashboard/pages/[pageId]/trial` — server-rendered Persian / RTL / light timeline screen. Pulls trial length and pricing from `plans` (no hardcoded ۷ in logic; only used in copy strings rendered against `option.trialDays`). Tabs between Pro and Business when both are eligible; renders an "ineligible" banner with link to billing when neither is.
- `components/dashboard/trial-claim-screen.tsx` — client island. 3-row timeline (today / day `trialDays - 2` / day `trialDays`), primary CTA, "رد کردن" secondary, post-trial price preview pulled from the registry.
- `/dashboard/pages/[pageId]/billing` — minimal scaffold (Phase 12 fleshes out). Shows current plan/status/trialEndsAt, eligible-trial CTAs (link to `/trial`), and a fallback ارتقا link to `/pro` when both trials are used. Required because `/api/billing/callback` and `/api/billing/checkout` already redirect here.
- Onboarding redirect — `saveOnboardingProfileForUser` now returns `{ pageId, isFirstPage }`; `saveOnboardingProfileAction` redirects first-page users to `/dashboard/pages/{id}/trial`. Edits to an existing page still go to `/page`.
- "First page only" rule — enforced at the _redirect_ sites (onboarding action). `CreatePageDialog` (additional pages) keeps redirecting to `/page` and never auto-shows the trial screen. Owners can still navigate to `/dashboard/pages/{id}/trial` intentionally from billing settings if they're eligible.

**Files changed:**

- `src/lib/trial.ts` (new)
- `src/app/api/billing/trial/start/route.ts` (new)
- `src/app/(app)/dashboard/pages/[pageId]/trial/page.tsx` (new)
- `src/app/(app)/dashboard/pages/[pageId]/billing/page.tsx` (new — Phase 12 will expand)
- `src/components/dashboard/trial-claim-screen.tsx` (new)
- `src/lib/profile-service.ts` (return `{pageId, isFirstPage}` from onboarding save)
- `src/app/onboarding/actions.ts` (redirect first-page user to trial screen)
- `IMPLEMENTATION_PLAN.md` (this file)

**Migration notes:** none. No schema changes — Phase 8 reuses the `pageSubscriptions.hasUsedTrialPro / hasUsedTrialBusiness / trialEndsAt` columns introduced in Phase 3.

**Deferred (intentional):**

- Numeric-cap entitlements still deferred (per Phase 7 carry-over).
- The billing settings page is a _scaffold_ — full invoices list, change-plan / cancel / reactivate UI lands in Phase 12.
- Trial-end conversion CTA from `/billing` (one-click upgrade once `change-plan` exists) is Phase 9.
- Real SMS sending stays log-only via `lib/sms-queue.ts` until Phase 10 ships the Kavenegar worker.
- The `/pro` marketing page still uses hardcoded copy/prices; that swap to the registry is queued for Phase 12.

**Validation:** `pnpm typecheck` ✅ · `pnpm build` ✅.

**Next phase (for a fresh chat):**

> Phase 9 — Plan changes. Implement the upgrade / downgrade / cancel /
> reactivate lifecycle on top of the Phase 8 foundation:
>
> - `POST /api/billing/change-plan` — Free→paid: full-period invoice via
>   the existing checkout pipeline. Paid→paid upgrade: prorated invoice
>   (`remaining_days / period_days` of the price delta, integer toman,
>   banker's rounding). Downgrade: write `pendingPlanChangePlanId` and
>   surface "اعمال در پایان دوره" — the Phase 7 cron already applies it.
> - `POST /api/billing/cancel` — set `cancelAtPeriodEnd = true`; cron
>   already handles the boundary.
> - `POST /api/billing/reactivate` — clear the cancel flag.
> - `lib/billing-math.ts` — pure proration helper, integer toman, half-to-even.
> - Surface the new endpoints on `/dashboard/pages/{id}/billing` (the
>   Phase 8 scaffold) — replace the placeholder "ارتقا" CTA with real
>   plan-change UI, add cancel / reactivate buttons.
> - Reuse `lib/trial.ts` eligibility for the trial CTAs already on the page.
> - Reuse `enqueueSms` for `plan_changed`, `cancellation_confirmed`.
> - Do NOT hardcode plan keys in gating logic; only use them where
>   selecting the requested plan is unavoidable. Validate that paid→Free
>   downgrade sets the sentinel `currentPeriodEnd` correctly so the cron
>   doesn't re-fire transitions on Free pages.

### Phase 9 — Plan changes

- Endpoints under `/api/billing/`:
  - `change-plan` — upgrade: prorated invoice (remaining_days / period_days). Free→paid: full-period invoice. Downgrade: writes `pendingPlanChangePlanId`, returns "اعمال در پایان دوره".
  - `cancel` — sets `cancelAtPeriodEnd=true`.
  - `reactivate` — clears the cancel flag.
- Proration formula in `lib/billing-math.ts`, integer toman, banker's rounding.

### Phase 10 — SMS system (Kavenegar)

- Migration `0019_sms.sql`:
  - `sms_templates` (`key text PK` like `trial_started`, `kavenegarTemplate text`, `variableSchema jsonb`, `isActive`, timestamps).
  - `sms_queue` (`id`, `userId`, `phone`, `templateKey`, `variables jsonb`, `status enum queued|sending|sent|failed`, `scheduledFor`, `sentAt`, `attempts int`, `lastError`, `idempotencyKey text unique`, timestamps).
- Worker: `POST /api/cron/sms` (every minute via systemd timer, same auth pattern). Picks up to 50 due rows, calls `sendKavenegarLookup(...)`, retries up to 3 times with backoff, marks failed.
- Template keys (matrix from prompt): `welcome`, `trial_started`, `trial_ending_soon`, `trial_ended_invoice_due`, `invoice_generated`, `renewal_reminder_5d`, `renewal_reminder_1d`, `payment_received`, `payment_failed`, `grace_period_started`, `subscription_expired`, `discount_applied`, `plan_changed`, `cancellation_confirmed`. Mapping to Kavenegar template names is admin-editable; seeded with `null` until user fills in.
- Idempotency keys: e.g. `trial_ending_soon:{subscriptionId}:{trialEndsAt:date}`.

### Phase 11 — Discount codes

- Migration `0020_discounts.sql`:
  - `discount_codes` (full schema per prompt; `codeNormalized` lowercased + unique; recurring fields).
  - `discount_redemptions` (code + invoice + user + page + appliedAmount + recurringCyclesRemaining + createdAt).
- Validation pipeline in `lib/discounts.ts`: active + window + max_redemptions + max_per_user + first_time_only + applies_to_plan + applies_to_billing_cycle. Returns either `{ ok: true, finalTotal }` or a structured error.
- Recurring discount: at each successful renewal, if `recurringCyclesRemaining > 0`, copy redemption forward with `recurringCyclesRemaining - 1`. If user cancels and reactivates, the chain is broken (per prompt).
- Free-period: when discount makes total 0, **skip Zarinpal**, mark invoice paid, extend period.

### Phase 12 — User-facing billing UI (Persian, light) ✅ Done

Routes under `/dashboard/pages/[pageId]/`:

- `billing` — header card showing `پلن فعلی: Pro` + status badge + `مدیریت صورت‌حساب` button (matches the Linktree-style "Plans & Billing" card from screenshot 4, in light theme).
- `billing/discount` — discount code input + apply.
- `billing/invoices` — list with Persian-fiscal-year invoice numbers and `پرداخت` button on `unpaid` rows.
- `billing/plans` — pricing cards (Hobby/Pro/Business style from screenshot 2, **light** with our brand colors), monthly/yearly toggle, comparison table (screenshot 3) — **all from the registry**, no hardcoded prices.
- `billing/cancel` — confirm screen with explicit end-of-period semantics.
- `/pricing` (public) — same data source, public-readable, used by marketing pages.

**Implemented in Phase 12:**

- Hub at `src/app/(app)/dashboard/pages/[pageId]/billing/page.tsx` (replaced the Phase 8 scaffold). Shows the current plan, current cycle price, period-end label, paid / failed / cancelled banners (driven by `?paid=` / `?billing=` callbacks), pending plan-change banner, cancel-at-period-end banner, and a 4-tile nav grid into `plans` / `invoices` / `discount` / `cancel` (cancel only when on a paid plan). Trial CTAs surface only while `getTrialEligibility()` reports a remaining trial.
- `billing/plans` route renders the existing Phase 9 `<BillingActionsCard>` (plan picker + monthly/annual + cancel/reactivate) above a registry-driven `<PlanComparisonTable>`. No prices come from code; everything reads `plans` + `planFeatures` from the DB.
- `billing/invoices` route lists every invoice for the page (newest first) via `<InvoicesTable>` with a mobile card layout + desktop table. The "پرداخت" button on `unpaid` rows POSTs to a new `POST /api/billing/invoices/[invoiceId]/pay` route which re-runs `requestPayment()` against Zarinpal and returns the redirect URL.
- `billing/discount` route is a focused screen that wraps the existing Phase 11 `<DiscountCodeInput>` with the page's redeemable plans (everything except `free`) loaded from the registry.
- `billing/cancel` route is a Persian confirmation screen with an explicit "متوجه‌ام …" checkbox before the cancel button is enabled, shows the exact period-end date, and degrades to a "فعال‌سازی مجدد" button if the page already has `cancelAtPeriodEnd`. The client island calls the existing `/api/billing/cancel` and `/api/billing/reactivate` endpoints — no new server logic.
- Public `/pricing` page (`src/app/pricing/page.tsx`) renders `<PricingCards>` + `<PlanComparisonTable>` from `loadPricingPlans()`. CTAs are auth-aware: anonymous → `/auth`, signed-in users with at least one page → that page's `billing/plans`, signed-in without pages → `/onboarding`.
- `/pro` marketing page now reads pricing strictly from the registry. `<PlanSelector>` was rewritten to receive `pro={ priceMonthlyToman, priceAnnualToman, trialDays }` as props and computes the monthly-equivalent + savings badge locally; `priceAnnualToman` is no longer hardcoded. The CTA links to the user's first page billing/plans (or onboarding).
- New shared component `src/components/billing/pricing-cards.tsx` (client) — monthly/annual Tabs with auto-computed savings badge for the highlighted plan; renders 3-column cards with a "پیشنهاد ویژه" sparkles badge; CTA delegated via `renderCta` so the dashboard, marketing, and `/pricing` can each control where it lands.
- New shared component `src/components/billing/plan-comparison-table.tsx` (server, async) — pulls `features` and `planFeatures` from the DB, groups by category, renders ✓ / formatted limit / — per cell with the Pro column highlighted.
- New shared component `src/components/billing/invoices-table.tsx` (client) — Persianized invoice numbers, status badges, mobile cards + desktop table, per-row pay CTA wired to `/api/billing/invoices/[id]/pay`.
- New helper `src/lib/pricing-registry.ts` — `loadPricingPlans()` returns active plans plus a curated "highlights" list per plan, ranked by category and biased toward features that the free plan doesn't already grant. This is the single source of truth for `<PricingCards>`.

**Files added:**

- `src/app/(app)/dashboard/pages/[pageId]/billing/plans/page.tsx`
- `src/app/(app)/dashboard/pages/[pageId]/billing/invoices/page.tsx`
- `src/app/(app)/dashboard/pages/[pageId]/billing/discount/page.tsx`
- `src/app/(app)/dashboard/pages/[pageId]/billing/cancel/page.tsx`
- `src/app/api/billing/invoices/[invoiceId]/pay/route.ts`
- `src/app/pricing/page.tsx`
- `src/components/billing/pricing-cards.tsx`
- `src/components/billing/plan-comparison-table.tsx`
- `src/components/billing/invoices-table.tsx`
- `src/components/billing/cancel-confirm-actions.tsx`
- `src/lib/pricing-registry.ts`

**Files changed:**

- `src/app/(app)/dashboard/pages/[pageId]/billing/page.tsx` (rewritten as the hub).
- `src/app/pro/page.tsx` (now loads `loadPricingPlans()` and computes auth-aware CTA href).
- `src/app/pro/plan-selector.tsx` (now props-driven from the registry; no hardcoded toman values).

**Migration notes:** none. No schema changes in Phase 12.

**Validation:** `pnpm typecheck` ✅, `pnpm build` (webpack) ✅. All Phase 12 routes registered in the build manifest (`/pricing`, `/pro`, `/dashboard/pages/[pageId]/billing/{plans,invoices,discount,cancel}`, `/api/billing/invoices/[invoiceId]/pay`).

**Deferred to later phases:**

- Localized invoice PDF / printable view (not required by spec).
- "تغییر روش پرداخت" UI (we only support Zarinpal redirects today).
- Admin-side billing surfaces — Phase 13.

### Phase 13 — Admin panel

Under `/admin/billing/*` and `/admin/discounts/*`:

- **Discount Programs** view matching screenshot 5 (light): KPIs (Programs / Active / Total Codes / Total Redemptions), `+ ایجاد برنامه` button, table of programs with `کدها +` action.
- Customer/page search + drill-down (subscription state, invoices, payments, entitlements, SMS history, Zarinpal ref-ID search).
- Manual entitlement grant/revoke with optional expiry + reason.
- Manual period extension + manual plan change with reason (audit log).
- Plan/feature matrix editor with explicit "بازسازی برای همه صفحات این پلن" button (no auto-rebuild).
- SMS template mapping + test send + queue browser.
- Invoice browser + manual "mark paid" with reason.
- Dashboard stats (active subs/plan, MRR estimate, trials in progress, payment success rate, top discount codes).
- [ ] **Carry-over from Phase 1:** migrate admin user-edit actions in `src/app/admin/users/actions.ts` (the two `eq(profiles.userId, userId)` lookups around lines 90 and 105) to resolve the target page explicitly. Admin should pick _which_ of the user's pages to edit instead of silently grabbing the first row.

### Phase 14 — Tests

- `node:test` runner (no new framework). Cover:
  - `pageHasFeature` for each `source`.
  - State machine transitions (each branch).
  - `verifyPayment` idempotency on duplicate authority.
  - Discount code validation matrix (per `applies_to_*`, `first_time_only`, `recurring`).
  - `free_months` → zero-total → no Zarinpal → period extended.
  - Expiry preserves config.
  - Public renderer hides; editor locks.

#### Phase 14 completion notes (2026-04-27)

**Status:** complete for the pure-logic surface. DB- / React-render-bound paths
deferred — see "Deferred" below.

**What shipped**

- `pnpm test` runs the Node test runner via tsx. Fifty tests across five
  files, ~1.3s wall time, zero network or DB dependencies.
- `tests/billing-pricing.test.ts` — `computeBillingTotals` (subtotal,
  clamped discount, env-driven VAT with banker's rounding, defensive
  validation) and `computePeriodEnd` (calendar-month / calendar-year
  arithmetic incl. month-end overflow).
- `tests/billing-math.test.ts` — `computeProration` upgrade math, downgrade
  zeroing, expired-period guard, full-period charge at start, integer
  guards; `roundHalfToEven` symmetry incl. negative inputs.
- `tests/billing-state.test.ts` — `evaluateTransitions` for every branch
  the state machine fires today: `trial_ending_in_3d`,
  `trial_ending_today`, paid `period_ending_in_5d/_1d`,
  `period_ended_to_grace`, `cancel_at_period_end_applied` and
  `pending_plan_change_applied` overrides at trial-end and period-end,
  grace → `grace_ended_to_expired`, no-fire on `expired`/`canceled`.
- `tests/discounts.test.ts` — `computeDiscountAmount` matrix: percent
  (floor + clamp at subtotal, range checks), fixed_amount (clamp at
  subtotal, zero-amount guard), free_months (zero-total, freeMonths
  carry-out, monthly-only enforcement), recurring-cycles decrement,
  `normalizeDiscountCode`.
- `tests/zarinpal.test.ts` — `verifyPayment` HTTP shape: code 100 ⇒
  `verified` with `alreadyVerified: false`; code 101 ⇒ `verified` with
  `alreadyVerified: true` (the gateway-side idempotency contract);
  failure codes, malformed body, missing ref_id ⇒ `failed`. `globalThis.fetch`
  is monkey-patched per test.
- Test infrastructure:
  - `tests/tsconfig.json` extends the root tsconfig and aliases
    `server-only` → `tests/stubs/server-only.ts` so any module under test
    that pulls in `@/lib/log`, `@/lib/redis`, etc. can be imported under
    Node without the Next bundler.
  - `tests/stubs/server-only.ts` is a no-op module — bundler-time
    enforcement only matters at build time, not in unit tests.
  - `package.json` adds `pnpm test` →
    `TSX_TSCONFIG_PATH=tests/tsconfig.json node --import tsx --test "tests/*.test.ts"`.
  - `tests/README.md` documents what's covered and what's deferred.
- No new runtime dependencies; no jest, no vitest, no jsdom, no Docker
  test fixtures.

**Validation**

- `pnpm typecheck`: pass.
- `pnpm build`: pass (webpack).
- `pnpm test`: pass — 50/50.

**Deferred (out of scope for a "lightweight node-runner" phase)**

The Phase 14 prompt also lists DB- and renderer-bound paths:

1. `pageHasFeature` per-source (`subscription` / `admin_grant` / `promo`)
   end-to-end.
2. Full `validateDiscountCode` matrix (`first_time_only` lookup,
   `max_redemptions`/`max_per_user`, `applies_to_*` resolution against
   real plan rows, recurring auto-apply via
   `findActiveRecurringRedemption`).
3. `verifyPayment` idempotency at the **callback-route** level (the
   `payments` row dedupe + `invoices` flip-to-paid TX).
4. "Expiry preserves config" — verifying that `rebuildEntitlements` after
   `grace_ended_to_expired` keeps `profile_links` / `profile_form_blocks`
   / `profile_booking_blocks` rows intact and only flips entitlements.
5. "Public renderer hides; editor locks" — render-level snapshot of
   `[slug]/page.tsx` and the dashboard editor under different
   entitlement maps.

The pure decision logic each of those paths sits on top of
(`evaluateTransitions`, `computeDiscountAmount`, `verifyPayment` HTTP
shape, proration math) IS covered. The deferred items all need either a
test database (no fixtures wired up today) or a React-render harness
(no jsdom/Next runtime today). Adding either is the next phase's job —
both should land together so the same harness tests both the gating
helper and the renderer that consumes it.

**Files added**

- `tests/README.md`
- `tests/tsconfig.json`
- `tests/stubs/server-only.ts`
- `tests/billing-pricing.test.ts`
- `tests/billing-math.test.ts`
- `tests/billing-state.test.ts`
- `tests/discounts.test.ts`
- `tests/zarinpal.test.ts`

**Files modified**

- `package.json` — added `pnpm test` script (no new dependencies; tsx is
  already a devDependency).

**Migration notes**

- None. No schema or seed changes.

**Next phase**

- A "Phase 15 — DB + render test harness" would unlock the deferred
  items above. Minimum viable shape:
  - A `tests/integration/setup.ts` that boots a disposable Postgres
    schema (we already have `docker compose up -d postgres`) and
    applies `drizzle-kit push` against a fresh `kioar_test` database.
    Each test file truncates between cases.
  - Seed the same plans/features registry the production seeder uses
    (`scripts/seed-plans.ts`) so feature_keys match.
  - Add render tests via `react-dom/server` + a tiny Next route
    harness (no need for a full jsdom — server-rendered HTML asserts
    are enough for "block hidden vs locked" checks).
  - Then port the deferred items 1–5 above into that harness.
- Independent of the test harness, the Phase 13 carry-over from Phase 1
  (admin user-edit actions still picking the first page silently) is
  still open and should be addressed before any further admin features
  ship.

---

## Files we will create

```
src/lib/
  pages.ts
  entitlements.ts
  billing-state.ts
  billing-math.ts
  zarinpal.ts
  discounts.ts
  invoice-numbering.ts
  sms-queue.ts
src/app/api/
  billing/checkout/route.ts
  billing/callback/route.ts
  billing/trial/start/route.ts
  billing/change-plan/route.ts
  billing/cancel/route.ts
  billing/reactivate/route.ts
  billing/discount/validate/route.ts
  cron/billing/route.ts
  cron/sms/route.ts
src/app/(app)/dashboard/pages/...        (Phase 1, 8, 12)
src/app/admin/billing/...                (Phase 13)
src/app/admin/discounts/...              (Phase 13)
src/components/billing/
  PricingCards.tsx
  PlanComparisonTable.tsx
  TrialTimeline.tsx                      (matches screenshot 1, Persian/light)
  CurrentPlanCard.tsx                    (matches screenshot 4, light)
  DiscountCodeInput.tsx
  LockedFeatureCard.tsx
  InvoicesTable.tsx
src/components/admin/
  DiscountPrograms.tsx                   (matches screenshot 5, light)
  PlanFeatureMatrixEditor.tsx
  SmsTemplateManager.tsx
  EntitlementGrantDialog.tsx
drizzle/
  0015_pages_foundation.sql
  0016_plan_registry.sql
  0017_page_subscriptions.sql
  0018_invoices_payments.sql
  0019_sms.sql
  0020_discounts.sql
scripts/
  seed-plans.ts
  seed-sms-templates.ts
BILLING.md
```

## Files we will modify

- `src/db/schema.ts` (every phase)
- `src/middleware.ts` (current-page cookie)
- `src/app/layout.tsx`, dashboard layouts (page switcher)
- `src/app/[slug]/page.tsx` and children (entitlement filtering)
- `src/lib/data.ts`, `src/lib/profile-service.ts` (rename/path), `src/lib/booking-service.ts`, `src/lib/form-service.ts`
- `src/components/dashboard/*` (entitlement boundaries)
- `src/components/shared/pro-promo-bar.tsx` (real trial state)
- `src/app/pro/*` (registry-driven, light, Persian)
- `.env.example` (new vars)
- `src/lib/sms.ts` (route through queue when called from cron paths)
- `README.md` (deployment cron entries)

---

## New env vars

```
ZARINPAL_MERCHANT_ID=
ZARINPAL_SANDBOX=1
BILLING_VAT_RATE=0
APP_BASE_URL=                  # for callbacks (we already have NEXT_PUBLIC_APP_URL)
```

No new infra (no BullMQ, no pg_cron, no Redis-as-queue). The existing systemd timer pattern is reused.

---

## Things explicitly out of scope (per prompt)

- Custom domains, custom CSS, password-protected links, age gates.
- Teams, workspaces, roles beyond `user`/`admin`, SSO, audit log of _every_ action.
- Public APIs.
- Built-in commerce/payments on the public page (commerce is just a link out).
- Stripe / Supabase / any PaaS dependency.
- Auto-charging via Zarinpal. Period.

---

## Definition of done (whole project)

- All migrations apply cleanly to a fresh DB **and** to Amir's existing dev DB.
- Every existing page row has a Free `page_subscription` and Free entitlement set.
- Public renderer hides locked features; editor shows them locked with previous config visible.
- A user can: sign up → create page → start 7-day Pro trial → pay via Zarinpal at trial end → receive `payment_received` SMS → schedule a downgrade → see it apply at period end → keep all prior config.
- A user can redeem a `free_months: 12` code and skip Zarinpal entirely.
- Cron is idempotent: running twice produces the same state, no double SMS.
- Admin can grant entitlements, change plans, manage discounts, view SMS log + invoices, search by ref-ID.
- `grep -R "=== 'pro'\\|=== 'business'" src/` returns 0 hits in product code (matches only in registry/admin/pricing).
- `BILLING.md` published.

---

## Seed feature matrix (verbatim from prompt — used by `scripts/seed-plans.ts`)

> See the `Feature matrix` table in the user prompt. The seeder reads this verbatim. Limit rows (`storage_image_uploads`, `form_submissions_unlimited`, `booking_slots_unlimited`) become `plan_features.limit_value`. The "Yes/Hidden" branding row maps to a single key `remove_branding` (Free: absent ⇒ branding shown; Pro/Business: present ⇒ branding hidden).
