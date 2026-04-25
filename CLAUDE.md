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
