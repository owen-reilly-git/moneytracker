-- moneytracker migration 007: Venmo handoff (deep link only, no OAuth/API)
-- Run this in the Supabase SQL editor against an existing project.
-- Additive only — a new nullable column + a new policy, safe on live data.

alter table roommates add column venmo_handle text;

-- No update policy existed on `roommates` before this — name/email are
-- only ever set once, at join time, via join_or_create_room. This adds
-- one scoped to your own row, needed so you can set/edit your handle.
-- Note: RLS is row-level, not column-level — this technically permits
-- updating any column on your own row, not just venmo_handle, the same
-- way the existing "leave room" policy permits deleting your whole row.
-- The UI only ever exposes editing the handle.
create policy "roommate edits own row" on roommates
  for update using (user_id = auth.uid())
  with check (user_id = auth.uid());
