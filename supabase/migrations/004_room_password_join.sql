-- moneytracker migration 004: room name + password join, remove admit/decline
-- Run this in the Supabase SQL editor against an existing project that
-- already has 001-003 applied.
--
-- IMPORTANT — after running this, your existing household(s) have no
-- password set (see the note at the bottom of this file) and will be
-- unjoinable until you set one.

-- ---------------------------------------------------------------------------
-- 1. Drop policies that depend on things we're removing below. Postgres
-- tracks policy -> function dependencies, so the functions can't be
-- dropped while a policy still references them.
-- ---------------------------------------------------------------------------

drop policy if exists "select own, owned, or applied-to household" on households;
drop policy if exists "authenticated users can create households" on households;
drop policy if exists "self, owner, or approved peers" on roommates;
drop policy if exists "join as pending, or owner self-joins approved" on roommates;
drop policy if exists "owner manages membership status" on roommates;
drop policy if exists "insert expenses as approved member" on expenses;
drop policy if exists "update own expenses" on expenses;
drop policy if exists "delete own expenses" on expenses;
drop policy if exists "poster seeds participants for their own expense" on expense_participants;

-- ---------------------------------------------------------------------------
-- 2. Drop functions that only existed to support the admit/decline flow.
-- ---------------------------------------------------------------------------

drop function if exists find_household_by_code(text);
drop function if exists is_household_owner(uuid);
drop function if exists auth_member_household_ids();

-- Now identical to the old auth_member_household_ids (no more
-- pending/declined distinction), so it absorbs that role.
create or replace function auth_household_ids()
returns setof uuid
language sql
security definer
stable
set search_path = public
as $$
  select household_id from roommates where user_id = auth.uid();
$$;

-- ---------------------------------------------------------------------------
-- 3. Households: password replaces home_code, name becomes the lookup key.
-- ---------------------------------------------------------------------------

alter table households add column password text;
alter table households add constraint households_name_key unique (name);
alter table households drop column home_code;

-- ---------------------------------------------------------------------------
-- 4. Roommates: no more pending/declined — every row is a full member.
-- ---------------------------------------------------------------------------

alter table roommates drop column status;
drop type if exists roommate_status;

-- ---------------------------------------------------------------------------
-- 5. New unified join/create RPC — replaces separate create-household and
-- find-household-by-code client calls with one atomic, password-checked
-- operation. security definer because it must read households.password,
-- which is never exposed via a broad SELECT policy.
-- ---------------------------------------------------------------------------

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
  values (v_household_id, v_user_id, p_your_name, coalesce(v_user_email, ''));

  return v_household_id;
end;
$$;

grant execute on function join_or_create_room(text, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 6. Simplified RLS — membership alone is now sufficient, there's no
-- pending state left to gate on.
-- ---------------------------------------------------------------------------

create policy "select own household" on households
  for select using (id in (select auth_household_ids()));

create policy "select roommates in own household" on roommates
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

create policy "poster seeds participants for their own expense" on expense_participants
  for insert with check (
    household_id in (select auth_household_ids())
    and exists (
      select 1 from expenses e
      where e.id = expense_participants.expense_id
        and e.paid_by in (select id from roommates where user_id = auth.uid())
    )
  );

-- ---------------------------------------------------------------------------
-- 7. create_expense_with_participants no longer filters seeding on status.
-- ---------------------------------------------------------------------------

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

-- ---------------------------------------------------------------------------
-- REQUIRED FOLLOW-UP: existing households have password = null after this
-- migration (home_code is gone, so they'd otherwise be unjoinable). Set a
-- password for each one you already have, e.g.:
--
--   update households set password = 'choose-a-password' where name = 'Test House';
--
-- The unique constraint on `name` (step 3) will fail this whole migration
-- if you already have two households with the same name — rename one
-- first if that happens.
-- ---------------------------------------------------------------------------
