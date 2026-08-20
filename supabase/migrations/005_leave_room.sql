-- moneytracker migration 005: let a roommate leave their room
-- Run this in the Supabase SQL editor against an existing project.
-- Additive only — a single new policy, safe to run against live data.

-- No delete policy existed on `roommates` before this — joining/leaving
-- was one-directional. This adds "leave your own membership," used by
-- the "Switch rooms" menu action: it deletes the caller's own roommate
-- row (never anyone else's) and the UI then sends them to /join.
create policy "roommate leaves own membership" on roommates
  for delete using (user_id = auth.uid());
