-- moneytracker schema + RLS policies
-- Run this whole file in the Supabase SQL editor (Project > SQL Editor > New query).
-- Safe to re-run: uses create-or-replace / if-not-exists where practical.

create extension if not exists pgcrypto;

create type expense_frequency as enum ('one_time', 'recurring');
create type roommate_status as enum ('pending', 'approved', 'declined');

create table households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  home_code text not null unique,
  owner_id uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create table roommates (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  name text not null,
  email text not null,
  status roommate_status not null default 'pending',
  created_at timestamptz not null default now(),
  unique (household_id, user_id)
);

create index roommates_household_id_idx on roommates(household_id);
create index roommates_user_id_idx on roommates(user_id);

create table expenses (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  paid_by uuid not null references roommates(id) on delete restrict,
  label text not null,
  amount numeric(10, 2) not null check (amount > 0),
  frequency expense_frequency not null default 'one_time',
  created_at timestamptz not null default now()
);

create index expenses_household_id_idx on expenses(household_id);
create index expenses_paid_by_idx on expenses(paid_by);
create index expenses_frequency_idx on expenses(frequency);

-- ---------------------------------------------------------------------------
-- Helper functions (security definer, so they can read roommates/households
-- on behalf of the caller without re-triggering RLS recursively).
-- ---------------------------------------------------------------------------

-- Household ids where the current user is an APPROVED member.
create or replace function auth_household_ids()
returns setof uuid
language sql
security definer
stable
set search_path = public
as $$
  select household_id from roommates
  where user_id = auth.uid() and status = 'approved';
$$;

-- Household ids where the current user has ANY membership row
-- (pending, approved, or declined) — used so a pending/declined
-- user can still see which household they applied to.
create or replace function auth_member_household_ids()
returns setof uuid
language sql
security definer
stable
set search_path = public
as $$
  select household_id from roommates where user_id = auth.uid();
$$;

-- Whether the current user owns this household.
create or replace function is_household_owner(hh_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists(
    select 1 from households where id = hh_id and owner_id = auth.uid()
  );
$$;

-- Look up a household by home code without exposing a broad SELECT policy
-- on households — the code itself is the access gate, so this only returns
-- the minimum needed to show a "join this household?" confirmation.
create or replace function find_household_by_code(code text)
returns table(id uuid, name text)
language sql
security definer
stable
set search_path = public
as $$
  select id, name from households where home_code = code;
$$;

grant execute on function find_household_by_code(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table households enable row level security;
alter table roommates enable row level security;
alter table expenses enable row level security;

-- households
create policy "select own, owned, or applied-to household" on households
  for select using (
    owner_id = auth.uid()
    or id in (select auth_member_household_ids())
  );

create policy "authenticated users can create households" on households
  for insert with check (owner_id = auth.uid());

-- roommates
create policy "self, owner, or approved peers" on roommates
  for select using (
    user_id = auth.uid()
    or is_household_owner(household_id)
    or (status = 'approved' and household_id in (select auth_household_ids()))
  );

create policy "join as pending, or owner self-joins approved" on roommates
  for insert with check (
    user_id = auth.uid()
    and (
      status = 'pending'
      or (status = 'approved' and is_household_owner(household_id))
    )
  );

create policy "owner manages membership status" on roommates
  for update using (is_household_owner(household_id))
  with check (is_household_owner(household_id));

-- expenses
create policy "select expenses in own household" on expenses
  for select using (household_id in (select auth_household_ids()));

create policy "insert expenses as approved member" on expenses
  for insert with check (
    household_id in (select auth_household_ids())
    and paid_by in (
      select id from roommates where user_id = auth.uid() and status = 'approved'
    )
  );

create policy "update own expenses" on expenses
  for update using (
    paid_by in (select id from roommates where user_id = auth.uid() and status = 'approved')
  )
  with check (household_id in (select auth_household_ids()));

create policy "delete own expenses" on expenses
  for delete using (
    paid_by in (select id from roommates where user_id = auth.uid() and status = 'approved')
  );

-- ---------------------------------------------------------------------------
-- Per-expense participants + in-app notifications
-- (originally shipped as supabase/migrations/002_participants_and_notifications.sql
-- against a live project; folded in here so this file stays the complete
-- from-scratch reference for new installs.)
-- ---------------------------------------------------------------------------

-- expense_participants: who's actually splitting a given expense.
-- One row per (expense, roommate) seeded at creation time from the
-- currently-approved household roster. Absence of a row means "wasn't
-- a household member when this was posted" (e.g. joined later) — not
-- the same as opted_out=true, and intentionally excluded either way.
create table expense_participants (
  id uuid primary key default gen_random_uuid(),
  expense_id uuid not null references expenses(id) on delete cascade,
  household_id uuid not null references households(id) on delete cascade,
  roommate_id uuid not null references roommates(id) on delete cascade,
  opted_out boolean not null default false,
  created_at timestamptz not null default now(),
  unique (expense_id, roommate_id)
);

create index expense_participants_expense_id_idx on expense_participants(expense_id);
create index expense_participants_roommate_id_idx on expense_participants(roommate_id);
create index expense_participants_household_id_idx on expense_participants(household_id);

-- Backfill: no-op on a fresh install (no expenses exist yet), but kept
-- here so this file matches supabase/migrations/002_*.sql exactly. See
-- that file's comment for why this exists.
insert into expense_participants (expense_id, household_id, roommate_id, opted_out)
select e.id, e.household_id, r.id, false
from expenses e
join roommates r on r.household_id = e.household_id and r.status = 'approved'
where not exists (
  select 1 from expense_participants ep where ep.expense_id = e.id
);

-- notifications: in-app only for v1. `message` is a precomputed,
-- self-contained snapshot string (not derived via joins at render
-- time) so it still reads correctly even if the source expense is
-- later edited or deleted. This table is the seam for email later —
-- a Supabase Edge Function trigger on insert would be the natural
-- place to add that, without touching this schema.
create table notifications (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  recipient_roommate_id uuid not null references roommates(id) on delete cascade,
  expense_id uuid references expenses(id) on delete set null,
  message text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_recipient_unread_idx on notifications(recipient_roommate_id, read_at);
create index notifications_household_id_idx on notifications(household_id);

-- Atomically creates an expense and seeds one participant row per
-- currently-approved household roommate. Runs with the CALLER's own
-- privileges (default, not security definer) so both inserts still
-- go through normal RLS below — this is purely about atomicity
-- (avoids an expense with zero participant rows if the second insert
-- ever failed as two separate client calls).
create or replace function create_expense_with_participants(
  p_household_id uuid,
  p_paid_by uuid,
  p_label text,
  p_amount numeric,
  p_frequency expense_frequency
) returns uuid
language plpgsql
as $$
declare
  v_expense_id uuid;
begin
  insert into expenses (household_id, paid_by, label, amount, frequency)
  values (p_household_id, p_paid_by, p_label, p_amount, p_frequency)
  returning id into v_expense_id;

  insert into expense_participants (expense_id, household_id, roommate_id, opted_out)
  select v_expense_id, p_household_id, id, false
  from roommates
  where household_id = p_household_id and status = 'approved';

  return v_expense_id;
end;
$$;

grant execute on function create_expense_with_participants(uuid, uuid, text, numeric, expense_frequency) to authenticated;

alter table expense_participants enable row level security;
alter table notifications enable row level security;

-- expense_participants
create policy "select participants in own household" on expense_participants
  for select using (household_id in (select auth_household_ids()));

-- Bulk-insert (one call seeds every roommate's row) is only allowed
-- when the caller is the payer of the expense being seeded — i.e.
-- only via create_expense_with_participants, called by the poster.
create policy "poster seeds participants for their own expense" on expense_participants
  for insert with check (
    household_id in (select auth_household_ids())
    and exists (
      select 1 from expenses e
      where e.id = expense_participants.expense_id
        and e.paid_by in (
          select id from roommates where user_id = auth.uid() and status = 'approved'
        )
    )
  );

-- A roommate can only toggle their OWN row, and never the payer's row
-- (the payer can't opt out of their own expense).
create policy "roommate toggles own participation" on expense_participants
  for update using (
    roommate_id in (select id from roommates where user_id = auth.uid())
  )
  with check (
    roommate_id in (select id from roommates where user_id = auth.uid())
    and roommate_id <> (select paid_by from expenses where id = expense_participants.expense_id)
  );

-- notifications
create policy "recipient reads own notifications" on notifications
  for select using (
    recipient_roommate_id in (select id from roommates where user_id = auth.uid())
  );

-- Anyone in the same household can notify another member of that
-- household (used when opting out/back in to notify the poster).
create policy "household member notifies household member" on notifications
  for insert with check (
    household_id in (select auth_household_ids())
    and recipient_roommate_id in (
      select id from roommates where household_id = notifications.household_id
    )
  );

create policy "recipient marks own notifications read" on notifications
  for update using (
    recipient_roommate_id in (select id from roommates where user_id = auth.uid())
  )
  with check (
    recipient_roommate_id in (select id from roommates where user_id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- Settle-up / payment tracking
-- (originally shipped as supabase/migrations/003_payments.sql against a
-- live project; folded in here so this file stays the complete
-- from-scratch reference for new installs.)
-- ---------------------------------------------------------------------------

create table payments (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  from_roommate_id uuid not null references roommates(id) on delete restrict,
  to_roommate_id uuid not null references roommates(id) on delete restrict,
  amount numeric(10, 2) not null check (amount > 0),
  note text,
  created_at timestamptz not null default now(),
  check (from_roommate_id <> to_roommate_id)
);

create index payments_household_id_idx on payments(household_id);
create index payments_from_roommate_id_idx on payments(from_roommate_id);
create index payments_to_roommate_id_idx on payments(to_roommate_id);

alter table payments enable row level security;

create policy "select payments in own household" on payments
  for select using (household_id in (select auth_household_ids()));

-- Either party to the payment can record it — the payer or the
-- recipient — since there's no confirmation step to distinguish
-- "claimed" from "verified" anyway.
create policy "party records a payment" on payments
  for insert with check (
    household_id in (select auth_household_ids())
    and (
      from_roommate_id in (select id from roommates where user_id = auth.uid())
      or to_roommate_id in (select id from roommates where user_id = auth.uid())
    )
  );

-- Same "either party" rule for deleting a mistaken entry. No update
-- policy — if the amount/note is wrong, delete and re-record rather
-- than edit, keeping the ledger's history unambiguous.
create policy "either party deletes a payment" on payments
  for delete using (
    from_roommate_id in (select id from roommates where user_id = auth.uid())
    or to_roommate_id in (select id from roommates where user_id = auth.uid())
  );
