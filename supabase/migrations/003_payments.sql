-- moneytracker migration 003: settle-up / payment tracking
-- Run this in the Supabase SQL editor against an existing project that
-- already has 001 (supabase/schema.sql) and 002
-- (supabase/migrations/002_participants_and_notifications.sql) applied.
-- Additive only — safe to run against a live project with real data.

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
