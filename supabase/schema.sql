-- moneytracker schema + RLS policies
-- Run this whole file in the Supabase SQL editor (Project > SQL Editor > New query).
-- Safe to re-run: uses create-or-replace / if-not-exists where practical.

create extension if not exists pgcrypto;

create type expense_frequency as enum ('one_time', 'recurring');

-- `name` is the room's lookup key (paired with `password` — see
-- join_or_create_room below), so it must be unique. `owner_id` is purely
-- informational (who created the room) — no policy treats the owner
-- specially, they're just the room's first member.
create table households (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  password text not null,
  owner_id uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

-- Every row here is a full member by definition — there's no pending or
-- declined state. Joining a household happens atomically alongside
-- verifying its password, via join_or_create_room below, never a plain
-- client-side insert.
create table roommates (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  name text not null,
  email text not null,
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

-- Household ids where the current user is a member.
create or replace function auth_household_ids()
returns setof uuid
language sql
security definer
stable
set search_path = public
as $$
  select household_id from roommates where user_id = auth.uid();
$$;

-- join_or_create_room is defined further down, after expense_participants
-- exists — it seeds participant rows on join, so it needs that table.

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table households enable row level security;
alter table roommates enable row level security;
alter table expenses enable row level security;

-- households — no insert policy: creation only happens through
-- join_or_create_room, which bypasses RLS internally as security definer.
create policy "select own household" on households
  for select using (id in (select auth_household_ids()));

-- roommates — no insert/update policy: joining only happens through
-- join_or_create_room, and there's no admit/decline action or status
-- to change anymore.
create policy "select roommates in own household" on roommates
  for select using (household_id in (select auth_household_ids()));

-- "Switch rooms": deletes the caller's own membership row (never
-- anyone else's), then the UI sends them to /join.
create policy "roommate leaves own membership" on roommates
  for delete using (user_id = auth.uid());

-- expenses
create policy "select expenses in own household" on expenses
  for select using (household_id in (select auth_household_ids()));

create policy "insert expenses as household member" on expenses
  for insert with check (
    household_id in (select auth_household_ids())
    and paid_by in (select id from roommates where user_id = auth.uid())
  );

create policy "update own expenses" on expenses
  for update using (
    paid_by in (select id from roommates where user_id = auth.uid())
  )
  with check (household_id in (select auth_household_ids()));

create policy "delete own expenses" on expenses
  for delete using (
    paid_by in (select id from roommates where user_id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- Per-expense participants + in-app notifications
-- (originally shipped as supabase/migrations/002_participants_and_notifications.sql
-- against a live project; folded in here so this file stays the complete
-- from-scratch reference for new installs.)
-- ---------------------------------------------------------------------------

-- expense_participants: who's actually splitting a given expense.
-- One row per (expense, roommate) seeded at creation time from the
-- household roster at that moment. Absence of a row means "wasn't a
-- household member when this was posted" (e.g. joined later) — not the
-- same as opted_out=true, and intentionally excluded either way.
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
join roommates r on r.household_id = e.household_id
where not exists (
  select 1 from expense_participants ep where ep.expense_id = e.id
);

-- Joins an existing room (verifying its password) or creates a new one
-- (if no room has that name yet) and adds the caller as a member, all in
-- one transaction. security definer because it needs to read
-- households.password to verify it — that column is never exposed via a
-- broad SELECT policy, so this is the only way to check it. Also backfills
-- the new member as a participant (opted_out=false) on every expense that
-- already exists in the room — joining includes you in existing bills by
-- default, same as it already does for future ones; opt out per-expense
-- afterward if needed.
create or replace function join_or_create_room(
  p_name text,
  p_password text,
  p_your_name text
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_user_email text;
  v_household_id uuid;
  v_existing_password text;
  v_roommate_id uuid;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select email into v_user_email from auth.users where id = v_user_id;

  select id, password into v_household_id, v_existing_password
  from households where name = p_name;

  if v_household_id is null then
    insert into households (name, password, owner_id)
    values (p_name, p_password, v_user_id)
    returning id into v_household_id;
  else
    if v_existing_password is distinct from p_password then
      raise exception 'Incorrect password';
    end if;

    if exists (
      select 1 from roommates
      where household_id = v_household_id and user_id = v_user_id
    ) then
      return v_household_id;
    end if;
  end if;

  insert into roommates (household_id, user_id, name, email)
  values (v_household_id, v_user_id, p_your_name, coalesce(v_user_email, ''))
  returning id into v_roommate_id;

  insert into expense_participants (expense_id, household_id, roommate_id, opted_out)
  select e.id, e.household_id, v_roommate_id, false
  from expenses e
  where e.household_id = v_household_id
  on conflict (expense_id, roommate_id) do nothing;

  return v_household_id;
end;
$$;

grant execute on function join_or_create_room(text, text, text) to authenticated;

-- Backfill: no-op on a fresh install, kept so this file matches
-- supabase/migrations/006_backfill_new_members.sql exactly. On an
-- existing project with data predating the join-time backfill above,
-- this brings it in line: every current member becomes a participant on
-- every existing expense in their household, wherever missing. Existing
-- rows (including prior opt-outs) are left untouched.
insert into expense_participants (expense_id, household_id, roommate_id, opted_out)
select e.id, e.household_id, r.id, false
from expenses e
join roommates r on r.household_id = e.household_id
where not exists (
  select 1 from expense_participants ep
  where ep.expense_id = e.id and ep.roommate_id = r.id
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
-- current household roommate. Runs with the CALLER's own privileges
-- (default, not security definer) so both inserts still go through
-- normal RLS below — this is purely about atomicity (avoids an expense
-- with zero participant rows if the second insert ever failed as two
-- separate client calls).
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
  where household_id = p_household_id;

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
        and e.paid_by in (select id from roommates where user_id = auth.uid())
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
