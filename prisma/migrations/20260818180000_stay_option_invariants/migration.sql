-- Two invariants the application already holds, moved into the database.
--
-- Both are expressed as partial/functional indexes, which Prisma's schema
-- language cannot describe — so they live here and are documented on the model.
-- They are additive: existing data satisfies them (checked before writing this),
-- and application code is unchanged.

-- Exactly one recommended option per package.
--
-- The badge and the highlighted price both assume a single answer, and the
-- document falls back to the first option when none is flagged. Two flagged at
-- once would make "recommended" mean whichever row came back first — different
-- between the builder, the client's page and the PDF, since none of them order
-- by the same thing.
--
-- Every write path already maintains this (adding flags only the first option,
-- setting one clears the rest in the same transaction, removing the recommended
-- promotes its successor). This makes a future path that forgets fail loudly
-- rather than quietly producing two.
CREATE UNIQUE INDEX IF NOT EXISTS "custom_package_stay_options_one_recommended"
    ON "custom_package_stay_options" ("customPackageId")
    WHERE "isRecommended";

-- Option names are unique per package regardless of case.
--
-- The label is the client's column heading, so "Deluxe" and "deluxe" side by
-- side is not a choice anyone can make. stayLabelProblem() already refuses it
-- case-insensitively, but the unique index behind it compared exactly, so only
-- the application was enforcing the rule it states.
CREATE UNIQUE INDEX IF NOT EXISTS "custom_package_stay_options_label_ci"
    ON "custom_package_stay_options" ("customPackageId", lower("label"));
