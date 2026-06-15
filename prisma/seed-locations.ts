// prisma/seed-locations.ts
// Run: npx tsx --env-file=.env prisma/seed-locations.ts
//
// Populates the `locations` table with geographic hierarchy data from
// https://github.com/dr5hn/countries-states-cities-database
//
// City filter: national capital OR state capital OR full-coverage tourism country

import "dotenv/config";
import pg from "pg";
import { createIPv4Pool } from "./seed/pg-ipv4";

const BASE = "https://raw.githubusercontent.com/dr5hn/countries-states-cities-database/master/json";
const BATCH = 200;

// ── dr5hn data shapes ──────────────────────────────────────────────────────────

type Dr5Region    = { id: number; name: string; wikiDataId?: string };
type Dr5Subregion = { id: number; name: string; region_id: number; wikiDataId?: string };
type Dr5Country   = {
  id: number; name: string; iso2: string; iso3: string;
  phone_code: string | number; capital: string; currency: string;
  currency_name?: string; tld?: string; native?: string;
  region_id: number; subregion_id: number;
  latitude?: string; longitude?: string; wikiDataId?: string;
};
type Dr5State = {
  id: number; name: string; state_code: string;
  latitude?: string; longitude?: string; type?: string;
  country_id: number; country_code: string;
};
type Dr5CityRaw = { id: number; name: string; latitude?: string; longitude?: string; wikiDataId?: string };
type Dr5City    = {
  id: number; name: string; state_id: number; state_code: string;
  country_id: number; country_code: string;
  latitude?: string; longitude?: string; wikiDataId?: string;
};
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

// Raw SQL batch insert — returns rows that were inserted or already exist
async function insertLocations(
  client: pg.PoolClient,
  rows: Record<string, unknown>[],
): Promise<{ id: bigint; slug: string }[]> {
  if (rows.length === 0) return [];

  const cols = [
    "type", "name", "slug", "parent_id", "country_id", "state_id",
    "iso_code", "short_code", "latitude", "longitude",
    "is_active", "is_searchable", "is_featured", "is_popular", "metadata",
  ];

  const values: unknown[] = [];
  const placeholders = rows.map((row, ri) => {
    const start = ri * cols.length + 1;
    cols.forEach(col => values.push(row[col] ?? null));
    return `(${cols.map((_, ci) => `$${start + ci}`).join(", ")}, NOW(), NOW())`;
  });

  const sql = `
    INSERT INTO locations (${cols.join(", ")}, created_at, updated_at)
    VALUES ${placeholders.join(", ")}
    ON CONFLICT (slug) DO NOTHING
  `;
  await client.query(sql, values);
  return [];
}

// ── main ───────────────────────────────────────────────────────────────────────

async function main() {
  const pool = await createIPv4Pool(process.env.DATABASE_URL!, {
    max: 3,
    idleTimeoutMillis: 120000,
    connectionTimeoutMillis: 30000,
  });

  console.log("🌍  Seeding locations from dr5hn/countries-states-cities-database\n");

  // ── Fetch all data ──────────────────────────────────────────────────────────
  process.stdout.write("📥  Fetching data from GitHub... ");
  const [regions, subregions, combined] = await Promise.all([
    fetchJson<Dr5Region[]>("regions.json"),
    fetchJson<Dr5Subregion[]>("subregions.json"),
    fetchJson<Dr5Combined[]>("countries+states+cities.json"),
  ]);

  const countries: Dr5Country[] = combined;
  const states: Dr5State[] = combined.flatMap(c =>
    (c.states ?? []).map(s => ({ ...s, country_id: c.id, country_code: c.iso2 }))
  );
  const cities: Dr5City[] = combined.flatMap(c =>
    (c.states ?? []).flatMap(s =>
      (s.cities ?? []).map(city => ({
        id: city.id, name: city.name,
        state_id: s.id, state_code: s.state_code,
        country_id: c.id, country_code: c.iso2,
        latitude: city.latitude, longitude: city.longitude,
        wikiDataId: city.wikiDataId,
      }))
    )
  );
  console.log("done");
  console.log(
    `   regions: ${regions.length}  subregions: ${subregions.length}  ` +
    `countries: ${countries.length}  states: ${states.length}  cities: ${cities.length}`
  );

  const regionMap    = new Map<number, bigint>();
  const subregionMap = new Map<number, bigint>();
  const countryMap   = new Map<number, bigint>();
  const stateMap     = new Map<number, bigint>();
  const seen         = new Set<string>();

  const client = await pool.connect();
  try {

    // ── 1. Regions ─────────────────────────────────────────────────────────────
    console.log("\n1/5  Regions");
    const regionSlugs: { dr5hn_id: number; slug: string }[] = [];
    const regionRows = regions.map(r => {
      const slug = uniqueSlug(slugify(r.name), seen);
      regionSlugs.push({ dr5hn_id: r.id, slug });
      return { type: "REGION", name: r.name, slug, is_active: true, is_searchable: true, is_featured: false, is_popular: false };
    });
    await insertLocations(client, regionRows);
    const { rows: dbRegions } = await client.query<{ id: bigint; slug: string }>(
      `SELECT id, slug FROM locations WHERE type = 'REGION'`
    );
    const regionSlugId = new Map(dbRegions.map(r => [r.slug, BigInt(r.id)]));
    regionSlugs.forEach(r => { const id = regionSlugId.get(r.slug); if (id) regionMap.set(r.dr5hn_id, id); });
    console.log(`   ✓ ${dbRegions.length} regions`);

    // ── 2. Subregions ──────────────────────────────────────────────────────────
    console.log("2/5  Subregions");
    const subSlugs: { dr5hn_id: number; slug: string }[] = [];
    const subRows = subregions.map(s => {
      const slug = uniqueSlug(slugify(s.name), seen);
      subSlugs.push({ dr5hn_id: s.id, slug });
      return { type: "SUBREGION", name: s.name, slug, parent_id: regionMap.get(s.region_id) ?? null, is_active: true, is_searchable: true, is_featured: false, is_popular: false };
    });
    await insertLocations(client, subRows);
    const { rows: dbSubs } = await client.query<{ id: bigint; slug: string }>(
      `SELECT id, slug FROM locations WHERE type = 'SUBREGION'`
    );
    const subSlugId = new Map(dbSubs.map(s => [s.slug, BigInt(s.id)]));
    subSlugs.forEach(s => { const id = subSlugId.get(s.slug); if (id) subregionMap.set(s.dr5hn_id, id); });
    console.log(`   ✓ ${dbSubs.length} subregions`);

    // ── 3. Countries ───────────────────────────────────────────────────────────
    console.log("3/5  Countries");
    const countrySlugs: { dr5hn_id: number; slug: string }[] = [];
    const countryRows = countries.map(c => {
      const slug = uniqueSlug(c.iso2.toLowerCase(), seen);
      countrySlugs.push({ dr5hn_id: c.id, slug });
      return {
        type: "COUNTRY", name: c.name, slug,
        iso_code: c.iso2, short_code: c.iso3,
        parent_id: subregionMap.get(c.subregion_id) ?? null,
        latitude: c.latitude || null, longitude: c.longitude || null,
        is_active: true, is_searchable: true, is_featured: false, is_popular: false,
        metadata: JSON.stringify({
          dr5hn_id: c.id, phone_code: String(c.phone_code),
          currency: c.currency, currency_name: c.currency_name ?? null,
          capital: c.capital ?? null, tld: c.tld ?? null, native_name: c.native ?? null,
        }),
      };
    });
    // countries in batches to avoid huge single query
    for (let i = 0; i < countryRows.length; i += BATCH) {
      await insertLocations(client, countryRows.slice(i, i + BATCH));
    }
    const { rows: dbCountries } = await client.query<{ id: bigint; slug: string }>(
      `SELECT id, slug FROM locations WHERE type = 'COUNTRY'`
    );
    const countrySlugId = new Map(dbCountries.map(c => [c.slug, BigInt(c.id)]));
    countrySlugs.forEach(c => { const id = countrySlugId.get(c.slug); if (id) countryMap.set(c.dr5hn_id, id); });
    await client.query(`UPDATE locations SET country_id = id WHERE type = 'COUNTRY' AND country_id IS NULL`);
    console.log(`   ✓ ${dbCountries.length} countries`);

    // ── 4. States ──────────────────────────────────────────────────────────────
    console.log("4/5  States");
    const stateSlugs: { dr5hn_id: number; slug: string }[] = [];
    const stateRows = states.map(s => {
      const countryId = countryMap.get(s.country_id) ?? null;
      const slug = uniqueSlug(slugify(`${s.name}-${s.country_code}`), seen);
      stateSlugs.push({ dr5hn_id: s.id, slug });
      return {
        type: "STATE", name: s.name, slug, short_code: s.state_code,
        parent_id: countryId, country_id: countryId,
        latitude: s.latitude || null, longitude: s.longitude || null,
        is_active: true, is_searchable: true, is_featured: false, is_popular: false,
        metadata: JSON.stringify({ dr5hn_id: s.id, administrative_type: s.type ?? null }),
      };
    });
    for (let i = 0; i < stateRows.length; i += BATCH) {
      await insertLocations(client, stateRows.slice(i, i + BATCH));
      progress(Math.min(i + BATCH, stateRows.length), stateRows.length);
    }
    console.log();
    const { rows: dbStates } = await client.query<{ id: bigint; slug: string }>(
      `SELECT id, slug FROM locations WHERE type = 'STATE'`
    );
    const stateSlugId = new Map(dbStates.map(s => [s.slug, BigInt(s.id)]));
    stateSlugs.forEach(s => { const id = stateSlugId.get(s.slug); if (id) stateMap.set(s.dr5hn_id, id); });
    console.log(`   ✓ ${dbStates.length} states`);

    // ── 5. Cities (filtered) ───────────────────────────────────────────────────
    console.log("5/5  Cities (filtering...)");

    const FULL_COVERAGE_ISO2 = new Set([
      "IN", "NP", "LK", "BT", "MV", "TH", "ID", "MY", "SG",
      "AE", "QA", "TR", "EG", "MA", "JP", "VN", "KH", "MM", "PH",
      "FR", "IT", "ES", "PT", "GR", "GB", "AU", "NZ", "US", "CA", "MX",
    ]);
    const fullCoverageCountryIds = new Set(
      countries.filter(c => FULL_COVERAGE_ISO2.has(c.iso2)).map(c => c.id)
    );
    const capitalKey = (name: string, cid: number) => `${name.toLowerCase()}||${cid}`;
    const nationalCapitals = new Set(
      countries.filter(c => c.capital?.trim()).map(c => capitalKey(c.capital.trim(), c.id))
    );
    const stateNameById = new Map(states.map(s => [s.id, s.name.toLowerCase()]));

    const filtered = cities.filter(city => {
      if (nationalCapitals.has(capitalKey(city.name, city.country_id))) return true;
      if (stateNameById.get(city.state_id) === city.name.toLowerCase()) return true;
      if (fullCoverageCountryIds.has(city.country_id)) return true;
      return false;
    });

    console.log(`   Kept ${filtered.length.toLocaleString()} / ${cities.length.toLocaleString()} cities`);
    console.log(`   (national capital OR state capital OR full-coverage country)`);

    const cityRows = filtered.map(city => {
      const countryId    = countryMap.get(city.country_id) ?? null;
      const stateId      = stateMap.get(city.state_id) ?? null;
      const isCapital    = nationalCapitals.has(capitalKey(city.name, city.country_id));
      const isStateCap   = stateNameById.get(city.state_id) === city.name.toLowerCase();
      const slug = uniqueSlug(slugify(`${city.name}-${city.state_code}-${city.country_code}`), seen);
      return {
        type: "CITY", name: city.name, slug,
        parent_id: stateId ?? countryId, country_id: countryId, state_id: stateId,
        latitude: city.latitude || null, longitude: city.longitude || null,
        is_active: true, is_searchable: true,
        is_popular: isCapital || isStateCap,
        is_featured: isCapital,
      };
    });

    for (let i = 0; i < cityRows.length; i += BATCH) {
      await insertLocations(client, cityRows.slice(i, i + BATCH));
      progress(Math.min(i + BATCH, cityRows.length), cityRows.length);
    }
    console.log();

    // ── Summary ────────────────────────────────────────────────────────────────
    const { rows: summary } = await client.query<{ type: string; cnt: string }>(
      `SELECT type, COUNT(*) AS cnt FROM locations GROUP BY type`
    );
    const byType = Object.fromEntries(summary.map(r => [r.type, Number(r.cnt)]));
    const total  = summary.reduce((a, r) => a + Number(r.cnt), 0);

    console.log(`
✅  Location seed complete!

   Regions        ${(byType.REGION    ?? 0).toLocaleString().padStart(6)}
   Subregions     ${(byType.SUBREGION ?? 0).toLocaleString().padStart(6)}
   Countries      ${(byType.COUNTRY   ?? 0).toLocaleString().padStart(6)}
   States         ${(byType.STATE     ?? 0).toLocaleString().padStart(6)}
   Cities         ${(byType.CITY      ?? 0).toLocaleString().padStart(6)}
   ─────────────────────────
   Total          ${total.toLocaleString().padStart(6)}

   City filter: national capital OR state capital OR full-coverage country
   National capitals: is_featured=true, is_popular=true
   State capitals:    is_popular=true
    `);

  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(e => { console.error(e); process.exit(1); });
