-- Add missing pageAccess column to team_roles
ALTER TABLE "team_roles" ADD COLUMN IF NOT EXISTS "pageAccess" JSONB NOT NULL DEFAULT '[]';
