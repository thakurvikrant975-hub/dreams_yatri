-- Links a package's permit line item back to the catalog `permits` row and
-- to the specific package_cab_types row whose vehicle it should price by.
-- Both nullable/additive — existing package_permits rows keep working via
-- their flat price/price_type exactly as before; the link is opt-in so the
-- live per-vehicle rate only takes over once both are set.
ALTER TABLE "package_permits" ADD COLUMN "permit_id" INTEGER;
ALTER TABLE "package_permits" ADD COLUMN "cab_type_id" INTEGER;

CREATE INDEX "package_permits_permit_id_idx" ON "package_permits"("permit_id");
CREATE INDEX "package_permits_cab_type_id_idx" ON "package_permits"("cab_type_id");

ALTER TABLE "package_permits" ADD CONSTRAINT "package_permits_permit_id_fkey" FOREIGN KEY ("permit_id") REFERENCES "permits"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "package_permits" ADD CONSTRAINT "package_permits_cab_type_id_fkey" FOREIGN KEY ("cab_type_id") REFERENCES "package_cab_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;
