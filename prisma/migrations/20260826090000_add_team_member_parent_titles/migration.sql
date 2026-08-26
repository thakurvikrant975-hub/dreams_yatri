-- CreateEnum
CREATE TYPE "NameTitle" AS ENUM ('MR', 'MRS', 'LATE_MR', 'LATE_MRS', 'DR');

-- AlterTable
ALTER TABLE "team_members" ADD COLUMN "fatherTitle" "NameTitle";
ALTER TABLE "team_members" ADD COLUMN "motherTitle" "NameTitle";
