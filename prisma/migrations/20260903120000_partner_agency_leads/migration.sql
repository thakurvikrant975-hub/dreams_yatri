-- Selling leads to an outside agency.
--
-- An agency is an ordinary team_members row with a role of its own, so that
-- assignment, auto-assign, the timeline and every report keep working through
-- the one "assignedTo" column they already use. Only two things are new: a
-- flag saying a role belongs to an agency rather than to our staff, and the
-- rules deciding how many leads that agency is handed and which ones qualify.

-- A flag, not a name match: this decides who may sign in at the partner portal
-- and who is refused at the staff login, and a role rename must not silently
-- open or close either.
ALTER TABLE "team_roles" ADD COLUMN "isPartnerAgency" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "partner_lead_rules" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    -- 0 hands over nothing: the feature stays inert until a lead manager
    -- chooses a number.
    "dailyCap" INTEGER NOT NULL DEFAULT 0,
    -- The next lead lands a random gapMin..gapMax leads after their last, so
    -- an agency gets a spread of the day rather than whatever arrives first.
    "gapMin" INTEGER NOT NULL DEFAULT 7,
    "gapMax" INTEGER NOT NULL DEFAULT 14,
    -- Optional eligibility filters. Every one that is set must pass.
    "maxGroupSize" INTEGER,
    "blockedDestinations" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "blockedSources" "QuerySource"[] DEFAULT ARRAY[]::"QuerySource"[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "partner_lead_rules_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "partner_lead_rules_memberId_key" ON "partner_lead_rules"("memberId");

ALTER TABLE "partner_lead_rules" ADD CONSTRAINT "partner_lead_rules_memberId_fkey"
    FOREIGN KEY ("memberId") REFERENCES "team_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- The role itself, created here so nobody has to remember to make it by hand.
--
-- pageAccess is deliberately a non-empty list of nothing reachable: an empty
-- pageAccess means "no restriction" to the dashboard layout, which on this
-- role would be precisely the wrong default. An agency member is refused at
-- the staff login outright (see auth-dashboard.ts) — this is the second lock.
INSERT INTO "team_roles" ("id", "name", "description", "permissions", "pageAccess", "isPartnerAgency", "createdAt", "updatedAt")
VALUES (
    'role_partner_agency',
    'Partner Agency',
    'An outside agency we sell leads to. Signs in at the partner portal and sees only the leads assigned to it.',
    '[]'::jsonb,
    '["/partner/leads"]'::jsonb,
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
)
ON CONFLICT ("name") DO NOTHING;
