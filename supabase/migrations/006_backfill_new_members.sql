-- moneytracker migration 006: joining backfills you into existing expenses
-- Run this in the Supabase SQL editor against an existing project.
--
-- Previously, expense_participants was seeded once at expense-creation
-- time and never retroactively — a roommate who joined later had no row
-- (and thus no fair-share) on anything posted before they joined. That's
-- being changed: joining a room now also adds you (opted_out=false) as a
-- participant on every expense that already exists there. You can still
-- opt out of any individual one afterward, same as always.

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

  -- Backfill: join every existing expense in this household as a
  -- participant. No-op for a brand-new room (no expenses exist yet).
  insert into expense_participants (expense_id, household_id, roommate_id, opted_out)
  select e.id, e.household_id, v_roommate_id, false
  from expenses e
  where e.household_id = v_household_id
  on conflict (expense_id, roommate_id) do nothing;

  return v_household_id;
end;
$$;

-- One-time data fix: bring existing rooms in line with the new rule.
-- Every CURRENT household member becomes a participant on every EXISTING
-- expense in their household, wherever they aren't already one. Only
-- adds missing rows — an expense someone already has a row for (whether
-- opted_out is true or false) is left untouched, so any opt-out choices
-- already made are preserved exactly.
insert into expense_participants (expense_id, household_id, roommate_id, opted_out)
select e.id, e.household_id, r.id, false
from expenses e
join roommates r on r.household_id = e.household_id
where not exists (
  select 1 from expense_participants ep
  where ep.expense_id = e.id and ep.roommate_id = r.id
);
