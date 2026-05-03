# Admin Users + Pages Refresh — Plan

## Bugs

- **Duplicate React key warnings on `/admin/users`** at lines 248 (`<li>`) and
  336 (`<TableRow>`). Root cause: `listAdminUsers` does
  `.from(users).leftJoin(profiles, ...)` and selects the profile slug/full
  name/avatar directly. Since a user can now own many pages (Phase 1 relaxed
  the `profiles.user_id` unique index), users with N pages produce N rows.
  Fix in `src/lib/data.ts`:
  - Remove `profiles` from the main row source. Keep filtering/searching on
    profile fields by switching to `EXISTS (SELECT 1 FROM profiles WHERE
user_id = users.id AND <pred>)` subqueries (and `NOT EXISTS` for
    incomplete).
  - Pull display profile (slug/fullName/avatar/title/isComplete) per user
    via a `LATERAL` subquery joined once that returns the **oldest** page
    only — matches the user-detail picker default.
  - Aggregate `pageCount`, plan summary, and "any trial / past-due / grace"
    flags via batched secondary queries keyed by `user.id` (same pattern as
    the existing `linkCounts` / `eventCounts` / `cardCounts` block).
- After the fix every user appears exactly once in `result.items`. Verified
  in dev DB by checking that a user with multiple pages still produces a
  single row.

## `/admin/users` upgrades

- New `AdminUserListItem` fields: `pageCount: number`,
  `pagePlans: { pageId, slug, planKey, status, currentPeriodEnd, cancelAtPeriodEnd, trialEndsAt }[]`.
- New table column **«صفحه‌ها»** showing `pageCount` with a small plan
  summary line ("۱ Pro · ۱ Free · ۱ آزمایشی"). The cell hosts a `<details>`
  disclosure listing each page (slug + plan badge + status + period end +
  link to `/admin/billing/pages/[pageId]`). No drawer/dialog needed —
  `<details>` is RTL-friendly and avoids client JS for the directory page.
- Plan summary chip on each row visually flags risky states:
  trialing (amber), grace/past-due (rose), cancel_at_period_end (muted).
- New filter chips appended to the existing five:
  - `paid` — at least one page on Pro or Business
  - `free_only` — every page on Free
  - `trialing` — any page in a trial
  - `at_risk` — any page in `grace` / `expired`
- `مدیریت` action stays linking to `/admin/users/[id]`. The user-detail
  page gets a new section («صفحه‌های این کاربر») listing each page with:
  plan badge, status badge, period end, and three links — manage
  (`/admin/billing/pages/[pageId]`), invoices
  (`/admin/billing/invoices?userId=…`), public URL. No new mutation
  surfaces here; everything links into the existing per-page workshop and
  the existing invoice browser.
- Per-row invoices shortcut: small icon button on each user row jumping to
  `/admin/billing/invoices?userId=<id>`.

## `/admin/billing/invoices` filter

The browser previously only supported text search (`q`). Add `userId`
filtering: when `?userId=<uuid>` is present, scope `WHERE u."id" =
<userId>` and surface a small "فیلترشده برای کاربر …" chip with a
"حذف فیلتر" link. URL state preserves the filter through pagination.

## New page: `/admin/pages`

A platform-wide pages directory. We keep `/admin/billing/pages` (the
existing Phase 13 surface) — it's still useful as a billing-oriented
view and the per-page drill-down lives at
`/admin/billing/pages/[pageId]`. The new `/admin/pages` is the broader
directory: every page on the platform, billing or not, with editorial
metrics (block count, total views) on top of plan/status. They are
complementary: `/admin/pages` is the directory, `/admin/billing/pages`
is the billing-focused subset, both link into the same drill-down.

Layout mirrors `/admin/users`:

- 5 stat tiles: total pages, new in 7d, active pages, paid pages
  (Pro/Business), pages in trial.
- 14-day pages-created sparkline.
- Search by slug, page title, or owner phone/name.
- Filter chips: `all`, `free`, `pro`, `business`, `trialing`, `grace`,
  `expired`, `cancel_at_period_end`.
- Table columns:
  - صفحه (avatar + title + slug + external link)
  - مالک (name + phone, links to `/admin/users/[ownerId]`)
  - پلن (Free/Pro/Business badge — display-only mapping, no gating)
  - وضعیت (subscription status badge)
  - پایان دوره (Jalali date)
  - بلوک‌ها (links count for now; bookings/forms can be added later)
  - بازدید (sum from `profile_stats_by_day`)
  - ساخته شده (Jalali date)
  - مدیریت (link to `/admin/billing/pages/[pageId]`)
- Pagination + URL state, copying the pattern in
  `/admin/billing/pages/page.tsx`.

## Sidebar

Insert «صفحه‌ها» nav entry between «کاربران» and «صورت‌حساب‌ها». Icon
key: `page` (already exists in `sidebar-nav.tsx`'s icon map).

## Architectural compliance

- No new `=== 'pro' / 'business' / 'free'` gating logic. Plan-key reads
  here are display-only: rendering a badge from `plans.key`. Verified
  with the same grep at the end of the work.
- No N+1: `pageCount`/plan-summary/page block-count/views are all
  computed via a single grouped query per concern keyed by user/page id.
- Server components fetch data; client components only where
  interactivity demands it (none here — the disclosure uses native
  `<details>`).
- Persian + RTL + light theme matched to the screenshot reference.
- Feature registry workflow does **not** apply: this work is
  internal admin tooling, explicitly excluded from the registry per
  `CLAUDE.md` ("Internal tooling (admin panel additions, dev scripts,
  migrations) — these aren't user-facing features, they don't go in the
  registry").

## Verification

- `pnpm typecheck` clean.
- `pnpm build` clean.
- `pnpm test` — 50 tests still pass (no test deltas planned).
- Manual: `/admin/users` no longer warns about duplicate keys; users
  with multiple pages render once with accurate plan summary.
