// prisma/seed-locations.ts
// Run: npm run seed:locations
//
// Populates the `locations` table with geographic hierarchy data from
// https://github.com/dr5hn/countries-states-cities-database
//
// City filter: keeps cities that have a Wikidata entry (wikiDataId present),
// which captures all national/state capitals, major cities, airports, and
// tourist destinations. Raw dataset: ~150k cities → filtered: ~50-70k notable cities.

import { PrismaClient, LocationType } from "../app/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const db = new PrismaClient({ adapter });

const BASE = "https://raw.githubusercontent.com/dr5hn/countries-states-cities-database/master/json";
const BATCH = 500;

// ── dr5hn data shapes ──────────────────────────────────────────────────────────

type Dr5Region = {
  id: number;
  name: string;
  wikiDataId?: string;
};

type Dr5Subregion = {
  id: number;
  name: string;
  region_id: number;
  wikiDataId?: string;
};

type Dr5Country = {
  id: number;
  name: string;
  iso2: string;
  iso3: string;
  phone_code: string | number;
  capital: string;
  currency: string;
  currency_name?: string;
  tld?: string;
  native?: string;
  region_id: number;
  subregion_id: number;
  latitude?: string;
  longitude?: string;
  wikiDataId?: string;
};

type Dr5State = {
  id: number;
  name: string;
  state_code: string;
  latitude?: string;
  longitude?: string;
  type?: string;
  country_id: number;
  country_code: string;
};

type Dr5CityRaw = {
  id: number;
  name: string;
  latitude?: string;
  longitude?: string;
  wikiDataId?: string;
};

type Dr5City = {
  id: number;
  name: string;
  state_id: number;
  state_code: string;
  country_id: number;
  country_code: string;
  latitude?: string;
  longitude?: string;
  wikiDataId?: string;
};

// The combined file has countries → states → cities nested
type Dr5CombinedState = Dr5State & { cities: Dr5CityRaw[] };
type Dr5Combined      = Dr5Country & { states: Dr5CombinedState[] };

// ── helpers ────────────────────────────────────────────────────────────────────

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 120);
}

function uniqueSlug(base: string, seen: Set<string>): string {
  if (!seen.has(base)) { seen.add(base); return base; }
  let n = 2;
  while (seen.has(`${base}-${n}`)) n++;
  const s = `${base}-${n}`;
  seen.add(s);
  return s;
}

async function fetchJson<T>(file: string): Promise<T> {
  const res = await fetch(`${BASE}/${file}`);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${file}`);
  return res.json() as Promise<T>;
}

function progress(done: number, total: number) {
  process.stdout.write(`\r   ${done.toLocaleString()} / ${total.toLocaleString()}`);
}

// ── main ───────────────────────────────────────────────────────────────────────

async function main() {
  console.log("🌍  Seeding locations from dr5hn/countries-states-cities-database\n");

  // ── Fetch all data ──────────────────────────────────────────────────────────
  process.stdout.write("📥  Fetching data from GitHub... ");
  // cities.json does not exist separately — cities are nested inside countries+states+cities.json
  const [regions, subregions, combined] = await Promise.all([
    fetchJson<Dr5Region[]>("regions.json"),
    fetchJson<Dr5Subregion[]>("subregions.json"),
    fetchJson<Dr5Combined[]>("countries+states+cities.json"),
  ]);

  // Extract flat lists from the combined file
  const countries: Dr5Country[] = combined;
  const states: Dr5State[] = combined.flatMap(c =>
    (c.states ?? []).map(s => ({ ...s, country_id: c.id, country_code: c.iso2 }))
  );
  const cities: Dr5City[] = combined.flatMap(c =>
    (c.states ?? []).flatMap(s =>
      (s.cities ?? []).map(city => ({
        id: city.id,
        name: city.name,
        state_id: s.id,
        state_code: s.state_code,
        country_id: c.id,
        country_code: c.iso2,
        latitude: city.latitude,
        longitude: city.longitude,
        wikiDataId: city.wikiDataId,
      }))
    )
  );

  console.log("done");
  console.log(
    `   regions: ${regions.length}  subregions: ${subregions.length}  ` +
    `countries: ${countries.length}  states: ${states.length}  cities: ${cities.length}`
  );

  // maps: dr5hn numeric id → Location.id (BigInt in PG)
  const regionMap    = new Map<number, bigint>();
  const subregionMap = new Map<number, bigint>();
  const countryMap   = new Map<number, bigint>();
  const stateMap     = new Map<number, bigint>();

  // global slug deduplication across all location types
  const seen = new Set<string>();

  // ── 1. Regions ─────────────────────────────────────────────────────────────
  console.log("\n1/5  Regions");
  type RegionTrack = { dr5hn_id: number; slug: string };
  const regionTrack: RegionTrack[] = [];

  await db.location.createMany({
    skipDuplicates: true,
    data: regions.map(r => {
      const slug = uniqueSlug(slugify(r.name), seen);
      regionTrack.push({ dr5hn_id: r.id, slug });
      return {
        type: LocationType.REGION,
        name: r.name,
        slug,
        is_active: true,
        is_searchable: true,
        is_featured: false,
        is_popular: false,
      };
    }),
  });

  const dbRegions = await db.location.findMany({
    where: { type: LocationType.REGION },
    select: { id: true, slug: true },
  });
  const regionSlugId = new Map(dbRegions.map(r => [r.slug, r.id]));
  regionTrack.forEach(r => {
    const id = regionSlugId.get(r.slug);
    if (id) regionMap.set(r.dr5hn_id, id);
  });
  console.log(`   ✓ ${dbRegions.length} regions`);

  // ── 2. Subregions ──────────────────────────────────────────────────────────
  console.log("2/5  Subregions");
  type SubTrack = { dr5hn_id: number; slug: string };
  const subTrack: SubTrack[] = [];

  await db.location.createMany({
    skipDuplicates: true,
    data: subregions.map(s => {
      const slug = uniqueSlug(slugify(s.name), seen);
      subTrack.push({ dr5hn_id: s.id, slug });
      return {
        type: LocationType.SUBREGION,
        name: s.name,
        slug,
        parent_id: regionMap.get(s.region_id) ?? null,
        is_active: true,
        is_searchable: true,
        is_featured: false,
        is_popular: false,
      };
    }),
  });

  const dbSubs = await db.location.findMany({
    where: { type: LocationType.SUBREGION },
    select: { id: true, slug: true },
  });
  const subSlugId = new Map(dbSubs.map(s => [s.slug, s.id]));
  subTrack.forEach(s => {
    const id = subSlugId.get(s.slug);
    if (id) subregionMap.set(s.dr5hn_id, id);
  });
  console.log(`   ✓ ${dbSubs.length} subregions`);

  // ── 3. Countries ───────────────────────────────────────────────────────────
  console.log("3/5  Countries");
  type CountryTrack = { dr5hn_id: number; slug: string };
  const countryTrack: CountryTrack[] = [];

  await db.location.createMany({
    skipDuplicates: true,
    data: countries.map(c => {
      // Use ISO-2 code as slug (always unique, human-readable)
      const slug = uniqueSlug(c.iso2.toLowerCase(), seen);
      countryTrack.push({ dr5hn_id: c.id, slug });
      return {
        type: LocationType.COUNTRY,
        name: c.name,
        slug,
        iso_code: c.iso2,
        short_code: c.iso3,
        parent_id: subregionMap.get(c.subregion_id) ?? null,
        latitude: c.latitude || null,
        longitude: c.longitude || null,
        is_active: true,
        is_searchable: true,
        is_featured: false,
        is_popular: false,
        metadata: {
          dr5hn_id: c.id,
          phone_code: String(c.phone_code),
          currency: c.currency,
          currency_name: c.currency_name ?? null,
          capital: c.capital ?? null,
          tld: c.tld ?? null,
          native_name: c.native ?? null,
        },
      };
    }),
  });

  const dbCountries = await db.location.findMany({
    where: { type: LocationType.COUNTRY },
    select: { id: true, slug: true },
  });
  const countrySlugId = new Map(dbCountries.map(c => [c.slug, c.id]));
  countryTrack.forEach(c => {
    const id = countrySlugId.get(c.slug);
    if (id) countryMap.set(c.dr5hn_id, id);
  });

  // country_id = self for country records (hierarchy shortcut)
  await db.$executeRaw`
    UPDATE locations SET country_id = id
    WHERE type = 'COUNTRY' AND country_id IS NULL
  `;
  console.log(`   ✓ ${dbCountries.length} countries`);

  // ── 4. States ──────────────────────────────────────────────────────────────
  console.log("4/5  States");
  type StateTrack = { dr5hn_id: number; slug: string };
  const stateTrack: StateTrack[] = [];

  const stateInsertData = states.map(s => {
    const countryId = countryMap.get(s.country_id) ?? null;
    // slug: "name-country_code" avoids conflicts across countries
    const slug = uniqueSlug(slugify(`${s.name}-${s.country_code}`), seen);
    stateTrack.push({ dr5hn_id: s.id, slug });
    return {
      type: LocationType.STATE,
      name: s.name,
      slug,
      short_code: s.state_code,
      parent_id: countryId,
      country_id: countryId,
      latitude: s.latitude || null,
      longitude: s.longitude || null,
      is_active: true,
      is_searchable: true,
      is_featured: false,
      is_popular: false,
      metadata: {
        dr5hn_id: s.id,
        administrative_type: s.type ?? null,
      },
    };
  });

  for (let i = 0; i < stateInsertData.length; i += BATCH) {
    await db.location.createMany({
      skipDuplicates: true,
      data: stateInsertData.slice(i, i + BATCH),
    });
    progress(Math.min(i + BATCH, stateInsertData.length), stateInsertData.length);
  }
  console.log();

  const dbStates = await db.location.findMany({
    where: { type: LocationType.STATE },
    select: { id: true, slug: true },
  });
  const stateSlugId = new Map(dbStates.map(s => [s.slug, s.id]));
  stateTrack.forEach(s => {
    const id = stateSlugId.get(s.slug);
    if (id) stateMap.set(s.dr5hn_id, id);
  });
  console.log(`   ✓ ${dbStates.length} states`);

  // ── 5. Cities (filtered) ───────────────────────────────────────────────────
  console.log("5/5  Cities (filtering...)");

  // ── City filter strategy (combined file has no wikiDataId on cities) ────────
  //
  // Rule 1 — National capital: city.name matches country.capital
  // Rule 2 — State capital proxy: city.name === state.name (very reliable across
  //          South Asia, Southeast Asia, Africa, Latin America)
  // Rule 3 — Primary market (India) + key international tourism countries: keep
  //          ALL cities so the travel engine has full destination coverage
  // Rule 4 — State capital for all other countries (rules 1+2 cover the rest)
  //
  // Top tourism ISO-2 codes (UNWTO + India-focused travel):
  const FULL_COVERAGE_ISO2 = new Set([
    "IN",  // India — primary market
    "NP",  // Nepal
    "LK",  // Sri Lanka
    "BT",  // Bhutan
    "MV",  // Maldives
    "TH",  // Thailand
    "ID",  // Indonesia / Bali
    "MY",  // Malaysia
    "SG",  // Singapore
    "AE",  // UAE / Dubai
    "QA",  // Qatar
    "TR",  // Turkey
    "EG",  // Egypt
    "MA",  // Morocco
    "JP",  // Japan
    "VN",  // Vietnam
    "KH",  // Cambodia
    "MM",  // Myanmar
    "PH",  // Philippines
    "FR",  // France
    "IT",  // Italy
    "ES",  // Spain
    "PT",  // Portugal
    "GR",  // Greece
    "GB",  // UK
    "AU",  // Australia
    "NZ",  // New Zealand
    "US",  // USA
    "CA",  // Canada
    "MX",  // Mexico
  ]);

  const fullCoverageCountryIds = new Set(
    countries.filter(c => FULL_COVERAGE_ISO2.has(c.iso2)).map(c => c.id)
  );

  // national capital key: "name_lower||country_dr5hn_id"
  const capitalKey = (name: string, countryId: number) =>
    `${name.toLowerCase()}||${countryId}`;
  const nationalCapitals = new Set(
    countries
      .filter(c => c.capital?.trim())
      .map(c => capitalKey(c.capital.trim(), c.id))
  );

  // state name lookup for state-capital proxy
  const stateNameById = new Map(states.map(s => [s.id, s.name.toLowerCase()]));

  const filtered = cities.filter(city => {
    // Rule 1: national capital
    if (nationalCapitals.has(capitalKey(city.name, city.country_id))) return true;
    // Rule 2: state capital proxy (city name = state name)
    if (stateNameById.get(city.state_id) === city.name.toLowerCase()) return true;
    // Rule 3: full coverage for primary + top-tourist countries
    if (fullCoverageCountryIds.has(city.country_id)) return true;
    return false;
  });

  const capitalSet = nationalCapitals; // alias for clarity below
  console.log(`   Kept ${filtered.length.toLocaleString()} / ${cities.length.toLocaleString()} cities`);
  console.log(`   (national capital OR state capital OR full-coverage country)`);

  const cityInsertData = filtered.map(city => {
    const countryId = countryMap.get(city.country_id) ?? null;
    const stateId   = stateMap.get(city.state_id)    ?? null;
    const isCapital = capitalSet.has(capitalKey(city.name, city.country_id));
    const isStateCapital =
      stateNameById.get(city.state_id) === city.name.toLowerCase();
    const slug = uniqueSlug(
      slugify(`${city.name}-${city.state_code}-${city.country_code}`),
      seen
    );
    return {
      type: LocationType.CITY,
      name: city.name,
      slug,
      parent_id: stateId ?? countryId,
      country_id: countryId,
      state_id: stateId,
      latitude: city.latitude || null,
      longitude: city.longitude || null,
      is_active: true,
      is_searchable: true,
      is_popular: isCapital || isStateCapital,
      is_featured: isCapital,
    };
  });

  for (let i = 0; i < cityInsertData.length; i += BATCH) {
    await db.location.createMany({
      skipDuplicates: true,
      data: cityInsertData.slice(i, i + BATCH),
    });
    progress(Math.min(i + BATCH, cityInsertData.length), cityInsertData.length);
  }
  console.log();

  // ── Summary ────────────────────────────────────────────────────────────────
  const [cityCount, total] = await Promise.all([
    db.location.count({ where: { type: LocationType.CITY } }),
    db.location.count(),
  ]);

  console.log(`
✅  Location seed complete!

   Regions        ${dbRegions.length.toLocaleString().padStart(6)}
   Subregions     ${dbSubs.length.toLocaleString().padStart(6)}
   Countries      ${dbCountries.length.toLocaleString().padStart(6)}
   States         ${dbStates.length.toLocaleString().padStart(6)}
   Cities         ${cityCount.toLocaleString().padStart(6)}
   ─────────────────────────
   Total          ${total.toLocaleString().padStart(6)}

   City filter: national capital OR state capital OR full-coverage country
   National capitals: is_featured=true, is_popular=true
   State capitals:    is_popular=true
  `);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
    await pool.end();
  });
