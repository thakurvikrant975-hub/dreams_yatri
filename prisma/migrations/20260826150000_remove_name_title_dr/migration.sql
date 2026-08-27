-- Postgres has no direct "ALTER TYPE ... DROP VALUE" — remove a value by
-- recreating the enum without it and re-pointing the columns at the new type.
-- Safe here: NameTitle only shipped this same day, so no row can hold 'DR'.
ALTER TYPE "NameTitle" RENAME TO "NameTitle_old";

CREATE TYPE "NameTitle" AS ENUM ('MR', 'MRS', 'LATE_MR', 'LATE_MRS');

ALTER TABLE "team_members" ALTER COLUMN "fatherTitle" TYPE "NameTitle" USING ("fatherTitle"::text::"NameTitle");
ALTER TABLE "team_members" ALTER COLUMN "motherTitle" TYPE "NameTitle" USING ("motherTitle"::text::"NameTitle");

DROP TYPE "NameTitle_old";
