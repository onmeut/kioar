@AGENTS.md

# Kioar — Mobile-first & PWA guidelines

This app is **mobile-first** and **installable**. Desktop is secondary; do NOT break desktop, but ALWAYS design from the smallest viewport up.

## Viewport & chrome

- Root viewport uses `viewportFit: "cover"`, `interactiveWidget: "resizes-content"`, and permits zoom (`maximumScale: 5`, `userScalable: true`) for accessibility.
- Theme color responds to color scheme; status bar is `black-translucent` on iOS for full-bleed PWA.
- `<body>` uses `min-h-dvh` and `overscroll-y-none`. Prefer `min-h-dvh` / `h-dvh` over `min-h-screen` for page shells on mobile (dvh avoids iOS URL-bar jitter).

## PWA manifest (`src/app/manifest.ts`)

- `id: "/?source=pwa"`, `start_url` includes the same source marker — required for app-replace installability.
- `display_override: ["standalone", "minimal-ui", "browser"]`.
- Shortcuts include per-item `icons`. Keep shortcuts to 3–4 high-intent actions.
- If you introduce a new surface that should be launchable, add a shortcut.

## Global CSS utilities (`src/app/globals.css`)

- `safe-pb` / `safe-pt` / `safe-px` — add safe-area padding on sticky/fixed edges.
- `safe-area-bottom` / `safe-area-top` — pure `env(safe-area-inset-*)`.
- `pb-nav` — reserves space for the mobile bottom nav + iOS bottom inset. Use on `<main>` inside authenticated shells.
- `min-h-screen-safe` / `h-screen-safe` — alias of `min-h-dvh` / `h-dvh`.
- `tap-target` — enforces 44×44 minimum. Use on icon-only buttons (search, trigger, etc.).
- `touch-pan-y` — overrides `touch-action` for scroll containers.
- `no-scrollbar` — hides scrollbars while keeping scroll.
- iOS 16 px auto-zoom is prevented globally via `@media (hover:none) and (pointer:coarse)`; do not set `<16px` font on inputs.

## Mobile navigation

- Authenticated shells (`dashboard`, `admin`) render `<MobileBottomNav variant="dashboard" />` or `"admin"`. It is `fixed bottom-0` with safe-area padding and a center primary action (floating pill).
- The shadcn Sidebar is `collapsible="icon"` on desktop and auto-becomes a Sheet on mobile via `SidebarTrigger`. Do NOT duplicate nav inside page content for mobile — rely on bottom nav + sheet.
- `<main>` in dashboard/admin layouts uses `pb-nav md:pb-6` so content clears the bottom nav.

## Forms — mobile requirements

Every `<input>` MUST declare, when applicable:

- `type` (`tel`, `email`, `url`, `number`, `search`, `password`).
- `inputMode` (`tel`, `email`, `url`, `numeric`, `decimal`, `search`).
- `autoComplete` (WHATWG tokens — `tel`, `email`, `name`, `one-time-code`, etc.).
- `enterKeyHint` (`next`, `send`, `search`, `go`, `done`).
- For slugs/URLs: `autoCapitalize="none" autoCorrect="off" spellCheck={false}`.
- For OTP: `autoComplete="one-time-code"`, `inputMode="numeric"`, `pattern="[0-9]*"`.

The base `Input` component is `h-11` on mobile, `md:h-9` on desktop. Inputs >16px font-size on mobile (via CSS media query) — do not override.

## Responsive patterns

- **Tables**: ALWAYS render a card list on mobile (`lg:hidden`) and the real table on desktop (`hidden lg:block`). Admin requests page is the canonical example.
- **Forms**: stack in one column on mobile; use `sm:grid-cols-2` only when both fields fit. Button rows: use `w-full sm:w-auto` for primary actions.
- **Touch targets**: minimum 44 px. Use `h-11`/`h-12` on interactive elements, `size-11` on icon buttons. Avoid `size-8`.
- **Dialogs vs Sheets**: for long content on mobile, prefer `<Sheet side="bottom">` or `<Drawer>` over `<Dialog>`. Reserve `<Dialog>` for short confirms.
- **Numbers & phones**: use `dir="ltr"` on the input, never reverse digits. Display with `formatPhoneDisplay` + `toPersianDigits`.

## RTL

- `<html dir="rtl">` is global. Use logical props: `ms-`, `me-`, `ps-`, `pe-`, `start-`, `end-`, `rounded-s-`, `rounded-e-`.
- For numeric/LTR-only content (URLs, slugs, phones, OTP), set `dir="ltr"` on the element itself.

## Installability checks when shipping UI

1. New route that should be a shortcut? Add it to `manifest.ts`.
2. Long page? Wrap sticky bottom with `safe-pb` or `pb-nav`.
3. Form? Verify `inputMode`, `autoComplete`, `enterKeyHint`, `autoFocus` on first field of a single-purpose screen.
4. Table? Provide a mobile card layout.
5. Ran `pnpm typecheck` and `pnpm build` (webpack)? Both must be green.

## Service worker

- Registered by `@ducanh2912/next-pwa`. Do NOT hand-edit `public/sw.js` — it's generated.
- Offline fallback is `/~offline`. If a route must always work offline, make sure its shell is static.

## Do NOT

- Do not use `min-h-screen` on new mobile pages (use `min-h-dvh`).
- Do not add `maximumScale: 1` or `userScalable: false`.
- Do not default inputs below 16 px on mobile or below `h-11`.
- Do not render desktop-only tables without a mobile card fallback.
- Do not ship forms without `inputMode` + `autoComplete` + `enterKeyHint`.
- Do not hide critical primary actions on mobile — surface them in the bottom nav or sticky CTA.

## Feature Registry Workflow — MANDATORY

Kioar's plan system is feature-based: every gateable capability is a row in the `features` table with a stable `lookup_key`, mapped to plans via `plan_features`. Product code never checks plan names; it only calls `pageHasFeature(pageId, 'lookup_key')`. The registry is the single source of truth.

**This means: every new gateable feature must go through the registry workflow before it is considered done.**

### When the workflow triggers

You must run this workflow when any of the following happen during a session:

1. The user asks you to build a new capability that could plausibly be plan-gated. Examples: a new block type, a new analytics view, a new export, a new integration, a new editor tool, a new public-page rendering branch, a new business workflow (forms, bookings, etc.), any new numeric limit (storage, submissions, etc.).
2. You discover existing code that looks like a gateable capability but has no corresponding registry entry. (You should sweep for this opportunistically — if you're touching a file and notice an ungated feature, raise it.)
3. The user explicitly says "add this to the feature registry" or similar.

The trigger is **capability**, not file type. A new React component on its own is not a feature. A new component that exposes a user-facing capability someone might pay for is.

### What the workflow looks like

When triggered, **stop coding** and run these steps in order:

1. **Propose a lookup key.** Use the existing naming convention from `seed-plans.ts` and the matrix in `IMPLEMENTATION_PLAN.md`. Snake_case, lowercase, prefixed by category where applicable (`link_*`, `analytics_*`, `marketing_*`, `business_*`, `support_*`). Stable identifiers — these are referenced in code forever, so pick well.

2. **Propose a category.** Must be one of the existing categories: `core`, `branding`, `design`, `link_types`, `analytics`, `marketing`, `business_tools`, `support`, `limits`. Don't invent new categories without explicit user approval.

3. **Propose a Persian display name and a one-sentence description.** Match the tone of existing rows. The user can edit later in the admin panel; aim for "good enough to ship".

4. **Ask the user three questions, in one batch:**

    a. Which plans get this feature? (`free` / `pro` / `business` — multi-select)
    b. Is this a boolean entitlement, or does it carry a numeric limit? If a limit, what's the limit per plan?
    c. Does this need backfill for existing pages? (Almost always yes if it's a "true on Free or Pro" feature, since existing pages already have `page_entitlements` rows seeded from the registry. New `business_tools` features generally don't need backfill since no existing page has Business.)

5. **Wait for the user's answer before writing any code.** Don't guess. Don't pick a default and proceed. The plan-mapping decision is a product decision and only the user can make it.

6. **Once answered, do all of the following in a single commit:**

    - Add the feature row to `seed-plans.ts` (the seeder is insert-only, so adding a new row + re-running it is safe).
    - Add the appropriate `plan_features` mapping rows to `seed-plans.ts`.
    - Run `pnpm db:seed:plans` against the dev DB to apply.
    - If the user said backfill is needed, write a small migration that inserts `page_entitlements` rows for every existing page on a qualifying plan. Don't conflate this with the seeder — the seeder owns the registry, migrations own per-row data.
    - Wire `pageHasFeature(pageId, '<lookup_key>')` into the actual product code that exposes the capability — both the public renderer (hide entirely) and the editor (locked-with-CTA), per the Phase 5 graceful degradation pattern.
    - Add the new lookup key to the matrix in `IMPLEMENTATION_PLAN.md` so the matrix stays the source-of-truth document.

7. **Verify before declaring done:**

    - `pnpm typecheck` clean.
    - `pnpm build` clean.
    - Grep the codebase for plan-name string comparisons (`=== 'pro'`, `=== 'business'`, `=== 'free'`, `isPro`, `isBusiness`, `userPlan`, `planTier`) — must still return zero hits.
    - Manually verify in the dev DB: a Free page does not have the new entitlement (or has it with the right limit), a Business page does, the public renderer hides the block on Free, the editor shows it locked.

### When NOT to run the workflow

- Bug fixes that don't change capability surface.
- Refactors that move code around without exposing new functionality.
- Internal tooling (admin panel additions, dev scripts, migrations) — these aren't user-facing features, they don't go in the registry.
- Visual tweaks to existing features (CSS changes, copy edits, layout adjustments).
- Backend infrastructure (queue workers, cron jobs, webhook handlers) — these support features but aren't features themselves.

If you're unsure whether something is a "feature" in this sense, **ask the user before assuming**. The cost of a clarifying question is one round trip; the cost of a missed gate is a Free user accessing a paid feature in production.

### Bad outcomes this rule prevents

- A new block type ships with no entitlement check; Free users see it and use it.
- A new analytics view is added to Pro in the matrix but the registry never gets the row; the gate fails open.
- A `business_*` feature gets added with the wrong category or a typo'd lookup key; admin panel grouping breaks; future features reference the wrong key.
- The matrix in `IMPLEMENTATION_PLAN.md` and the live registry drift apart; nobody can tell which is correct.
- Limit values get hardcoded in product code instead of read from `plan_features.limit_value`; changing storage caps requires a deploy instead of an admin edit.

The registry is infrastructure. Treat new entries with the same rigor as new database migrations: small, deliberate, reviewed, traceable.
