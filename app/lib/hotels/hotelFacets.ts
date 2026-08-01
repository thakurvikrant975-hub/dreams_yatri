/**
 * Filter vocabulary for the /hotels search sidebar.
 *
 * Same approach as `packageFacets.ts`: the underlying columns are free text and
 * inconsistent, so the sidebar shows a small curated vocabulary and matches DB
 * rows onto it by keyword rather than surfacing the raw values as checkboxes.
 *
 * Two columns in particular can't be used directly:
 *   • `hotel_rooms.room_type` is NULL on ~99.9% of rooms — the real signal is
 *     the room's own `name` ("Deluxe Room", "Executive Suite"), so room-type
 *     filtering is keyword matching over names.
 *   • `hotels.category` is the legacy dashboard field ("boutique_hotel",
 *     "farm_stay") rather than the `property_sub_type` enum, which is unset on
 *     dashboard-created stock.
 *
 * Pure module (no DB, no server-only imports): the server action resolves these
 * against Postgres and the client sidebar renders + serialises them.
 */

// ── Filter state ─────────────────────────────────────────────────────────────

export type HotelFilters = {
  /** hotels.star_rating, 1–5 */
  stars: number[];
  /** PRICE_BUCKETS slugs — matched against per-night room rates */
  price: string[];
  /** ROOM_TYPES slugs */
  roomTypes: string[];
  /** PROPERTY_TYPES slugs (hotels.category values) */
  propertyTypes: string[];
  /** MEAL_PLANS slugs */
  mealPlans: string[];
  /** Literal room-amenity names, e.g. "Wi-Fi" */
  amenities: string[];
};

export const EMPTY_HOTEL_FILTERS: HotelFilters = {
  stars: [],
  price: [],
  roomTypes: [],
  propertyTypes: [],
  mealPlans: [],
  amenities: [],
};

// ── Stars ────────────────────────────────────────────────────────────────────

export const STAR_OPTIONS = [5, 4, 3, 2, 1] as const;

export function starLabel(n: number): string {
  return `${n} Star${n === 1 ? "" : "s"}`;
}

// ── Price (per night, lowest active rate on any room) ────────────────────────

export type PriceBucket = { slug: string; label: string; min: number; max: number };

export const PRICE_BUCKETS: PriceBucket[] = [
  { slug: "under-2k", label: "Under ₹2,000",     min: 0,      max: 2_000 },
  { slug: "2k-4k",    label: "₹2,000 – ₹4,000",  min: 2_000,  max: 4_000 },
  { slug: "4k-7k",    label: "₹4,000 – ₹7,000",  min: 4_000,  max: 7_000 },
  { slug: "7k-12k",   label: "₹7,000 – ₹12,000", min: 7_000,  max: 12_000 },
  { slug: "above-12k", label: "Above ₹12,000",   min: 12_000, max: Number.POSITIVE_INFINITY },
];

// ── Room types (keyword-matched against hotel_rooms.name) ────────────────────

export type RoomTypeRule = { slug: string; label: string; keywords: string[] };

/**
 * Deliberately overlapping: "Super Deluxe Room" matches both `deluxe` and
 * `super-deluxe`. Filters are inclusive by nature — someone ticking "Deluxe"
 * expects super-deluxe stock to qualify, not to be excluded on a technicality.
 */
export const ROOM_TYPES: RoomTypeRule[] = [
  { slug: "standard",     label: "Standard",     keywords: ["standard", "standerd"] },
  { slug: "deluxe",       label: "Deluxe",       keywords: ["deluxe", "delux"] },
  { slug: "super-deluxe", label: "Super Deluxe", keywords: ["super deluxe", "super delux"] },
  { slug: "superior",     label: "Superior",     keywords: ["superior"] },
  { slug: "premium",      label: "Premium",      keywords: ["premium", "primium"] },
  { slug: "executive",    label: "Executive",    keywords: ["executive"] },
  { slug: "suite",        label: "Suite",        keywords: ["suite"] },
  { slug: "family",       label: "Family",       keywords: ["family"] },
  { slug: "luxury",       label: "Luxury",       keywords: ["luxury"] },
  { slug: "cottage",      label: "Cottage",      keywords: ["cottage"] },
  { slug: "tent",         label: "Tent / Camp",  keywords: ["tent", "camp", "swiss"] },
];

// ── Property type (hotels.category, the legacy dashboard field) ──────────────

export type PropertyTypeRule = { slug: string; label: string; categories: string[] };

export const PROPERTY_TYPES: PropertyTypeRule[] = [
  { slug: "hotel",     label: "Hotel",     categories: ["hotel"] },
  { slug: "resort",    label: "Resort",    categories: ["resort"] },
  { slug: "homestay",  label: "Homestay",  categories: ["homestay", "farm_stay"] },
  { slug: "villa",     label: "Villa",     categories: ["villa"] },
  { slug: "cottage",   label: "Cottage",   categories: ["cottage"] },
  { slug: "houseboat", label: "Houseboat", categories: ["houseboat"] },
  { slug: "camp",      label: "Camp",      categories: ["camp"] },
  { slug: "boutique",  label: "Boutique & Heritage", categories: ["boutique_hotel", "heritage_hotel"] },
];

// ── Meal plans (keyword-matched against meal_types.name) ─────────────────────

export type MealPlanRule = { slug: string; label: string; hint: string; keywords: string[] };

/**
 * Matched on the descriptive part of the name, never the "CP"/"MAP"/"AP" code —
 * "AP" is a substring of "MAP", so code matching silently mislabels half-board
 * plans as full-board.
 */
export const MEAL_PLANS: MealPlanRule[] = [
  { slug: "breakfast",     label: "Breakfast Included", hint: "CP",  keywords: ["breakfast only"] },
  { slug: "half-board",    label: "Breakfast + Dinner", hint: "MAP", keywords: ["breakfast + dinner"] },
  { slug: "full-board",    label: "All Meals",          hint: "AP",  keywords: ["lunch"] },
  { slug: "all-inclusive", label: "All Inclusive",      hint: "AI",  keywords: ["all inclusive"] },
];

// ── Amenities (literal values from hotel_rooms.amenities) ────────────────────

/**
 * A shortlist of the amenities guests actually filter on, in the exact spelling
 * stored in the rooms' amenity arrays — the raw set runs to dozens of entries
 * per room and is mostly back-of-house ("First Aid Kit", "Fire Extinguisher").
 */
export const AMENITY_OPTIONS = [
  "Wi-Fi",
  "Parking",
  "Restaurant",
  "Room Service",
  "Air Conditioning",
  "TV",
  "Power Backup",
  "Hot Water",
  "Swimming Pool",
  "Gym",
  "Elevator",
  "Bar",
] as const;

// ── URL serialisation ────────────────────────────────────────────────────────
//
// Filters live in the query string so results stay server-rendered, shareable
// and back-button friendly — the same contract the packages sidebar uses.

export const HOTEL_FILTER_PARAM_KEYS = ["stars", "price", "room", "ptype", "meal", "amen"] as const;

function splitSlugs(raw: string | null | undefined, allowed: readonly string[]): string[] {
  if (!raw) return [];
  const seen = new Set(raw.split(",").map((s) => s.trim()).filter(Boolean));
  // Filter through the known vocabulary so a hand-edited URL can't reach the DB.
  return allowed.filter((slug) => seen.has(slug));
}

/**
 * Read filters out of a query string. `get` keeps this usable from both a
 * server page (`searchParams`) and the client (`useSearchParams`).
 */
export function parseHotelFilters(get: (key: string) => string | null | undefined): HotelFilters {
  const starsRaw = get("stars");
  return {
    stars: starsRaw
      ? [...new Set(
          starsRaw.split(",").map((n) => Number(n.trim()))
            .filter((n) => Number.isInteger(n) && n >= 1 && n <= 5),
        )].sort((a, b) => b - a)
      : [],
    price: splitSlugs(get("price"), PRICE_BUCKETS.map((b) => b.slug)),
    roomTypes: splitSlugs(get("room"), ROOM_TYPES.map((r) => r.slug)),
    propertyTypes: splitSlugs(get("ptype"), PROPERTY_TYPES.map((p) => p.slug)),
    mealPlans: splitSlugs(get("meal"), MEAL_PLANS.map((m) => m.slug)),
    amenities: splitSlugs(get("amen"), AMENITY_OPTIONS),
  };
}

/** Write filters onto an existing param set (search-bar params are preserved). */
export function applyHotelFilters(params: URLSearchParams, f: HotelFilters): URLSearchParams {
  const values: Record<(typeof HOTEL_FILTER_PARAM_KEYS)[number], string> = {
    stars: f.stars.join(","),
    price: f.price.join(","),
    room: f.roomTypes.join(","),
    ptype: f.propertyTypes.join(","),
    meal: f.mealPlans.join(","),
    amen: f.amenities.join(","),
  };
  for (const key of HOTEL_FILTER_PARAM_KEYS) {
    if (values[key]) params.set(key, values[key]);
    else params.delete(key);
  }
  return params;
}

export function countActiveHotelFilters(f: HotelFilters): number {
  return (
    f.stars.length + f.price.length + f.roomTypes.length +
    f.propertyTypes.length + f.mealPlans.length + f.amenities.length
  );
}

/** Stable signature of the filter state — used to re-key Suspense and to
 *  detect when the server has re-rendered with a different selection. */
export function hotelFiltersKey(f: HotelFilters): string {
  return [
    [...f.stars].sort((a, b) => a - b).join(","),
    [...f.price].sort().join(","),
    [...f.roomTypes].sort().join(","),
    [...f.propertyTypes].sort().join(","),
    [...f.mealPlans].sort().join(","),
    [...f.amenities].sort().join(","),
  ].join("|");
}
