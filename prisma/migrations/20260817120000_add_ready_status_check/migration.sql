-- A two-call submit sequence (save-with-status-READY, then a separate
-- markPackageReady) let the second call's own permission check reread a
-- status the first call had already flipped, fail, and leave the row
-- stuck at READY with no readyAt — locked to the exec, invisible to
-- costing's readyAt-gated verify-packages queue. Application code has
-- been fixed so only markPackageReady ever writes READY, always paired
-- with readyAt in the same update — this constraint is the backstop
-- against that regressing unnoticed. 9 production rows already found in
-- this state were repaired directly (backfilled readyAt/readyBy from
-- their own builtBy/updatedAt) before this migration was written, so it
-- applies clean against the current data.
ALTER TABLE "custom_packages"
  ADD CONSTRAINT "ready_status_requires_ready_at"
  CHECK (status != 'READY' OR "readyAt" IS NOT NULL);
