# Kioar Events — Implementation Plan

> Status: PLAN (awaiting confirmation before destructive migration). Build in reviewable increments.

## 0. Decisions (confirmed with user)

- **QR scanner**: `BarcodeDetector` where available + **jsQR** fallback (decode camera frames on canvas). Works on iOS Safari. Adds one dependency: `jsqr`.
- **QR resolution**: scanned URL → parse `/<slug>` or `/c/{id}` → resolve to page owner `userId` → find that user's registration **for this event**. No new ticket QR; reuse the existing personal QR identity.
- **Old data**: the throwaway events are test-only — **drop the rows**, rebuild the schema cleanly. (Pause point before running the destructive migration.)
- **Public URL shape** (confirmed): `kioar.com/<handle>/e/<eventSlug>`. `/events` = global discovery. Old `/events/[slug]` → redirect shim to the canonical handle URL.

### Locked constraints (confirmed clarifications)

1. **Capacity is enforced on BOTH concurrent paths.** Use a locked transaction (`SELECT … FOR UPDATE` on the event row) (a) on the **register** path when `approvalRequired = false` (instant approval), and (b) on the **approve** path when `approvalRequired = true`. Both can oversell under concurrency.
2. **Receipts are private; covers are public.** Cover images → `events/` bucket folder (public, as today). Payment receipts → `event-receipts/` folder, served via **private upload + presigned URLs** (confirmed): extend `storage.ts` with `uploadPrivateImage` (`ACL: "private"`) and a presigned `GetObject` helper (`@aws-sdk/s3-request-presigner`). The host/admin registrant view mints a short-lived signed URL through an **owner-gated** route; receipts are never in a public payload. Local-dev driver stores them outside `/public` and serves them through the same owner-gated route handler. Store only the **object key** (`receiptKey`) on the registration, not a public URL.
3. **Check-in route is owner-gated.** `/(app)/events/[eventId]/checkin` must verify the current user is the **page owner of that specific event** — the same guard as `/(app)/events/[eventId]/manage`. Not "any authenticated user". (Admin may also pass.)
4. **`/events` global discovery is paginated.** No full-table scan on an unauthed public route. Follow the **Discover exemplar** (`src/app/discover/page.tsx`): `PAGE_SIZE = 24`, `?page=N`, query `LIMIT PAGE_SIZE+1 OFFSET (page-1)*PAGE_SIZE`, derive `hasMore` from the extra row, render prev/next links. Index `(status, startsAt)` already supports the upcoming-soonest sort + filter.
5. **`onlineUrl` must never leak.** The public event page server component strips `onlineUrl` from the rendered payload unless the current viewer's registration status is `approved` or `attended`. Everyone else sees a placeholder: «لینک پس از تأیید نمایش داده می‌شود». Same rule anywhere the event renders publicly (block cards, discovery).

## 1. What exists today (the throwaway prototype)

A shallow, **admin-only, global** events feature:

- `events` table: flat, owned by `created_by_user_id` (admin), single `location` text, `status` enum (`draft|published|closed`), no pricing/approval/capacity/questions/check-in.
- `event_registrations`: `(event_id, user_id, status)` where status is only `registered|cancelled`.
- Routes: `/events` (global list), `/events/[slug]` (public page, uses deprecated `lib/persian`), `/admin/events/*` (CRUD), `/(app)/my-events` + `/(app)/my-events/[slug]` (attendee view).
- The **login-return flow already partly exists**: `setPendingEventRegistration` / `continuePendingEventRegistrationOrRedirect` in `lib/auth/session.ts` + cookie in `lib/auth/pending-intent.ts`. We will keep and extend this pattern.

**Verdict:** rewrite the data model and all flows. Keep table *names* (`events`, `event_registrations`) but redefine columns; add new tables. Delete the old admin-only form/components and global-only assumptions.

## 2. How the real systems work (recon findings)

- **Blocks are page-owned**, not user-owned. A "page" = a row in `profiles` (owner `userId`, many pages per user). Resolve current page via `resolveCurrentPageForOwner()`.
- **Blocks share a `sortOrder` axis** with `profile_links` and render intermixed on `/[slug]`. Each block table has `profileId`, `isActive`, `spotlight`, `animationStyle`, `sortOrder`. Events block follows this exact shape.
- **Block picker**: `src/components/dashboard/add-link-dialog.tsx` → `FEATURE_CARDS` array is the "second row" (link / هماهنگ / محصول / فرم). We add a 5th card **رویداد** with the same lock treatment.
- **Plan gating**: `pageHasFeature(pageId, key)` / `getPageEntitlementLimit`. Block→feature map in `src/lib/block-features.ts`. Lock chip tier via `featureKeyToRequiredPlan` (business_* → purple). Registry seeded in `scripts/seed-plans.ts` (insert-only).
- **Public profile cache** (`src/lib/cache/profile-cache.ts`): `/[slug]` is Redis-cached. Any write affecting render MUST call `invalidateProfileCacheBySlug/ById` after commit. The loader is `loadPublicProfileBySlug` in `lib/data.ts` — events block fetch slots in alongside booking/form/product (gated by entitlement).
- **Personal QR**: encodes the page URL (`/[slug]` or `/c/{id}`). Generated client-side via `qrcode`. No server identity token today.
- **Dates**: Shamsi via `src/lib/date/persian.ts` (`formatShamsiDate`, `formatShamsiDateTime`, etc.); timezones via `src/lib/date/timezone.ts` (`civilToUtc`, `formatShamsi*InZone`). DB stores UTC `timestamptz`. **No ShamsiDatePicker component exists** — current event-form uses native `datetime-local`. We will build a single `<ShamsiDateTimePicker />` in the events module and route event date inputs through it.
- **Uploads**: `uploadPublicImage(file, "events")` → existing bucket. Reuse as-is for covers and receipts.
- **Auth**: `requireUser` / `requireCompletedProfile` / `requireAdmin` from `lib/auth/session`. `getCurrentViewer()` for optional viewer.

## 3. Data model (new)

All money in **toman bigint** (no fractional), per project convention. All timestamps `timestamptz` UTC. Future events store host IANA timezone.

### Enums

```
event_status:           draft | published | cancelled         (computed: full, past)
event_location_type:    physical | online
event_price_type:       free | paid
event_registration_status:
   pending_approval | payment_pending | payment_submitted |
   approved | waitlisted | rejected | cancelled | attended
event_question_kind:    short_text | long_text | single_select | multi_select
event_discount_type:    percentage | fixed     (reuse discountTypeEnum shape; new enum to stay self-contained)
```

### Tables

**`events`** (redefined — page-owned)
- `id`, `pageId → profiles.id (cascade)`, `createdByUserId → users.id (set null)`
- `slug` (unique), `title`, `description`, `coverUrl`
- `locationType`, `locationAddress` (physical), `onlineUrl` (online; revealed only to approved)
- `timezone` (IANA, host zone snapshot at publish; default Asia/Tehran)
- `startsAt`, `endsAt?`
- `capacity?` (null = unlimited)
- `priceType`, `priceToman` (bigint, 0 for free)
- `approvalRequired` (bool), `receiptUploadEnabled` (bool), `waitlistEnabled` (bool)
- `status`, `sortOrder`, `isActive`, `spotlight`, `animationStyle` (block fields)
- timestamps
- indexes: `unique(slug)`, `(pageId, sortOrder)`, `(status, startsAt)`

**`event_questions`** (custom registration questions — self-contained, inspired by `form_fields` but NOT coupled)
- `id`, `eventId (cascade)`, `kind`, `label`, `required`, `options jsonb`, `sortOrder`

**`event_registrations`** (redefined)
- `id`, `eventId (cascade)`, `userId (cascade)`
- `status` (full state machine)
- `answers jsonb` (questionId → string|string[])
- `receiptUrl?`, `discountCode?`, `expectedToman` (bigint; price after discount, snapshot)
- `waitlisted` is represented by status; keep `registeredAt` (createdAt), `decidedAt?` (approve/reject), `cancelledAt?`
- unique `(eventId, userId)`; index `(userId)`, `(eventId, status)`

**`event_discount_codes`**
- `id`, `eventId (cascade)`, `code`, `type`, `value` (bigint toman or percent), `usageLimit?`, `usedCount`, `expiresAt?`, `isActive`
- unique `(eventId, lower(code))`

**`event_checkins`** (audit record — idempotent)
- `id`, `eventId (cascade)`, `registrationId (cascade)`, `userId`, `scannedByUserId`, `checkedInAt`
- unique `(registrationId)` → enforces single check-in; second scan reads existing row → "already checked in at …"

Migration: hand-write `drizzle/00NN_events_rebuild.sql` (drop old `events`/`event_registrations` content + columns, create new shape + enums + tables) **and** add the `_journal.json` entry, verified with `npm run db:migrate`. Per migration discipline, schema.ts change + migration land in one commit.

## 4. State machine (§7.4) — enforced server-side

```
register:
  free,  approval off            → approved
  free,  approval on             → pending_approval
  paid,  receipt on              → payment_pending → (attendee uploads) → payment_submitted
  paid,  receipt off             → pending_approval (price shown, host confirms out-of-band)
  capacity full + waitlist on    → waitlisted
  capacity full + waitlist off   → blocked (error)

host actions:
  pending_approval / payment_submitted → approved | rejected
  waitlisted → approved (manual promote, re-checks capacity)
  approved → attended (check-in) | (host remove → rejected)
attendee:
  any upcoming non-terminal → cancelled (frees a spot)
check-in:
  approved → attended (records event_checkins row, idempotent)
```

**Capacity** counts `approved` + `attended` (+ `pending_approval`/`payment_*`? → No: count only confirmed/approved to avoid blocking on un-acted pendings; document explicitly and re-check capacity at the moment of approval in a transaction with `SELECT … FOR UPDATE` on the event row to prevent oversell on concurrent approvals).

## 5. Plan gating

- New feature key **`business_events`**, category `business_tools`. Maps in `block-features.ts` (`BlockKind` gains `"event"` → `business_events`; `business_*` → purple Business chip).
- Registry: add row + plan mappings to `scripts/seed-plans.ts`; run `npm run db:seed:plans`. **Will ask the 3 registry questions before seeding** (which plans, boolean vs limit, backfill).
- Public renderer hides the events block entirely when ungranted; editor shows `<LockedFeatureCard>` + upgrade CTA (reuse `UpgradePlanModal`). Add card to `FEATURE_CARDS` with `eventsLocked` / `eventsRequiredPlan` wiring through `add-link-dialog.tsx` → `links-page-client.tsx`.
- Admin (`requireAdmin`) bypasses gating.
- Grep gate: zero plan-name comparisons.

## 6. QR check-in architecture (the critical system)

**Resolver** (`src/lib/events/checkin.ts`):
- `resolveQrToUserId(scanned: string)`: accept full URL or bare slug. Parse pathname → if `/c/{id}` → look up card → `pageId` → `profiles.userId`; if `/{slug}` → `profiles.slug` → `userId`. Returns `{ userId, displayName }` or `null` (not a Kioar user).
- `resolveCheckin(eventId, userId)`: load registration for `(eventId, userId)` → return a discriminated result: `approved_ready | already_checked_in(at) | pending_approval | payment_pending | payment_submitted | rejected | cancelled | waitlisted | not_registered`.
- `performCheckin(eventId, registrationId, scannedByUserId)`: transaction — re-load registration `FOR UPDATE`, assert `approved`, insert `event_checkins` (unique on registrationId → idempotent; on conflict return existing), set status `attended`. Returns final state.
- Host-side on-the-spot actions reuse the same approve/verify-receipt server actions.

**Scanner UI** (`src/components/events/checkin-scanner.tsx`, client):
- Request camera (`getUserMedia`, `facingMode: environment`). Big mobile-first result card.
- Decode loop: try `window.BarcodeDetector` (`formats: ['qr_code']`) per animation frame; if unavailable, draw video → canvas → `jsQR(imageData)`.
- On decode: call check-in server action with scanned text → render colored result (green approved / amber pending / red blocked / grey not-registered), attendee name, single primary action ("ثبت ورود" / "تأیید و ثبت ورود" / "تأیید رسید و ورود"). Debounce duplicate scans; show "قبلاً وارد شده در …" on re-scan.
- Failure modes handled: non-Kioar QR, foreign-event registration, poor connection (retry, never corrupt state), concurrent scans (server idempotency), capacity full at promote time.

**Attendee side**: reuse existing personal QR. Surface "نمایش کد QR برای ورود" on `/my-events` (attending) and the event confirmation screen — links to the existing QR (share modal / `qr-card`).

## 7. Routes & components

```
src/db/schema.ts                         redefine events/event_registrations, add 3 tables + enums + relations
drizzle/00NN_events_rebuild.sql          + _journal.json entry

src/lib/events/
  event-service.ts        create/update/publish/cancel/delete (page-owned, slug uniqueness)
  registration-service.ts register / approve / reject / verify-receipt / cancel / promote (state machine + capacity tx)
  discount.ts             validate + apply codes (server-side)
  checkin.ts              QR resolve + resolveCheckin + performCheckin
  calendar.ts             .ics builder (VTIMEZONE via formatIcsLocal) + Google Calendar template URL
  queries.ts              public/host/admin reads

src/lib/block-features.ts                 add "event" → business_events
src/lib/cache/profile-cache.ts            (no change to helpers; ensure event writes call invalidate*)
src/lib/data.ts                           loadPublicProfileBySlug: add gated eventBlocks fetch

src/components/events/
  event-form.tsx                 host create/edit (cover upload, ShamsiDateTimePicker, pricing, toggles, questions builder, discount codes)
  shamsi-datetime-picker.tsx     single reusable Shamsi picker (events module)
  question-builder.tsx           replicate form-field pattern (self-contained)
  discount-codes-editor.tsx
  event-block-row.tsx            editor row (locked state aware)
  public-event-block.tsx         renders cards on /[slug]
  public-event-register.tsx      register CTA + login enforcement + question answers + receipt + discount
  registrant-table.tsx           host management (mobile cards + desktop table), filters, actions, CSV
  checkin-scanner.tsx            QR scanner mode
  add-to-calendar.tsx            Google / Apple(.ics) menu
  my-events-attending.tsx / my-events-hosting.tsx

src/app/(app)/events/                      host: list/create/edit/manage + check-in (within app shell)
  page.tsx, new/page.tsx, [eventId]/edit/page.tsx, [eventId]/manage/page.tsx, [eventId]/checkin/page.tsx, actions.ts
src/app/(app)/my-events/page.tsx           rebuild: dual tabs (شرکت می‌کنم / میزبانی می‌کنم)
src/app/[handle]/events/[slug]/page.tsx    public event page, branded to the business page
   (decision: nest under the business handle so events are branded; keep /events/[slug] as a redirect shim OR move global discovery to /events)
src/app/events/page.tsx                    rebuild as PUBLIC GLOBAL DISCOVERY (search/filter/sort)
src/app/admin/events/                      rebuild: platform-wide list, filters, registrant view, moderate, stats

src/app/[slug]/page.tsx                    map eventBlocks into the render payload (intermixed by sortOrder)
src/components/dashboard/add-link-dialog.tsx + links-page-client.tsx
                                           add رویداد feature card + lock + onAddEvent
```

**Public event page URL decision (needs your nod):** brand events under the business handle — `kioar.com/<handle>/e/<eventSlug>` — so the page carries the business identity, while `/events` is the global discovery surface. The old flat `/events/[slug]` becomes a redirect to the canonical URL.

## 8. Add to calendar (§9)

`.ics` download (Apple/Outlook) with `VTIMEZONE` + `DTSTART;TZID=` via `formatIcsLocal`, `DTSTAMP` via `formatIcsUtc` (both in `lib/date/timezone.ts`). Google Calendar template URL (`render?action=TEMPLATE&dates=…`). Location = address, or online URL only if the viewer is approved.

## 9. Cron / notifications

No new schedulers and no new notification system (§12). If an existing SMS/notification path is trivially reusable for "event cancelled / approved", mirror it; otherwise skip. (Will not build new infra.)

## 10. Tests (`tests/*.test.ts`, node:test + tsx)

- State machine transitions (legal/illegal).
- Capacity enforcement under concurrent approval (oversell guard).
- Discount validation (expiry, usage limit, percentage vs fixed math).
- QR resolution (slug, /c/{id}, foreign user, non-Kioar, foreign-event).
- Check-in idempotency (double scan).
- `.ics`/timezone correctness.

## 11. Build order (reviewable increments)

1. **Schema + migration** (pause for confirmation before destructive run) + enums + relations.
2. **Feature registry** (`business_events`) — ask 3 questions, seed, wire `block-features.ts`.
3. **Picker card + gating** wiring (add-link-dialog, links-page-client, locked editor row).
4. **Host event form** (services: event-service; components: form, ShamsiDateTimePicker, question-builder, discount editor).
5. **Public event page** + **account-required registration** (extends existing pending-intent flow) + approval/receipt/discount paths.
6. **Events block rendering** on `/[slug]` (loader + public-event-block) + cache invalidation.
7. **QR check-in** (checkin.ts + scanner) — most care.
8. **Host management view** (registrant table, approvals, receipts, attendance, CSV, stats).
9. **`/my-events`** dual-purpose + add-to-calendar + show-my-QR.
10. **`/events`** global discovery.
11. **Admin** platform-wide events.
12. Polish: empty states, validation, RTL/Jalali, mobile, tests.

## 12. Guardrails honored

No gradients. `min-h-dvh`. Inputs ≥16px / `h-11` with `inputMode`+`autoComplete`+`enterKeyHint`. Mobile card fallback for the registrant table. No `date-fns-jalali` outside `lib/date/*`. No plan-name comparisons. Migration + schema in one atomic commit. Cache invalidation after commit. `npm run typecheck` + `npm run build` green before "done".
