# moneytracker

A minimal shared-expense tracker for roommates. Next.js (App Router) + TypeScript + Tailwind on the frontend, Supabase (Postgres + Auth) on the backend.

## Core idea

Each roommate logs expenses they've paid for. Every roommate in the same household sees a personal balance hero (net owed/owes, Splitwise-style), a scrollable expense feed, per-person monthly recurring totals, and a household-wide settle-up list. Roommates can opt out of expenses they weren't part of, which re-splits that expense among the remaining participants and notifies the poster. Roommates can record payments (cash/Venmo/etc. that happened outside the app) to bring balances back down — no real money moves, this is a ledger entry only (see "Payments" below).

## Stack

- Next.js 16 App Router, TypeScript, Tailwind CSS v4, React 19
- Supabase: Postgres, Row Level Security, Supabase Auth (email/password), `@supabase/ssr` for session handling (not the deprecated `auth-helpers` package)
- No ORM — query Supabase directly via the generated client, typed against `src/lib/database.types.ts`

## Data model

- `households` — id, `name` (unique — the room's lookup key), `password`, `owner_id` (references `auth.users`, informational only — who created the room), created_at
- `roommates` — id, household_id, `user_id` (references `auth.users`, nullable), name, email, `venmo_handle` (nullable — public username only, see "Venmo handoff" below), created_at. One row per (household, user); every row is a full member, there's no pending/approved/declined state.
- `expenses` — id, household_id, `paid_by` (references roommates, restrict on delete), label, amount (numeric, > 0), `frequency` (`one_time` | `recurring`), created_at
- `expense_participants` — id, expense_id, household_id, roommate_id, `opted_out` (boolean). One row per (expense, roommate) — seeded when the expense is created for then-current members, and backfilled for anyone who joins later — see "Per-expense participants" below.
- `notifications` — id, household_id, recipient_roommate_id, expense_id (nullable, `on delete set null`), `message` (precomputed, self-contained text), `read_at` (nullable). In-app only, see "Notifications" below.
- `payments` — id, household_id, `from_roommate_id`, `to_roommate_id` (both restrict on delete), amount (numeric, > 0), note (nullable), created_at. Person-to-person, not tied to a specific expense — see "Payments" below.

Indexes on all foreign keys (`household_id`, `paid_by`, `user_id`, plus the new tables' FKs) and `expenses.frequency` for filtering, `notifications(recipient_roommate_id, read_at)` for the unread-count query.

The canonical schema + RLS policies live in `supabase/schema.sql` — run it in the Supabase SQL editor for a fresh install. For an *existing* project, incremental changes ship as numbered files under `supabase/migrations/` (e.g. `002_participants_and_notifications.sql` … `007_venmo_handle.sql`) — additive-only, safe to run against live data (`004` is the exception: it drops `home_code`/`status`, see that file's header comment for the required manual password backfill). `schema.sql` gets the same changes folded in afterward so it stays the complete from-scratch reference; don't let it drift from the migrations.

## Household membership: room name + password, instant join

There is no email invite system and no approval step in v1. Signing in the first time means entering a room name and password — that single action either creates the room (name doesn't exist yet) or joins it (name exists, password matches), atomically, via the `join_or_create_room(p_name, p_password, p_your_name)` Postgres function (`security definer`, since it needs to read `households.password` — a column never exposed via a broad `select` policy — and RLS has no insert policy on `households`/`roommates` at all, so this RPC is the *only* way either table gets a new row). `JoinOrCreateRoomForm` is the one form for both cases; there is no separate create-vs-join UI.

Membership is binary: a `roommates` row exists for a user in a household, or it doesn't. There's no pending/approved/declined state and no admit/decline UI — knowing the room name + password *is* the access control, and it's checked once, at join time, not on every subsequent access.

Post-login routing: no row anywhere → `/join`; row exists → `/dashboard`. That's the entire decision (see `src/app/page.tsx`, `src/app/dashboard/page.tsx`).

Leaving is the mirror image: the "Switch rooms" action in `MenuButton.tsx` deletes the caller's own `roommates` row (confirmed via `window.confirm` first — it's the one non-payment destructive self-service action in the app) and sends them back to `/join`. There's no persisted "which room am I in" state beyond that row, so leaving one room and joining another is just delete-then-insert, not a stored preference to juggle.

## RLS approach

RLS policies avoid recursive self-joins by going through a `security definer` SQL function instead of a correlated subquery on the same table:
- `auth_household_ids()` — household ids where the current user has a `roommates` row (i.e. is a member)

When changing policies, keep using this helper rather than inlining `roommates`-referencing subqueries directly into `roommates` policies (that pattern causes infinite recursion in Postgres RLS). `households` and `roommates` intentionally have **no** insert/update policies for regular clients — all writes to those two tables go through `join_or_create_room`, which bypasses RLS internally as `security definer` rather than needing policies that a plain client insert could also exploit. The one exception is `roommates`' delete policy (`user_id = auth.uid()`, migration `005_leave_room.sql`) — a user can delete their own membership row and only their own, which is what "Switch rooms" uses.

## Balance / split logic

`src/lib/balances.ts` is the single place split math happens. Confirmed v1 rule: every expense ever logged (one-time and recurring alike) is split equally across its own **participant set** (see below) — not the whole household — as a lifetime running total, not a monthly reset. A recurring row is a standing bill entered once; the `recurring` flag only affects the "your recurring bills" display (`MonthlySubtotals`), it does not multiply the row's weight in the balance calc.

`calculateBalances(roommates, expenses, payments)` folds payments in as two more terms on top of the expense math: `balance_i = (paid on expenses − fair share of expenses) + (payments i sent) − (payments i received)`. This is what lets a payment bring a balance back toward — or past — zero; nothing about the expense math changes to accommodate it.

The dashboard's `BalanceHero` (top of page, current user's own net + personal breakdown) and `SettlementList` (household-wide, everyone vs. everyone) both derive from `calculateBalances` → `calculateSettlements`; there is no separate settlement algorithm for the hero, it's the same output filtered to rows involving the current user. `calculateSettlements` itself needed no changes for payments — it only ever sees net balances, not their composition.

**Payments seam**: `balances.ts` is intentionally the only place that knows "who owes whom," and payments are recorded directly into it (see "Payments" below) — the deferred seam is real payment *execution* (Stripe, Venmo links, etc. actually moving money), not recording that a payment already happened outside the app.

## Per-expense participants (opt-out)

By default every current household member is seeded as a participant on a new expense (`expense_participants` row, `opted_out = false`), via the `create_expense_with_participants` Postgres function — this runs the expense insert and the participant-seeding insert in one transaction (plain function, not `security definer`, so both inserts still go through normal RLS as the calling user) so an expense can never end up with zero participant rows. `NewExpenseRow` calls this RPC directly rather than a plain `insert`.

A roommate can opt out (or back in) of any expense they're a participant in **except their own** — RLS blocks the payer from toggling their own row (`roommate_id <> (select paid_by from expenses where id = ...)` in the `with check`). This is enforced at the database level, not just hidden in the UI. Opting out is a reversible toggle, no time limit. If every non-payer opts out, the expense's fair share becomes the full amount for the payer alone — this falls out of the general math with no special-casing needed.

A roommate who joins the household *after* an expense was posted is backfilled onto it — `join_or_create_room` (migration `006_backfill_new_members.sql`) seeds an `opted_out = false` row for every expense that already exists in that household at join time, the same as `create_expense_with_participants` does for new ones going forward. Joining includes you in existing bills by default; you opt out per-expense afterward if a given one doesn't apply to you. (Earlier versions of this app left old expenses alone when someone joined later — that was intentional at the time, but got reversed once it produced a confusing real case: a bill added moments before a roommate joined silently excluded them.)

## Notifications

In-app only for v1 (`notifications` table + `NotificationBell` in the dashboard header). Both opting out AND opting back in re-split the expense and notify its poster — `src/lib/notifications.ts`'s `notifyResplit()` is the single call site that creates a notification row, and is the seam for adding email later (e.g. a Supabase Edge Function triggered on insert into this table) without touching call sites. No realtime subscription in v1 — the bell's unread count reflects whatever was fetched on the last page load / `router.refresh()`, consistent with how the rest of the app already works.

## Payments

Person-to-person, not tied to any specific expense — "Carol paid Alice $20" reduces Carol's overall balance with the household pool, regardless of which expenses caused the debt. One-sided and immediate: recording a payment updates balances right away, no recipient-confirmation step (same trust model expenses already use — anyone can log one unchallenged). Either party can record it — `src/components/SettleUpLine.tsx` renders both "You owe X" and "X owes you" lines in `BalanceHero` with a record-payment action, and the RLS insert policy allows either `from_roommate_id` or `to_roommate_id` to match the caller. The amount field defaults to the suggested settlement amount but is editable, so partial payments are just a normal form submission, not a special case. No update policy on `payments` — a wrong entry gets deleted (allowed by either party) and re-recorded rather than edited, keeping history unambiguous. `PaymentHistory.tsx` shows the full household ledger — see "Dashboard entry points" below for where it's surfaced.

## Venmo handoff

Deep link only — this app never talks to Venmo's API, never authenticates with Venmo, and never moves money. A roommate stores their own public `venmo_handle` (RLS: `roommates` has an update policy scoped to `user_id = auth.uid()` — the only column the UI exposes for it is the handle, though the policy itself is row-level so it technically permits updating the whole row you own, same caveat as the "leave room" delete policy). `src/lib/venmo.ts`'s `buildVenmoUrl()` constructs `https://venmo.com/<handle>?txn=pay&amount=...&note=...` — Venmo's actual universal link format, which the OS intercepts to open the *recipient's* own installed, already-logged-in Venmo app. `openVenmoLink()` picks same-window navigation (`location.href`) on mobile — more reliable for triggering that OS handoff, and a standalone installed PWA doesn't reliably support spawning new tabs anyway — versus `window.open` in a new tab on desktop, checked via user agent at click time (not render time, so no SSR/hydration concern).

Only shown on "you owe" lines in `SettleUpLine` (paying is something the debtor initiates), and only as a real button when the recipient has a handle set — otherwise it's muted "hasn't set up Venmo" text, never a dead link. The amount is always shown in the button's own label regardless of whether Venmo's pre-fill actually lands, since that pre-fill is best-effort on Venmo's end. Clicking it also expands the existing record-payment form on that line (same one "Record payment" opens) so the next step is right there — it does not auto-submit that form, recording the payment is still a separate, deliberate tap after confirming in Venmo. `VenmoHandleModal.tsx` (reachable from `MenuButton` and, if your own handle is unset, a nudge in `BalanceHero`) is where you set/edit your own handle.

## Dashboard entry points

The header holds the room name/password on the left, and on the right just `NotificationBell` (shrunk to a small square, `h-9 w-9`, red unread-count badge) and `MenuButton` (grey square, "☰") — no standalone sign-out button anymore, it lives inside that menu alongside "Switch rooms" (see the membership section above). Both are `h-9 w-9` so they match visually. Everything else on the page is triggered from two prominent elements rather than a row of buttons:

- **`AddExpenseButton.tsx`** — the large circular "+" button (black border, green fill) is absolutely positioned to straddle the bottom border of the `ExpenseFeed` card, centered horizontally (`translate-y-1/2` on a wrapper anchored to that card's bottom edge — deliberately not `position: fixed` relative to the viewport, so it can never overlap scrolled content). It's a dumb controlled component now (just an `onClick` prop) — `ExpenseFeed` owns the `isAdding` boolean and, when true, renders `NewExpenseRow` inline at the top of the list, styled identically to `ExpenseRow`'s own inline edit form (same input/fieldset/button classes, copy-pasted intentionally rather than shared — see below). No modal for adding an expense anymore; that was the original design but read as "worse" once built, so it was replaced.
- **`BalanceHero.tsx`** — the balance summary itself (label, big number, owe/owed line) is the tap target for a `Modal.tsx` containing only `SettlementList`. Only that summary area is clickable, not the whole card — the per-person `SettleUpLine` rows below it (each with their own "Record payment" action) stay independently interactive.

`Modal.tsx` (backdrop + centered panel, click-backdrop-or-✕ to close) is only used by `BalanceHero` now. There is no more `HeaderPopover.tsx`, `MonthlySubtotals.tsx`, `PaymentHistory.tsx`, or `ExpenseForm.tsx` — all were deleted once nothing referenced them. That means "your recurring bills" and "payment history" currently have **no UI anywhere** (confirmed intentional) — the underlying data (the `recurring` flag on expenses, the `payments` table) still exists and still feeds the balance math, it's just not surfaced as its own view. If that's revisited later, don't silently resurrect it — same "flag reachability before removing/not-adding" rule that governed removing it in the first place.

`NewExpenseRow.tsx` and `ExpenseRow.tsx`'s inline edit form intentionally duplicate the same field markup rather than sharing a component — they're two different mutations (create vs. update) on two different schedules; if the form fields change, update both.

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
- No email-based invites (room name + password only)
- No multi-household switching UI — a user is assumed to belong to one room at a time
- No password recovery/change flow for a room's password

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
