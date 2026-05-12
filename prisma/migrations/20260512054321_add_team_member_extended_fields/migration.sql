-- AlterEnum
ALTER TYPE "VehicleType" ADD VALUE 'Rikshaw';

-- AlterTable (employeeId added as nullable first)
ALTER TABLE "team_members"
ADD COLUMN     "aadhaarFileKey" TEXT,
ADD COLUMN     "aadhaarFileUrl" TEXT,
ADD COLUMN     "aadhaarNumber" VARCHAR(12),
ADD COLUMN     "alternativeMobile" VARCHAR(15),
ADD COLUMN     "designation" VARCHAR(255),
ADD COLUMN     "employeeId" TEXT,
ADD COLUMN     "fatherMobile" VARCHAR(15),
ADD COLUMN     "fatherName" VARCHAR(255),
ADD COLUMN     "motherMobile" VARCHAR(15),
ADD COLUMN     "motherName" VARCHAR(255),
ADD COLUMN     "panFileKey" TEXT,
ADD COLUMN     "panFileUrl" TEXT,
ADD COLUMN     "panNumber" VARCHAR(10),
ADD COLUMN     "personalEmail" TEXT,
ADD COLUMN     "personalMobile" VARCHAR(15),
ADD COLUMN     "profilePicKey" TEXT,
ADD COLUMN     "profilePicUrl" TEXT;

-- Backfill existing rows with placeholder employee IDs
WITH numbered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY "createdAt") AS rn
  FROM "team_members"
  WHERE "employeeId" IS NULL
)
UPDATE "team_members"
SET "employeeId" = 'DY' || LPAD(CAST(numbered.rn AS TEXT), 6, '0')
FROM numbered
WHERE "team_members".id = numbered.id;

-- Now enforce NOT NULL
ALTER TABLE "team_members" ALTER COLUMN "employeeId" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "team_members_employeeId_key" ON "team_members"("employeeId");

-- CreateIndex
CREATE INDEX "team_members_employeeId_idx" ON "team_members"("employeeId");