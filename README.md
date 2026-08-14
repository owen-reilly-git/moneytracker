# moneytracker

Minimal shared-expense tracker for roommates. Log what you paid for, see the full household list, monthly recurring subtotals, and a running "what everyone owes" balance. No real payments — see [CLAUDE.md](./CLAUDE.md) for the full design notes.

## Stack

Next.js (App Router) + TypeScript + Tailwind CSS, Supabase (Postgres, Auth, Row Level Security).

## 1. Create a Supabase project

Create a project at [supabase.com](https://supabase.com), then in **Project Settings > API** grab:

- Project URL
- `anon` public key

## 2. Run the database schema

Open the Supabase **SQL Editor** and run the entire contents of [`supabase/schema.sql`](./supabase/schema.sql). This creates the `households`, `roommates`, and `expenses` tables, the helper functions, and all Row Level Security policies.

## 3. Configure environment variables

```bash
cp .env.local.example .env.local
```

Fill in:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

Both are safe to expose client-side — RLS is what actually protects the data. Never commit `.env.local`.

## 4. Install and run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## 5. Try it out

1. Sign up with an email/password (Supabase sends a confirmation email by default — either confirm it, or turn off "Confirm email" in **Authentication > Providers > Email** for local testing).
2. On first login you'll land on **/join**: create a household and pick a home code, or enter someone else's code to request to join.
3. The household owner sees incoming join requests on the dashboard and can admit or decline them.
4. Once approved, add expenses (one-time or recurring) and see the shared dashboard, per-person monthly recurring subtotals, and the balance summary.

## Notes

- Email auth only in v1 — no OAuth providers.
- No payments integration. `src/lib/balances.ts` is the seam where one would plug in later.
- Full architecture and data-model notes live in [CLAUDE.md](./CLAUDE.md).
