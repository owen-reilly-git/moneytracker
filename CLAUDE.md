# moneytracker

A minimal shared-expense tracker for roommates. Next.js (App Router) + TypeScript + Tailwind on the frontend, Supabase (Postgres + Auth) on the backend.

## Core idea

Each roommate logs expenses they've paid for. Every roommate in the same household sees the full expense list, monthly recurring subtotals per person, and a "what everyone owes" balance summary. No real payments — balances are numbers on screen only (see "Payments seam" below).

## Stack

- Next.js 16 App Router, TypeScript, Tailwind CSS v4, React 19
- Supabase: Postgres, Row Level Security, Supabase Auth (email/password), `@supabase/ssr` for session handling (not the deprecated `auth-helpers` package)
- No ORM — query Supabase directly via the generated client, typed against `src/lib/database.types.ts`

## Data model

- `households` — id, name, `home_code` (unique, chosen by the creator), `owner_id` (references `auth.users`), created_at
- `roommates` — id, household_id, `user_id` (references `auth.users`, nullable), name, email, `status` (`pending` | `approved` | `declined`), created_at. One row per (household, user).
- `expenses` — id, household_id, `paid_by` (references roommates, restrict on delete), label, amount (numeric, > 0), `frequency` (`one_time` | `recurring`), created_at

Indexes on all foreign keys (`household_id`, `paid_by`, `user_id`) plus `expenses.frequency` for filtering.

The canonical schema + RLS policies live in `supabase/schema.sql` — run it in the Supabase SQL editor. Treat that file as the source of truth for the DB; don't hand-edit the schema in the dashboard without also updating it there.

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

`src/lib/balances.ts` is the single place split math happens. Confirmed v1 rule: every expense ever logged (one-time and recurring alike) is split equally across all currently-`approved` roommates, as a lifetime running total — not a monthly reset. A recurring row is a standing bill entered once; the `recurring` flag only affects the monthly-subtotal display, it does not multiply the row's weight in the balance calc. Keep this file free of any actual money-movement logic.

**Payments seam**: this is intentionally the only place that knows "who owes whom." When a real payments integration (Stripe, Venmo links, etc.) gets added later, it should read from this module's output rather than recomputing balances elsewhere.

## Explicitly out of scope (v1)

- No Stripe / direct deposit / real payment execution
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
