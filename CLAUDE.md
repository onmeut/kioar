@AGENTS.md

# Kioar — session context

Persian-only (RTL) link-in-bio + bookings/forms/events SaaS, **mobile-first**, installable PWA, self-hosted (Docker + Caddy). Light theme only.

## Stack

- **Next.js 16** App Router, `--webpack` (NOT turbopack — see scripts).
  - This is **not** the Next.js you may know. Read `node_modules/next/dist/docs/` before assuming an API exists.
- **React 19**, TypeScript, Tailwind v4 (`@tailwindcss/postcss`), shadcn/ui (Radix/Base UI), `motion` (Framer Motion), `lucide-react` + `@tabler/icons-react`.
- **Drizzle ORM** + **Postgres** (`postgres` driver). Schema in `src/db/schema.ts`. Migrations in `drizzle/`.
- **Redis** (`ioredis`) for rate limits, OTP cooldowns, SMS queue locks.
- **Kavenegar** SMS lookup. **Zarinpal** payments. **S3-compatible** object storage (`@aws-sdk/client-s3`), with `@vercel/blob` as alt.
- **Auth**: phone + OTP, custom session cookie `kioar_session`, hashed with `AUTH_SECRET`. Admin role from `ADMIN_PHONE_NUMBERS` env.
- **PWA**: Removed. `public/sw.js` is a hand-written kill-switch that unregisters any old service worker and nukes its caches; no SW is registered for new visitors. Do not reintroduce `next-pwa`.
- **Fonts**: IRANYekanXVF (local in `src/fonts`) + Vazirmatn variable.
- **npm** is the package manager.

## Scripts (use these, not bare `next` / `tsc`)

```
npm run dev              # next dev --webpack
npm run build            # next build --webpack   ← must be green before declaring done
npm run typecheck        # tsc --noEmit            ← must be green before declaring done
npm run lint             # eslint
npm test                 # node --test against tests/*.test.ts via tsx
npm run db:up            # docker compose up -d postgres
npm run db:generate      # drizzle-kit generate (new migration)
npm run db:migrate       # drizzle-kit migrate
npm run db:push          # drizzle-kit push (dev only)
npm run db:studio
npm run db:seed:plans    # tsx scripts/seed-plans.ts  ← feature registry seeder, insert-only
npm run db:seed:sms      # tsx scripts/seed-sms-templates.ts
```

## Project layout

```
src/
  proxy.ts                     # only matches /auth — handle→pending-slug cookie
  app/
    (app)/                     # authenticated user shell: dashboard, page editor, bookings, forms, events, requests
    [slug]/                    # public profile page renderer + booking/form actions
    admin/                     # /admin shell, gated by requireAdmin()
    api/                       # cron, webhooks, internal endpoints
    auth/                      # phone+OTP screens
    affiliate/, invited/, onboarding/, pricing/, r/, u/, events/, ~offline/
  components/                  # admin/, app/, auth/, billing/, dashboard/, events/, marketing/,
                               # navigation/, onboarding/, public/, referral/, shared/, ui/
  db/                          # index.ts (getDb), schema.ts (~40 tables)
  lib/
    auth/                      # session.ts, otp.ts, pending-intent.ts
    date/                      # persian.ts + timezone.ts ← ONLY place that imports date-fns-jalali
    oauth/                     # OAuth providers (linked-account flow)
    persian.ts                 # DEPRECATED shim re-exporting from lib/date/persian
    entitlements.ts            # pageHasFeature, requireFeature, getPageEntitlementLimit, rebuildEntitlements
    pages.ts                   # multi-page helpers (resolveCurrentPageForOwner, createPageForOwner, …)
    billing-*.ts, zarinpal.ts, discounts.ts, invoice-numbering.ts, trial.ts
    sms.ts, sms-queue.ts, kavenegar.ts
    storage.ts, ssrf.ts, rate-limit.ts, redis.ts, request-ip.ts
    booking-*, form-service, event-service, profile-service, link-icons*
tests/                         # node:test + tsx, see tests/tsconfig.json
drizzle/                       # numbered SQL migrations + meta/
scripts/                       # generate-pwa-icons, seed-plans, seed-sms-templates
```

## Database conventions

- Schema is one file: `src/db/schema.ts`. Generate migrations with `npm run db:generate`, never hand-edit existing migrations.
- Timestamps: `timestamp({ withTimezone: true })`. UTC in DB, always.
- Money: bigint `toman` (no fractional). VAT rate from `BILLING_VAT_RATE` env, never hardcoded.
- Multi-tenancy: **page-owned**, not user-owned. The `profiles` table is the `pages` entity (owner = `userId`, but a user can have many pages). Resolve "current page" with `resolveCurrentPageForOwner()` — never assume `users.id === pages.id`.
- Plan/feature registry tables: `plans`, `features`, `plan_features`, `page_subscriptions`, `page_entitlements`. **No plan-name comparisons in product code** — gate via `pageHasFeature(pageId, lookupKey)`. Limits via `getPageEntitlementLimit()`.

## Migration discipline — MANDATORY

**The Dockerfile ENTRYPOINT already runs `npm run db:migrate` before starting the app** — auto-migration is active on every deploy. This means: if a column exists in `src/db/schema.ts` but no migration has been written for it, production will crash immediately after deploy with a `column does not exist` error.

**Rules:**
1. **Every schema change (new column, new table, new enum value, rename, drop) MUST have a corresponding migration SQL file in `drizzle/` AND an entry in `drizzle/meta/_journal.json` before the code is committed.**
2. **Never add a column to `src/db/schema.ts` without simultaneously creating the migration.** The two files are always a single atomic commit.
3. Use `npm run db:generate` for standard schema changes. If the meta snapshots are out of sync (missing snapshots for recent migrations), hand-write the SQL instead and add it to `_journal.json` — but never skip either step.
4. Hand-written migrations follow the naming pattern `NNNN_short_description.sql` where `NNNN` is the next sequential number.
5. After writing a migration, verify locally with `npm run db:migrate` before pushing.

## Persian (Shamsi) calendar — MANDATORY

Single source of truth: **`src/lib/date/persian.ts`** (+ `src/lib/date/timezone.ts`). Everything else imports from there. The legacy `src/lib/persian.ts` is a deprecated re-export shim — do not add new exports to it.

Locked-in rules:

- **DB = UTC Gregorian.** Postgres `timestamptz`, Drizzle `timestamp({ withTimezone: true })`. Never store Shamsi strings as truth.
- **Display = Shamsi via `formatShamsi*` helpers.** `formatShamsiDate / formatShamsiDateTime / formatShamsiShort / formatShamsiMonthYear / formatShamsiWeekdayDayMonth / formatShamsi(date, pattern)`.
- **Only `src/lib/date/*` imports `date-fns-jalali`.** Grep `from "date-fns-jalali"` should return exactly two hits (`persian.ts` + `timezone.ts`). Never import it from a component or other lib module.
- **No hardcoded Persian month names** outside the date module's preset formatters.
- **No raw `Intl.DateTimeFormat("fa-IR", …)` for date display.** Direct Intl is fine for non-display work (currency, day-key parsing).
- **"Today / now" anchors to Asia/Tehran.** Use `tehranIsoDate(now)` for backend day-keys (`YYYY-MM-DD`), `tehranLocalView` for Jalali arithmetic, and `shamsiStartOfMonth / shamsiAddMonths / shamsiDaysInMonth / shamsiWeekdayColumn` for calendar grids.
- **APIs ship ISO 8601 UTC strings.** Never pre-format Shamsi server-side.
- **Date pickers**: when one is needed, build a single `<ShamsiDatePicker />` and route all callers through it. Native `<input type="datetime-local">` stays Gregorian-local — that's an HTML constraint.
- **Never reintroduce the booking-grid bug**: build the calendar from `shamsiStartOfMonth + shamsiDaysInMonth + shamsiWeekdayColumn`, label each cell with its true Jalali day-of-month. Do not iterate `new Date(year, month, day)` under a Persian header.

## Timezone handling — MANDATORY

Calendly-style: host defines availability in their own zone, booker sees converted slots in their zone, UTC is the only stored truth. Single source of truth: **`src/lib/date/timezone.ts`** (pairs with `./persian.ts`).

Locked-in rules:

- **All `timestamptz` columns are UTC. Always.** Never store offsets, abbreviations, or wall-clock strings as truth.
- **Future scheduled events store UTC + IANA timezone.** Booking blocks carry `timezone` (host's zone at slot-publish time); `bookings` carry `hostTimezone` (snapshot at booking time) and `guestTimezone` (booker's chosen zone). Recurring rules must always store the IANA zone they were authored in — never just an offset.
- **Only `src/lib/date/timezone.ts` and `src/lib/date/persian.ts` import `date-fns-tz` / `date-fns-jalali`.** Grep `from "date-fns-tz"` should return exactly one hit (`timezone.ts`). Components and other libs must use the wrappers (`formatShamsiTimeInZone`, `formatGregorianDateInZone`, `formatInTimezone`, `civilToUtc`, `resolveSlotToUtc`, `formatTimezoneLabel`, `formatOffset`, `getTimezoneOffsetMinutes`).
- **Never store or transmit timezone offsets (`+02:00`) or abbreviations (`CET`, `EST`) as identifiers.** Always IANA (`Europe/Berlin`, `America/New_York`). Node's Intl will accept offsets/abbreviations as input, but the convention is enforced socially: do not write them into the DB or APIs.
- **Detect with `Intl.DateTimeFormat().resolvedOptions().timeZone`** via `detectUserTimezone()`. Always allow the user to override (booking modal exposes a Select; persist override in `localStorage[kioar:booking-tz:${blockId}]`).
- **APIs ship UTC ISO 8601 strings (`...Z`).** Never pre-format zoned/Shamsi server-side. Conversion happens at the render layer via `formatShamsi*InZone` / `formatGregorian*InZone`.
- **Civil-time → UTC conversions go through `civilToUtc` / `resolveSlotToUtc`** (DST-correct via `fromZonedTime`). Never hand-roll `new Date(y, m, d, h, mm)` and add an offset — DST gaps and overlaps will silently corrupt slots.
- **ICS exports use TZID + `VTIMEZONE`**, not floating times or naive UTC. Use `formatIcsLocal(date, tz)` for `DTSTART;TZID=...` and `formatIcsUtc(date)` for `DTSTAMP`.
- **Don't auto-migrate historical timestamps.** They're already UTC; only future-scheduled rows need the new tz columns. Backfill `host_timezone` lazily on read if needed (default to `Asia/Tehran`).
- **UI**: when displaying a future event whose `bookerTz !== hostTimezone`, show both ("ساعت محلی شما: …" + "وقت میزبان: …"). The booker's zone label is `formatTimezoneLabel(tz, instant)` → e.g. `Europe/Berlin (GMT+1:00)`.

## Mobile-first & PWA

Mobile is primary; desktop must keep working but design from the smallest viewport up.

- **Viewport** (`src/app/layout.tsx`): `viewportFit: "cover"`, `interactiveWidget: "resizes-content"`, `maximumScale: 5`, `userScalable: true`. Status bar `black-translucent` on iOS. Never set `maximumScale: 1` or `userScalable: false`.
- **Body**: `min-h-dvh overscroll-y-none`. Use `min-h-dvh` / `h-dvh` (or the `min-h-screen-safe` / `h-screen-safe` aliases). Avoid `min-h-screen` for new pages.
- **PWA manifest** (`src/app/manifest.ts`): `id` and `start_url` carry `?source=pwa`; `display_override: ["standalone","minimal-ui","browser"]`. New launchable surface? Add a shortcut (max 3–4).
- **CSS utilities** (`src/app/globals.css`): `safe-pb / safe-pt / safe-px`, `safe-area-bottom / safe-area-top`, `pb-nav` (reserves bottom-nav + iOS inset on `<main>`), `tap-target` (44×44 minimum), `touch-pan-y`, `no-scrollbar`.
- iOS auto-zoom is prevented globally for coarse pointers; do **not** set `<16px` font on inputs.

### Mobile navigation

- Authenticated shells render `<MobileBottomNav variant="dashboard" />` or `"admin"` — fixed bottom, safe-area padded, center floating primary action.
- shadcn `<Sidebar collapsible="icon">` becomes a Sheet on mobile via `<SidebarTrigger>`. Don't duplicate nav in page content.
- `<main>` in `(app)` and `admin` layouts uses `pb-nav md:pb-6`.

### Forms — mobile requirements

Every `<input>` declares, when applicable:

- `type` (`tel | email | url | number | search | password`).
- `inputMode` (`tel | email | url | numeric | decimal | search`).
- `autoComplete` (WHATWG tokens — `tel`, `email`, `name`, `one-time-code`, …).
- `enterKeyHint` (`next | send | search | go | done`).
- Slugs/URLs: `autoCapitalize="none" autoCorrect="off" spellCheck={false}`.
- OTP: `autoComplete="one-time-code" inputMode="numeric" pattern="[0-9]*"`.

Base `<Input>` is `h-11` mobile / `md:h-9` desktop. Don't override font-size below 16px on mobile.

### Responsive patterns

- **Tables**: card list on mobile (`lg:hidden`) + real table desktop (`hidden lg:block`). Canonical example: admin requests page.
- **Forms**: stack one column on mobile; `sm:grid-cols-2` only when both fields fit. Primary buttons `w-full sm:w-auto`.
- **Touch targets**: ≥44 px. `h-11`/`h-12` interactive, `size-11` icon buttons. Avoid `size-8`.
- **Long content**: prefer `<Sheet side="bottom">` or `<Drawer>` over `<Dialog>`. Reserve `<Dialog>` for short confirms.
- **Numbers/phones**: `dir="ltr"` on the input itself, never reverse digits. Display via `formatPhoneDisplay` + `toPersianDigits`.

### RTL

- `<html dir="rtl">` is global. Use logical Tailwind props: `ms-`, `me-`, `ps-`, `pe-`, `start-`, `end-`, `rounded-s-`, `rounded-e-`.
- For numeric/LTR-only content (URLs, slugs, phones, OTP), set `dir="ltr"` on the element.

### Pre-merge checklist for UI

1. New launchable route? Add a shortcut to `manifest.ts`.
2. Sticky bottom? Wrap with `safe-pb` or `pb-nav`.
3. First field of single-purpose screen? `autoFocus`. All fields have `inputMode + autoComplete + enterKeyHint`.
4. Table? Mobile card fallback present.
5. `npm run typecheck` and `npm run build` green.

## Auth, sessions, admin

- Sessions: `getCurrentViewer()` (cached) reads `kioar_session` cookie, hashes with `AUTH_SECRET`, joins `users`. Banned users (`bannedAt`) are denied. Impersonation uses a separate `kioar_imp_return` cookie holding the admin's original token.
- Use `requireAuth()` / `requireAdmin()` from `@/lib/auth/session` in server components and actions. Never trust client.
- OTP: 6 digits, 3-min TTL, 60s cooldown, 5 attempts max — constants in `src/lib/auth/session.ts`.

## Cron / background work

- Single pattern: `POST/GET /api/cron/<name>` guarded by `Authorization: Bearer ${CRON_SECRET}` and a `pg_advisory_lock`. External systemd timer / Caddy hits the endpoints. Don't introduce BullMQ / pg_cron / new schedulers — extend this pattern. See `docs/cron.md`.

## Rate limiting

- `src/lib/rate-limit.ts` (Redis-backed buckets, plus `rate_limit_buckets` table fallback). Apply at every public mutation entrypoint (OTP, public forms, bookings, signup).

## Storage

- `src/lib/storage.ts` is the only place that talks to S3. Uploads go under `public/uploads/{avatars,link-covers}/` paths in dev, S3 keys in prod. SSRF protection in `src/lib/ssrf.ts` for any user-supplied URL fetch (link metadata, OG previews).

## Testing

- `npm test` runs `node --test` over `tests/*.test.ts` via `tsx`. Tests use `tests/tsconfig.json` and a `tests/stubs/` directory for module stubs. Add tests for billing math, date math, discounts, zarinpal — anything money- or time-sensitive.

## Feature Registry workflow — MANDATORY

Plan system is feature-based. Every gateable capability is a row in `features` with a stable `lookup_key`, mapped to plans via `plan_features`. Product code never compares plan names; it calls `pageHasFeature(pageId, 'lookup_key')` and `getPageEntitlementLimit(pageId, 'lookup_key')`.

### When the workflow triggers

1. User asks to build a capability that could plausibly be plan-gated (new block type, analytics view, export, integration, editor tool, public-page rendering branch, business workflow, numeric limit).
2. You discover existing code that exposes a gateable capability with no registry entry — raise it.
3. User explicitly asks to add a feature to the registry.

The trigger is **capability**, not file type. A new component is a feature only when it exposes user-visible capability someone might pay for.

### Steps (stop coding and run in order)

1. **Propose a `lookup_key`** in `snake_case`, prefixed by category where applicable (`link_*`, `analytics_*`, `marketing_*`, `business_*`, `support_*`). Stable forever.
2. **Propose a `category`** — one of `core`, `branding`, `design`, `link_types`, `analytics`, `marketing`, `business_tools`, `support`, `limits`. Don't invent new categories without explicit approval.
3. **Propose a Persian display name + one-sentence description** matching the tone of existing rows.
4. **Ask the user three questions in one batch:**
   a. Which plans? (`free` / `pro` / `business`, multi-select)
   b. Boolean entitlement, or numeric limit? If limit, what value per plan?
   c. Backfill existing pages? (Usually yes for Free/Pro features; usually no for `business_*` since no existing page has Business.)
5. **Wait for the answer.** Don't guess — this is a product decision.
6. **Implement in one commit:**
   - Add the row + mappings to `scripts/seed-plans.ts` (insert-only seeder).
   - Run `npm run db:seed:plans` against dev DB.
   - If backfill is needed, write a migration that inserts `page_entitlements` rows for qualifying pages. Seeder owns the registry; migrations own per-row data.
   - Wire `pageHasFeature(pageId, '<lookup_key>')` into both the public renderer (hide entirely) and the editor (`<LockedFeatureCard>` with upgrade CTA).
   - Add the lookup key to the matrix in `IMPLEMENTATION_PLAN.md`.
7. **Verify before declaring done:**
   - `npm run typecheck` and `npm run build` clean.
   - Grep for plan-name comparisons (`=== 'pro'`, `=== 'business'`, `=== 'free'`, `isPro`, `isBusiness`, `userPlan`, `planTier`) — must be zero hits.
   - In dev DB: Free page lacks the entitlement (or has correct limit); Business page has it; renderer hides on Free; editor shows locked.

### When NOT to run

- Bug fixes that don't change capability surface.
- Refactors without new functionality.
- Internal admin / dev tooling, migrations, queue workers, cron handlers.
- Visual tweaks (CSS, copy, layout) on existing features.

If unsure, ask before assuming.

## Public profile cache — MANDATORY

The public profile page (`/[slug]`) is read-through cached in Redis via `src/lib/cache/profile-cache.ts`. Key format `kioar:page:v1:{slug}`, TTL 300s for hits, 60s for the 404 sentinel. Fail-open: every Redis error logs and falls through to the DB loader.

Locked-in rules:

- **Any new write path that affects what the public page renders MUST call an `invalidateProfileCache*` helper after the transaction commits**, never inside `tx`. The current invalidation map lives in `src/lib/cache/profile-cache.ts`.
- Pick the right helper:
  - `invalidateProfileCacheBySlug(slug)` — slug already in scope (most block/profile mutations, page deletion).
  - `invalidateProfileCacheById(pageId)` — only `pageId` in scope (billing/admin/cron/entitlement paths). Does an internal slug lookup.
  - `invalidateProfileCacheOnSlugChange(oldSlug, newSlug)` — slug change, drops both keys.
- The renderer reads ISO 8601 UTC `Date` instances; the cache reviver only revives strings matching `/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/`. Don't ship pre-formatted Shamsi or zoned strings on the cached payload.
- Mutations that affect the cached shape: profile fields, slug, avatar, links, blocks (booking/form/product/spotlight/order), plan/entitlement changes (paid checkout, trial start, cron transitions, admin grants/revokes/force-expire/manual plan change/mark invoice paid). Things that DO NOT affect rendering (price locks, future-renewal discounts, referral period extensions that only bump `currentPeriodEnd`, invoice cancel) skip invalidation.
- Metrics keys: `kioar:metrics:profile_cache:{hit|miss|not_found_hit|error}` (Redis INCR). Don't add per-slug counters — cardinality is unbounded.

## Hard "do not"s

- **NO GRADIENTS.** Never use `bg-gradient-*`, `bg-linear-*`, `bg-[radial-gradient(...)]`, `bg-[conic-gradient(...)]`, `bg-[linear-gradient(...)]`, or any CSS `gradient` function anywhere in the UI — not as backgrounds, not as text fills (`bg-clip-text`), not as decorative blobs. Use solid colors only. This is a hard rule the designer explicitly set.
- Don't use `min-h-screen` on new mobile pages (use `min-h-dvh`).
- Don't set `maximumScale: 1` or `userScalable: false`.
- Don't ship inputs below 16px font on mobile or below `h-11`.
- Don't ship desktop-only tables without a mobile card fallback.
- Don't ship forms without `inputMode + autoComplete + enterKeyHint`.
- Don't import `date-fns-jalali` outside `src/lib/date/*`.
- Don't compare plan names (`=== 'pro'`, etc.) anywhere in product code.
- Don't hand-edit `public/sw.js` or migration files that already exist.
- Don't introduce a second background-job system; extend `/api/cron/*`.
- Don't pre-format dates server-side; ship UTC ISO and format on render via `formatShamsi*`.
