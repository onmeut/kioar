# Cards Database Schema

## Overview
Physical NFC/QR cards system where each card has:
- A unique 7-character Crockford base32 ID (`id`)
- A permanent URL: `https://kioar.com/c/{id}`
- Optional binding to a user's page (`page_id`)

---

## Tables

### 1. `cards` — Physical card inventory

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `text` | PRIMARY KEY | 7-char base32 (e.g., `A3K7M2F`) — the printed QR value |
| `page_id` | `uuid` | FOREIGN KEY `profiles.id`, ON DELETE SET NULL | Page this card is bound to; null = unassigned (gift card) |
| `status` | `card_status` enum | DEFAULT 'unassigned', NOT NULL | **Values:** `unassigned` (minted, no page), `assigned` (page_id set), `disabled` (lost/stolen) |
| `batch` | `text` | NOT NULL | Batch label (e.g., `2026-001`) — groups cards from same production run |
| `color` | `text` | NOT NULL | Card color string (e.g., `black`) |
| `material` | `card_material` enum | NOT NULL | **Values:** `colorful`, `metal` |
| `source` | `card_source` enum | NOT NULL | **Values:** `purchased` (paid order), `gift_pro` (Pro plan grant), `gift_business` (Business plan grant) |
| `nfcWrittenAt` | `timestamp(tz)` | Nullable | When NFC chip was written with URL |
| `nfcLockedAt` | `timestamp(tz)` | Nullable | When NFC chip was locked read-only |
| `claimedAt` | `timestamp(tz)` | Nullable | When user claimed/activated the card (gift cards only) |
| `createdAt` | `timestamp(tz)` | DEFAULT NOW(), NOT NULL | Row creation time |
| `updatedAt` | `timestamp(tz)` | DEFAULT NOW(), NOT NULL | Updated on every record change |

**Indexes:**
- `cards_page_id_idx` on `page_id`
- `cards_status_idx` on `status`
- `cards_batch_idx` on `batch`

---

### 2. `card_orders` — Purchase/redemption & fulfillment records

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `uuid` | PRIMARY KEY | Order identifier |
| `pageId` | `uuid` | FOREIGN KEY `profiles.id`, NOT NULL, ON DELETE CASCADE | User's page placing the order |
| `userId` | `uuid` | FOREIGN KEY `users.id`, NOT NULL, ON DELETE CASCADE | User placing the order |
| `color` | `text` | NOT NULL | Card color chosen |
| `material` | `card_material` enum | NOT NULL | Material chosen (`colorful`, `metal`) |
| `nameOnCard` | `text` | NOT NULL | Name to print on card |
| `province` | `text` | NOT NULL | Shipping address province |
| `city` | `text` | NOT NULL | Shipping address city |
| `address` | `text` | NOT NULL | Full shipping address |
| `postalCode` | `text` | NOT NULL | Postal code |
| `status` | `card_order_status` enum | DEFAULT 'pending_payment', NOT NULL | **Values:** `pending_payment`, `paid`, `processing`, `shipped`, `fulfilled`, `cancelled` |
| `source` | `card_source` enum | DEFAULT 'purchased', NOT NULL | `purchased` (paid), `gift_pro`, `gift_business` (redeemed) |
| `cardId` | `text` | FOREIGN KEY `cards.id`, ON DELETE SET NULL | Physical card assigned at fulfillment |
| `amountToman` | `integer` | DEFAULT 0, NOT NULL | Price in Toman (0 for gift redemptions) |
| `paymentAuthority` | `text` | UNIQUE, Nullable | Zarinpal authority code (purchase orders only) |
| `paymentRefId` | `text` | Nullable | Zarinpal payment reference ID |
| `paidAt` | `timestamp(tz)` | Nullable | When payment verified (or gift redeemed) |
| `shippedAt` | `timestamp(tz)` | Nullable | When shipped to user |
| `fulfilledAt` | `timestamp(tz)` | Nullable | When delivery confirmed |
| `createdAt` | `timestamp(tz)` | DEFAULT NOW(), NOT NULL | Order creation time |
| `updatedAt` | `timestamp(tz)` | DEFAULT NOW(), NOT NULL | Updated on status change |

**Indexes:**
- `card_orders_page_id_idx` on `pageId`
- `card_orders_user_id_idx` on `userId`
- `card_orders_status_idx` on `status`
- `card_orders_payment_authority_idx` (UNIQUE) on `paymentAuthority`

---

### 3. `card_entitlements` — Gift entitlements from subscriptions

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `uuid` | PRIMARY KEY | Entitlement identifier |
| `pageId` | `uuid` | FOREIGN KEY `profiles.id`, NOT NULL, ON DELETE CASCADE | Page that owns this entitlement |
| `userId` | `uuid` | FOREIGN KEY `users.id`, NOT NULL, ON DELETE CASCADE | User that owns this entitlement |
| `material` | `card_material` enum | NOT NULL | Material the user is entitled to (`colorful`, `metal`) |
| `source` | `card_source` enum | NOT NULL | How entitlement was granted (`gift_pro`, `gift_business`) |
| `sourceKey` | `text` | UNIQUE, NOT NULL | Idempotency key (e.g., `invoice:{invoiceId}`) — prevents double-granting |
| `redeemedAt` | `timestamp(tz)` | Nullable | When user redeemed this entitlement |
| `redeemedOrderId` | `uuid` | FOREIGN KEY `card_orders.id`, ON DELETE SET NULL | The order that redeemed this entitlement |
| `expiresAt` | `timestamp(tz)` | Nullable | When entitlement expires (if applicable) |
| `createdAt` | `timestamp(tz)` | DEFAULT NOW(), NOT NULL | When entitlement was granted |
| `updatedAt` | `timestamp(tz)` | DEFAULT NOW(), NOT NULL | Updated when redeemed |

**Indexes:**
- `card_entitlements_page_id_idx` on `pageId`
- `card_entitlements_user_id_idx` on `userId`
- `card_entitlements_source_key_idx` (UNIQUE) on `sourceKey`

---

## Enums

### `card_status`
- `unassigned` — Minted, no page bound yet (gift cards ship like this)
- `assigned` — page_id set → `/c/{id}` renders that page
- `disabled` — Lost/stolen/revoked → inactive landing

### `card_material`
- `colorful` — Standard colored card
- `metal` — Premium metal card

### `card_source`
- `purchased` — Bought outright in the ordering studio
- `gift_pro` — Granted by yearly Pro subscription
- `gift_business` — Granted by yearly Business subscription

### `card_order_status`
- `pending_payment` — Checkout started, awaiting Zarinpal verify (purchased only)
- `paid` — Payment verified (or gift redeemed) → enters fulfillment queue
- `processing` — Admin assigned a physical card / writing NFC
- `shipped` — In transit to user
- `fulfilled` — Delivered
- `cancelled` — Order cancelled

---

## QR Code Generation

### Folder Structure
```
project-root/
└── card-batches/
    └── batch-{batch}/          (e.g., batch-2026-001/)
        ├── qr/                 ← QR SVG files
        │   ├── A3K7M2F.svg
        │   ├── B4L8N3G.svg
        │   └── ...
        └── manifest.csv        ← CSV with card metadata
```

### Manifest CSV Columns
| Column | Example | Notes |
|--------|---------|-------|
| `id` | `A3K7M2F` | Card ID (printed on card) |
| `url` | `https://kioar.com/c/A3K7M2F` | Production URL |
| `qr_filename` | `A3K7M2F.svg` | SVG filename in `qr/` folder |
| `nfc_url` | `https://kioar.com/c/A3K7M2F` | Same as `url` — NFC chip payload |
| `color` | `black` | Card color |
| `material` | `colorful` | `colorful` or `metal` |
| `batch` | `2026-001` | Batch identifier |

### Generation Command
```bash
npm run cards:batch -- --count 500 --batch 2026-001 \
  --color black --material colorful --source purchased
```

**Flags:**
- `--count` (required) — Number of cards to mint (> 0)
- `--batch` (required) — Batch label (e.g., `2026-001`)
- `--color` (default: `black`) — Card color string
- `--material` (default: `colorful`) — `colorful` or `metal`
- `--source` (default: `purchased`) — `purchased`, `gift_pro`, or `gift_business`
- `--out` (default: `./card-batches`) — Output root directory

### Generation Process
1. Generate collision-checked short base32 IDs (7 chars, no `0/O/1/I/L/U`)
2. Insert `unassigned` `cards` rows into database
3. Render SVG for each card ID using `buildQrMatrix` (error-correction level H)
4. Write `manifest.csv` with all card metadata
5. Output: `card-batches/batch-{batch}/qr/{ID}.svg` + `manifest.csv`

---

## Lifecycle

### Purchased Cards
1. **Order placed** → `card_orders` row created with `status = pending_payment`
2. **Payment verified** → `paidAt` set, `status = paid`
3. **Admin fulfillment** → Scan card ID, run NFC write→lock checklist, assign `cardId` to order
4. **Cards table updated** → `cards.page_id` set to order's `pageId`, `status = assigned`
5. **Order shipped** → `shippedAt` set, `status = shipped`
6. **Delivered** → `fulfilledAt` set, `status = fulfilled`
7. **User taps card** → `/c/{id}` renders bound page

### Gift Cards (from subscription)
1. **Subscription purchased** → `card_entitlements` row created (granted)
2. **Batch printed** → Unassigned `cards` rows minted with `source = gift_pro/gift_business`
3. **User taps card** → `/c/{id}` shows "activate this card"
4. **User logs in & picks page** → `cards.page_id` set, `status = assigned`, `claimedAt` stamped
5. **Entitlement redeemed** → `card_entitlements.redeemedAt` set, `redeemedOrderId` linked

### Re-pointing & Disabling
- **Re-point** — Assigned card's `page_id` updated to different page (chip/QR unchanged)
- **Disable** — Admin sets `status = disabled` for lost/stolen card

---

## Caching

- **Profile cache** — Bound page render uses existing slug-keyed Redis cache (`kioar:page:v1:{slug}`)
- **Card-to-slug cache** — `kioar:card:v1:{id}` (300s TTL, fail-open)
- Invalidate card cache with `invalidateCardCache(id)` after bind/re-point/disable

---

## Related Files

- **Schema definition**: `src/db/schema.ts` (lines 2506–2626)
- **Batch generation script**: `scripts/generate-card-batch.ts`
- **Card resolution**: `src/lib/cards/card-resolve.ts`
- **QR rendering**: `src/lib/qr/render-svg.ts`, `src/lib/qr/types.ts`
- **Admin interface**: `src/app/admin/cards/`
- **Public card page**: `src/app/c/[id]/page.tsx`
- **Tests**: `tests/cards.test.ts`
- **Migration**: `drizzle/0053_nfc_cards.sql`

---

## Key Notes

✓ Card IDs are **7-character Crockford base32** (no `0/O/1/I/L/U`)
✓ URL is **always `/c/{id}`** — never username-dependent
✓ QR & NFC both encode **production URL** regardless of deploy env
✓ QR error-correction is **level H** for durability
✓ Username change does **not break** the card (only `page_id` matters)
✓ Gift cards require **activation-on-tap** before binding
✓ Purchased cards are **pre-bound at fulfillment**
