-- moneytracker migration 002: per-expense participants + in-app notifications
-- Run this in the Supabase SQL editor against an existing project that
-- already has 001 (supabase/schema.sql) applied. Additive only — safe to
-- run against a live project with real data.

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

-- Backfill: expenses created before this migration have zero
-- participant rows. Without this, the balance calc (which skips fair
-- -share accrual when a expense has no participants, to guard
-- divide-by-zero) would count every pre-migration expense as pure
-- credit for its payer with nothing owed back — wildly inflating
-- their balance. Seed those old expenses with the household's
-- currently-approved roommates, matching the pre-opt-out behavior
-- ("everyone splits it") they were created under.
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
