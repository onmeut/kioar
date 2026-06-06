# NFC / QR physical cards

Physical cards whose printed QR + locked NFC chip + a `cards` DB row all encode
the **same** permanent URL `https://kioar.com/c/{id}`. Tapping or scanning a card
opens the bound page's public profile directly (no redirect).

## Core model

- **One id per card.** `cards.id` is a short Crockford base32 code (7 chars, no
  `0/O/1/I/L/U`) — it IS the printed value and the primary key. No separate
  "internal vs printed" id.
- **Permanent URL.** Always `/c/{id}`; never contains the username. A username
  change can never break a card.
- **Resolution is by render, not redirect.** `/c/{id}` (`src/app/c/[id]/page.tsx`)
  renders the target profile inline at HTTP 200. The address bar stays `/c/{id}`.
- **Card binds to a PAGE, not a user.** `cards.page_id → profiles.id`. Re-pointing
  only updates `page_id`; the chip/QR never change.
- **Hybrid fulfillment:**
  - **Purchased** → `page_id` pre-bound at fulfillment (target known at checkout)
    → no user activation step.
  - **Gift** (granted by a plan purchase) → chip written + locked but `page_id`
    left null → user does one-time **activation-on-tap** at `/c/{id}`.
- **NFC write-and-lock is identical for both:** write `https://kioar.com/c/{id}`,
  tap-test, then lock read-only. Only the DB binding timing differs.

## Tables (`src/db/schema.ts`, migration `0053_nfc_cards.sql`)

- `cards` — one row per physical card (`id`, `page_id`, `status`, `batch`,
  `color`, `material`, `source`, NFC checklist timestamps).
- `card_orders` — purchase/redemption + fulfillment record (address, name-on-card,
  status, Zarinpal fields, linked `card_id`).
- `card_entitlements` — gift entitlements granted by subscription purchases,
  idempotent on `source_key` so a purchase grants its free card exactly once.

## Caching (no CDN)

Expected volume ~10k taps/day (~0.12 req/s); the origin handles this directly.

- The bound page render reuses the existing **slug-keyed** Redis profile cache
  via `getPublicProfileBySlug(slug)` (`src/lib/cache/profile-cache.ts`).
- A small **id → slug** cache lives in `src/lib/cards/card-resolve.ts`
  (`kioar:card:v1:{id}`, 300s TTL, fail-open). Invalidate it with
  `invalidateCardCache(id)` after any bind / re-point / disable.

No ArvanCloud/edge work — everything is in-app.

## Batch generation (pre-printing)

Mint a batch and produce the print + NFC package:

```bash
npm run cards:batch -- --count 500 --batch 2026-001 \
  --color black --material colorful --source purchased
```

Output: `card-batches/batch-{batch}/qr/{ID}.svg` + `manifest.csv`.

- QR SVGs are rendered by the SAME engine as the in-app share QR
  (`src/lib/qr/render-svg.ts`), so styling + centered logo match. Error-correction
  is **level H** (forced in `buildQrMatrix`) for durability behind the logo and
  physical wear.
- `manifest.csv` columns: `id, url, qr_filename, nfc_url, color, material, batch`.
  `nfc_url` == `url` — it is the payload to encode on each chip.

Admins can also mint a batch from `/admin/cards` (inventory tab); the same
`mintCardBatch()` helper (`src/lib/cards/inventory.ts`) backs both paths.

## Printer / NFC handoff

1. Send `qr/*.svg` (preferred) + `manifest.csv` (variable-data printing) to the
   printer.
2. NFC chips encode each card's `nfc_url` and are **locked read-only**. Always
   **write → tap-test → THEN lock** — never lock before verifying.
3. Writing may be done by the vendor (from the manifest) or in-house. Track the
   write/lock state per card via the admin fulfillment checklist.

## Fulfillment & activation

- **Purchased:** at fulfillment, admin assigns a physical card to the order,
  sets `cards.page_id` to the order's page, `status = assigned`, invalidates the
  card cache, and advances the order to `shipped`/`fulfilled`. User taps → profile
  loads immediately.
- **Gift:** ships unassigned. Tapping `/c/{id}` shows "activate this card"
  (`src/components/cards/card-activate-landing.tsx`); the user logs in, picks one
  of their pages, and `activateCardAction` binds it.
- **Re-point:** an assigned card's `page_id` can be changed (chip/QR unchanged).
- **Disable:** admin sets `status = disabled` for a lost/stolen card.

## Admin surface (`/admin/cards`)

Single admin "کارت‌ها" menu with four sub-tabs:

- **سفارش‌ها** (`/admin/cards`) — order queue. Assign a physical card by
  scanning/entering its printed id, run the NFC write→lock checklist, advance
  status (paid → processing → shipped → fulfilled), cancel.
- **موجودی و دسته‌ها** (`/admin/cards/inventory`) — generate batches; per-batch
  assigned/unassigned/disabled counts. (QR + manifest export via the CLI.)
- **تنظیمات کارت و پلن** (`/admin/cards/settings`) — prices, which plan tier a
  paid card grants, which material each plan grants, material availability.
- **پیشنهادها** (`/admin/cards/offers`) — toggle each gift offer; edit the
  cross-promo copy strings (Farsi) shown on the plans page and in the card flow.

All gift/pricing logic reads these via `app_settings` — no hardcoded
tiers/materials/prices in product code. Every admin mutation writes an
`admin_audit_log` row.

## Plans ↔ cards gifting

- **Plan → card:** a yearly Pro/Business purchase grants a redeemable
  `card_entitlements` row (Pro→colorful, Business→metal, configurable). Hooked
  into the billing callback (best-effort, idempotent on `invoice:{id}` via a
  UNIQUE `source_key`). The user redeems it as a free card order in the studio.
- **Card → plan:** a paid card order grants the buyer 1 year of the configured
  plan tier (`grantPlanYearForCardPurchase`, hooked into the card callback).
  Conservative: never downgrades an active higher tier; extends the period.

## QA checklist (Phase 7)

Verified:
- Batch generation → DB rows + QR SVGs + manifest all consistent.
- QR matrix is the canonical ECC-H encode of `/c/{id}` (scannable). See
  `tests/cards.test.ts`.
- Card id validation rejects ambiguous glyphs / wrong length / lowercase.
- Lifecycle (SQL): assigned renders, **username change does NOT break the card**
  (`page_id` untouched by slug rename), re-point, disable, unassigned→activate.
- Gift entitlement idempotency (duplicate `source_key` rejected by UNIQUE index).
- `typecheck`, `build`, `npm test`, `lint` all green.
- Zero plan-name feature-gates in card product code (the one `=== "free"` is a
  settings sentinel for "no gift", documented inline).
