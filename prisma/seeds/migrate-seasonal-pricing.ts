/**
 * One-shot data migration script: migrate existing valid_from/valid_to on
 * hotel_room_pricing and activity_variants into the new season tables.
 *
 * Run once with:
 *   npx tsx prisma/seeds/migrate-seasonal-pricing.ts
 *
 * Safe to re-run — skips rows that already have at least one season entry.
 */

import { PrismaClient } from "../../app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(__dirname, "../../.env.local") });
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});
const adapter = new PrismaPg(pool);
const db = new PrismaClient({ adapter } as any);

async function main() {
  console.log("🌱 Starting seasonal pricing migration...\n");

  // ── Hotels ──────────────────────────────────────────────────────────────
  const pricingPlans = await db.hotel_room_pricing.findMany({
    where: {
      valid_from: { not: null },
      valid_to:   { not: null },
    },
    select: {
      id:              true,
      valid_from:      true,
      valid_to:        true,
      price_per_night: true,
      original_price:  true,
      _count: { select: { seasons: true } },
    },
  });

  let hotelCreated = 0;
  let hotelSkipped = 0;

  for (const plan of pricingPlans) {
    if (plan._count.seasons > 0) {
      hotelSkipped++;
      continue; // already migrated
    }
    await db.hotel_room_pricing_season.create({
      data: {
        pricing_id:      plan.id,
        season_name:     "Default Season",
        valid_from:      plan.valid_from!,
        valid_to:        plan.valid_to!,
        price_per_night: plan.price_per_night,
        original_price:  plan.original_price ?? null,
        is_active:       true,
        sort_order:      0,
      },
    });
    hotelCreated++;
  }

  console.log(`✅ Hotels: created ${hotelCreated} season rows (skipped ${hotelSkipped} already-migrated)`);

  // ── Activities ───────────────────────────────────────────────────────────
  const variants = await db.activity_variants.findMany({
    where: {
      valid_from: { not: null },
      valid_to:   { not: null },
    },
    include: {
      pricing: {
        where:   { is_active: true },
        orderBy: { sort_order: "asc" },
      },
      _count: { select: { seasons: true } },
    },
  });

  let activityCreated = 0;
  let activitySkipped = 0;

  for (const variant of variants) {
    if (variant._count.seasons > 0) {
      activitySkipped++;
      continue; // already migrated
    }

    const season = await db.activity_variant_season.create({
      data: {
        variant_id:  variant.id,
        season_name: "Default Season",
        valid_from:  variant.valid_from!,
        valid_to:    variant.valid_to!,
        is_active:   true,
        sort_order:  0,
      },
    });

    if (variant.pricing.length > 0) {
      await db.activity_variant_season_pricing.createMany({
        data: variant.pricing.map((p, i) => ({
          season_id:         season.id,
          label:             p.label,
          age_from:          p.age_from ?? null,
          age_to:            p.age_to   ?? null,
          price:             p.price,
          original_price:    p.original_price   ?? null,
          margin_percentage: p.margin_percentage,
          is_active:         p.is_active,
          sort_order:        i,
        })),
      });
    }

    activityCreated++;
  }

  console.log(
    `✅ Activities: created ${activityCreated} season rows (skipped ${activitySkipped} already-migrated)\n`,
  );
  console.log("🎉 Migration complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
