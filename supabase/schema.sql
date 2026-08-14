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
