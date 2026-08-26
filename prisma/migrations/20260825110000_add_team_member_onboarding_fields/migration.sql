-- New fields for the "May I know you" onboarding popup. The Gender enum
-- already exists (used elsewhere in the schema) and is reused here rather
-- than adding a second one.
ALTER TABLE "team_members"
  ADD COLUMN "aadhaarBackFileKey" TEXT,
  ADD COLUMN "aadhaarBackFileUrl" TEXT,
  ADD COLUMN "gender" "Gender",
  ADD COLUMN "joiningDateUnknown" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "officialMobile" VARCHAR(15);
