-- Per-member auto-assign controls (see app/lib/queries/auto-assign.ts):
-- an on/off toggle independent of isActive, plus an optional floor/ceiling
-- on how many active-pipeline leads round-robin will give this member.
-- All nullable/defaulted — every existing row keeps today's behaviour
-- (in the rotation, no floor, no ceiling) until explicitly configured.
ALTER TABLE "team_members"
  ADD COLUMN "autoAssignActive" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "autoAssignMin" INTEGER,
  ADD COLUMN "autoAssignMax" INTEGER;
