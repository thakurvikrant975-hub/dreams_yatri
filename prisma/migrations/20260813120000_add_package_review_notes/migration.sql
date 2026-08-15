-- Per-element review findings, so a rejection can say WHICH element is wrong.
--
-- Additive and self-contained: nothing existing reads or writes this table, so
-- applying it changes no current behaviour. The package's own rejectionNote /
-- rejectionReasonId stay exactly as they are — this sits alongside them as the
-- detail, not as a replacement.
CREATE TYPE "ReviewTargetKind" AS ENUM ('STAY', 'TRANSPORT', 'ACTIVITY', 'MEAL', 'TICKET', 'ADDON', 'DAY', 'PRICING', 'PACKAGE');
CREATE TYPE "ReviewSeverity" AS ENUM ('ERROR', 'SUGGESTION');
CREATE TYPE "ReviewNoteStatus" AS ENUM ('OPEN', 'RESOLVED');

CREATE TABLE "package_review_notes" (
    "id"              TEXT NOT NULL,
    "customPackageId" TEXT NOT NULL,
    "targetKind"      "ReviewTargetKind" NOT NULL,
    "day"             INTEGER,
    "index"           INTEGER,
    "severity"        "ReviewSeverity" NOT NULL,
    "status"          "ReviewNoteStatus" NOT NULL DEFAULT 'OPEN',
    "message"         TEXT NOT NULL,
    "createdById"     TEXT,
    "createdByName"   TEXT,
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt"      TIMESTAMP(3),
    "resolvedById"    TEXT,
    "resolvedByName"  TEXT,

    CONSTRAINT "package_review_notes_pkey" PRIMARY KEY ("id")
);

-- The queue's open-issue count and the document's per-element lookup both read
-- by (package, status), so one composite index serves both.
CREATE INDEX "package_review_notes_customPackageId_status_idx"
    ON "package_review_notes"("customPackageId", "status");

-- Cascade: notes are meaningless without the package they annotate, and a
-- deleted package should not strand rows keyed to an id that no longer exists.
ALTER TABLE "package_review_notes"
    ADD CONSTRAINT "package_review_notes_customPackageId_fkey"
    FOREIGN KEY ("customPackageId") REFERENCES "custom_packages"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
