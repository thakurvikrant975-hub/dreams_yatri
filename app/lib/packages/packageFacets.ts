/**
 * Filter vocabulary for the /packages search sidebar.
 *
 * Category names and stay-category labels in the DB are free text and messy —
 * near-duplicates ("Family Tour" / "Family Tours" / "Family Holidays"),
 * typos ("Delux", "Duluxe", "Budeget") and mixed conventions ("4 Star" vs
 * "4*"). Rather than surface that noise as filter checkboxes, the sidebar
 * shows a small curated vocabulary and matches the DB rows onto it by keyword
 * — the same approach the card badge already takes in packageOffer.ts. A row
 * matching nothing is simply not filterable.
 *
 * Pure module (no DB, no server-only imports): the server action resolves
 * these against Postgres and the client sidebar renders + serialises them.
 */

// ── Filter state ─────────────────────────────────────────────────────────────

export type PackageFilters = {
  /** destinations.id */
  destinationIds: number[];
  /** THEME_RULES slugs */
  themes: string[];
  /** STAY_TIERS slugs */
  stayTiers: string[];
  /** DURATION_BUCKETS slugs */
  durations: string[];
  /** BUDGET_BUCKETS slugs */
  budgets: string[];
};

export const EMPTY_PACKAGE_FILTERS: PackageFilters = {
  destinationIds: [],
  themes: [],
  stayTiers: [],
  durations: [],
  budgets: [],
};

// ── Themes (from package categories + tags) ──────────────────────────────────

export type ThemeRule = { slug: string; label: string; keywords: string[] };

/** A category may match several themes — "Nature & Wildlife Tour" is both —
 *  so unlike the single-pick card badge, every match counts here. */
export const THEME_RULES: ThemeRule[] = [
  { slug: "honeymoon",    label: "Honeymoon",       keywords: ["honeymoon", "romantic", "couple"] },
  { slug: "family",       label: "Family",          keywords: ["family", "kids", "children"] },
  { slug: "adventure",    label: "Adventure",       keywords: ["adventure", "trek", "hiking", "rafting", "safari"] },
  { slug: "beach",        label: "Beach & Islands", keywords: ["beach", "island", "coastal"] },
  { slug: "hill-station", label: "Hill Station",    keywords: ["hill station", "hills", "mountain", "snow"] },
  { slug: "wildlife",     label: "Wildlife",        keywords: ["wildlife", "jungle", "national park"] },
  { slug: "nature",       label: "Nature & Scenic", keywords: ["nature", "scenic", "lake", "backwater"] },
  { slug: "spiritual",    label: "Spiritual",       keywords: ["spiritual", "temple", "pilgrim", "char dham", "yatra"] },
  { slug: "cultural",     label: "Heritage",        keywords: ["heritage", "cultural", "culture", "history", "fort", "sightseeing"] },
  { slug: "weekend",      label: "Weekend Getaway", keywords: ["weekend", "getaway", "short trip"] },
];

// ── Stay types (from package_stay_categories.label) ──────────────────────────

export type StayTier = { slug: string; label: string; hint: string; keywords: string[] };

/** Order matters — the most specific label wins, so "Super Deluxe" is never
 *  swallowed by the "deluxe" rule and "Super Luxury" never by "luxury". */
export const STAY_TIERS: StayTier[] = [
  { slug: "super-deluxe", label: "Super Deluxe", hint: "Upgraded rooms",  keywords: ["super deluxe", "super delux", "super deluxr"] },
  { slug: "luxury",       label: "Luxury",       hint: "5 star / premium", keywords: ["super luxury", "luxury", "premium", "primium", "5 star"] },
  { slug: "deluxe",       label: "Deluxe",       hint: "4 star",          keywords: ["deluxe", "delux", "duluxe", "4 star"] },
  { slug: "standard",     label: "Standard",     hint: "3 star",          keywords: ["standard", "standerd", "3 star"] },
  { slug: "budget",       label: "Budget",       hint: "2 star / economy", keywords: ["budget", "budeget", "bugeted", "budgted", "economy", "2 star"] },
];

// ── Duration (from package_durations.nights) ─────────────────────────────────

export type DurationBucket = { slug: string; label: string; minNights: number; maxNights: number };

export const DURATION_BUCKETS: DurationBucket[] = [
  { slug: "upto-3",  label: "Up to 3 nights", minNights: 0,  maxNights: 3 },
  { slug: "4-6",     label: "4 – 6 nights",   minNights: 4,  maxNights: 6 },
  { slug: "7-9",     label: "7 – 9 nights",   minNights: 7,  maxNights: 9 },
  { slug: "10-plus", label: "10+ nights",     minNights: 10, maxNights: 999 },
];

// ── Budget (per adult, at the searcher's own traveller mix) ──────────────────

export type BudgetBucket = { slug: string; label: string; min: number; max: number };

export const BUDGET_BUCKETS: BudgetBucket[] = [
  { slug: "under-15k", label: "Under ₹15,000",       min: 0,      max: 15_000 },
  { slug: "15k-30k",   label: "₹15,000 – ₹30,000",   min: 15_000, max: 30_000 },
  { slug: "30k-50k",   label: "₹30,000 – ₹50,000",   min: 30_000, max: 50_000 },
  { slug: "50k-1l",    label: "₹50,000 – ₹1,00,000", min: 50_000, max: 100_000 },
  { slug: "above-1l",  label: "Above ₹1,00,000",     min: 100_000, max: Number.POSITIVE_INFINITY },
];

// ── Matching helpers ─────────────────────────────────────────────────────────

/** Lowercase, drop CMS artefacts, expand "4*" → "4 star", collapse whitespace. */
export function normaliseFacetText(value: string): string {
  return value
    .toLowerCase()
    .replace(/(\d)\s*\*/g, "$1 star")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Every theme a package's category/tag names match (may be none). */
export function themesForNames(names: (string | null | undefined)[]): string[] {
  const haystack = names
    .filter((n): n is string => !!n)
    .map(normaliseFacetText)
    .join(" | ");
  if (!haystack) return [];
  return THEME_RULES.filter((r) => r.keywords.some((kw) => haystack.includes(kw))).map((r) => r.slug);
}

/** The single tier a stay-category label belongs to, or null when unmatched. */
export function stayTierForLabel(label: string | null | undefined): string | null {
  if (!label) return null;
  const text = normaliseFacetText(label);
  if (!text) return null;
  return STAY_TIERS.find((t) => t.keywords.some((kw) => text.includes(kw)))?.slug ?? null;
}

export function durationBucketForNights(nights: number): string | null {
  return DURATION_BUCKETS.find((b) => nights >= b.minNights && nights <= b.maxNights)?.slug ?? null;
}

/** True when a per-adult price falls in any of the selected budget buckets.
 *  An empty selection matches everything. Buckets are [min, max). */
export function matchesBudget(perAdult: number, slugs: string[]): boolean {
  if (slugs.length === 0) return true;
  if (!Number.isFinite(perAdult) || perAdult <= 0) return false;
  return BUDGET_BUCKETS.filter((b) => slugs.includes(b.slug)).some(
    (b) => perAdult >= b.min && perAdult < b.max,
  );
}

// ── URL serialisation ────────────────────────────────────────────────────────
//
// The sidebar writes filters straight to the query string so results stay
// server-rendered, shareable and back-button friendly — the same contract the
// destinations sidebar uses.

export const PACKAGE_FILTER_PARAM_KEYS = ["dest", "theme", "stay", "nights", "budget"] as const;

function splitSlugs(raw: string | null | undefined, allowed: string[]): string[] {
  if (!raw) return [];
  const seen = new Set(raw.split(",").map((s) => s.trim()).filter(Boolean));
  // Filter through the known vocabulary so a hand-edited URL can't reach the DB.
  return allowed.filter((slug) => seen.has(slug));
}

/**
 * Read filters out of a query string. `get` keeps this usable from both a
 * server page (`searchParams`) and the client (`useSearchParams`).
 */
export function parsePackageFilters(
  get: (key: string) => string | null | undefined,
): PackageFilters {
  const destRaw = get("dest");
  return {
    destinationIds: destRaw
      ? [...new Set(
          destRaw.split(",").map((n) => Number(n.trim()))
            .filter((n) => Number.isInteger(n) && n > 0),
        )]
      : [],
    themes: splitSlugs(get("theme"), THEME_RULES.map((t) => t.slug)),
    stayTiers: splitSlugs(get("stay"), STAY_TIERS.map((t) => t.slug)),
    durations: splitSlugs(get("nights"), DURATION_BUCKETS.map((d) => d.slug)),
    budgets: splitSlugs(get("budget"), BUDGET_BUCKETS.map((b) => b.slug)),
  };
}

/** Write filters onto an existing param set (search-bar params are preserved). */
export function applyPackageFilters(params: URLSearchParams, f: PackageFilters): URLSearchParams {
  const values: Record<(typeof PACKAGE_FILTER_PARAM_KEYS)[number], string> = {
    dest: f.destinationIds.join(","),
    theme: f.themes.join(","),
    stay: f.stayTiers.join(","),
    nights: f.durations.join(","),
    budget: f.budgets.join(","),
  };
  for (const key of PACKAGE_FILTER_PARAM_KEYS) {
    if (values[key]) params.set(key, values[key]);
    else params.delete(key);
  }
  return params;
}

export function countActivePackageFilters(f: PackageFilters): number {
  return (
    f.destinationIds.length + f.themes.length + f.stayTiers.length +
    f.durations.length + f.budgets.length
  );
}

/** Stable signature of the filter state — used to re-key Suspense and to
 *  detect when the server has re-rendered with a different selection. */
export function packageFiltersKey(f: PackageFilters): string {
  return [
    [...f.destinationIds].sort((a, b) => a - b).join(","),
    [...f.themes].sort().join(","),
    [...f.stayTiers].sort().join(","),
    [...f.durations].sort().join(","),
    [...f.budgets].sort().join(","),
  ].join("|");
}
