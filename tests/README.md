# Kioar tests

Lightweight, pure-logic tests run via `node:test` + `tsx`.

```sh
pnpm test
```

## What's covered

- `billing-pricing.test.ts` — `computeBillingTotals` (subtotal/discount/VAT
  clamps + half-to-even rounding) and `computePeriodEnd` (calendar-aligned
  monthly + annual arithmetic, including end-of-month edge cases).
- `billing-math.test.ts` — `computeProration` (upgrade/downgrade matrix +
  expired-period guard) and `roundHalfToEven` symmetry.
- `billing-state.test.ts` — `evaluateTransitions` for every branch the
  state machine can fire today: trial reminders, trial-end (with and
  without scheduled cancel / pending plan change), paid renewal
  reminders, period-end → grace, grace → expired, no-fire on
  `expired`/`canceled`.
- `discounts.test.ts` — `computeDiscountAmount` matrix: percent (clamp at
  subtotal, floor rounding), fixed_amount (clamp at subtotal),
  free_months (subtotal-zeroing, `freeMonths` carry-out, monthly-only
  enforcement), `recurringCyclesRemainingAfter` decrement, invalid amounts.
- `zarinpal.test.ts` — `verifyPayment` HTTP idempotency: code 100 returns
  `verified` with `alreadyVerified: false`, code 101 returns `verified`
  with `alreadyVerified: true`, all other codes return `failed`. `fetch`
  is monkey-patched per test; no network access.

## What's deliberately NOT covered here

The Phase 14 prompt also lists:

- `pageHasFeature` per-source (`subscription` / `admin_grant` / `promo`),
- full `validateDiscountCode` matrix (per `applies_to_*`,
  `first_time_only`, `recurring`),
- `verifyPayment` idempotency on duplicate authority **at the
  callback-route level**,
- "expiry preserves config",
- "public renderer hides; editor locks".

Those paths are DB- or React-render-bound. The repository has no test DB
infrastructure (no Docker fixtures wired up for CI, no jsdom, no Next
runtime harness) and adding either is its own phase. The pure helpers
those paths sit on top of (`evaluateTransitions`,
`computeDiscountAmount`, `verifyPayment` HTTP shape, proration) are
covered here, which is where the actual decision logic lives — the DB
calls in the upper layers are thin SELECTs / INSERTs whose correctness
is enforced by the schema + ON CONFLICT clauses, not by branching code.

Adding a test-DB harness is tracked as a follow-up in
`IMPLEMENTATION_PLAN.md` Phase 14 notes.
