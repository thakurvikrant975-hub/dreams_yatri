// prisma/seed-destination.ts

import * as dotenv from "dotenv";
dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local" });

import { PrismaClient } from "../app/generated/prisma";
import { PrismaPg }     from "@prisma/adapter-pg";
import pg               from "pg";
import * as fs          from "fs";
import * as path        from "path";

const pool    = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: false });
const adapter = new PrismaPg(pool as never);
const prisma  = new PrismaClient({ adapter } as never);

// ── Read from local files (not fetch) ─────────────────────────────────────────
function readJson(filename: string): any[] {
  const filePath = path.join(__dirname, "data", `${filename}.json`);
  return JSON.parse(fs.readFileSync(filePath, "utf-8"));
}

async function main() {
  console.log("Seeding started...");

  // ── Regions ──────────────────────────────────────────────────────────────────
  const regions = readJson("regions");
  await prisma.regionAll.createMany({
    data: regions.map(({ name }: any) => ({ name })),
    skipDuplicates: true,
  });
  console.log(`✅ Regions: ${regions.length}`);

  const regionMap = new Map(
    (await prisma.regionAll.findMany()).map(r => [r.name, r.id])
  );

  // ── Subregions ────────────────────────────────────────────────────────────────
  const subregions = readJson("subregions");
  const subregionData = subregions
    .map(({ name, region }: any) => {
      const regionId = regionMap.get(region);
      return regionId ? { name, regionId } : null;
    })
    .filter(Boolean);

  await prisma.subregionAll.createMany({ data: subregionData as any, skipDuplicates: true });
  console.log(`✅ Subregions: ${subregionData.length}`);

  const subregionMap = new Map(
    (await prisma.subregionAll.findMany()).map(sr => [sr.name, sr.id])
  );

  // ── Countries ─────────────────────────────────────────────────────────────────
  const countries = readJson("countries");
  const countryData = countries.map((c: any) => ({
    name:         c.name,
    iso2:         c.iso2         ?? null,
    phonecode:    c.phone_code   ?? null,
    capital:      c.capital      ?? null,
    currency:     c.currency     ?? null,
    currencyName: c.currency_name ?? null,
    nationality:  c.nationality  ?? null,
    latitude:     c.latitude     ? parseFloat(c.latitude)  : null,
    longitude:    c.longitude    ? parseFloat(c.longitude) : null,
    regionId:     regionMap.get(c.region)       || null,
    subregionId:  subregionMap.get(c.subregion) || null,
  }));

  await prisma.countryAll.createMany({ data: countryData, skipDuplicates: true });
  console.log(`✅ Countries: ${countryData.length}`);

  const countryMap = new Map(
    (await prisma.countryAll.findMany()).map(c => [c.iso2, c.id])
  );

  // ── States ────────────────────────────────────────────────────────────────────
  const states = readJson("states");
  const stateData = states
    .map(({ name, country_code, latitude, longitude }: any) => {
      const countryId = countryMap.get(country_code);
      return countryId ? {
        name,
        countryCode: country_code,
        latitude:    latitude  ? parseFloat(latitude)  : null,
        longitude:   longitude ? parseFloat(longitude) : null,
        countryId,
      } : null;
    })
    .filter(Boolean);

  await prisma.stateAll.createMany({ data: stateData as any, skipDuplicates: true });
  console.log(`✅ States: ${stateData.length}`);

  const stateMap = new Map(
    (await prisma.stateAll.findMany()).map(s => [`${s.name}-${s.countryId}`, s.id])
  );

  // ── Cities (batched) ──────────────────────────────────────────────────────────
  const cities  = readJson("cities");
  const BATCH   = 5000;
  let inserted  = 0;

  for (let i = 0; i < cities.length; i += BATCH) {
    const chunk    = cities.slice(i, i + BATCH);
    const cityData = chunk
      .map(({ name, state_name, country_code, state_code, latitude, longitude }: any) => {
        const countryId = countryMap.get(country_code);
        const stateId   = stateMap.get(`${state_name}-${countryId}`);
        return stateId && countryId ? {
          name,
          stateCode:   state_code,
          countryCode: country_code,
          latitude:    parseFloat(latitude),
          longitude:   parseFloat(longitude),
          stateId,
          countryId,
        } : null;
      })
      .filter(Boolean);

    await prisma.cityAll.createMany({ data: cityData as any, skipDuplicates: true });
    inserted += cityData.length;
    console.log(`Cities inserted: ${inserted} / ${cities.length}`);
  }

  console.log("\n🎉 Seeding completed!");
}

main()
  .catch((e) => { console.error("Seeding failed:", e); process.exit(1); })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });