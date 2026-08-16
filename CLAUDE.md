# moneytracker

A minimal shared-expense tracker for roommates. Next.js (App Router) + TypeScript + Tailwind on the frontend, Supabase (Postgres + Auth) on the backend.

## Core idea

Each roommate logs expenses they've paid for. Every roommate in the same household sees a personal balance hero (net owed/owes, Splitwise-style), a scrollable expense feed, per-person monthly recurring totals, and a household-wide settle-up list. Roommates can opt out of expenses they weren't part of, which re-splits that expense among the remaining participants and notifies the poster. Roommates can record payments (cash/Venmo/etc. that happened outside the app) to bring balances back down — no real money moves, this is a ledger entry only (see "Payments" below).

## Stack

- Next.js 16 App Router, TypeScript, Tailwind CSS v4, React 19
- Supabase: Postgres, Row Level Security, Supabase Auth (email/password), `@supabase/ssr` for session handling (not the deprecated `auth-helpers` package)
- No ORM — query Supabase directly via the generated client, typed against `src/lib/database.types.ts`

## Data model

- `households` — id, name, `home_code` (unique, chosen by the creator), `owner_id` (references `auth.users`), created_at
- `roommates` — id, household_id, `user_id` (references `auth.users`, nullable), name, email, `status` (`pending` | `approved` | `declined`), created_at. One row per (household, user).
- `expenses` — id, household_id, `paid_by` (references roommates, restrict on delete), label, amount (numeric, > 0), `frequency` (`one_time` | `recurring`), created_at
- `expense_participants` — id, expense_id, household_id, roommate_id, `opted_out` (boolean). One row per (expense, roommate) that was approved at the time the expense was created — see "Per-expense participants" below.
- `notifications` — id, household_id, recipient_roommate_id, expense_id (nullable, `on delete set null`), `message` (precomputed, self-contained text), `read_at` (nullable). In-app only, see "Notifications" below.
- `payments` — id, household_id, `from_roommate_id`, `to_roommate_id` (both restrict on delete), amount (numeric, > 0), note (nullable), created_at. Person-to-person, not tied to a specific expense — see "Payments" below.

Indexes on all foreign keys (`household_id`, `paid_by`, `user_id`, plus the new tables' FKs) and `expenses.frequency` for filtering, `notifications(recipient_roommate_id, read_at)` for the unread-count query.

The canonical schema + RLS policies live in `supabase/schema.sql` — run it in the Supabase SQL editor for a fresh install. For an *existing* project, incremental changes ship as numbered files under `supabase/migrations/` (e.g. `002_participants_and_notifications.sql`, `003_payments.sql`) — additive-only, safe to run against live data. `schema.sql` gets the same additions folded in afterward so it stays the complete from-scratch reference; don't let it drift from the migrations.

## Household membership: the "Home Code" flow

There is no email invite system in v1. Instead:

1. **Create**: the first person ("owner") picks a household name and a home code they make up, which creates the `households` row and an auto-`approved` `roommates` row for themselves.
2. **Join request**: anyone else enters that home code on the join screen, which looks up the household via the `find_household_by_code(code)` Postgres function (a `security definer` RPC — it does NOT expose a broad `SELECT` policy on `households`, since the code is the only thing gating access) and inserts a `pending` `roommates` row for themselves.
3. **Approve/decline**: only the household owner (`households.owner_id = auth.uid()`) can update a `roommates` row's status. Pending/declined members cannot see any household data beyond their own membership row.
4. Only `approved` roommates can see or add expenses in a household (`auth_household_ids()` helper filters on `status = 'approved'`).

Post-login routing depends on the current user's roommate row(s):
- no row anywhere → `/join` (create or enter a home code)
- row exists but `pending` → `/pending` (holding page)
- row `approved` → `/dashboard`

## RLS approach

RLS policies avoid recursive self-joins by going through two `security definer` SQL functions instead of correlated subqueries on the same table:
- `auth_household_ids()` — household ids where the current user is an `approved` roommate
- `is_household_owner(household_id)` — whether the current user owns that household

When changing policies, keep using these helpers rather than inlining `roommates`-referencing subqueries directly into `roommates` policies (that pattern causes infinite recursion in Postgres RLS).

## Balance / split logic

`src/lib/balances.ts` is the single place split math happens. Confirmed v1 rule: every expense ever logged (one-time and recurring alike) is split equally across its own **participant set** (see below) — not the whole household — as a lifetime running total, not a monthly reset. A recurring row is a standing bill entered once; the `recurring` flag only affects the "your recurring bills" display (`MonthlySubtotals`), it does not multiply the row's weight in the balance calc.

`calculateBalances(roommates, expenses, payments)` folds payments in as two more terms on top of the expense math: `balance_i = (paid on expenses − fair share of expenses) + (payments i sent) − (payments i received)`. This is what lets a payment bring a balance back toward — or past — zero; nothing about the expense math changes to accommodate it.

The dashboard's `BalanceHero` (top of page, current user's own net + personal breakdown) and `SettlementList` (household-wide, everyone vs. everyone) both derive from `calculateBalances` → `calculateSettlements`; there is no separate settlement algorithm for the hero, it's the same output filtered to rows involving the current user. `calculateSettlements` itself needed no changes for payments — it only ever sees net balances, not their composition.

**Payments seam**: `balances.ts` is intentionally the only place that knows "who owes whom," and payments are recorded directly into it (see "Payments" below) — the deferred seam is real payment *execution* (Stripe, Venmo links, etc. actually moving money), not recording that a payment already happened outside the app.

## Per-expense participants (opt-out)

By default every currently-`approved` roommate is seeded as a participant on a new expense (`expense_participants` row, `opted_out = false`), via the `create_expense_with_participants` Postgres function — this runs the expense insert and the participant-seeding insert in one transaction (plain function, not `security definer`, so both inserts still go through normal RLS as the calling user) so an expense can never end up with zero participant rows. `ExpenseForm` calls this RPC directly rather than a plain `insert`.

A roommate can opt out (or back in) of any expense they're a participant in **except their own** — RLS blocks the payer from toggling their own row (`roommate_id <> (select paid_by from expenses where id = ...)` in the `with check`). This is enforced at the database level, not just hidden in the UI. Opting out is a reversible toggle, no time limit. If every non-payer opts out, the expense's fair share becomes the full amount for the payer alone — this falls out of the general math with no special-casing needed.

A roommate who joins the household *after* an expense was posted has no participant row for it at all (not seeded retroactively) — same effect as having opted out, but distinguished conceptually: absence means "wasn't here," `opted_out = true` means "chose not to."

## Notifications

In-app only for v1 (`notifications` table + `NotificationBell` in the dashboard header). Both opting out AND opting back in re-split the expense and notify its poster — `src/lib/notifications.ts`'s `notifyResplit()` is the single call site that creates a notification row, and is the seam for adding email later (e.g. a Supabase Edge Function triggered on insert into this table) without touching call sites. No realtime subscription in v1 — the bell's unread count reflects whatever was fetched on the last page load / `router.refresh()`, consistent with how the rest of the app already works.

## Payments

Person-to-person, not tied to any specific expense — "Carol paid Alice $20" reduces Carol's overall balance with the household pool, regardless of which expenses caused the debt. One-sided and immediate: recording a payment updates balances right away, no recipient-confirmation step (same trust model expenses already use — anyone can log one unchallenged). Either party can record it — `src/components/SettleUpLine.tsx` renders both "You owe X" and "X owes you" lines in `BalanceHero` with a record-payment action, and the RLS insert policy allows either `from_roommate_id` or `to_roommate_id` to match the caller. The amount field defaults to the suggested settlement amount but is editable, so partial payments are just a normal form submission, not a special case. No update policy on `payments` — a wrong entry gets deleted (allowed by either party) and re-recorded rather than edited, keeping history unambiguous. `PaymentHistory.tsx` (behind the "Payment history" header popover) shows the full household ledger.

## PWA (installable app, offline shell)

Service worker via **Serwist's Turbopack integration** (`@serwist/turbopack`), not `@serwist/next` (webpack-only, incompatible) and not `next-pwa` (unmaintained, also webpack-only). This project builds with Turbopack for both `next dev` and `next build` (Next 16 default) — verified `@serwist/turbopack` supports this on its stable `latest` npm tag before adopting it, by pulling the official `next-turbo-basic` example from `github.com/serwist/serwist`.

- `next.config.ts` — wrapped with `withSerwist()`.
- `src/app/sw.ts` — service worker source: Serwist's `defaultCache` (Next.js-aware runtime caching for static assets/pages/fonts) plus a `fallbacks` entry so a failed navigation serves `/offline` instead of the browser's native error page.
- `src/app/serwist/[path]/route.ts` — Route Handler (`createSerwistRoute`) that compiles `sw.ts` and serves it at `/serwist/sw.js`; also precaches `/offline` at build time via `additionalPrecacheEntries` so the fallback works even before a user has visited it online.
- `src/app/layout.tsx` — wraps `{children}` in `<SerwistProvider swUrl="/serwist/sw.js">` (from `@serwist/turbopack/react`), which handles registration. No manual `navigator.serviceWorker.register` call.
- **Cross-origin note**: the service worker only intercepts same-origin requests. Supabase calls go to a different origin (`*.supabase.co`) and are never cached — "offline" means the app shell still loads, not that expense/balance data is available offline. Caching Supabase responses would risk showing stale financial numbers as if live, so this is deliberate, not a gap.
- `src/app/manifest.ts`, `src/app/icon.tsx`, `src/app/apple-icon.tsx` — native App Router conventions (auto-linked in `<head>`, no manual `<link>` tags). Icons are generated programmatically via `ImageResponse` (`next/og`) — solid `#111827` square with a white "M" — not hand-authored image files.
- `src/app/icons/[size]/route.tsx` — a dedicated Route Handler (192 / 512 / 512-maskable) purely for `manifest.ts`'s `icons` array, which needs stable, literal URLs rather than Next's auto-generated (and not-meant-to-be-referenced-externally) icon paths.
- `src/components/IosInstallHint.tsx` — dismissible "tap Share → Add to Home Screen" banner, since iOS gives no automatic install prompt. Uses `useSyncExternalStore` (not `useEffect` + `setState`) to read browser-only state (iOS UA, standalone-display-mode) without an SSR hydration mismatch or a flagged synchronous-setState-in-effect lint error.
- `tsconfig.json` — `lib` includes `"webworker"` alongside `"dom"` (needed for `ServiceWorkerGlobalScope` in `sw.ts`); matches Serwist's own example config, does not appear to conflict with the rest of the app's DOM types.
- `.gitignore` — `public/sw*` / `public/swe-worker*` (Serwist's own recommended entries for generated artifacts).

## Explicitly out of scope (v1)

- No Stripe / direct deposit / real payment execution — `payments` only records that a settlement happened, never moves money
- No email-based invites (home code only)
- No multi-household switching UI beyond what membership status requires

## Env vars

Set in `.env.local` (never commit secrets):
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

No service-role key is used client-side or in this app.

## Commands

- `npm run dev` — local dev server
- `npm run build` — production build
- `npm run start` — run a production build
- `npm run lint` — ESLint

## Notes

- `next dev` regenerates an `AGENTS.md` block with Next.js 16 upgrade notes on each run — that's expected, not a manual edit gone missing.
- Session refresh lives in `src/proxy.ts` (Next.js 16 renamed the `middleware.ts` convention to `proxy.ts`; the exported function is `proxy`, not `middleware`).
