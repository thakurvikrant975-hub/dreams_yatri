"use server";

import { revalidatePath } from "next/cache";
import { getCurrentActor, logTimeline } from "@/app/(dashboard)/dashboard/(main)/(marketing)/queries/actions";
import { fetchPackagePageData } from "@/app/actions/packages/fetch-page-data";
import { getHeroImage, getThumbnailImage } from "@/app/lib/imageUrl";
import { db } from "@/app/lib/db";
import { deriveTransportFields } from "@/app/lib/deriveTicketTransport";
import { computeBuilderHotelPricing, computeBuilderCabPricing, persistStayOptionPricing, computeStayOptionPricing } from "@/app/services/package-pricing.service";
import { baseRatePricingError } from "@/app/services/package-price-utils";
import { splitManualHotelName } from "@/app/services/hotel-name-utils";
import { resolveHotelSeasonPricing } from "@/app/lib/hotel-season-pricing";
import { parseRoomSelections, parseCabSelections } from "./room-cab-selections";
import type { RoomSelection, CabSelection } from "./room-cab-selections";
import type { Prisma, VehicleType } from "@/app/generated/prisma";
import { getItinerarySettings } from "@/app/(dashboard)/dashboard/(main)/itinerary-settings/actions";
import { broadcastVerificationCounts } from "@/app/services/verification-counts.service";
import { emailPackageToClient } from "./email-package";
import { classifyActionError } from "@/app/lib/action-error";
import { getEffectiveMember } from "@/app/(dashboard)/dashboard/(main)/lib/get-current-member";
import { resolveWorkspaceCaps, workspaceRoleOf, ownsPackage } from "./workspace-caps";
import { applyDiscount, discountLabel } from "./discount";
import { missingTravellerAgesError } from "./traveller-ages";
import { stayOptionGaps, stayOptionGapError } from "./stay-options";
import { syncRecommendedStayFromDays } from "./stay-options.sync";

// meal_types.covered_meals / itinerary_stays.active_meals store lowercase
// keys ("breakfast", "lunch", "dinner") — mapped to the same labels the
// builder's own meal toggle chips use (see MEAL_OPTIONS in page.tsx).
const MEAL_KEY_LABELS: Record<string, string> = {
  breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner",
};

/** Lets the client component gate edit access to the inclusions/exclusions/
 * policy bullet lists — those are company-wide standard content, not
 * something any individual Sales Executive should be able to alter per
 * package. Returns null when there's no session/team member match. */
export async function getCurrentUserRole(): Promise<string | null> {
  const { actor } = await getCurrentActor();
  return (actor as unknown as { role?: string } | undefined)?.role ?? null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Real hotel-room / activity search, scoped by city name.
//
// Note: real hotel/activity rows in this catalog are keyed by the free-text
// `city` field, not `destination_id` (that FK is only populated on a handful
// of test rows) — so unlike the admin package-builder's search (which filters
// by destination_id), this searches `city` directly against the route stop's
// name, with destination.name as a secondary match for any rows that *do*
// have destination_id set. Not restricted to LIVE listing_status — this is
// an internal sales/ops tool, and virtually all real hotels sit in DRAFT
// (that status gates customer-facing visibility, not internal usability).
// ─────────────────────────────────────────────────────────────────────────────

const HOTEL_IMAGE_ORDER = [{ is_primary: "desc" as const }, { sort_order: "asc" as const }];

const HOTEL_ROOM_SELECT = {
  id: true,
  plan_name: true,
  price_per_night: true,
  weekend_price_per_night: true,
  extra_bed_rate: true,
  weekend_extra_bed_rate: true,
  occupancy_prices: {
    select: { occupancy: true, price_per_night: true, weekend_price_per_night: true },
  },
  // Only active seasons — resolveHotelSeasonPricing (shared with the actual
  // billing engine, see its own doc comment) is what turns these plus a date
  // into the room's effective rate; this search must never disagree with it.
  seasons: {
    where: { is_active: true },
    select: {
      valid_from: true, valid_to: true, price_per_night: true, weekend_price_per_night: true,
      extra_bed_rate: true, weekend_extra_bed_rate: true,
      occupancy_prices: { select: { occupancy: true, price_per_night: true, weekend_price_per_night: true } },
    },
  },
  meal_type: { select: { name: true, covered_meals: true } },
  hotel: {
    select: {
      // `category` is the property TYPE (hotel/resort/homestay/…); the star
      // rating the user actually means by "3/4/5 star" lives in `stay_type`
      // as free text ("3 Star", "4 Star", …) — both are exposed separately.
      name: true, category: true, stay_type: true, thumbnail: true, city: true, state: true,
      check_in_time: true, check_out_time: true,
      images: { select: { url: true, thumbnail: true }, orderBy: HOTEL_IMAGE_ORDER, take: 1 },
      location: { select: { latitude: true, longitude: true } },
    },
  },
  room: {
    select: {
      name: true, bed_type: true, view_type: true, area_sqft: true, max_occupancy: true,
      max_adults: true, max_children: true, extra_bed_capacity: true, child_cot_available: true,
      images: { select: { url: true, thumbnail: true }, orderBy: HOTEL_IMAGE_ORDER, take: 3 },
    },
  },
} as const;

export interface HotelRoomResult {
  id:            number;
  hotelName:     string;
  roomName:      string;
  mealPlanName:  string | null;
  /** Lowercase meal keys actually covered by this room's plan — e.g. ["breakfast", "dinner"] — sourced from meal_types.covered_meals, not guessed from the plan name text. */
  coveredMeals:  string[];
  /** The rate actually charged for the date passed to the search — a season
   * override when the day falls inside one, its own weekend rate on a Sat/Sun
   * with none active, otherwise the room's flat base rate. Same figure
   * whether or not a date was given; without one this is just the base rate. */
  pricePerNight: number;
  /** True when pricePerNight came from a season override rather than the
   * room's flat base rate — shown as a small badge so an exec knows a date
   * actually moved the price rather than assuming the flat rate everywhere. */
  isSeasonalRate: boolean;
  thumbnail:     string | null;
  /** The hotel's own main photo — shown first in the picked-hotel gallery. */
  hotelPhoto:    string | null;
  /** Up to 3 photos of the specific room booked. */
  roomPhotos:    string[];
  category:      string | null;
  /** Star rating as stored, e.g. "3 Star" — null when the hotel has none set. */
  starRating:    string | null;
  /** "City, State" — shown under the hotel name in the preview. */
  location:      string | null;
  /** e.g. "2:00 PM" / "11:00 AM", as set on the hotel's own record — filled
   * into the day's hotelCheckIn/hotelCheckOut automatically on selection so
   * an exec doesn't have to know and re-type the hotel's actual policy. */
  checkInTime:   string | null;
  checkOutTime:  string | null;
  /** e.g. "1 Double Bed | Mountain View | 250 sq.ft | 3 Star | Sleeps 3 | +1 extra bed" —
   * includes star rating and occupancy/extra-bed info so the choice stays
   * legible after selection (this text is what persists onto the itinerary
   * day and shows in the client-facing PDF), not just while browsing. */
  roomSpecs:     string | null;
  roomCapacity:  number | null;
  maxAdults:     number | null;
  maxChildren:   number | null;
  /** Extra mattress/rollaway beds the room can accommodate beyond its base occupancy — 0 if none. */
  extraBedCapacity: number;
  childCotAvailable: boolean;
  /** Straight-line distance in km from the searched destination — null when
   * either point couldn't be resolved (no ref coords given, or this hotel
   * has no stored location). */
  distanceKm:    number | null;
}

/** Haversine straight-line distance in km — good enough for "how far from
 * town" context; not a driving distance. */
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// "use server" files may only export async functions — kept module-private
// and mirrored as a local constant in page.tsx (matches the pageSize passed
// to <SearchSelect>, see CAB_LABELS/MEAL_KEY_LABELS for the same pattern).
const HOTEL_SEARCH_PAGE_SIZE = 20;

function mapHotelRoomRow(
  item: Prisma.hotel_room_pricingGetPayload<{ select: typeof HOTEL_ROOM_SELECT }>,
  refCoords?: { lat: number; lng: number } | null,
  date?: string | null,
): HotelRoomResult {
  const rawHotelPhoto = item.hotel.images[0]?.thumbnail ?? item.hotel.images[0]?.url ?? item.hotel.thumbnail ?? null;
  const rawRoomPhotos = (item.room?.images ?? []).map((img) => img.thumbnail ?? img.url).filter((u): u is string => !!u);
  const rawThumbnail = rawRoomPhotos[0] ?? rawHotelPhoto ?? null;

  const extraBedCapacity = item.room?.extra_bed_capacity ?? 0;
  const roomSpecs = [
    item.room?.bed_type,
    item.room?.view_type,
    item.room?.area_sqft ? `${item.room.area_sqft} sq.ft` : null,
    item.hotel.stay_type,
    item.room?.max_occupancy ? `Sleeps ${item.room.max_occupancy}` : null,
    extraBedCapacity > 0 ? `+${extraBedCapacity} extra bed${extraBedCapacity > 1 ? "s" : ""}` : null,
    item.room?.child_cot_available ? "child cot available" : null,
  ].filter(Boolean).join(" | ") || null;

  const hotelLat = item.hotel.location?.latitude != null ? Number(item.hotel.location.latitude) : null;
  const hotelLng = item.hotel.location?.longitude != null ? Number(item.hotel.location.longitude) : null;
  const distanceKm = (refCoords && hotelLat != null && hotelLng != null)
    ? Math.round(haversineKm(refCoords.lat, refCoords.lng, hotelLat, hotelLng) * 10) / 10
    : null;

  // Same resolution the actual billing engine uses (computeBuilderHotelPricing
  // → resolveHotelSeasonPricing) — this search's price can never disagree
  // with what a pick of this room would actually cost on this date.
  const dateObj = date ? new Date(date) : null;
  const { basePrice, isSeasonal } = resolveHotelSeasonPricing(item, dateObj && !Number.isNaN(dateObj.getTime()) ? dateObj : null);

  return {
    id:            item.id,
    hotelName:     item.hotel.name,
    roomName:      item.room?.name ?? "Room",
    mealPlanName:  item.meal_type?.name ?? null,
    coveredMeals:  item.meal_type?.covered_meals ?? [],
    pricePerNight: basePrice,
    isSeasonalRate: isSeasonal,
    thumbnail:     rawThumbnail ? getThumbnailImage(rawThumbnail) : null,
    hotelPhoto:    rawHotelPhoto ? getThumbnailImage(rawHotelPhoto) : null,
    roomPhotos:    rawRoomPhotos.map((u) => getThumbnailImage(u)),
    category:      item.hotel.category,
    starRating:    item.hotel.stay_type,
    location:      [item.hotel.city, item.hotel.state].filter(Boolean).join(", ") || null,
    checkInTime:   item.hotel.check_in_time ?? null,
    checkOutTime:  item.hotel.check_out_time ?? null,
    roomSpecs,
    roomCapacity:  item.room?.max_occupancy ?? null,
    maxAdults:     item.room?.max_adults ?? null,
    maxChildren:   item.room?.max_children ?? null,
    extraBedCapacity,
    childCotAvailable: item.room?.child_cot_available ?? false,
    distanceKm,
  };
}

/** "price_asc"/"price_desc" sort by the room's actual nightly rate; "rating_desc"
 * sorts by the hotel's star rating (falls back to name for ties/unrated hotels);
 * "distance_asc" sorts nearest-first (only meaningful with refCoords — rooms
 * with no computable distance sort last, not first); "name_asc" is the
 * original default order. Applied in JS now that results can be a merge of
 * two separate queries (see searchHotelRoomsForBuilder) rather than left to a
 * single query's own ORDER BY. */
export type HotelSortOption = "price_asc" | "price_desc" | "rating_desc" | "distance_asc" | "name_asc";

function sortHotelResults(rows: HotelRoomResult[], sortBy: HotelSortOption): HotelRoomResult[] {
  const byName = (a: HotelRoomResult, b: HotelRoomResult) => a.hotelName.localeCompare(b.hotelName);
  const sorted = [...rows];
  switch (sortBy) {
    case "price_asc":
      sorted.sort((a, b) => a.pricePerNight - b.pricePerNight || byName(a, b));
      break;
    case "price_desc":
      sorted.sort((a, b) => b.pricePerNight - a.pricePerNight || byName(a, b));
      break;
    case "rating_desc":
      // Free-text "4 Star" etc. — descending string sort still puts 5/4/3/2
      // Star in the right order since only the leading digit differs.
      sorted.sort((a, b) => (b.starRating ?? "").localeCompare(a.starRating ?? "") || byName(a, b));
      break;
    case "distance_asc":
      sorted.sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity) || byName(a, b));
      break;
    case "name_asc":
    default:
      sorted.sort(byName);
      break;
  }
  return sorted;
}

/** Default straight-line radius (km) of the searched/geocoded point that
 * counts as "near here" for the coordinate-based blend below — used
 * whenever a caller doesn't pass its own `radiusKm`. */
const HOTEL_NEARBY_RADIUS_KM = 25;

export async function searchHotelRoomsForBuilder(
  /** The day's auto-derived stop (from Route: Destinations & Nights) — the
   * default scope shown before the exec types anything. Ignored once `query`
   * is non-empty, since a typed search is meant to be able to reach hotels
   * in any city, not just this one (see `query` below). */
  cityOrDestinationName: string,
  /** Free text from the single hotel search box — matched against the
   * hotel's name AND its city/state/destination, so typing e.g. "Munnar"
   * finds hotels there even though the day defaults to a different city,
   * with no separate city field needed. Empty means "just show the default
   * city's hotels". */
  query: string,
  refCoords?: { lat: number; lng: number } | null,
  page: number = 1,
  /** Free-text `hotels.stay_type` match, e.g. "4 Star" — the star-rating filter chip. */
  starFilter?: string | null,
  /** Free-text `hotels.category` match, e.g. "resort" — the property-type filter chip. */
  categoryFilter?: string | null,
  /** Lowercase meal keys ("breakfast"/"lunch"/"dinner") the room's plan must
   * cover — a room needs ALL selected meals to match, not just one. Empty/
   * omitted means no meal filtering. Ignored when `noMealsOnly` is set. */
  mealFilter?: string[] | null,
  sortBy?: HotelSortOption | null,
  /** Room-only / EP filter — true shows only rooms with no meal plan at all
   * (no meal_type row, or a meal_type whose covered_meals is empty). */
  noMealsOnly?: boolean | null,
  /** The day's actual travel date (ISO) — when given, pricePerNight reflects
   * that specific date's season/weekend rate instead of the flat base rate. */
  date?: string | null,
  /** Overrides HOTEL_NEARBY_RADIUS_KM for the coordinate-based blend — lets
   * an exec widen the search past 25km for a sparsely-covered destination,
   * or narrow it to rule out a distant same-named place. Only affects the
   * geo fallback (refCoords set, no typed query); a typed search never used
   * a radius to begin with. */
  radiusKm?: number | null,
): Promise<{ rows: HotelRoomResult[]; total: number; hiddenNoSeasonRate: number }> {
  const city = cityOrDestinationName.split(",")[0]?.trim();
  const q = query.trim();
  if (!city && !q) return { rows: [], total: 0, hiddenNoSeasonRate: 0 };

  const mealClause = noMealsOnly
    ? { OR: [{ meal_type_id: null }, { meal_type: { covered_meals: { isEmpty: true } } }] }
    : mealFilter && mealFilter.length > 0
      ? { meal_type: { covered_meals: { hasEvery: mealFilter } } }
      : {};
  const hotelFilters = {
    is_active: true,
    ...(starFilter ? { stay_type: starFilter } : {}),
    ...(categoryFilter ? { category: categoryFilter } : {}),
  };

  const textMatches = await db.hotel_room_pricing.findMany({
    where: {
      is_active: true,
      hotel: {
        ...hotelFilters,
        // A typed search reaches anywhere (name or location) — it isn't
        // scoped to the day's default city, so an exec can jump straight to
        // a hotel/city they already know without clearing anything first.
        // With no query, fall back to just the default city/destination.
        ...(q
          ? {
              OR: [
                { name: { contains: q, mode: "insensitive" } },
                { city: { contains: q, mode: "insensitive" } },
                { state: { contains: q, mode: "insensitive" } },
                { destination: { name: { contains: q, mode: "insensitive" } } },
              ],
            }
          : {
              // Also matches the hotel's own name — a stop like "Cherrapunji"
              // often has no hotel actually tagged with that exact city (the
              // catalog uses the sub-locality instead, e.g. "Shella
              // Bholaganj"), but a property literally named "... Cherrapunji"
              // still exists and should show up by default rather than
              // silently returning nothing until the exec types the same
              // string manually (which already matched name — see the `q`
              // branch above).
              OR: [
                { name: { contains: city, mode: "insensitive" } },
                { city: { contains: city, mode: "insensitive" } },
                { destination: { name: { contains: city, mode: "insensitive" } } },
              ],
            }),
      },
      ...mealClause,
    },
    select: HOTEL_ROOM_SELECT,
  });

  // Blended in whenever there's a point to measure from — not just as a
  // fallback when the text match came back empty. A stop can have one hotel
  // tagged with its exact city name and a dozen more a few km away tagged
  // with a neighbouring sub-locality; those shouldn't stay invisible just
  // because the first one happened to match by text. Skipped for a typed
  // name/place search (`q`) — that's a deliberate "find this specific thing"
  // query, not "what's near here", and geocoding whatever was typed as a
  // place wouldn't reliably mean what the exec meant by it.
  let geoMatches: typeof textMatches = [];
  if (refCoords && !q) {
    const excludeIds = textMatches.map((r) => r.id);
    const nearby = await db.hotel_room_pricing.findMany({
      where: {
        is_active: true,
        hotel: { ...hotelFilters, location: { latitude: { not: null }, longitude: { not: null } } },
        ...(excludeIds.length > 0 ? { id: { notIn: excludeIds } } : {}),
        ...mealClause,
      },
      select: HOTEL_ROOM_SELECT,
    });
    const effectiveRadiusKm = radiusKm ?? HOTEL_NEARBY_RADIUS_KM;
    geoMatches = nearby.filter((item) => {
      const lat = item.hotel.location?.latitude != null ? Number(item.hotel.location.latitude) : null;
      const lng = item.hotel.location?.longitude != null ? Number(item.hotel.location.longitude) : null;
      if (lat == null || lng == null) return false;
      return haversineKm(refCoords.lat, refCoords.lng, lat, lng) <= effectiveRadiusKm;
    });
  }

  const mapped = sortHotelResults(
    [...textMatches, ...geoMatches].map((item) => mapHotelRoomRow(item, refCoords, date)),
    sortBy ?? "name_asc",
  );

  // A room with no season covering this night is not offered.
  //
  // resolveHotelSeasonPricing falls back to the room's base rate when no season
  // matches — which is right for showing a catalogue, and wrong for quoting a
  // date. Seasons are stored year-agnostically, so a rate set once covers that
  // window every year; a date that matches nothing means nobody has priced that
  // part of the calendar at all. Quoting it at the base rate produced a
  // confident number for a night the hotel has never given us a price for, and
  // the exec had no way to tell that apart from a real rate.
  //
  // Only filtered when a date is actually known. Searching before the trip has
  // a travel date cannot evaluate a season, and hiding everything then would
  // leave an exec staring at an empty catalogue for a reason nothing on screen
  // explains.
  const dated = !!date && !Number.isNaN(new Date(date).getTime());
  const combined = dated ? mapped.filter((r) => r.isSeasonalRate) : mapped;
  const hiddenNoSeasonRate = dated ? mapped.length - combined.length : 0;

  const start = (Math.max(page, 1) - 1) * HOTEL_SEARCH_PAGE_SIZE;
  return {
    rows: combined.slice(start, start + HOTEL_SEARCH_PAGE_SIZE),
    total: combined.length,
    /** How many rooms were dropped for having no rate on this date — so the
     * picker can say why a hotel someone expected is missing, instead of
     * looking simply absent. */
    hiddenNoSeasonRate,
  };
}

/** Looks up a single room by its `hotel_room_pricing` id — used by the hotel
 * picker to price the currently-selected room so other results can show a
 * "+4000 / -200" delta against it, even after a draft reload (the delta
 * baseline isn't persisted, just recomputed from the stored roomPricingId). */
export async function getHotelRoomByIdForBuilder(
  id: number,
  refCoords?: { lat: number; lng: number } | null,
  date?: string | null,
): Promise<HotelRoomResult | null> {
  const item = await db.hotel_room_pricing.findUnique({
    where: { id },
    select: HOTEL_ROOM_SELECT,
  });
  if (!item) return null;
  return mapHotelRoomRow(item, refCoords, date);
}

export interface ActivityResult {
  id:            number;
  name:          string;
  /** The catalog's own write-up for this activity — what actually goes into
   * the day card's description on selection (see handleActivitySelect in
   * page.tsx). Null when the catalog entry was never given one. */
  description:   string | null;
  category:      string | null;
  durationHours: number | null;
  thumbnail:     string | null;
  /** Up to 3 gallery photos — "Glimpses of the experience" style. */
  photos:        string[];
  photoLabels:   string[];
}

export async function searchActivitiesForBuilder(cityOrDestinationName: string, query: string): Promise<ActivityResult[]> {
  const city = cityOrDestinationName.split(",")[0]?.trim();
  const q = query.trim();
  if (!city && !q) return [];

  // No query: default listing scoped to the day's destination. With a query,
  // search broadly by activity title OR city/destination — previously this
  // ANDed the query onto the destination scope, so typing an activity title
  // from a *different* city (or a city name that isn't also in the day's
  // destination) silently returned zero/wrong matches.
  const list = await db.activities.findMany({
    where: {
      is_active: true,
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { city: { contains: q, mode: "insensitive" } },
              { state: { contains: q, mode: "insensitive" } },
              { destination: { name: { contains: q, mode: "insensitive" } } },
            ],
          }
        : {
            OR: [
              { city: { contains: city, mode: "insensitive" } },
              { destination: { name: { contains: city, mode: "insensitive" } } },
              // `city`/`destination_id` are unpopulated on virtually every real
              // activity row — the city instead lives as a suffix in the name
              // itself (e.g. "Tea Garden Walk munnar"), so match against that too.
              { name: { contains: city, mode: "insensitive" } },
            ],
          }),
    },
    select: {
      id: true, name: true, description: true, duration_hours: true,
      category: { select: { name: true } },
      images: {
        select: { url: true, thumbnail: true, label: true },
        orderBy: [{ is_primary: "desc" }, { sort_order: "asc" }],
        take: 3,
      },
    },
    take: 20,
    orderBy: { name: "asc" },
  });

  return list.map((a) => {
    const photos = a.images.map((img) => img.thumbnail ?? img.url).filter((u): u is string => !!u);
    const photoLabels = a.images.map((img) => img.label ?? "");
    return {
      id:            a.id,
      name:          a.name,
      description:   a.description ?? null,
      category:      a.category?.name ?? null,
      durationHours: a.duration_hours != null ? Number(a.duration_hours) : null,
      thumbnail:     photos[0] ? getThumbnailImage(photos[0]) : null,
      photos:        photos.map((u) => getThumbnailImage(u)),
      photoLabels,
    };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Vehicle/cab search — not city-scoped (unlike hotels/activities): vehicles
// are a shared fleet catalog, not tied to a single destination.
// ─────────────────────────────────────────────────────────────────────────────

export interface VehicleResult {
  id:                number;
  name:              string;
  type:              string;
  passengerCapacity: number;
  hasAc:             boolean;
  thumbnail:         string | null;
}

export async function searchVehiclesForBuilder(query: string): Promise<VehicleResult[]> {
  const list = await db.vehicles.findMany({
    where: {
      is_active: true,
      ...(query ? { name: { contains: query, mode: "insensitive" } } : {}),
    },
    select: {
      id: true, name: true, type: true, passenger_capacity: true, has_ac: true, image_key: true,
    },
    take: 20,
    orderBy: { name: "asc" },
  });

  return list.map((v) => ({
    id:                v.id,
    name:              v.name,
    type:              v.type,
    passengerCapacity: v.passenger_capacity,
    hasAc:             v.has_ac,
    thumbnail:         v.image_key ? getThumbnailImage(v.image_key) : null,
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// City-scoped cab pricing — cab_pricing rows are tied to a destination/
// Location (100% of active rows have a location with lat/lng), unlike the
// vehicles catalog above. Exact city match first; if a searched city has no
// pricing configured (real gap — only ~39 destinations have cab rates today),
// falls back to whichever priced city sits nearest by straight-line distance,
// so the exec always sees real, bookable cab rates instead of nothing.
// ─────────────────────────────────────────────────────────────────────────────

export interface CabPricingResult {
  id:                number;
  vehicleName:       string;
  vehicleType:       string;
  passengerCapacity: number;
  hasAc:             boolean;
  thumbnail:         string | null;
  price:             number;
  pricingType:       string;
  /** The destination/location this rate is actually priced for — may differ
   * from the searched city when falling back to the nearest priced one. */
  cityName:          string;
  distanceKm:        number | null;
}

const CAB_PRICING_SELECT = {
  id: true, price: true, pricing_type: true,
  destination: { select: { name: true } },
  location: { select: { name: true, latitude: true, longitude: true } },
  vehicle: { select: { name: true, type: true, passenger_capacity: true, has_ac: true, image_key: true } },
} as const;

export type CabSortOption = "price_asc" | "price_desc" | "seats_desc" | "seats_asc" | "distance_asc" | "name_asc";

// Sorted cheapest-first by default, so a city split across two same-named
// location rows (e.g. two "Goa" rows — a state-wide entry and an unrelated
// duplicate — see the package-builder-v2 split investigation) can have an
// entirely cheaper vehicle group (bikes) fill the whole page and permanently
// hide a pricier group (cars/buses). The classic "Search cabs in <city>"
// combobox now paginates properly (SearchSelect's "Load more" button), so
// this is back to a normal page size — kept small so the popup opens fast
// and "Load more" is the way to see the rest, not a giant first fetch.
// Not exported: this is a "use server" file, and only async functions may
// be exported from one — callers mirror this value locally (see page.tsx).
const CAB_SEARCH_PAGE_SIZE = 20;

function sortCabResults(rows: CabPricingResult[], sortBy: CabSortOption): CabPricingResult[] {
  const byName = (a: CabPricingResult, b: CabPricingResult) => a.vehicleName.localeCompare(b.vehicleName);
  const sorted = [...rows];
  switch (sortBy) {
    case "price_asc":
      sorted.sort((a, b) => a.price - b.price || byName(a, b));
      break;
    case "price_desc":
      sorted.sort((a, b) => b.price - a.price || byName(a, b));
      break;
    case "seats_desc":
      sorted.sort((a, b) => b.passengerCapacity - a.passengerCapacity || byName(a, b));
      break;
    case "seats_asc":
      sorted.sort((a, b) => a.passengerCapacity - b.passengerCapacity || byName(a, b));
      break;
    case "distance_asc":
      sorted.sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity) || byName(a, b));
      break;
    case "name_asc":
    default:
      sorted.sort(byName);
      break;
  }
  return sorted;
}

function toCabPricingResult(
  item: Prisma.cab_pricingGetPayload<{ select: typeof CAB_PRICING_SELECT }>,
  refCoords?: { lat: number; lng: number } | null,
): CabPricingResult {
  const lat = item.location?.latitude != null ? Number(item.location.latitude) : null;
  const lng = item.location?.longitude != null ? Number(item.location.longitude) : null;
  const distanceKm = (refCoords && lat != null && lng != null)
    ? Math.round(haversineKm(refCoords.lat, refCoords.lng, lat, lng) * 10) / 10
    : null;

  return {
    id:                item.id,
    vehicleName:       item.vehicle.name,
    vehicleType:       item.vehicle.type,
    passengerCapacity: item.vehicle.passenger_capacity,
    hasAc:             item.vehicle.has_ac,
    thumbnail:         item.vehicle.image_key ? getThumbnailImage(item.vehicle.image_key) : null,
    price:             Number(item.price),
    pricingType:       item.pricing_type,
    cityName:          item.destination?.name ?? item.location?.name ?? "",
    distanceKm,
  };
}

export async function searchCabsForBuilder(
  cityOrDestinationName: string,
  query: string,
  refCoords?: { lat: number; lng: number } | null,
  page: number = 1,
  /** vehicles.type match, e.g. "SUV" — the vehicle-type filter chip. */
  vehicleTypeFilter?: string | null,
  /** Minimum vehicles.passenger_capacity — the seats filter chip. */
  minSeats?: number | null,
  sortBy?: CabSortOption | null,
): Promise<{ rows: CabPricingResult[]; total: number }> {
  const city = cityOrDestinationName.split(",")[0]?.trim();
  const vehicleWhere: Prisma.vehiclesWhereInput = {
    ...(query ? { name: { contains: query, mode: "insensitive" } } : {}),
    ...(vehicleTypeFilter ? { type: vehicleTypeFilter as VehicleType } : {}),
    ...(minSeats ? { passenger_capacity: { gte: minSeats } } : {}),
  };
  const hasVehicleWhere = Object.keys(vehicleWhere).length > 0;

  let list: CabPricingResult[] = [];

  if (city) {
    const rows = await db.cab_pricing.findMany({
      where: {
        is_active: true,
        OR: [
          { destination: { name: { contains: city, mode: "insensitive" } } },
          { location: { name: { contains: city, mode: "insensitive" } } },
        ],
        ...(hasVehicleWhere ? { vehicle: vehicleWhere } : {}),
      },
      select: CAB_PRICING_SELECT,
    });
    list = rows.map((item) => toCabPricingResult(item, refCoords));
  }

  // No pricing configured for this exact city (or none searched at all) —
  // fall back to whichever priced destination sits nearest by straight-line
  // distance, using refCoords (the day's real pickup point when the exec
  // picked one, otherwise the geocoded city). This is what lets a day
  // scoped to e.g. "Kochi" surface a state-wide rate priced under "Kerala"
  // instead of coming back empty just because the names don't match.
  if (list.length === 0 && refCoords) {
    const all = await db.cab_pricing.findMany({
      where: {
        is_active: true,
        location: { latitude: { not: null }, longitude: { not: null } },
        ...(hasVehicleWhere ? { vehicle: vehicleWhere } : {}),
      },
      select: CAB_PRICING_SELECT,
    });

    let nearestCityName: string | null = null;
    let minDist = Infinity;
    for (const item of all) {
      const lat = item.location?.latitude != null ? Number(item.location.latitude) : null;
      const lng = item.location?.longitude != null ? Number(item.location.longitude) : null;
      if (lat == null || lng == null) continue;
      const d = haversineKm(refCoords.lat, refCoords.lng, lat, lng);
      if (d < minDist) {
        minDist = d;
        nearestCityName = item.destination?.name ?? item.location?.name ?? null;
      }
    }
    if (nearestCityName) {
      list = all
        .filter((item) => (item.destination?.name ?? item.location?.name) === nearestCityName)
        .map((item) => toCabPricingResult(item, refCoords));
    }
  }

  const sorted = sortCabResults(list, sortBy ?? "price_asc");
  const start = (Math.max(page, 1) - 1) * CAB_SEARCH_PAGE_SIZE;
  return { rows: sorted.slice(start, start + CAB_SEARCH_PAGE_SIZE), total: sorted.length };
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared Types (exported so pages can import them)
// ─────────────────────────────────────────────────────────────────────────────

export interface QueryRow {
  id:             string;
  name:           string;
  phone:          string;
  countryCode:    string;
  email:          string | null;
  destination:    string | null;
  travelDate:     Date | null;
  groupSize:      number | null;
  assignedToName: string | null;
  assignedAt:     Date | null;
  createdAt:      Date;
  updatedAt:      Date;
  requirements:   any;
  status:         string;
  /** The exact public package page path this lead submitted from (if any),
   * e.g. "/packages/kerala-highlights/5d-4n/munnar-kochi/super-deluxe" —
   * lets "Create Package" find the exact originating package, not just a
   * same-destination guess. */
  packageUrl:     string | null;
  /** Packages already built for this query, most recent first — a query can
   * have more than one (e.g. two different budget options sent out). Empty
   * when none have been started yet. */
  customPackages: { id: string; title: string; status: string }[];
}

/** The builder is keyed off the *package*, not the query — a query can now
 * have several packages built for it, and a package can exist with no
 * linked query at all ("blank" packages). So every lead-identity field here
 * is nullable: null means this package has no linked query (or the query
 * hasn't loaded yet), not that something failed. `customPackage` itself is
 * never null when returned from getPackageDetail — a null result there
 * means no package exists yet at that id (a brand-new, unsaved draft; see
 * getQueryLeadInfo, used to prefill that case instead). */
export interface QueryDetail {
  id:             string | null;
  name:           string | null;
  phone:          string | null;
  countryCode:    string | null;
  email:          string | null;
  destination:    string | null;
  travelDate:     Date | null;
  groupSize:      number | null;
  assignedToName: string | null;
  assignedAt:     Date | null;
  createdAt:      Date | null;
  updatedAt:      Date | null;
  requirements:   any;
  status:         string | null;
  /** The exact public package page path this lead submitted from (if any),
   * e.g. "/packages/kerala-highlights/5d-4n/munnar-kochi/super-deluxe" —
   * lets "Create Package" find the exact originating package, not just a
   * same-destination guess. */
  packageUrl:     string | null;
  message: string | null;
  /** Joined from TeamMember — package_queries.assignedTo has no FK relation. */
  execEmail:       string | null;
  execDesignation: string | null;
  customPackage: {
    id:              string;
    /** The linked query's id, or null for a blank package — immutable after
     * creation. */
    queryId:         string | null;
    /** The stay standards this package quotes, in display order. Names only:
     * a builder that cannot edit them still has to be able to say that it
     * cannot — v1 writes the day row, which carries the recommended option
     * alone. Empty for every package built before stay options existed. */
    stayOptions:     { label: string; isRecommended: boolean }[];
    status:          string;
    sentAt:          Date | null;
    /** Set when the exec marks the package ready for costing review — see
     * markPackageReady. Combined with the query's assignedAt and this
     * package's sentAt, gives the "assigned → ready" and "ready → sent"
     * turnaround times shown in the Package Status card. */
    readyAt:         Date | null;
    readyByName:     string | null;
    verified:        boolean;
    verifiedAt:      Date | null;
    verifiedByName:  string | null;
    rejectedAt:      Date | null;
    rejectedByName:  string | null;
    rejectionNote:   string | null;
    rejectionReason: { label: string } | null;
    revisionRequestedAt:     Date | null;
    revisionRequestedByName: string | null;
    revisionNote:            string | null;
    viewedAt:        Date | null;
    viewCount:       number;
    /** Snapshot of the last-SENT version, captured right before an edit
     * overwrites it — see PreviousSnapshot in page.tsx for the shape. */
    previousSnapshot: unknown;
    title:           string;
    description:     string | null;
    coverImage:      string | null;
    coverImagePosition: number;
    totalDays:       number;
    totalNights:     number;
    travelDate:      Date | null;
    adults:          number;
    children:        number;
    infants:         number;
    childrenAges:    number[];
    infantAges:      number[];
    pricePerPerson:  number | null;
    totalPrice:      number | null;
    marginPercentage: number;
    /** Costing's concession off the final price — see discount.ts. */
    discountType: "FLAT" | "PERCENT" | null;
    discountValue: number | null;
    discountNote: string | null;
    gstPercentage:    number;
    inclusions:      string[];
    exclusions:      string[];
    /** Read-only — costing's per-package removals from the merged
     * inclusions/exclusions list (see the schema comment on
     * custom_packages.removedInclusions). Set only from verify-packages,
     * never written back by saveCustomPackage. */
    removedInclusions: string[];
    removedExclusions: string[];
    termsNotes:      string | null;
    termsConditions: string[];
    paymentPolicy:   string[];
    amendmentPolicy: string[];
    travelBenefits:  string[];
    extraPolicyItems: ExtraPolicyItems;
    /** Frozen hotel/cab/ticket/margin/GST breakdown, written once when the
     * package is sent — see PricingSnapshot in sendPackageToClient. */
    pricingSnapshot: unknown;
    stops:           StopInput[];
    itineraries:     DayItinerary[];
    tickets:         TicketInput[];
    addOns:          AddonInput[];
  } | null;
}

export interface StopInput {
  id?:     string;
  name:    string;
  nights:  number;
  /** Manual override for the "Places You Gonna Visit" tile image — takes
   * priority over the auto-resolved destination catalog photo when set. */
  image?:  string;
}

export interface ActivityInput {
  id?:          string;
  title:        string;
  description:  string;
  photo:        string;
  /** Up to 3 gallery photos — "Glimpses of the experience" style. */
  photos:       string[];
  photoLabels:  string[];
}

export interface DayItinerary {
  id?:                string;
  day:                number;
  title:              string;
  description:        string;
  activities:         ActivityInput[];
  meals:              string[];
  accommodation:      string;
  accommodationPhoto: string;
  accommodationRoomPhotos: string[];
  accommodationLocation: string;
  accommodationRoomSpecs: string;
  /** Snapshotted off the hotel at pick time — see the schema note. Empty for
   * a hand-typed stay or one chosen before this existed. */
  accommodationStarRating: string;
  accommodationRoomCapacity: number | null;
  /** Occupancy caps snapshotted from the picked catalog room (see
   * HotelRoomResult) — max adults/children the room itself allows, and how
   * many extra mattresses/rollaway beds it has. Feeds the "rooms & mattresses
   * needed for this party" readout in the Hotel Info card (room-capacity.ts).
   * Null for a hand-typed day with no roomPricingId. */
  accommodationMaxAdults?: number | null;
  accommodationMaxChildren?: number | null;
  accommodationExtraBedCapacity?: number | null;
  /** Mattress/rollaway-bed count for a day with NO roomPricingId — set by
   * the hotel team filling an "Add Hotels by Team" request, or typed
   * directly here for a hand-entered hotel. A catalog-picked room's
   * mattress count is computed instead (see roomExtraBedsUsed in
   * room-capacity.ts) — this only matters once there's no catalog room to
   * compute it from. */
  manualExtraBeds?: number | null;
  /** The exact `hotel_room_pricing` row picked for this night — lets the
   * package price be computed from real, date/occupancy-aware hotel rates
   * instead of typed in by hand. Null when the hotel was entered as free text. */
  roomPricingId:      number | null;
  /** Overrides the auto-computed (adults+children ÷ room capacity) room
   * count for roomPricingId above — set when the exec explicitly says how
   * many of that room type are needed. Null/undefined keeps the
   * auto-computed behavior (unchanged from before this field existed). */
  roomsCount?:        number | null;
  /** Additional, different room types for the same night — see
   * RoomSelection. Empty/undefined when this night only has the one
   * primary room. */
  extraRooms?:        RoomSelection[];
  hotelCheckIn:       string;
  hotelCheckOut:      string;
  hotelMealPlan:      string;
  /** Set when the exec couldn't find a catalog hotel and flagged this day for
   * the hotel team instead (see /dashboard/hotel-requests) — accommodation/
   * roomPricingId etc. above stay empty while true. Blocks markPackageReady. */
  hotelPending:       boolean;
  hotelPendingNote:   string;
  /** Property type requested (e.g. "RESORT", "STAR_4" — same keys as
   * stayPreference), shown to the hotel team on /dashboard/hotel-requests.
   * Same lifecycle as hotelPendingNote — only meaningful while pending. */
  hotelRequestType?:  string | null;
  /** B2B price/night the hotel team entered — or the exec typed directly for
   * a hand-entered hotel — feeds computeBuilderHotelPricing's manual-price
   * branch since roomPricingId stays null for these days. */
  manualHotelPricePerNight: number | null;
  /** Per-mattress rate for manualExtraBeds above, same manual-price branch. */
  manualExtraBedRate?: number | null;
  /** Read-only — who/when the hotel team filled this day in, for display
   * only (not written back by saveCustomPackage). */
  hotelFilledAt?:     Date | null;
  hotelFilledByName?: string | null;
  /** Read-only — the hotel team's internal note left when filling this day
   * in, for display only (not written back by saveCustomPackage, and never
   * included in the itinerary PDF — see ItineraryDocument.tsx). */
  hotelFillNote?:     string | null;
  /** Read-only — set when the hotel team couldn't fulfil a pending request
   * (see /dashboard/hotel-requests). hotelPending stays true while this is
   * set: the day stays in the team's queue as "rejected, needs the exec's
   * attention" rather than silently clearing. Ignored on save — saveCustomPackage
   * derives these from the DB row it fetched itself, the same "never trust
   * the client's stale snapshot" treatment as hotelFilledAt above, so a
   * background autosave from an older tab can never silently erase a
   * rejection the exec hasn't seen yet. */
  hotelRejectedAt?:     Date | null;
  hotelRejectedByName?: string | null;
  hotelRejectionNote?:  string | null;
  /** Set (only) by the "Update Request"/"Request Room" submit action to say
   * "the exec has seen this rejection and is knowingly resubmitting" — the
   * one explicit gesture saveCustomPackage accepts as proof this isn't a
   * stale save, and clears hotelRejectedAt/etc above. Not persisted itself. */
  hotelRejectionAcknowledged?: boolean;
  /** Read-only — costing's per-day price correction (see
   * /dashboard/verify-packages), set only from the review screen. Carried
   * forward untouched by saveCustomPackage; feeds computeBuilderHotelPricing/
   * computeBuilderCabPricing so the builder's own live preview matches what
   * costing has already corrected instead of ignoring it. */
  hotelPriceOverride?: number | null;
  cabPriceOverride?:   number | null;
  transport:          string;
  transportPhoto:     string;
  transportVehicleType: string;
  transportSeats:     number | null;
  transportPickup:    string;
  /** Coordinates of the pickup point, when it was chosen from the Location
   * catalog (via LocationSearchSelect) rather than typed as free text — lets
   * cab search find the nearest priced city from the real pickup spot instead
   * of a geocoded guess of the day's city. Null for free-text/legacy pickups. */
  transportPickupLat: number | null;
  transportPickupLng: number | null;
  transportDrop:      string;
  transportDropLat:   number | null;
  transportDropLng:   number | null;
  transportDistanceKm: number | null;
  /** Free-text estimate like "3h 15m" — typed by the exec or filled in by
   * the AI Itinerary Builder. */
  transportTravelTime: string;
  /** The exact `cab_pricing` row picked for this day — lets the package price
   * be computed from real, season/date-aware cab rates instead of typed in by
   * hand. Null when the vehicle was picked from the unscoped fleet catalog
   * (no real rate to reference) or entered as free text. */
  cabPricingId:       number | null;
  /** Overrides the implicit quantity of 1 for cabPricingId above — e.g. 2 of
   * the same Sedan. Null/undefined keeps the previous implicit-1 behavior. */
  cabQuantity?:       number | null;
  /** Additional, different cabs for the same day — see CabSelection. */
  extraCabs?:         CabSelection[];
  notes:              string;
  /** Tone for the note above — warning | info | error | success | neutral.
   * Null/absent reads as neutral. Same vocabulary as itinerary_notes.type. */
  notesType?:         string | null;
  /** Optional heading for the note — falls back to the tone's label. */
  notesTitle?:        string | null;
}

/** Per-package additions to the six standard lists — see
 * custom_packages.extraPolicyItems. Anyone (including a Sales Executive, who
 * can't touch the standard lists themselves) can add/remove items here;
 * they're always shown on top of, never replacing, the admin-managed
 * standard list from itinerary_settings. */
export type ExtraPolicyItems = {
  inclusions:      string[];
  exclusions:      string[];
  termsConditions: string[];
  paymentPolicy:   string[];
  amendmentPolicy: string[];
  travelBenefits:  string[];
};

/** Defensive against a missing key or non-array value in the stored JSON
 * (e.g. an older row saved before a key existed) — every key always comes
 * back as at least an empty array. */
function normalizeExtraPolicyItems(raw: unknown): ExtraPolicyItems {
  const obj = (raw && typeof raw === "object" ? raw : {}) as Partial<Record<keyof ExtraPolicyItems, unknown>>;
  const arr = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);
  return {
    inclusions:      arr(obj.inclusions),
    exclusions:      arr(obj.exclusions),
    termsConditions: arr(obj.termsConditions),
    paymentPolicy:   arr(obj.paymentPolicy),
    amendmentPolicy: arr(obj.amendmentPolicy),
    travelBenefits:  arr(obj.travelBenefits),
  };
}

export interface PackageInput {
  /** The package's own identity — client-generated (crypto.randomUUID()) the
   * first time a new draft is saved, then reused on every subsequent save.
   * This (not queryId) is what saveCustomPackage upserts on, since a query
   * can now have more than one package. */
  id:              string;
  /** The linked query, or null for a "blank" package with no lead attached.
   * Only meaningful on first create — never changes after that. */
  queryId:         string | null;
  title:           string;
  description:     string;
  coverImage:      string;
  coverImagePosition: number;
  destination:     string;
  startingPoint:   string;
  totalDays:       number;
  totalNights:     number;
  travelDate:      string;
  adults:          number;
  children:        number;
  infants:         number;
  childrenAges:    number[];
  infantAges:      number[];
  pricePerPerson:  number | null;
  totalPrice:      number | null;
  marginPercentage: number;
  gstPercentage:    number;
  /** Costing's concession off the final price — see discount.ts. */
  discountType?:    "FLAT" | "PERCENT" | null;
  discountValue?:   number | null;
  discountNote?:    string | null;
  currency:        string;
  inclusions:      string[];
  exclusions:      string[];
  termsNotes:      string;
  termsConditions: string[];
  paymentPolicy:   string[];
  amendmentPolicy: string[];
  travelBenefits:  string[];
  extraPolicyItems: ExtraPolicyItems;
  status:          "DRAFT" | "READY";
  stops:           StopInput[];
  itineraries:     DayItinerary[];
  tickets:         TicketInput[];
  addOns:          AddonInput[];
}

export interface AddonInput {
  id?:      string;
  /** e.g. "Honeymoon Kit", "Inner Line Permit". */
  name:     string;
  /** Per-unit price — subtotal (price × quantity) feeds into
   * computeFinalPricing in page.tsx, same as hotel/cab costs. */
  price:    number | null;
  quantity: number;
  notes:    string;
  /** Which itinerary day this was added under (added while working on that
   * day's hotel) — renders under that day's Hotel section in the document.
   * Null when added generically from the Package Details tab. */
  day:      number | null;
}

export interface TicketInput {
  id?:            string;
  /** Mirrors the TicketType enum, BUS and OTHER included, so a package
   * carrying either stays readable and editable in the builder. */
  type:           "FLIGHT" | "TRAIN" | "HELICOPTER" | "BUS" | "OTHER";
  provider:       string;
  ticketNumber:   string;
  fromPlace:      string;
  toPlace:        string;
  /** ISO date ("YYYY-MM-DD") — the calendar date this leg actually travels,
   * which may differ from the package's overall travel date (e.g. a return
   * leg). Empty string when not set. */
  travelDate:     string;
  /** 24-hour "HH:MM" — matches <input type="time">'s value format exactly,
   * so no parsing is needed at the input boundary. */
  departureTime:  string;
  arrivalTime:    string;
  /** Auto-computed from departureTime/arrivalTime (see computeDurationText
   * in page.tsx) whenever either changes — not directly user-editable. */
  durationText:   string;
  adults:         number;
  children:       number;
  infants:        number;
  ticketCount:    number;
  /** Total fare for this ticket entry — summed with the other tickets into
   * the package's computed pricing (see computeFinalPricing in page.tsx).
   * Never shown on the client-facing document, only used internally. */
  fare:           number | null;
  notes:          string;
}

export interface PaginatedQueries {
  queries:    QueryRow[];
  total:      number;
  page:       number;
  totalPages: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// "Use It" — copy a real catalog package's content into a draft-shaped
// payload the builder form can merge in directly. Deliberately leaves out
// anything traveller/query-specific (travelDate, adults/children/infants,
// pricing, flight/train inclusion, status) — those belong to the actual
// lead, not the catalog package, so copying-in shouldn't overwrite them.
// ─────────────────────────────────────────────────────────────────────────────

export interface PackageCopyPayload {
  /** The custom package this was duplicated from, when it was — so the stay
   * options can be cloned once the duplicate has an id of its own. Absent for
   * a catalog template, which has no stay options to carry. See
   * cloneStayOptionsInto. */
  sourceCustomPackageId?: string;
  title:         string;
  description:   string;
  coverImage:    string;
  destination:   string;
  startingPoint: string;
  totalDays:     number;
  totalNights:   number;
  /** Optional — the catalog "Use Template" flow always sets these (they're
   * the whole point of picking a template), but duplicateCustomPackageIntoDraft
   * below deliberately omits them: a custom package's inclusions/exclusions
   * are always re-sourced live from itinerary_settings on the next save
   * regardless (see saveCustomPackage), so setting them here would only be a
   * momentary, ultimately-overwritten flash — omitting the key entirely lets
   * the builder's existing "Load itinerary settings" effect keep owning them
   * uncontested, exactly as it does for a brand-new blank draft. */
  inclusions?:    string[];
  exclusions?:    string[];
  termsNotes:    string;
  stops:         StopInput[];
  itineraries:   DayItinerary[];
  /** Present only when duplicating an existing custom package (see
   * duplicateCustomPackageIntoDraft) — the catalog "Use Template" flow has
   * no equivalent source data for these, so they're optional here rather
   * than teaching that flow to fake them. */
  coverImagePosition?: number;
  /** String, matching PackageForm's input-bound field type — not the raw
   * Prisma Float. */
  marginPercentage?:   string;
  gstPercentage?:      string;
  extraPolicyItems?:   ExtraPolicyItems;
  tickets?:            TicketInput[];
  addOns?:             AddonInput[];
  flightsIncluded?: boolean; flightNotes?: string; flightFrom?: string; flightTo?: string;
  trainIncluded?:   boolean; trainNotes?: string;  trainFrom?: string;  trainTo?: string;
}

export async function copyPackageIntoDraft(
  packageSlug:  string,
  durationSlug: string,
  routeSlug:    string,
  staySlug:     string,
): Promise<PackageCopyPayload | null> {
  // includeInactive: this copies an admin-catalog package's content into a
  // sales exec's draft — a package the admin has switched off for the public
  // site (see CreatePackageDialog/searchPackageLibraryForTemplate) is still
  // a perfectly valid template to reuse internally, it just shouldn't be
  // reachable on the live site.
  // allowMissingStay: a package with no stay categories configured at all
  // (a real data gap on several catalog packages, e.g. most Jammu & Kashmir
  // ones) has no hotel/pricing to key off, but its route/itinerary/
  // activities/policies are still perfectly valid to copy — previously this
  // returned null here, so "Use Template" silently produced a completely
  // empty draft with no error shown (see CreatePackageDialog/UsePackageDialog).
  const data = await fetchPackagePageData(packageSlug, durationSlug, routeSlug, staySlug, { includeInactive: true, allowMissingStay: true });
  if (!data) return null;

  const stops: StopInput[] = (data.selectedRoute?.stops ?? []).map((s) => ({
    name:   s.place_name,
    nights: s.stay_days,
  }));

  // fetchPackagePageData (shared with the public website) doesn't expose the
  // raw hotel_room_pricing id, so it's looked up separately here — lets a
  // copied template count toward auto-computed pricing immediately, instead
  // of requiring the exec to re-pick every room via search first.
  const roomPricingByDay = new Map<number, number>();
  if (data.selectedRoute && data.selectedStay) {
    const stayRows = await db.package_itineraries.findMany({
      where: {
        package_id: data.id,
        duration_id: data.currentDuration.id,
        route_id: data.selectedRoute.id,
      },
      select: {
        day: true,
        itineraryStays: {
          where: { stay_category_id: data.selectedStay.id },
          select: { room_pricing_id: true },
        },
      },
    });
    for (const row of stayRows) {
      const roomPricingId = row.itineraryStays[0]?.room_pricing_id;
      if (roomPricingId != null) roomPricingByDay.set(row.day, roomPricingId);
    }
  }

  // Star category for each copied day, off the same hotels.stay_type a manual
  // pick snapshots (see HotelRoomResult.starRating). The catalog day's own
  // denormalised hotel shape doesn't carry it, so it's resolved through the
  // room-pricing ids already gathered above — without this the copy wrote an
  // empty rating and every day of a copied package rendered with no stars,
  // even though the hotel behind it has one.
  const starRatingByDay = new Map<number, string>();
  if (roomPricingByDay.size > 0) {
    const priced = await db.hotel_room_pricing.findMany({
      where: { id: { in: [...new Set(roomPricingByDay.values())] } },
      select: { id: true, hotel: { select: { stay_type: true } } },
    });
    const starByPricingId = new Map(
      priced.map((r) => [r.id, r.hotel?.stay_type ?? ""] as const),
    );
    for (const [day, pricingId] of roomPricingByDay) {
      const stars = starByPricingId.get(pricingId);
      if (stars) starRatingByDay.set(day, stars);
    }
  }

  const itineraries: DayItinerary[] = data.itinerary.map((day) => {
    const transfer = day.transfers[0];

    const rawHotelPhoto = day.hotel?.images?.[0]?.thumbnail ?? day.hotel?.images?.[0]?.url ?? null;
    const rawRoomPhotos = (day.hotel?.room_images ?? [])
      .slice(0, 3)
      .map((img) => img.thumbnail ?? img.url)
      .filter((u): u is string => !!u);
    const roomSpecs = [
      day.hotel?.room_bed_type,
      day.hotel?.room_view,
      day.hotel?.room_area_sqft ? `${day.hotel.room_area_sqft} sq.ft` : null,
    ].filter(Boolean).join(" | ");

    return {
      day:                day.day,
      title:              day.title,
      description:        day.description ?? "",
      activities:         day.activities.map((a) => {
        const rawPhotos = (a.images ?? []).slice(0, 3);
        const photos = rawPhotos
          .map((img) => (img.thumbnail ?? img.url ? getThumbnailImage((img.thumbnail ?? img.url)!) : null))
          .filter((u): u is string => !!u);
        const photoLabels = rawPhotos.map((img) => img.label ?? "");
        return {
          title:       a.name,
          description: a.description ?? "",
          photo:       photos[0] ?? "",
          photos,
          photoLabels,
        };
      }),
      // Prefer the hotel's actual covered meals over the catalog day's
      // manually-added meal keys, when the hotel has them — same source of
      // truth the live builder search now uses.
      meals: day.hotel?.active_meals && day.hotel.active_meals.length > 0
        ? day.hotel.active_meals.map((k) => MEAL_KEY_LABELS[k] ?? k)
        : day.meals,
      accommodation:      day.hotel ? [day.hotel.name, day.hotel.room_name].filter(Boolean).join(" — ") : "",
      accommodationPhoto: rawHotelPhoto ? getThumbnailImage(rawHotelPhoto) : "",
      accommodationRoomPhotos: rawRoomPhotos.map((u) => getThumbnailImage(u)),
      accommodationLocation: day.hotel?.location ?? "",
      accommodationRoomSpecs: roomSpecs,
      accommodationStarRating: starRatingByDay.get(day.day) ?? "",
      accommodationRoomCapacity: day.hotel?.room_capacity ?? null,
      roomPricingId:      roomPricingByDay.get(day.day) ?? null,
      hotelCheckIn:       day.hotel?.check_in_time ?? "",
      hotelCheckOut:      day.hotel?.check_out_time ?? "",
      hotelMealPlan:      day.hotel?.plan_name ?? day.hotel?.meal_type ?? "",
      hotelPending:       false,
      hotelPendingNote:   "",
      manualHotelPricePerNight: null,
      hotelFilledAt:      null,
      hotelFilledByName:  null,
      hotelFillNote:      null,
      transport:          transfer?.vehicle_name ?? "",
      transportPhoto:     transfer?.vehicle_image_key ? getThumbnailImage(transfer.vehicle_image_key) : "",
      transportVehicleType: transfer?.vehicle_type ?? "",
      transportSeats:     transfer?.vehicle_capacity ?? null,
      transportPickup:    transfer?.pickup_name ?? "",
      // fetchPackagePageData doesn't expose the transfer route's raw lat/lng —
      // left null on copy, same as roomPricingId used to be; the exec can
      // re-pick the pickup point via the location search to back-fill it.
      transportPickupLat: null,
      transportPickupLng: null,
      transportDrop:      transfer?.drop_name ?? "",
      transportDropLat:   null,
      transportDropLng:   null,
      transportDistanceKm: transfer?.distance_km ?? null,
      // The catalog itinerary_transfers model has no travel-time field to
      // copy from — left blank, same as the other transfer fields noted above.
      transportTravelTime: "",
      // fetchPackagePageData doesn't expose the transfer's raw cab_pricing id
      // either — left null on copy, same as transportPickupLat/Lng; the exec
      // can re-pick the cab via search to back-fill it for auto-pricing.
      cabPricingId:       null,
      notes:              day.notes.map((n) => n.message).join(" "),
    };
  });

  const termsNotes = data.policies
    .map((p) => `${p.title}:\n${p.points.map((pt) => `• ${pt}`).join("\n")}`)
    .join("\n\n");

  const rawCover = data.thumbnail ?? data.images[0]?.url ?? "";

  return {
    title:         data.title,
    description:   data.description ?? "",
    coverImage:    rawCover ? getHeroImage(rawCover) : "",
    destination:   stops.length > 0 ? stops.map((s) => s.name).join(", ") : data.destination.name,
    startingPoint: "",
    totalDays:     data.currentDuration.days,
    totalNights:   data.currentDuration.nights,
    inclusions:    data.inclusions,
    exclusions:    data.exclusions,
    termsNotes,
    stops,
    itineraries,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// "Copy previous package" — duplicate an already-built CUSTOM package (e.g.
// the query's first package) into a fresh draft, for when an exec needs a
// second budget option/variant for the same client instead of rebuilding the
// whole itinerary by hand. Unlike copyPackageIntoDraft above (which extracts
// generic template content from a public catalog package), this is a real
// duplicate — hotel/cab selections, tickets, add-ons, margin/GST and
// policy additions all come across, since it's copying one exec's own work,
// not adapting a catalog listing. Explicitly NOT carried over: identity
// (ids — every row must be a fresh insert), pricing totals (recomputed
// fresh for the new draft), and anything tied to the SOURCE package's own
// review/fulfillment history (hotelFilledAt/By, hotelPriceOverride/
// cabPriceOverride) — those describe events that happened to that package,
// not this one.
// ─────────────────────────────────────────────────────────────────────────────

export async function duplicateCustomPackageIntoDraft(sourcePackageId: string): Promise<PackageCopyPayload | null> {
  const cp = await db.custom_packages.findUnique({
    where: { id: sourcePackageId },
    select: {
      title: true, description: true, coverImage: true, coverImagePosition: true,
      destination: true, startingPoint: true, totalDays: true, totalNights: true,
      marginPercentage: true, gstPercentage: true, termsNotes: true, extraPolicyItems: true,
      discountType: true, discountValue: true, discountNote: true,
      flightsIncluded: true, flightNotes: true, flightFrom: true, flightTo: true,
      trainIncluded: true, trainNotes: true, trainFrom: true, trainTo: true,
      stops: { orderBy: { sortOrder: "asc" }, select: { name: true, nights: true, image: true } },
      tickets: {
        orderBy: { sortOrder: "asc" },
        select: {
          id: true, type: true, provider: true, ticketNumber: true,
          fromPlace: true, toPlace: true, travelDate: true,
          departureTime: true, arrivalTime: true, durationText: true,
          adults: true, children: true, infants: true,
          ticketCount: true, fare: true, notes: true,
        },
      },
      addOns: {
        orderBy: { sortOrder: "asc" },
        select: { id: true, name: true, price: true, quantity: true, notes: true, day: true },
      },
      itineraries: {
        orderBy: { day: "asc" },
        select: {
          id: true, day: true, title: true, description: true, meals: true,
          accommodation: true, accommodationPhoto: true, accommodationRoomPhotos: true,
          accommodationLocation: true, accommodationRoomSpecs: true, accommodationStarRating: true,
          accommodationRoomCapacity: true,
          accommodationMaxAdults: true, accommodationMaxChildren: true, accommodationExtraBedCapacity: true,
          manualExtraBeds: true,
          roomPricingId: true, roomsCount: true, extraRooms: true,
          hotelCheckIn: true, hotelCheckOut: true, hotelMealPlan: true,
          hotelPending: true, hotelPendingNote: true, hotelRequestType: true, manualHotelPricePerNight: true, manualExtraBedRate: true,
          hotelFilledAt: true, hotelFilledByName: true, hotelFillNote: true,
          hotelRejectedAt: true, hotelRejectedByName: true, hotelRejectionNote: true,
          hotelPriceOverride: true, cabPriceOverride: true,
          transport: true, transportPhoto: true, transportVehicleType: true,
          transportSeats: true, transportPickup: true,
          transportPickupLat: true, transportPickupLng: true,
          transportDropLat: true, transportDropLng: true,
          transportDrop: true, transportDistanceKm: true, transportTravelTime: true,
          cabPricingId: true, cabQuantity: true, extraCabs: true, notes: true, notesType: true, notesTitle: true,
          activities: {
            orderBy: { sortOrder: "asc" },
            select: { id: true, title: true, description: true, photo: true, photos: true, photoLabels: true },
          },
        },
      },
    },
  });
  if (!cp) return null;

  const stops: StopInput[] = cp.stops.map((s) => ({ name: s.name, nights: s.nights, image: s.image ?? undefined }));

  const itineraries: DayItinerary[] = cp.itineraries.map((it) => {
    const n = normalizeItinerary(it);
    return {
      day: n.day, title: n.title, description: n.description, meals: n.meals,
      activities: n.activities.map((a) => ({
        title: a.title, description: a.description, photo: a.photo, photos: a.photos, photoLabels: a.photoLabels,
      })),
      accommodation: n.accommodation, accommodationPhoto: n.accommodationPhoto,
      accommodationRoomPhotos: n.accommodationRoomPhotos, accommodationLocation: n.accommodationLocation,
      accommodationRoomSpecs: n.accommodationRoomSpecs, accommodationStarRating: n.accommodationStarRating,
      accommodationRoomCapacity: n.accommodationRoomCapacity,
      accommodationMaxAdults: n.accommodationMaxAdults, accommodationMaxChildren: n.accommodationMaxChildren,
      accommodationExtraBedCapacity: n.accommodationExtraBedCapacity, manualExtraBeds: n.manualExtraBeds,
      roomPricingId: n.roomPricingId, roomsCount: n.roomsCount, extraRooms: n.extraRooms,
      hotelCheckIn: n.hotelCheckIn, hotelCheckOut: n.hotelCheckOut, hotelMealPlan: n.hotelMealPlan,
      hotelPending: n.hotelPending, hotelPendingNote: n.hotelPendingNote,
      manualHotelPricePerNight: n.manualHotelPricePerNight,
      manualExtraBedRate: n.manualExtraBedRate,
      hotelFilledAt: null, hotelFilledByName: null, hotelFillNote: null,
      hotelRejectedAt: null, hotelRejectedByName: null, hotelRejectionNote: null,
      hotelPriceOverride: null, cabPriceOverride: null,
      transport: n.transport, transportPhoto: n.transportPhoto, transportVehicleType: n.transportVehicleType,
      transportSeats: n.transportSeats, transportPickup: n.transportPickup,
      transportPickupLat: n.transportPickupLat, transportPickupLng: n.transportPickupLng,
      transportDropLat: n.transportDropLat, transportDropLng: n.transportDropLng,
      transportDrop: n.transportDrop, transportDistanceKm: n.transportDistanceKm, transportTravelTime: n.transportTravelTime,
      cabPricingId: n.cabPricingId, cabQuantity: n.cabQuantity, extraCabs: n.extraCabs, notes: n.notes, notesType: n.notesType, notesTitle: n.notesTitle,
    };
  });

  const tickets: TicketInput[] = cp.tickets.map((t) => {
    const n = normalizeTicket(t);
    return {
      type: n.type, provider: n.provider, ticketNumber: n.ticketNumber,
      fromPlace: n.fromPlace, toPlace: n.toPlace, travelDate: n.travelDate,
      departureTime: n.departureTime, arrivalTime: n.arrivalTime, durationText: n.durationText,
      adults: n.adults, children: n.children, infants: n.infants,
      ticketCount: n.ticketCount, fare: n.fare, notes: n.notes,
    };
  });

  const addOns: AddonInput[] = cp.addOns.map((a) => {
    const n = normalizeAddon(a);
    return { name: n.name, price: n.price, quantity: n.quantity, notes: n.notes, day: n.day };
  });

  return {
    // Carried so the duplicate can clone the source's stay options once it has
    // an id of its own — the payload itself only describes the day rows, which
    // hold the recommended option and nothing else.
    sourceCustomPackageId: sourcePackageId,
    title:         `${cp.title} (Copy)`,
    description:   cp.description ?? "",
    coverImage:    cp.coverImage ?? "",
    coverImagePosition: cp.coverImagePosition,
    destination:   cp.destination,
    startingPoint: cp.startingPoint ?? "",
    totalDays:     cp.totalDays,
    totalNights:   cp.totalNights,
    termsNotes:    cp.termsNotes ?? "",
    stops,
    itineraries,
    marginPercentage: String(cp.marginPercentage),
    gstPercentage:    String(cp.gstPercentage),
    extraPolicyItems: normalizeExtraPolicyItems(cp.extraPolicyItems),
    tickets,
    addOns,
    flightsIncluded: cp.flightsIncluded, flightNotes: cp.flightNotes ?? "", flightFrom: cp.flightFrom ?? "", flightTo: cp.flightTo ?? "",
    trainIncluded:   cp.trainIncluded,   trainNotes: cp.trainNotes ?? "",   trainFrom: cp.trainFrom ?? "",   trainTo: cp.trainTo ?? "",
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. List all IN_PROGRESS queries pending package creation
// ─────────────────────────────────────────────────────────────────────────────
export async function getPackageBuilderQueries({
  page    = 1,
  size    = 20,
  search  = "",
}: {
  page?:   number;
  size?:   number;
  search?: string;
}): Promise<PaginatedQueries> {
  const safeSize = Math.min(size, 50);
  const skip     = (page - 1) * safeSize;

  const searchFilter = search
    ? {
        OR: [
          { name:        { contains: search, mode: "insensitive" as const } },
          { destination: { contains: search, mode: "insensitive" as const } },
          { phone:       { contains: search } },
        ],
      }
    : {};

  const where = {
    status: "IN_PROGRESS" as const,
    ...searchFilter,
  };

  const [total, queries] = await Promise.all([
    db.package_queries.count({ where }),
    db.package_queries.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip,
      take: safeSize,
      select: {
        id:             true,
        name:           true,
        phone:          true,
        countryCode:    true,
        email:          true,
        destination:    true,
        travelDate:     true,
        groupSize:      true,
        assignedToName: true,
        assignedAt:     true,
        updatedAt:      true,
        requirements:   true,
        status:         true,
        packageUrl:     true,
        custom_packages: {
          orderBy: { createdAt: "desc" },
          select: { id: true, title: true, status: true },
        },
      },
    }),
  ]);

  return {
    queries: queries.map(({ custom_packages, ...q }) => ({ ...q, customPackages: custom_packages })) as unknown as QueryRow[],
    total,
    page,
    totalPages: Math.ceil(total / safeSize),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Look up a destination's catalog cover photo by name (exact, then fuzzy),
//    so a new package can default to a real photo instead of a blank header.
// ─────────────────────────────────────────────────────────────────────────────
export async function getDestinationCoverImage(destinationName: string): Promise<string | null> {
  const name = destinationName.split(",")[0]?.trim();
  if (!name) return null;

  const destination =
    (await db.destinations.findFirst({
      where: { name: { equals: name, mode: "insensitive" } },
      select: { cover_image: true, thumbnail: true },
    })) ??
    (await db.destinations.findFirst({
      where: { name: { contains: name, mode: "insensitive" } },
      select: { cover_image: true, thumbnail: true },
    }));

  const raw = destination?.cover_image ?? destination?.thumbnail ?? null;
  return raw ? getHeroImage(raw) : null;
}

// ─────────────────────────────────────────────────────────────────────────────
// DB rows store these text/array fields as nullable (`String?`, default-empty
// arrays aside), so a day/activity saved without every field filled in comes
// back from Prisma as `null` — normalize to the DayItinerary/ActivityInput
// contract's non-null defaults here, once, instead of every consumer having
// to guard against a `string | null` mismatch with its own type.
// ─────────────────────────────────────────────────────────────────────────────
function normalizeActivity(a: {
  id: string; title: string; description: string | null;
  photo: string | null; photos: string[]; photoLabels: string[];
}): ActivityInput {
  return {
    id:          a.id,
    title:       a.title ?? "",
    description: a.description ?? "",
    photo:       a.photo ?? "",
    photos:      a.photos ?? [],
    photoLabels: a.photoLabels ?? [],
  };
}

function normalizeItinerary(it: {
  id: string; day: number; title: string; description: string | null; meals: string[];
  accommodation: string | null; accommodationPhoto: string | null; accommodationRoomPhotos: string[];
  accommodationLocation: string | null; accommodationRoomSpecs: string | null;
  accommodationStarRating: string | null; accommodationRoomCapacity: number | null;
  accommodationMaxAdults: number | null; accommodationMaxChildren: number | null; accommodationExtraBedCapacity: number | null;
  manualExtraBeds: number | null;
  roomPricingId: number | null;
  roomsCount: number | null;
  extraRooms: Prisma.JsonValue;
  hotelCheckIn: string | null; hotelCheckOut: string | null; hotelMealPlan: string | null;
  hotelPending: boolean; hotelPendingNote: string | null; hotelRequestType: string | null;
  manualHotelPricePerNight: number | null;
  manualExtraBedRate: number | null;
  hotelFilledAt: Date | null; hotelFilledByName: string | null; hotelFillNote: string | null;
  hotelRejectedAt: Date | null; hotelRejectedByName: string | null; hotelRejectionNote: string | null;
  hotelPriceOverride: number | null; cabPriceOverride: number | null;
  transport: string | null; transportPhoto: string | null; transportVehicleType: string | null;
  transportSeats: number | null; transportPickup: string | null;
  transportPickupLat: number | null; transportPickupLng: number | null;
  transportDropLat: number | null; transportDropLng: number | null;
  transportDrop: string | null;
  transportDistanceKm: number | null; transportTravelTime: string | null; notes: string | null; notesType: string | null; notesTitle: string | null;
  cabPricingId: number | null;
  cabQuantity: number | null;
  extraCabs: Prisma.JsonValue;
  activities: Parameters<typeof normalizeActivity>[0][];
}): DayItinerary {
  return {
    id:                        it.id,
    day:                       it.day,
    title:                     it.title ?? "",
    description:               it.description ?? "",
    activities:                it.activities.map(normalizeActivity),
    meals:                     it.meals ?? [],
    accommodation:             it.accommodation ?? "",
    accommodationPhoto:        it.accommodationPhoto ?? "",
    accommodationRoomPhotos:   it.accommodationRoomPhotos ?? [],
    accommodationLocation:     it.accommodationLocation ?? "",
    accommodationRoomSpecs:    it.accommodationRoomSpecs ?? "",
    accommodationStarRating:   it.accommodationStarRating ?? "",
    accommodationRoomCapacity: it.accommodationRoomCapacity ?? null,
    accommodationMaxAdults:    it.accommodationMaxAdults ?? null,
    accommodationMaxChildren:  it.accommodationMaxChildren ?? null,
    accommodationExtraBedCapacity: it.accommodationExtraBedCapacity ?? null,
    manualExtraBeds:           it.manualExtraBeds ?? null,
    roomPricingId:             it.roomPricingId ?? null,
    roomsCount:                it.roomsCount ?? null,
    extraRooms:                parseRoomSelections(it.extraRooms),
    hotelCheckIn:              it.hotelCheckIn ?? "",
    hotelCheckOut:             it.hotelCheckOut ?? "",
    hotelMealPlan:             it.hotelMealPlan ?? "",
    hotelPending:              it.hotelPending,
    hotelPendingNote:          it.hotelPendingNote ?? "",
    hotelRequestType:          it.hotelRequestType ?? null,
    manualHotelPricePerNight:  it.manualHotelPricePerNight ?? null,
    manualExtraBedRate:        it.manualExtraBedRate ?? null,
    hotelFilledAt:             it.hotelFilledAt,
    hotelFilledByName:         it.hotelFilledByName,
    hotelFillNote:             it.hotelFillNote,
    hotelRejectedAt:           it.hotelRejectedAt,
    hotelRejectedByName:       it.hotelRejectedByName,
    hotelRejectionNote:        it.hotelRejectionNote,
    hotelPriceOverride:        it.hotelPriceOverride ?? null,
    cabPriceOverride:          it.cabPriceOverride ?? null,
    transport:                 it.transport ?? "",
    transportPhoto:            it.transportPhoto ?? "",
    transportVehicleType:      it.transportVehicleType ?? "",
    transportSeats:            it.transportSeats ?? null,
    transportPickup:           it.transportPickup ?? "",
    transportPickupLat:        it.transportPickupLat ?? null,
    transportDropLat:          it.transportDropLat ?? null,
    transportDropLng:          it.transportDropLng ?? null,
    transportPickupLng:        it.transportPickupLng ?? null,
    transportDrop:             it.transportDrop ?? "",
    transportDistanceKm:       it.transportDistanceKm ?? null,
    transportTravelTime:       it.transportTravelTime ?? "",
    cabPricingId:              it.cabPricingId ?? null,
    cabQuantity:               it.cabQuantity ?? null,
    extraCabs:                 parseCabSelections(it.extraCabs),
    notes:                     it.notes ?? "",
    notesType:                 it.notesType ?? null,
    notesTitle:                it.notesTitle ?? null,
  };
}

function normalizeTicket(t: {
  id: string; type: "FLIGHT" | "TRAIN" | "HELICOPTER" | "BUS" | "OTHER"; provider: string | null; ticketNumber: string | null;
  fromPlace: string | null; toPlace: string | null; travelDate: Date | null;
  departureTime: string | null; arrivalTime: string | null; durationText: string | null;
  adults: number; children: number; infants: number; ticketCount: number;
  fare: number | null; notes: string | null;
}): TicketInput {
  return {
    id:            t.id,
    type:          t.type,
    provider:      t.provider ?? "",
    ticketNumber:  t.ticketNumber ?? "",
    fromPlace:     t.fromPlace ?? "",
    toPlace:       t.toPlace ?? "",
    travelDate:    t.travelDate ? t.travelDate.toISOString().slice(0, 10) : "",
    departureTime: t.departureTime ?? "",
    arrivalTime:   t.arrivalTime ?? "",
    durationText:  t.durationText ?? "",
    adults:        t.adults,
    children:      t.children,
    infants:       t.infants,
    ticketCount:   t.ticketCount,
    fare:          t.fare ?? null,
    notes:         t.notes ?? "",
  };
}

function normalizeAddon(a: {
  id: string; name: string; price: number | null; quantity: number; notes: string | null; day: number | null;
}): AddonInput {
  return {
    id:       a.id,
    name:     a.name,
    price:    a.price ?? null,
    quantity: a.quantity,
    notes:    a.notes ?? "",
    day:      a.day ?? null,
  };
}

const QUERY_LEAD_SELECT = {
  id:             true,
  name:           true,
  phone:          true,
  countryCode:    true,
  email:          true,
  destination:    true,
  travelDate:     true,
  groupSize:      true,
  assignedTo:     true,
  assignedToName: true,
  assignedAt:     true,
  createdAt:      true,
  updatedAt:      true,
  requirements:   true,
  status:         true,
  message:        true,
  packageUrl:     true,
} as const;

// package_queries.assignedTo is a plain string (no FK relation defined), so
// the exec's contact details always need a separate lookup.
async function resolveExecInfo(assignedTo: string | null) {
  const exec = assignedTo
    ? await db.teamMember.findUnique({
        where:  { id: assignedTo },
        select: { email: true, designation: true },
      })
    : null;
  return { execEmail: exec?.email ?? null, execDesignation: exec?.designation ?? null };
}

// ─────────────────────────────────────────────────────────────────────────────
// 3a. Get a package by its own id — the builder's primary loader. A query can
// now have several packages built for it, and a package can exist with no
// linked query at all, so the package row (not the query) is the anchor.
// Returns null only when this id genuinely doesn't exist yet — the builder
// treats that as "brand new, unsaved" rather than an error (see
// getQueryLeadInfo below, used to prefill that brand-new draft).
// ─────────────────────────────────────────────────────────────────────────────
export async function getPackageDetail(packageId: string): Promise<QueryDetail | null> {
  // Staff only. This returns the whole internal picture of a package — costing's
  // rejection notes, the pricing snapshot, the lead's name, phone and email —
  // and every export in a "use server" file is a callable endpoint, so without
  // this it handed all of that to anyone who knew a package id. Every caller is
  // a dashboard screen; nothing public reads it.
  //
  // Null rather than a throw, matching the not-found path each caller already
  // handles.
  const viewer = await getEffectiveMember();
  if (!viewer?.member?.id) return null;

  const pkg = await db.custom_packages.findUnique({
    where: { id: packageId },
    select: {
      id:              true,
      queryId:         true,
      status:          true,
      sentAt:          true,
      readyAt:         true,
      readyByName:     true,
      verified:        true,
      verifiedAt:      true,
      verifiedByName:  true,
      rejectedAt:      true,
      rejectedByName:  true,
      rejectionNote:   true,
      rejectionReason: { select: { label: true } },
      revisionRequestedAt:     true,
      revisionRequestedByName: true,
      revisionNote:            true,
      viewedAt:        true,
      viewCount:       true,
      previousSnapshot: true,
      title:           true,
      description:     true,
      coverImage:      true,
      coverImagePosition: true,
      totalDays:       true,
      totalNights:     true,
      travelDate:      true,
      adults:          true,
      children:        true,
      infants:         true,
      childrenAges:    true,
      infantAges:      true,
      pricePerPerson:  true,
      totalPrice:      true,
      marginPercentage: true,
      discountType: true, discountValue: true, discountNote: true,
      gstPercentage:    true,
      inclusions:      true,
      exclusions:      true,
      removedInclusions: true,
      removedExclusions: true,
      termsNotes:      true,
      termsConditions: true,
      paymentPolicy:   true,
      amendmentPolicy: true,
      travelBenefits:  true,
      extraPolicyItems: true,
      pricingSnapshot: true,
      // Only the names, and only so a builder that cannot edit them can say
      // so — v1 has no stay-option UI and writes the day row, which carries
      // the recommended option alone. See the notice in v1's page.
      stayOptions: {
        orderBy: { sortOrder: "asc" },
        select: { label: true, isRecommended: true },
      },
      stops: {
        orderBy: { sortOrder: "asc" },
        select: { id: true, name: true, nights: true, image: true },
      },
      tickets: {
        orderBy: { sortOrder: "asc" },
        select: {
          id: true, type: true, provider: true, ticketNumber: true,
          fromPlace: true, toPlace: true, travelDate: true,
          departureTime: true, arrivalTime: true, durationText: true,
          adults: true, children: true, infants: true,
          ticketCount: true, fare: true, notes: true,
        },
      },
      addOns: {
        orderBy: { sortOrder: "asc" },
        select: { id: true, name: true, price: true, quantity: true, notes: true, day: true },
      },
      itineraries: {
        orderBy: { day: "asc" },
        select: {
          id:                 true,
          day:                true,
          title:              true,
          description:        true,
          meals:              true,
          accommodation:      true,
          accommodationPhoto: true,
          accommodationRoomPhotos: true,
          accommodationLocation: true,
          accommodationRoomSpecs: true,
          accommodationStarRating: true,
          accommodationRoomCapacity: true,
          accommodationMaxAdults: true,
          accommodationMaxChildren: true,
          accommodationExtraBedCapacity: true,
          manualExtraBeds:    true,
          roomPricingId:      true,
          roomsCount:         true,
          extraRooms:         true,
          hotelCheckIn:       true,
          hotelCheckOut:      true,
          hotelMealPlan:      true,
          hotelPending:       true,
          hotelPendingNote:   true,
          hotelRequestType:   true,
          manualHotelPricePerNight: true,
          manualExtraBedRate: true,
          hotelFilledAt:      true,
          hotelFilledByName:  true,
          hotelFillNote:      true,
          hotelRejectedAt:    true,
          hotelRejectedByName: true,
          hotelRejectionNote: true,
          hotelPriceOverride: true,
          cabPriceOverride:   true,
          transport:          true,
          transportPhoto:     true,
          transportVehicleType: true,
          transportSeats:     true,
          transportPickup:    true,
          transportPickupLat: true,
          transportDropLat:   true,
          transportDropLng:   true,
          transportPickupLng: true,
          transportDrop:      true,
          transportDistanceKm: true,
          transportTravelTime: true,
          cabPricingId:       true,
          cabQuantity:        true,
          extraCabs:          true,
          notes:              true,
          notesType:          true,
          notesTitle:         true,
          activities: {
            orderBy: { sortOrder: "asc" },
            select: { id: true, title: true, description: true, photo: true, photos: true, photoLabels: true },
          },
        },
      },
      query: { select: QUERY_LEAD_SELECT },
    },
  });

  if (!pkg) return null;

  const { query, itineraries, tickets, addOns, ...pkgRest } = pkg;
  const { execEmail, execDesignation } = await resolveExecInfo(query?.assignedTo ?? null);

  return {
    id:             query?.id ?? null,
    name:           query?.name ?? null,
    phone:          query?.phone ?? null,
    countryCode:    query?.countryCode ?? null,
    email:          query?.email ?? null,
    destination:    query?.destination ?? null,
    travelDate:     query?.travelDate ?? null,
    groupSize:      query?.groupSize ?? null,
    assignedToName: query?.assignedToName ?? null,
    assignedAt:     query?.assignedAt ?? null,
    createdAt:      query?.createdAt ?? null,
    updatedAt:      query?.updatedAt ?? null,
    requirements:   query?.requirements ?? null,
    status:         query?.status ?? null,
    message:        query?.message ?? null,
    packageUrl:     query?.packageUrl ?? null,
    execEmail,
    execDesignation,
    customPackage: {
      ...pkgRest,
      stops: pkgRest.stops.map((s) => ({ ...s, image: s.image ?? undefined })),
      itineraries: itineraries.map(normalizeItinerary),
      tickets: tickets.map(normalizeTicket),
      addOns: addOns.map(normalizeAddon),
      extraPolicyItems: normalizeExtraPolicyItems(pkgRest.extraPolicyItems),
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 3b. Lead-only lookup — used to prefill a brand-new (not-yet-saved) package
// that's being started from a query, before the first Save creates the real
// custom_packages row. Never carries any existing package data (a query can
// have several; picking one here would be arbitrary).
// ─────────────────────────────────────────────────────────────────────────────
export async function getQueryLeadInfo(queryId: string): Promise<QueryDetail | null> {
  const query = await db.package_queries.findUnique({
    where:  { id: queryId },
    select: QUERY_LEAD_SELECT,
  });
  if (!query) return null;

  const { execEmail, execDesignation } = await resolveExecInfo(query.assignedTo);

  return {
    ...query,
    execEmail,
    execDesignation,
    customPackage: null,
  };
}

/** Every package built for the same query as this one, newest first.
 *
 * A query can carry more than one package — an exec duplicates a draft to
 * quote the same trip a second way, and both are real, sendable quotes. The
 * sales-query row only ever links one of them (whichever needs attention,
 * else the newest), so once you are inside a builder the other one is
 * unreachable without going back out and opening the query's detail sheet.
 * This is what the header switcher reads so it never gets that far.
 *
 * Returns the current package too — the switcher marks it rather than hiding
 * it, so "1 of 2" is legible without counting.
 *
 * Access follows the same rule as the rest of the workspace: ownership runs
 * through the query, so a sibling built by a colleague on a lead assigned to
 * you is yours to see. Costing sees all of them, since a review covers
 * whatever the exec sent. A package with no query has no siblings by
 * definition and returns just itself.
 */
export type SiblingPackage = {
  id: string;
  title: string;
  status: string;
  createdAt: Date;
  verified: boolean;
  rejectedAt: Date | null;
  sentAt: Date | null;
  pricePerPerson: number | null;
  builtByName: string | null;
  isCurrent: boolean;
};

export async function getSiblingPackages(packageId: string): Promise<SiblingPackage[]> {
  const viewer = await getEffectiveMember();
  if (!viewer?.member?.id) return [];

  const current = await db.custom_packages.findUnique({
    where:  { id: packageId },
    select: { id: true, queryId: true },
  });
  if (!current) return [];
  if (!current.queryId) return [];

  const query = await db.package_queries.findUnique({
    where:  { id: current.queryId },
    select: {
      assignedTo:      true,
      custom_packages: {
        select: {
          id: true, title: true, status: true, createdAt: true, verified: true,
          rejectedAt: true, sentAt: true, pricePerPerson: true,
          builtBy: true, builtByName: true,
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });
  if (!query) return [];

  const role = workspaceRoleOf(viewer.member?.teamRole?.name);
  const rows = query.custom_packages.filter((p) =>
    role === "costing" ||
    p.id === packageId ||
    ownsPackage({
      viewerId:        viewer.member?.id,
      viewerRoleName:  viewer.member?.teamRole?.name,
      builtBy:         p.builtBy,
      queryAssignedTo: query.assignedTo,
    }),
  );

  // One package is not a choice, and a lone entry in a switcher reads as a
  // menu that failed to load. The caller renders nothing for this.
  if (rows.length < 2) return [];

  return rows.map(({ builtBy: _builtBy, ...p }) => ({
    ...p,
    isCurrent: p.id === packageId,
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Save (create or update) a custom package with itineraries
// ─────────────────────────────────────────────────────────────────────────────
export async function saveCustomPackage(input: PackageInput): Promise<{
  id: string; success: boolean; error?: string;
  /** Day numbers where a hotel-team re-request got blocked because this
   * save's copy of the package predates a fill that happened elsewhere in
   * the meantime — see the staleResurrection guard below. Present only when
   * non-empty; the caller should warn the exec to refresh and retry. */
  staleHotelRequestDays?: number[];
}> {
  try {
    const {
      id, queryId, title, description, coverImage, coverImagePosition, destination, startingPoint,
      totalDays, totalNights, travelDate, adults, children, infants, childrenAges, infantAges,
      pricePerPerson, totalPrice, marginPercentage, gstPercentage, currency,
      discountType, discountValue, discountNote,
      termsNotes, extraPolicyItems,
      stops, itineraries, tickets, addOns,
    } = input;
    // input.status is deliberately never read — see nextStatus below, which
    // is the only thing allowed to decide this row's status on a save.

    // flightsIncluded/flightFrom/... aren't edited directly anymore — they're
    // derived from the ticket list so the map legs (ItineraryMap) and the
    // document's inclusion flags can never drift out of sync with what's
    // actually been priced in on the Tickets tab.
    const {
      flightsIncluded, flightFrom, flightTo, flightNotes,
      trainIncluded, trainFrom, trainTo, trainNotes,
    } = deriveTransportFields(tickets);

    const { teamMemberId, teamMemberName } = await getCurrentActor();
    const builtBy = teamMemberId ?? "unknown";
    const builtByName = teamMemberName ?? "Sales Executive";

    // If a package was already SENT to the client, snapshot what they were
    // actually shown before this save overwrites it — otherwise an exec
    // editing after send has no way to see what changed from the version
    // the customer has in hand.
    let previousSnapshot: Prisma.InputJsonValue | undefined;
    const existing = await db.custom_packages.findUnique({
      where:  { id },
      select: {
        status: true, verified: true, rejectedAt: true, revisionRequestedAt: true,
        builtBy: true, query: { select: { assignedTo: true } },
        title: true, totalDays: true, totalNights: true, travelDate: true,
        adults: true, children: true, infants: true, pricePerPerson: true, totalPrice: true,
        stops: { orderBy: { sortOrder: "asc" }, select: { name: true, nights: true } },
        itineraries: {
          orderBy: { day: "asc" },
          select: {
            day: true, title: true, description: true, meals: true,
            accommodation: true, hotelCheckIn: true, hotelCheckOut: true, hotelMealPlan: true,
            transport: true, transportVehicleType: true, transportPickup: true, transportDrop: true,
            notes: true,
          },
        },
      },
    });
    // A package out for costing review is closed to the person who submitted
    // it — but not to the reviewer, whose entire job happens at READY. This
    // used to reject the status outright, which locked out the one role that
    // is supposed to be writing then: costing could edit every field in the
    // builder and had no way to persist a single one of them.
    //
    // So it asks the same question the editor asks, from the same pure
    // function, rather than inferring it from status: may THIS caller edit
    // THIS package right now. The client already hides what it can, but
    // hiding a control is a courtesy, not a permission — this is the gate
    // against a stale tab, or anything calling the action directly.
    //
    // Deliberately narrowed to READY rather than applied to every save: at
    // DRAFT this stays exactly as permissive as it has always been, so a team
    // role that doesn't map cleanly onto exec/costing (workspaceRoleOf's
    // "other") keeps working the way it does today instead of quietly losing
    // the ability to save.
    const memberCtx = await getEffectiveMember();
    const role = workspaceRoleOf(memberCtx?.member?.teamRole?.name);
    // A package with no row yet is being created by this very call, so the
    // caller owns it — that is the exec arriving with a freshly-generated id.
    const isOwner = existing == null || ownsPackage({
      viewerId: memberCtx?.member?.id,
      viewerRoleName: memberCtx?.member?.teamRole?.name,
      builtBy: existing.builtBy,
      queryAssignedTo: existing.query?.assignedTo,
    });
    const caps = resolveWorkspaceCaps(role, {
      status: existing?.status ?? "DRAFT",
      verified: existing?.verified ?? false,
      rejectedAt: existing?.rejectedAt ?? null,
      revisionRequestedAt: existing?.revisionRequestedAt ?? null,
    }, { isOwner });

    // An exec edits their own work. Applied here rather than through
    // caps.editItinerary because that is false for them on a SENT package,
    // where saving is still allowed on purpose: a client who asks for a change
    // after receiving the itinerary is ordinary, and the save snapshots what
    // they were originally shown (see previousSnapshot below).
    if (role === "exec" && !isOwner) {
      return { id, success: false, error: "This package belongs to another sales exec. Ask them, or a team leader, to make the change." };
    }

    // Costing writes only while the package is actually with them — which now
    // ends at their own approval. After that the exec is holding exactly what
    // was signed off, and changing it would alter the approved package without
    // re-approving it; the way back in is for the exec to request a revision.
    if (role === "costing" && !caps.editItinerary) {
      return {
        id, success: false,
        error: existing?.verified
          ? "You've already approved this package. Ask the sales exec to pull it back for revision if it needs another change."
          : "This package is back with the sales exec — you'll be able to edit it again when they resubmit it for review.",
      };
    }

    // And nobody else writes while it IS with costing. Two people correcting
    // the same element in opposite directions is the thing this prevents.
    if (existing?.status === "READY" && !caps.editItinerary) {
      return { id, success: false, error: "This package is awaiting costing review and can't be edited until it's verified or rejected back to you." };
    }

    // A save edits content. It never moves a package through its workflow —
    // every transition has its own action that records who did it and when:
    // markPackageReady, approve, reject, requestPackageRevision, send.
    //
    // Without this, `status` was whatever the client last put in the payload:
    // costing's autosave would have dropped a package out of the review queue
    // by writing DRAFT over READY, and the exec's Save Draft on an already-SENT
    // package silently un-sent it.
    //
    // It briefly allowed DRAFT → READY, on the reasoning that Mark Ready saves
    // first and then flips the status. It does — but in the other order than
    // that implies: letting the save move it to READY meant markPackageReady's
    // own submit check then ran against a package that was no longer a draft,
    // failed, and left the row at READY with no readyAt. Locked to the exec,
    // and invisible to costing, whose queue is keyed on readyAt.
    //
    // The create branch had the same hole a level up: a brand-new package's
    // very first save can BE the Mark Ready save (duplicate, then submit
    // before anything else autosaves) — `existing` is null there too, so
    // trusting `status` let the row get created at READY directly, with the
    // exact same downstream failure the moment markPackageReady re-fetched
    // it. A new package is always a DRAFT; nothing about creating one is
    // costing's or a reviewer's decision to make.
    const nextStatus = existing == null ? "DRAFT" : existing.status;

    // True while the package is out for review, when the quoted total is
    // costing's to set — through approve and updatePackagePricing, both of
    // which recompute it and record the change. The exec's editor keeps
    // pricePerPerson/totalPrice synced to its own live computation as they
    // build, and that must not overwrite a reviewed figure.
    //
    // Scoped to those two columns only. What we PAY — ticket fares, add-on
    // prices, per-day rates — stays writable here at every status, because
    // caps.editCost gives costing exactly that in the builder.
    const pricingLocked = existing?.status === "READY";

    if (existing?.status === "SENT") {
      previousSnapshot = {
        savedAt:        new Date().toISOString(),
        title:          existing.title,
        totalDays:      existing.totalDays,
        totalNights:    existing.totalNights,
        travelDate:     existing.travelDate?.toISOString() ?? null,
        adults:         existing.adults,
        children:       existing.children,
        infants:        existing.infants,
        pricePerPerson: existing.pricePerPerson,
        totalPrice:     existing.totalPrice,
        stops:          existing.stops,
        itineraries:    existing.itineraries,
      } as unknown as Prisma.InputJsonValue;
    }

    // Inclusions/exclusions/T&C/payment/amendment/benefits are one global
    // set of company-wide content, edited only on /dashboard/itinerary-
    // settings — never trust client input for these, always write the
    // current global values so the row stays in sync with what's shown.
    const itinerarySettings = await getItinerarySettings();
    const effectiveInclusions      = itinerarySettings.inclusions;
    const effectiveExclusions      = itinerarySettings.exclusions;
    const effectiveTermsConditions = itinerarySettings.termsConditions;
    const effectivePaymentPolicy   = itinerarySettings.paymentPolicy;
    const effectiveAmendmentPolicy = itinerarySettings.amendmentPolicy;
    const effectiveTravelBenefits  = itinerarySettings.travelBenefits;
    const effectiveCustomPolicySections = itinerarySettings.customPolicySections as unknown as Prisma.InputJsonValue;
    // Unlike the six lists above, this one DOES trust client input — it's
    // the per-package additions a Sales Executive (or anyone) is meant to
    // be able to add, on top of (never replacing) the standard lists.
    // Normalized defensively since it's untrusted input.
    const effectiveExtraPolicyItems = normalizeExtraPolicyItems(extraPolicyItems) as unknown as Prisma.InputJsonValue;

    // Upsert the custom package (unique on its own id, client-generated on
    // first save — see PackageInput.id — not on queryId, since a query can
    // now have several packages).
    const pkg = await db.custom_packages.upsert({
      where:  { id },
      create: {
        id,
        queryId,
        title,
        description:     description || null,
        coverImage:      coverImage || null,
        coverImagePosition,
        destination,
        startingPoint:   startingPoint || null,
        totalDays,
        totalNights,
        travelDate:      travelDate ? new Date(travelDate) : null,
        adults,
        children,
        infants,
        childrenAges:    childrenAges ?? [],
        infantAges:      infantAges ?? [],
        pricePerPerson:  pricePerPerson ?? null,
        totalPrice:      totalPrice ?? null,
        marginPercentage,
        gstPercentage,
        discountType:  discountType ?? null,
        discountValue: discountValue ?? null,
        discountNote:  discountNote?.trim() || null,
        currency,
        inclusions:      effectiveInclusions,
        exclusions:      effectiveExclusions,
        termsNotes:      termsNotes || null,
        termsConditions: effectiveTermsConditions,
        paymentPolicy:   effectivePaymentPolicy,
        amendmentPolicy: effectiveAmendmentPolicy,
        travelBenefits:  effectiveTravelBenefits,
        customPolicySections: effectiveCustomPolicySections,
        extraPolicyItems: effectiveExtraPolicyItems,
        flightsIncluded,
        flightNotes:     flightNotes || null,
        flightFrom:      flightFrom || null,
        flightTo:        flightTo || null,
        trainIncluded,
        trainNotes:      trainNotes || null,
        trainFrom:       trainFrom || null,
        trainTo:         trainTo || null,
        status:          nextStatus,
        builtBy,
        builtByName:     builtByName || null,
      },
      update: {
        title,
        description:     description || null,
        coverImage:      coverImage || null,
        coverImagePosition,
        destination,
        startingPoint:   startingPoint || null,
        totalDays,
        totalNights,
        travelDate:      travelDate ? new Date(travelDate) : null,
        adults,
        children,
        infants,
        childrenAges:    childrenAges ?? [],
        infantAges:      infantAges ?? [],
        // Margin, GST and the discount are absent from this update on purpose,
        // at every status.
        //
        // They are costing's levers (see workspace-caps: the exec has
        // editMargin: false and cannot even see these numbers), and the one
        // path that writes them — updatePackagePricing — re-checks that
        // capability and records the change. Accepting them here gave the rule
        // a hole on both sides: a crafted payload could set a margin the sender
        // was never allowed to set, and an ordinary save from an editor opened
        // before a correction would post the pre-correction values back over
        // it. With autosave now running for costing, the second one would have
        // happened on a timer, seconds after their own correction, silently.
        //
        // They are still written on `create` below — a new package needs its
        // opening margin and GST from somewhere, and that is the house default
        // the form carries.
        //
        // pricePerPerson/totalPrice stay the exec's while a package is theirs:
        // the builder keeps them synced to the live computation as they work.
        // At READY they are costing's, via updatePackagePricing and approve.
        ...(pricingLocked ? {} : {
          pricePerPerson:  pricePerPerson ?? null,
          totalPrice:      totalPrice ?? null,
        }),
        currency,
        inclusions:      effectiveInclusions,
        exclusions:      effectiveExclusions,
        termsNotes:      termsNotes || null,
        termsConditions: effectiveTermsConditions,
        paymentPolicy:   effectivePaymentPolicy,
        amendmentPolicy: effectiveAmendmentPolicy,
        travelBenefits:  effectiveTravelBenefits,
        customPolicySections: effectiveCustomPolicySections,
        extraPolicyItems: effectiveExtraPolicyItems,
        flightsIncluded,
        flightNotes:     flightNotes || null,
        flightFrom:      flightFrom || null,
        flightTo:        flightTo || null,
        trainIncluded,
        trainNotes:      trainNotes || null,
        trainFrom:       trainFrom || null,
        trainTo:         trainTo || null,
        status:          nextStatus,
        // builtBy/builtByName are set on create and never rewritten. They name
        // whoever BUILT the package, which is not the same as whoever last
        // saved it — now that costing saves too, echoing the current actor here
        // would quietly reassign authorship to the reviewer.
        ...(previousSnapshot ? { previousSnapshot } : {}),
      },
    });

    // Replace route stops — delete all then recreate (no nested children, so
    // createMany is fine here, unlike itineraries below).
    await db.custom_package_stops.deleteMany({
      where: { customPackageId: pkg.id },
    });
    const namedStops = stops.filter((s) => s.name.trim());
    if (namedStops.length > 0) {
      await db.custom_package_stops.createMany({
        data: namedStops.map((s, idx) => ({
          customPackageId: pkg.id,
          name:            s.name,
          nights:          s.nights,
          image:           s.image || null,
          sortOrder:       idx,
        })),
      });
    }

    // Replace itineraries (and their nested activities, via cascade) — delete
    // all then recreate. Nested `activities.create` needs one create per day
    // rather than createMany, since createMany can't take nested writes.
    //
    // Fetched BEFORE the delete so hotel-fulfillment provenance
    // (hotelFilledAt/By/ByName) can be carried forward untouched rather than
    // trusted from the client payload — the exec's browser form state is a
    // point-in-time snapshot, and the hotel team fills in a pending day from
    // a completely separate page (/dashboard/hotel-requests) while the exec
    // may still have this package open mid-edit. Without this, a stale save
    // could silently revert a completed fulfillment back to "pending",
    // re-blocking Mark Ready even though the team already handled it.
    const existingHotelState = await db.custom_itineraries.findMany({
      where: { customPackageId: pkg.id },
      select: {
        day: true, hotelPending: true, hotelRequestedAt: true, hotelFilledAt: true, hotelFilledById: true, hotelFilledByName: true,
        hotelFillNote: true,
        hotelRejectedAt: true, hotelRejectedById: true, hotelRejectedByName: true, hotelRejectionNote: true, hotelRejectedNotifiedAt: true,
        hotelPriceOverride: true, cabPriceOverride: true,
        roomPricingId: true, roomsCount: true, manualExtraBeds: true, extraRooms: true, manualHotelPricePerNight: true, manualExtraBedRate: true, accommodation: true,
        cabPricingId: true, transportDistanceKm: true, cabQuantity: true, extraCabs: true,
      },
    });
    const existingByDay = new Map(existingHotelState.map((r) => [r.day, r]));

    // A costing correction is tied to whatever hotel/cab was priced when it
    // was set — if the exec swaps the actual hotel/cab afterward, that
    // correction no longer means anything and must NOT silently reapply to
    // the new selection. Only invalidate it here, per day, when the thing it
    // was priced against actually changed — a resubmission that touches
    // nothing about a given day's hotel/cab keeps costing's correction
    // (previously this was wiped wholesale on every markPackageReady, which
    // threw away a valid correction just for resubmitting unrelated edits).
    const filteredExtraRooms = (it: { extraRooms?: { roomPricingId: number }[] | null }) =>
      (it.extraRooms ?? []).filter((r) => r.roomPricingId > 0);
    const filteredExtraCabs = (it: { extraCabs?: { label: string }[] | null }) =>
      (it.extraCabs ?? []).filter((c) => c.label.trim());
    const hotelSelectionChanged = (existing: typeof existingHotelState[number] | undefined, it: (typeof itineraries)[number]) =>
      !existing
      || existing.roomPricingId !== (it.roomPricingId ?? null)
      || existing.roomsCount !== (it.roomsCount ?? null)
      || existing.manualExtraBeds !== (it.manualExtraBeds ?? null)
      || existing.manualHotelPricePerNight !== (it.manualHotelPricePerNight ?? null)
      || existing.manualExtraBedRate !== (it.manualExtraBedRate ?? null)
      || existing.accommodation !== (it.accommodation || null)
      || JSON.stringify(existing.extraRooms ?? []) !== JSON.stringify(filteredExtraRooms(it));
    const cabSelectionChanged = (existing: typeof existingHotelState[number] | undefined, it: (typeof itineraries)[number]) =>
      !existing
      || existing.cabPricingId !== (it.cabPricingId ?? null)
      || existing.transportDistanceKm !== (it.transportDistanceKm ?? null)
      || existing.cabQuantity !== (it.cabQuantity ?? null)
      || JSON.stringify(existing.extraCabs ?? []) !== JSON.stringify(filteredExtraCabs(it));

    // Stay categories hang off the day rows about to be deleted, and
    // custom_itinerary_stays cascades on itineraryId — so an ordinary save
    // would take every standard's hotels with it. Read them out keyed by DAY
    // NUMBER, which is what survives the recreate, and put them back below.
    //
    // Not fixed by making the save upsert instead: the delete/recreate is
    // load-bearing here (day renumbering, the activities cascade, the
    // hotel-request guards), and rebuilding that is a far larger change than
    // carrying the stays across.
    const carriedStays = await db.custom_itinerary_stays.findMany({
      where: { itinerary: { customPackageId: pkg.id } },
      include: { itinerary: { select: { day: true } } },
    });

    await db.custom_itineraries.deleteMany({
      where: { customPackageId: pkg.id },
    });

    // Days where a client-requested `hotelPending: true` got blocked by the
    // staleResurrection guard below — surfaced back to the caller (see the
    // return statement) so a blocked re-request is never silent. This is
    // exactly the scenario the guard exists for (a stale, pre-fill tab
    // saving over a fill that already happened) — rare, but when it does
    // happen the exec needs to know their request didn't take, not just see
    // it quietly vanish, so they know to refresh and try again.
    const staleHotelRequestDays: number[] = [];
    if (itineraries.length > 0) {
      await db.$transaction(
        itineraries.map((it) => {
          const existing = existingByDay.get(it.day);
          const alreadyFilled = !!existing?.hotelFilledAt;
          // Distinguishes a genuine re-request (exec saw the filled hotel —
          // e.g. via the "Filled by X" line, which is sourced from this same
          // hotelFilledAt — and clicked "Add Hotels by Team" again because it
          // wasn't right) from the stale-tab race this guard exists to catch:
          // the hotel team fills a day in a separate tab/page while the exec
          // still has an older, pre-fill copy of this form open and saves for
          // an unrelated reason. The client's own hotelFilledAt (read-only,
          // loaded at page-open time — see the DayItinerary comment above)
          // only matches the DB's current one if the exec's snapshot already
          // knew about this exact fill, which a stale tab's never would.
          const clientSawThisFill = alreadyFilled && it.hotelFilledAt != null
            && new Date(it.hotelFilledAt).getTime() === existing!.hotelFilledAt!.getTime();
          const staleResurrection = alreadyFilled && !clientSawThisFill;
          if (it.hotelPending && staleResurrection) staleHotelRequestDays.push(it.day);
          const clearedRejection = !!existing?.hotelRejectedAt && it.hotelRejectionAcknowledged === true;
          const hotelPending = it.hotelPending && !staleResurrection;
          const hotelRequestedAt = hotelPending
            ? (existing?.hotelPending ? existing.hotelRequestedAt : new Date())
            : (existing?.hotelRequestedAt ?? null);
          return db.custom_itineraries.create({
            data: {
              customPackageId:    pkg.id,
              day:                it.day,
              title:              it.title,
              description:        it.description || null,
              meals:              it.meals,
              accommodation:      it.accommodation || null,
              accommodationPhoto: it.accommodationPhoto || null,
              accommodationRoomPhotos: it.accommodationRoomPhotos ?? [],
              accommodationLocation: it.accommodationLocation || null,
              accommodationRoomSpecs: it.accommodationRoomSpecs || null,
              accommodationStarRating: it.accommodationStarRating || null,
              accommodationRoomCapacity: it.accommodationRoomCapacity ?? null,
              accommodationMaxAdults: it.accommodationMaxAdults ?? null,
              accommodationMaxChildren: it.accommodationMaxChildren ?? null,
              accommodationExtraBedCapacity: it.accommodationExtraBedCapacity ?? null,
              manualExtraBeds:    it.manualExtraBeds ?? null,
              roomPricingId:      it.roomPricingId ?? null,
              roomsCount:         it.roomsCount ?? null,
              hotelPending,
              hotelPendingNote:   hotelPending ? (it.hotelPendingNote || null) : null,
              hotelRequestType:   hotelPending ? (it.hotelRequestType || null) : null,
              hotelRequestedAt,
              // A day going pending again — whether this is its first-ever
              // request or a re-request after a fill — starts a fresh
              // fulfillment cycle, so any previous fill's provenance no
              // longer applies and must be cleared (otherwise the very next
              // save would immediately re-trigger the staleResurrection
              // guard above against the fill this request is superseding).
              hotelFilledAt:      hotelPending ? null : (existing?.hotelFilledAt ?? null),
              hotelFilledById:    hotelPending ? null : (existing?.hotelFilledById ?? null),
              hotelFilledByName:  hotelPending ? null : (existing?.hotelFilledByName ?? null),
              hotelFillNote:      hotelPending ? null : (existing?.hotelFillNote ?? null),
              // The exec's own payload for these is never trusted (see the
              // DayItinerary doc comment) — only hotelRejectionAcknowledged,
              // set by the "Update Request" submit action, is proof the exec
              // actually saw this rejection before resubmitting.
              hotelRejectedAt:         clearedRejection ? null : (existing?.hotelRejectedAt ?? null),
              hotelRejectedById:       clearedRejection ? null : (existing?.hotelRejectedById ?? null),
              hotelRejectedByName:     clearedRejection ? null : (existing?.hotelRejectedByName ?? null),
              hotelRejectionNote:      clearedRejection ? null : (existing?.hotelRejectionNote ?? null),
              hotelRejectedNotifiedAt: clearedRejection ? null : (existing?.hotelRejectedNotifiedAt ?? null),
              manualHotelPricePerNight: it.manualHotelPricePerNight ?? null,
              manualExtraBedRate: it.manualExtraBedRate ?? null,
              // Costing-only corrections — never sourced from the exec's own
              // form (it doesn't expose them). Carried forward as-is unless
              // this save actually changed the hotel/cab it was priced
              // against, in which case it no longer applies.
              hotelPriceOverride: hotelSelectionChanged(existing, it) ? null : existing!.hotelPriceOverride,
              cabPriceOverride:   cabSelectionChanged(existing, it) ? null : existing!.cabPriceOverride,
              // Drop any "add another room" row the exec never finished
              // picking a room for (roomPricingId still 0, the picker's
              // "unselected" sentinel) rather than persisting junk entries.
              extraRooms:         (it.extraRooms ?? []).filter((r) => r.roomPricingId > 0) as unknown as Prisma.InputJsonValue,
              hotelCheckIn:       it.hotelCheckIn || null,
              hotelCheckOut:      it.hotelCheckOut || null,
              hotelMealPlan:      it.hotelMealPlan || null,
              transport:          it.transport || null,
              transportPhoto:     it.transportPhoto || null,
              transportVehicleType: it.transportVehicleType || null,
              transportSeats:     it.transportSeats ?? null,
              transportPickup:    it.transportPickup || null,
              transportPickupLat: it.transportPickupLat ?? null,
              transportDropLat:   it.transportDropLat ?? null,
              transportDropLng:   it.transportDropLng ?? null,
              transportPickupLng: it.transportPickupLng ?? null,
              transportDrop:      it.transportDrop || null,
              transportDistanceKm: it.transportDistanceKm ?? null,
              transportTravelTime: it.transportTravelTime || null,
              cabPricingId:       it.cabPricingId ?? null,
              cabQuantity:        it.cabQuantity ?? null,
              // Same "drop unfinished rows" filter as extraRooms above.
              extraCabs:          (it.extraCabs ?? []).filter((c) => c.label.trim()) as unknown as Prisma.InputJsonValue,
              notes:              it.notes || null,
              notesType:          it.notesType || null,
              notesTitle:         it.notesTitle || null,
              activities: {
                create: it.activities
                  .filter((a) => a.title.trim())
                  .map((a, idx) => ({
                    title:       a.title,
                    description: a.description || null,
                    photo:       a.photo || null,
                    photos:      a.photos ?? [],
                    photoLabels: a.photoLabels ?? [],
                    sortOrder:   idx,
                  })),
              },
            },
          });
        }),
        // Default is 5s — too short for a rich (e.g. AI-generated) multi-day
        // itinerary on a cold Neon compute (app/lib/db.ts's pool comments
        // note cold starts up to ~15s under load): one sequential create per
        // day easily blows a 5s budget, throwing "Transaction already
        // closed" and surfacing to the exec as a generic save failure.
        { timeout: 25_000, maxWait: 10_000 },
      );
    }

    // Re-attach each standard's hotels to the rows that just replaced the ones
    // they hung from, matching on day number. A day the save dropped takes its
    // stays with it, which is right — the day is gone.
    //
    // The RECOMMENDED standard is skipped: its columns live on the day row
    // itself and have just been written from the form, so restoring the
    // pre-save copy would put the old hotel back and undo the edit that caused
    // the save. It is re-derived from the day row instead, which is the
    // direction the mirror runs everywhere else.
    if (carriedStays.length > 0) {
      const freshDays = await db.custom_itineraries.findMany({
        where: { customPackageId: pkg.id },
        select: { id: true, day: true },
      });
      const idByDay = new Map(freshDays.map((d) => [d.day, d.id]));
      const recommended = await db.custom_package_stay_options.findFirst({
        where: { customPackageId: pkg.id, isRecommended: true },
        select: { id: true },
      });

      // Where each carried stay belongs AFTER the save.
      //
      // Not its old day number. Moving, inserting or deleting a day renumbers
      // every day from that point on (see renumber() in builder-context), so a
      // stay carried by number lands on whatever now happens to hold that
      // number — a different night. The row id is what survives a reorder: the
      // form keeps it on the day it belongs to while the number changes
      // underneath, so the payload maps old row id to new day number.
      //
      // Add-ons already work this way (renumber rebases them through mapDay);
      // this is the same problem, and it was the one thing the stay carry-across
      // did not account for.
      const newDayByOldRowId = new Map(
        itineraries.filter((it) => it.id).map((it) => [it.id!, it.day]),
      );

      const restored = carriedStays
        .filter((st) => st.stayOptionId !== recommended?.id)
        .map((st) => {
          // Falls back to the old number only for a stay whose day reached the
          // save with no id — a day added in this very save, which cannot have
          // moved.
          const targetDay = newDayByOldRowId.get(st.itineraryId) ?? st.itinerary.day;
          const targetId = idByDay.get(targetDay);
          if (!targetId) return null;
          const { id: _id, itineraryId: _itineraryId, itinerary: _itinerary, createdAt: _c, updatedAt: _u, ...fields } = st;
          return {
            ...fields,
            // Prisma reads Json as JsonValue (null included) but will not take
            // a bare null on write; undefined leaves the column at its default.
            extraRooms: (fields.extraRooms ?? undefined) as Prisma.InputJsonValue | undefined,
            itineraryId: targetId,
          };
        })
        .filter((r): r is NonNullable<typeof r> => r !== null);
      if (restored.length > 0) {
        await db.custom_itinerary_stays.createMany({ data: restored, skipDuplicates: true });
      }
    }
    // The recommended standard, rebuilt from the day rows the form just wrote.
    await syncRecommendedStayFromDays(pkg.id);

    // Tickets — reconciled by id, not replaced wholesale.
    //
    // This was delete-everything + createMany, which handed every surviving
    // ticket a brand-new id on every save. updatePackagePricing corrects fares
    // by id (`custom_package_tickets.update({ where: { id } })`), so one save
    // from the builder left the Costing tab holding ids that no longer existed
    // and its next Edit Pricing save failed outright. Rows now keep their
    // identity, and `fare` — costing's column, not this form's — is left alone
    // while a correction can be in flight against it.
    const liveTicketIds = new Set(
      (await db.custom_package_tickets.findMany({
        where: { customPackageId: pkg.id }, select: { id: true },
      })).map((t) => t.id),
    );
    const keptTicketIds = tickets
      .map((t) => t.id)
      .filter((tid): tid is string => !!tid && liveTicketIds.has(tid));

    // `notIn: []` matches every row, which is exactly right when nothing is
    // kept — the whole list was cleared.
    await db.custom_package_tickets.deleteMany({
      where: { customPackageId: pkg.id, id: { notIn: keptTicketIds } },
    });

    await Promise.all(tickets.map((t, idx) => {
      const content = {
        type:          t.type,
        provider:      t.provider || null,
        ticketNumber:  t.ticketNumber || null,
        fromPlace:     t.fromPlace || null,
        toPlace:       t.toPlace || null,
        travelDate:    t.travelDate ? new Date(t.travelDate) : null,
        departureTime: t.departureTime || null,
        arrivalTime:   t.arrivalTime || null,
        durationText:  t.durationText || null,
        adults:        t.adults,
        children:      t.children,
        infants:       t.infants,
        ticketCount:   t.ticketCount,
        notes:         t.notes || null,
        sortOrder:     idx,
      };
      // Fares are written at every status, costing's review included.
      //
      // They were briefly held back at READY, to stop a save posting a stale
      // fare over one corrected in Edit Pricing. But a fare is what we PAY,
      // which caps.editCost puts squarely in costing's hands *in the builder* —
      // so holding it back turned the Tickets drawer into a control that moved
      // the live pricing and then dropped the change. The staleness it guarded
      // against is handled at the source now: Edit Pricing syncs what it wrote
      // back into the editor's form, so there is no stale fare left to post.
      return t.id && liveTicketIds.has(t.id)
        ? db.custom_package_tickets.update({
            where: { id: t.id },
            data:  { ...content, fare: t.fare ?? null },
          })
        : db.custom_package_tickets.create({
            data: { customPackageId: pkg.id, ...content, fare: t.fare ?? null },
          });
    }));

    // Add-ons — same reconcile, same reason: updatePackagePricing corrects
    // price and quantity by id.
    const namedAddons = addOns.filter((a) => a.name.trim());
    const liveAddonIds = new Set(
      (await db.custom_package_addons.findMany({
        where: { customPackageId: pkg.id }, select: { id: true },
      })).map((a) => a.id),
    );
    const keptAddonIds = namedAddons
      .map((a) => a.id)
      .filter((aid): aid is string => !!aid && liveAddonIds.has(aid));

    await db.custom_package_addons.deleteMany({
      where: { customPackageId: pkg.id, id: { notIn: keptAddonIds } },
    });

    await Promise.all(namedAddons.map((a, idx) => {
      const content = {
        name:      a.name,
        notes:     a.notes || null,
        day:       a.day ?? null,
        sortOrder: idx,
      };
      return a.id && liveAddonIds.has(a.id)
        ? db.custom_package_addons.update({
            where: { id: a.id },
            data:  { ...content, price: a.price ?? 0, quantity: a.quantity || 1 },
          })
        : db.custom_package_addons.create({
            data: {
              customPackageId: pkg.id, ...content,
              price: a.price ?? 0, quantity: a.quantity || 1,
            },
          });
    }));

    revalidatePath("/dashboard/package-builder");

    return {
      id: pkg.id, success: true,
      ...(staleHotelRequestDays.length > 0 ? { staleHotelRequestDays } : {}),
    };
  } catch (err) {
    console.error("[saveCustomPackage]", err);
    const { message } = classifyActionError(err);
    return { id: "", success: false, error: message };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. Mark package as SENT → update query status → return WhatsApp URL
// ─────────────────────────────────────────────────────────────────────────────
/**
 * NOT exported, deliberately.
 *
 * This file carries "use server", so every export is a callable endpoint. This
 * function flips a package to SENT, freezes its pricing snapshot and hands back
 * the client's share URL — and it checks the package's STATE (verified, READY)
 * without ever checking who is asking. Exported, it was a way to publish
 * somebody else's package to their client, from outside the builder, with no
 * permission check anywhere in the path.
 *
 * The only caller is shareCustomPackageWithClient below, which resolves
 * caps.send first — sending belongs to the exec who owns the client
 * relationship, even after costing has approved. Keeping this private means
 * that gate cannot be walked around rather than merely being the polite route.
 */
async function sendPackageToClient(packageId: string): Promise<{
  success:      boolean;
  whatsappUrl?: string;
  shareUrl?:    string;
  error?:       string;
}> {
  try {
    const pkg = await db.custom_packages.findUnique({
      where:   { id: packageId },
      include: {
        query:       true,
        itineraries: { orderBy: { day: "asc" } },
        tickets:     { orderBy: { sortOrder: "asc" } },
        addOns:      { orderBy: { sortOrder: "asc" } },
      },
    });

    if (!pkg) return { success: false, error: "Package not found" };
    // shareCustomPackageWithClient (the exec-triggered caller) already checks
    // pkg.verified before calling this, but the READY invariant belongs here
    // too, on the function that actually locks pricing and flips status to
    // SENT — not solely on whoever happens to call it. Without this, a future
    // direct call would silently skip costing review entirely, which is the
    // exact thing this whole workflow exists to stop.
    if (pkg.status !== "READY") return { success: false, error: "This package must be marked ready and reviewed by costing before it can be sent." };
    // A blank package (no linked query) has no client contact to send to —
    // it needs to be attached to a lead first via a real query before it can
    // go out over WhatsApp/email.
    if (!pkg.query) return { success: false, error: "This package isn't linked to a client query yet, so it can't be sent." };

    // Falls back to the real production domain, not localhost — this URL
    // goes straight into a client-facing WhatsApp message/email. NEXT_PUBLIC_
    // BASE_URL not being set (e.g. missing from the host's env config) should
    // never silently produce a link the client can't open.
    const baseUrl  = process.env.NEXT_PUBLIC_BASE_URL ?? "https://dreamsyatri.org";
    const shareUrl = `${baseUrl}/custom-package/${packageId}`;

    // ── Compute the authoritative price ──────────────────────────────────────
    // Computed fresh from the actual priced hotel/cab/ticket/add-on rows (not
    // trusted from client state) at the exact moment the package is sent —
    // this becomes the number written to totalPrice/pricePerPerson below (and
    // therefore what the public page shows and "Book Now" charges), so it can
    // never drift from what's actually in the itinerary even if the exec
    // never clicked "Apply computed pricing" in the builder after their last
    // edit. Mirrors the arithmetic in the builder's own computeFinalPricing
    // (page.tsx): base → +margin% → taxable → +gst% → final, tickets always
    // at a flat 5% margin.
    const travelDateIso = pkg.travelDate ? pkg.travelDate.toISOString().slice(0, 10) : null;
    const [hotelPricing, cabPricing] = await Promise.all([
      computeBuilderHotelPricing({
        travelDate: travelDateIso,
        adults:     pkg.adults,
        children:   pkg.children,
        days: pkg.itineraries.map((it) => ({
          day:           it.day,
          roomPricingId: it.roomPricingId,
          roomsCount:    it.roomsCount,
          manualExtraBeds: it.manualExtraBeds,
          manualExtraBedRate: it.manualExtraBedRate,
          extraRooms:    parseRoomSelections(it.extraRooms),
          manualHotelPricePerNight: it.manualHotelPricePerNight,
          hotelPriceOverride: it.hotelPriceOverride,
          ...splitManualHotelName(it.accommodation),
        })),
      }),
      computeBuilderCabPricing({
        travelDate: travelDateIso,
        days: pkg.itineraries.map((it) => ({
          day:                 it.day,
          cabPricingId:        it.cabPricingId,
          transportDistanceKm: it.transportDistanceKm,
          cabQuantity:         it.cabQuantity,
          extraCabs:           parseCabSelections(it.extraCabs),
          cabPriceOverride:    it.cabPriceOverride,
        })),
      }),
    ]);

    const TICKET_MARGIN_PCT = 5;
    // A costing-team correction from pre-send review (verify-packages'
    // updatePackagePricing) wins over the live-computed subtotal — without
    // this, a fix made during review would be silently discarded the moment
    // this recomputes fresh from the (unchanged) catalog/itinerary rows.
    const hotelSubtotal = pkg.hotelSubtotalOverride ?? hotelPricing.hotelSubtotal;
    const cabSubtotal = pkg.cabSubtotalOverride ?? cabPricing.cabSubtotal;
    const ticketsSubtotal = pkg.tickets.reduce((sum, t) => sum + (t.fare ?? 0), 0);
    const addonsSubtotal = pkg.addOns.reduce((sum, a) => sum + (a.price ?? 0) * (a.quantity || 1), 0);
    const hotelCabBase = hotelSubtotal + cabSubtotal;
    const baseCost = hotelCabBase + addonsSubtotal + ticketsSubtotal;
    const hotelCabMarginAmount = Math.round((hotelCabBase + addonsSubtotal) * pkg.marginPercentage / 100);
    const ticketsMarginAmount = Math.round(ticketsSubtotal * TICKET_MARGIN_PCT / 100);
    const marginAmount = hotelCabMarginAmount + ticketsMarginAmount;
    const taxable = baseCost + marginAmount;
    const gstAmount = Math.round(taxable * pkg.gstPercentage / 100);
    const listPrice = taxable + gstAmount;
    // Costing's concession, off the end — same rule and same helper as every
    // other surface (see discount.ts). Missing here, this recompute quietly
    // undid the discount at the last possible moment: on the row the client
    // page reads, in the snapshot meant to be the record of what was quoted,
    // and in the WhatsApp message itself.
    const discount = applyDiscount(listPrice, {
      type: pkg.discountType,
      value: pkg.discountValue,
    });
    const finalPrice = discount.finalPrice;
    const totalPax = pkg.adults + pkg.children;
    const pricePerPersonComputed = totalPax > 0 ? Math.round(finalPrice / totalPax) : finalPrice;

    const pricingSnapshot = {
      lockedAt: new Date().toISOString(),
      currency: pkg.currency,
      hotel: {
        subtotal: hotelSubtotal, nightsCounted: hotelPricing.nightsCounted, lines: hotelPricing.days,
        overridden: pkg.hotelSubtotalOverride != null,
      },
      cab: {
        subtotal: cabSubtotal, daysCounted: cabPricing.daysCounted, lines: cabPricing.days,
        overridden: pkg.cabSubtotalOverride != null,
      },
      tickets: {
        subtotal: ticketsSubtotal,
        lines: pkg.tickets.map((t) => ({
          type: t.type, provider: t.provider ?? "", fromPlace: t.fromPlace ?? "", toPlace: t.toPlace ?? "",
          fare: t.fare, ticketCount: t.ticketCount,
        })),
      },
      addOns: {
        subtotal: addonsSubtotal,
        lines: pkg.addOns.map((a) => ({ name: a.name, price: a.price, quantity: a.quantity, day: a.day })),
      },
      baseCost,
      marginPercentage: pkg.marginPercentage,
      hotelCabMarginAmount,
      ticketsMarginAmount,
      marginAmount,
      taxable,
      gstPercentage: pkg.gstPercentage,
      gstAmount,
      // Both sides of the concession are frozen, not just the payable figure.
      // A snapshot that recorded only finalPrice could not answer "was this
      // client given a discount, and how much" after the fact — which is the
      // question a snapshot exists to answer.
      listPrice,
      discountType:   pkg.discountType,
      discountValue:  pkg.discountValue,
      discountAmount: discount.amount,
      finalPrice,
      pricePerPerson: pricePerPersonComputed,
      // What was actually shown to the client at lock time (the exec may
      // have hand-typed a different number than the computed one above) —
      // lets a later recheck spot drift between the two.
      displayedTotalPrice:     pkg.totalPrice ?? null,
      displayedPricePerPerson: pkg.pricePerPerson ?? null,
    } as unknown as Prisma.InputJsonValue;

    // ── Build WhatsApp deep-link ─────────────────────────────────────────────
    const rawPhone  = pkg.query.phone.replace(/\D/g, "");
    const country   = pkg.query.countryCode ?? "91";
    const fullPhone = rawPhone.startsWith(country) ? rawPhone : `${country}${rawPhone}`;

    const travelDateStr = pkg.travelDate
      ? new Date(pkg.travelDate).toLocaleDateString("en-IN", {
          day: "2-digit", month: "short", year: "numeric",
        })
      : "TBD";

    const paxLine =
      `${pkg.adults} Adult${pkg.adults !== 1 ? "s" : ""}` +
      (pkg.children ? `, ${pkg.children} Child${pkg.children !== 1 ? "ren" : ""}` : "") +
      (pkg.infants  ? `, ${pkg.infants} Infant${pkg.infants !== 1 ? "s" : ""}` : "");

    // Uses the just-computed finalPrice (about to be persisted below), not
    // the pre-send pkg.totalPrice, so the WhatsApp message always quotes the
    // same number the client will see on the link and be charged via "Book Now".
    const priceStr = `${pkg.currency} ${finalPrice.toLocaleString("en-IN")}`;

    const transportLine = [
      pkg.flightsIncluded ? "✈️ Flights included" : null,
      pkg.trainIncluded ? "🚆 Train included" : null,
      // Helicopter/Bus/Other legs don't get their own flightsIncluded-style
      // persisted flag (see TicketLike in deriveTicketTransport.ts) —
      // checked directly off the ticket list instead, same data this
      // message already has.
      pkg.tickets.some((t) => t.type === "HELICOPTER") ? "🚁 Helicopter included" : null,
      pkg.tickets.some((t) => t.type === "BUS") ? "🚌 Bus included" : null,
      pkg.tickets.some((t) => t.type === "OTHER")
        ? `🎫 ${pkg.tickets.filter((t) => t.type === "OTHER").map((t) => t.provider).filter(Boolean).join(", ") || "Other transport"} included`
        : null,
    ].filter(Boolean).join(" · ");

    const message = [
      `Hi ${pkg.query.name} 👋`,
      ``,
      `Your customised *${pkg.title}* package is ready! 🎉`,
      ``,
      `📍 *Destination:* ${pkg.destination}`,
      `🚗 *Starting From:* ${pkg.startingPoint ?? pkg.query.destination ?? "—"}`,
      `📅 *Travel Date:* ${travelDateStr}`,
      `🌙 *Duration:* ${pkg.totalDays} Days / ${pkg.totalNights} Nights`,
      `👥 *Travellers:* ${paxLine}`,
      `💰 *Total Price:* ${priceStr}`,
      // Stated, not implied. The price above is already net of the discount,
      // so without this line the concession is invisible in the one message
      // the client actually reads.
      ...(discount.applies
        ? [`🎉 _You save ${pkg.currency} ${discount.amount.toLocaleString("en-IN")} (${discountLabel({ type: pkg.discountType, value: pkg.discountValue }, discount.amount)})_`]
        : []),
      ...(transportLine ? [transportLine] : []),
      ``,
      `View your full itinerary here: ${shareUrl}`,
      `Let us know if you'd like any changes! 🙏`,
    ].join("\n");

    const whatsappUrl = `https://wa.me/${fullPhone}?text=${encodeURIComponent(message)}`;

    // ── Update DB ────────────────────────────────────────────────────────────
    // totalPrice/pricePerPerson are overwritten with the fresh computation
    // (not just recorded into pricingSnapshot) so the public custom-package
    // page — and the real "Book Now" charge it drives — always match what's
    // actually in the itinerary (hotels, extra rooms/cabs, add-ons, tickets)
    // at the moment of send, even if the exec never clicked "Apply computed
    // pricing" in the builder after their last edit.
    await db.$transaction([
      db.custom_packages.update({
        where: { id: packageId },
        data:  {
          status: "SENT", sentAt: new Date(), pricingSnapshot,
          totalPrice: finalPrice, pricePerPerson: pricePerPersonComputed,
          // Baked into the snapshot above — cleared so a hypothetical future
          // recompute never silently reapplies a stale correction.
          hotelSubtotalOverride: null, cabSubtotalOverride: null,
        },
      }),
      db.package_queries.update({
        where: { id: pkg.query.id },
        data:  { status: "PACKAGE_SENT" },
      }),
    ]);

    revalidatePath("/dashboard/package-builder");

    return { success: true, whatsappUrl, shareUrl };
  } catch (err) {
    console.error("[sendPackageToClient]", err);
    return { success: false, error: "Failed to send package" };
  }
}

/**
 * Submits a package for costing review — the ONLY way a sales exec can move
 * a package forward into review. No pricing is locked and the client is
 * never notified here — that happens in two later steps: costing approves
 * (approveCustomPackage, in verify-packages/actions.ts) and then the exec
 * sends it themselves (shareCustomPackageWithClient, below). This just flips
 * status to READY, timestamps it (readyAt, for the "assigned → ready" and
 * "ready → sent" duration metrics), and clears any prior verify/reject state
 * so a fresh review cycle starts clean.
 */
export async function markPackageReady(
  packageId: string,
  /** Optional message for costing, shown on verify-packages — e.g. context
   * on a manual hotel entry or a price-sensitive client. Omitted entirely
   * (not just empty) by the hotel-requests auto-advance path, which has no
   * exec input to draw one from. */
  note?: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const { actor } = await getCurrentActor();

    const [pkg, memberCtx] = await Promise.all([
      db.custom_packages.findUnique({
        where: { id: packageId },
        select: {
          id: true, status: true, queryId: true,
          verified: true, rejectedAt: true, revisionRequestedAt: true,
          builtBy: true, query: { select: { assignedTo: true } },
          children: true, infants: true, childrenAges: true, infantAges: true,
        },
      }),
      getEffectiveMember(),
    ]);
    if (!pkg) return { success: false, error: "Package not found" };
    if (!pkg.queryId) return { success: false, error: "This package isn't linked to a client query yet — attach one before submitting for review." };
    if (pkg.status === "SENT") return { success: false, error: "This package has already been sent to the client." };

    // Submitting is the exec's, from their own draft. This action had no role
    // check at all: a costing manager with the package open could push an
    // exec's half-built draft into their own review queue, and the row would
    // then record the reviewer as the person who marked it ready.
    const caps = resolveWorkspaceCaps(workspaceRoleOf(memberCtx?.member?.teamRole?.name), {
      status: pkg.status,
      verified: pkg.verified,
      rejectedAt: pkg.rejectedAt,
      revisionRequestedAt: pkg.revisionRequestedAt,
    }, {
      isOwner: ownsPackage({
        viewerId: memberCtx?.member?.id,
        viewerRoleName: memberCtx?.member?.teamRole?.name,
        builtBy: pkg.builtBy,
        queryAssignedTo: pkg.query?.assignedTo,
      }),
    });
    if (!caps.submit) {
      return { success: false, error: "Only the sales exec who owns this package can mark it ready for review." };
    }

    // Every child and infant needs a real age before costing sees this. Both
    // builders check the same rule client-side, but it is enforced here as
    // well: this action is the single door into review (the hotel-requests
    // auto-advance path comes through it too), and a package that reaches
    // costing reading "2 Children (age 0, 0)" costs them a round-trip to the
    // exec to price the rooms at all. See traveller-ages.ts.
    const agesError = missingTravellerAgesError(pkg);
    if (agesError) return { success: false, error: agesError };

    // Every stay option has to be complete before costing sees it. An option
    // with an unbooked night prices those nights at zero, so it arrives looking
    // like the cheapest thing on offer. Checked here because this is the single
    // door into review — the builder checks the same rule for a faster answer.
    const optionsForGaps = await db.custom_package_stay_options.findMany({
      where: { customPackageId: packageId },
      select: {
        label: true,
        stays: {
          select: {
            accommodation: true, roomPricingId: true, hotelPending: true,
            itinerary: { select: { day: true } },
          },
        },
      },
    });
    const gapError = stayOptionGapError(stayOptionGaps(
      optionsForGaps.map((o) => ({
        label: o.label,
        stays: o.stays.map((st) => ({
          day: st.itinerary.day,
          accommodation: st.accommodation,
          roomPricingId: st.roomPricingId,
          hotelPending: st.hotelPending,
        })),
      })),
    ));
    if (gapError) return { success: false, error: gapError };

    // A night with no season rate behind it. The hotel catalog already refuses
    // to show rooms whose seasons miss the travel date, so this catches the
    // case that filter cannot: a room picked while it was in season, and a
    // travel date moved out of it afterwards — or seasons that lapsed while
    // the package sat in a drawer. resolveHotelSeasonPricing falls back to the
    // room's base rate without saying so, which is how a quote goes out at
    // last year's price and reaches costing looking settled.
    //
    // Checked across every option, not just the recommended one: each column
    // is a price the client may pick.
    const optionPricing = await computeStayOptionPricing(packageId).catch(() => []);
    const baseRateOption = optionPricing.find((o) => o.baseRateDays.length > 0);
    if (baseRateOption) {
      const error = baseRatePricingError(
        baseRateOption.baseRateDays.map((day) => ({ day, baseRate: true })),
      );
      if (error) {
        return {
          success: false,
          error: optionPricing.length > 1 ? `${baseRateOption.label}: ${error}` : error,
        };
      }
    }

    // Per-day hotel/cab corrections from a prior review cycle are left as-is
    // here — saveCustomPackage already invalidates a given day's correction
    // the moment the exec actually changes that day's hotel/cab, so whatever
    // survives to this point is still valid and should carry into the new
    // review cycle rather than forcing costing to redo it from scratch for a
    // resubmission that didn't touch pricing at all.
    await db.custom_packages.update({
      where: { id: packageId },
      data: {
        status: "READY",
        readyAt: new Date(),
        readyBy: actor?.id ?? null,
        readyByName: actor?.name ?? null,
        readyNote: note?.trim() || null,
        verified: false, verifiedAt: null, verifiedBy: null, verifiedByName: null,
        rejectedAt: null, rejectedBy: null, rejectedByName: null, rejectionReasonId: null, rejectionNote: null,
        execNotifiedAt: null,
      },
    });

    // Freeze each standard's price at the moment it goes for review, the same
    // way the package's own figure is frozen. From here the prices the client
    // compares are settled numbers, not ones recomputed against catalog rates
    // that may have moved since.
    await persistStayOptionPricing(packageId).catch((err) => {
      // Never block a submission on this: the package's own price is already
      // authoritative, and a standard with no stored figure falls back to a
      // live computation wherever it is shown.
      console.error("[markPackageReady] stay category pricing", err);
    });

    await logTimeline(pkg.queryId, `Package marked ready for costing review by ${actor?.name ?? "team member"}`, actor?.id, actor?.name ?? undefined);
    await broadcastVerificationCounts();

    revalidatePath("/dashboard/package-builder");
    revalidatePath(`/dashboard/package-builder/${packageId}`);
    revalidatePath(`/dashboard/package-builder-v2/${packageId}`);
    revalidatePath("/dashboard/verify-packages");
    // The detail page specifically — costing's own actions (approve/reject
    // in verify-packages/actions.ts) already revalidate this, but a
    // resubmission from the exec's side never did. Without it, a costing
    // manager who had this package's review page open (or cached via the
    // list's route prefetch) from the PREVIOUS cycle kept seeing that stale
    // render — old hotel/cab picks, old price — until an unrelated full
    // reload happened to blow the cache away.
    revalidatePath(`/dashboard/verify-packages/${packageId}`);
    revalidatePath("/dashboard/sales-query");
    return { success: true };
  } catch (err) {
    console.error("[markPackageReady]", err);
    return { success: false, error: "Failed to mark package ready" };
  }
}

/**
 * The exec's own equivalent of a rejection, in reverse — pulls an
 * already-verified-or-already-sent package back out of its locked/done
 * state so it can be edited again, with a free-text note explaining what
 * needs another look (e.g. the client asked for a change after receiving
 * the itinerary). Unlocks the builder (status → DRAFT) exactly like a
 * costing rejection does; the exec then edits as needed and calls
 * markPackageReady again to put it back in costing's queue, where the note
 * stays visible until that next review concludes. sentAt itself is never
 * cleared — same as everywhere else in this file, it's kept as "was this
 * ever sent" history, not "is this currently sent".
 */
export async function requestPackageRevision(packageId: string, note: string): Promise<{ success: boolean; error?: string }> {
  const trimmedNote = note.trim();
  if (!trimmedNote) return { success: false, error: "Explain what needs another look before resubmitting." };

  try {
    const { actor } = await getCurrentActor();

    const [pkg, memberCtx] = await Promise.all([
      db.custom_packages.findUnique({
        where: { id: packageId },
        select: {
          id: true, status: true, verified: true, sentAt: true, queryId: true,
          rejectedAt: true, revisionRequestedAt: true,
          builtBy: true, query: { select: { assignedTo: true } },
        },
      }),
      getEffectiveMember(),
    ]);
    if (!pkg) return { success: false, error: "Package not found" };
    const isApprovedNotSent = pkg.status === "READY" && pkg.verified;
    const isSent = pkg.status === "SENT";
    if (!isApprovedNotSent && !isSent) {
      return { success: false, error: "This package isn't in a state that can be pulled back for revision." };
    }

    // The exec's, not costing's — and the distinction is the one `revise`
    // exists to draw (see workspace-caps). Costing sends work back by
    // rejecting it, which carries a reason and their findings. Unguarded, this
    // gave them a second, reason-light path to quietly undo their own approval.
    const caps = resolveWorkspaceCaps(workspaceRoleOf(memberCtx?.member?.teamRole?.name), {
      status: pkg.status,
      verified: pkg.verified,
      rejectedAt: pkg.rejectedAt,
      revisionRequestedAt: pkg.revisionRequestedAt,
    }, {
      isOwner: ownsPackage({
        viewerId: memberCtx?.member?.id,
        viewerRoleName: memberCtx?.member?.teamRole?.name,
        builtBy: pkg.builtBy,
        queryAssignedTo: pkg.query?.assignedTo,
      }),
    });
    if (!caps.revise) {
      return { success: false, error: "Only the sales exec who owns this package can pull it back for revision. Costing sends one back by rejecting it, with a reason." };
    }

    await db.custom_packages.update({
      where: { id: packageId },
      data: {
        status: "DRAFT",
        verified: false, verifiedAt: null, verifiedBy: null, verifiedByName: null,
        revisionRequestedAt: new Date(),
        revisionRequestedBy: actor?.id ?? null,
        revisionRequestedByName: actor?.name ?? null,
        revisionNote: trimmedNote,
      },
    });

    // The columns above hold only the LATEST revision — each request overwrites
    // the one before it. Costing needs the series, not the last entry: a
    // package pulled back three times for the same reason is a different
    // conversation from one pulled back once. Logged here so the history
    // survives, alongside the pricing corrections already kept this way.
    await db.activityLog.create({
      data: {
        entity: "CustomPackageRevision",
        entityId: packageId,
        // LogAction is a fixed enum; the entity above is what identifies these
        // rows, exactly as CustomPackagePricing does for costing corrections.
        action: "UPDATE",
        description: trimmedNote,
        userId: actor?.id ?? null,
        userName: actor?.name ?? null,
        userEmail: actor?.email ?? null,
        metadata: { fromStatus: pkg.status, wasVerified: pkg.verified },
      },
    });

    if (pkg.queryId) {
      await logTimeline(pkg.queryId, `${actor?.name ?? "Sales exec"} pulled this package back for another look — ${trimmedNote}`, actor?.id, actor?.name ?? undefined);
    }
    await broadcastVerificationCounts();

    revalidatePath("/dashboard/package-builder");
    revalidatePath(`/dashboard/package-builder/${packageId}`);
    revalidatePath(`/dashboard/package-builder-v2/${packageId}`);
    revalidatePath("/dashboard/verify-packages");
    revalidatePath(`/dashboard/verify-packages/${packageId}`);
    revalidatePath("/dashboard/sales-query");
    return { success: true };
  } catch (err) {
    console.error("[requestPackageRevision]", err);
    return { success: false, error: "Failed to request a revision" };
  }
}

/**
 * Permanently removes a package the exec doesn't want anymore — a hard
 * delete, cascading to its stops/tickets/addons/itineraries (all four
 * relations are onDelete: Cascade — see prisma/schema.prisma). Unlike
 * deleteQuery, custom_packages has no deletedAt/soft-delete field, so this
 * can't be undone: blocked outright once the package has actually gone out
 * to a client (its PDF/shared link may already be in their hands) or the
 * query it belongs to has converted to a real booking.
 */
export async function deleteCustomPackage(packageId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { actor } = await getCurrentActor();

    const pkg = await db.custom_packages.findUnique({
      where: { id: packageId },
      select: {
        title: true, sentAt: true, queryId: true,
        query: { select: { booking: { select: { id: true } } } },
      },
    });
    if (!pkg) return { success: false, error: "Package not found — it may already have been deleted." };

    if (pkg.sentAt) {
      return { success: false, error: "Can't delete — this package has already been sent to the client." };
    }
    if (pkg.query?.booking) {
      return { success: false, error: "Can't delete — this client's query has a booking linked to it." };
    }

    await db.custom_packages.delete({ where: { id: packageId } });

    if (pkg.queryId) {
      await logTimeline(pkg.queryId, `${actor?.name ?? "Sales exec"} deleted the package "${pkg.title}"`, actor?.id, actor?.name ?? undefined);
    }
    await broadcastVerificationCounts();

    revalidatePath("/dashboard/package-builder");
    revalidatePath("/dashboard/verify-packages");
    revalidatePath("/dashboard/hotel-requests");
    revalidatePath("/dashboard/sales-query");
    return { success: true };
  } catch (err) {
    console.error("[deleteCustomPackage]", err);
    const { message } = classifyActionError(err);
    return { success: false, error: message };
  }
}

/**
 * The exec's own send step — only reachable once costing has approved the
 * pricing (verified: true). sendPackageToClient still separately enforces
 * status === "READY" (its own long-standing guard), so this adds the one
 * check that's new to this split flow: no approval, no send.
 */
export async function shareCustomPackageWithClient(packageId: string): Promise<{
  success: boolean;
  whatsappUrl?: string;
  shareUrl?: string;
  error?: string;
}> {
  try {
    const { actor } = await getCurrentActor();

    const pkg = await db.custom_packages.findUnique({
      where: { id: packageId },
      select: {
        id: true, status: true, verified: true, queryId: true,
        builtBy: true, query: { select: { assignedTo: true } },
      },
    });
    if (!pkg) return { success: false, error: "Package not found" };
    if (!pkg.verified) return { success: false, error: "This package hasn't been approved by costing yet." };

    // Sending stays with the exec even once costing has approved: the reviewer
    // signs off on what it costs, the person who owns the client relationship
    // decides when it lands in their inbox. caps.send says so, and until now
    // only the button respected it.
    const memberCtx = await getEffectiveMember();
    const sendCaps = resolveWorkspaceCaps(workspaceRoleOf(memberCtx?.member?.teamRole?.name), {
      status: pkg.status,
      verified: pkg.verified,
      rejectedAt: null,
      revisionRequestedAt: null,
    }, {
      isOwner: ownsPackage({
        viewerId: memberCtx?.member?.id,
        viewerRoleName: memberCtx?.member?.teamRole?.name,
        builtBy: pkg.builtBy,
        queryAssignedTo: pkg.query?.assignedTo,
      }),
    });
    if (!sendCaps.send) {
      return { success: false, error: "Only the sales exec who owns this package can share it with the client." };
    }

    const sendResult = await sendPackageToClient(packageId);
    if (!sendResult.success) {
      return { success: false, error: sendResult.error ?? "Failed to send package" };
    }

    // Best-effort — an email failure shouldn't undo the send; the WhatsApp
    // link/client page are already live either way.
    try {
      await emailPackageToClient(packageId);
    } catch (e) {
      console.error("[shareCustomPackageWithClient] email failed", e);
    }

    if (pkg.queryId) {
      await logTimeline(pkg.queryId, `Package sent to client by ${actor?.name ?? "team member"}`, actor?.id, actor?.name ?? undefined);
    }

    revalidatePath("/dashboard/sales-query");
    revalidatePath("/dashboard/package-builder");
    revalidatePath(`/dashboard/package-builder/${packageId}`);
    revalidatePath(`/dashboard/package-builder-v2/${packageId}`);

    return { success: true, whatsappUrl: sendResult.whatsappUrl, shareUrl: sendResult.shareUrl };
  } catch (err) {
    console.error("[shareCustomPackageWithClient]", err);
    return { success: false, error: "Failed to send package" };
  }
}

export type PackageStatusEvent = {
  id: string;
  title: string;
  kind: "verified";
  reasonLabel: string | null;
  note: string | null;
} | {
  id: string;
  title: string;
  kind: "rejected";
  reasonLabel: string | null;
  note: string | null;
} | {
  id: string;
  title: string;
  kind: "hotel_filled";
  days: { day: number; hotelName: string | null }[];
  filledByName: string | null;
} | {
  id: string;
  title: string;
  kind: "hotel_rejected";
  /** The client's name, e.g. "Rejected for Priya Sharma" — this is the one
   * event where the toast names the client rather than just the package
   * title, per how the hotel-requests queue itself is organized (by
   * client), not the package title an exec may not have front-of-mind. */
  clientName: string | null;
  days: { day: number; note: string | null }[];
  rejectedByName: string | null;
};

/**
 * Polled every ~20s by PackageStatusNotifier (mounted for sales execs in the
 * dashboard layout) so an exec sees "your package was approved" or "…was
 * rejected — <reason>" as a toast without refreshing. No generic
 * notification bus exists in this dashboard yet — this is deliberately
 * narrow (just these package/day events) rather than building one.
 *
 * The hotel_filled event only fires once EVERY pending day on a package has
 * been filled (not per day) — a package can have several days flagged
 * pending at once, and the exec only wants the one "you're good to go"
 * toast, not one per day as the hotel team works through them.
 *
 * Marks every returned row execNotifiedAt/hotelFillNotifiedAt=now in the
 * same call, so an event surfaces exactly once — re-marking ready (which
 * clears execNotifiedAt) or a fresh verify/reject/hotel-fill is what makes
 * it eligible again.
 */
export async function getMyUnseenPackageEvents(): Promise<PackageStatusEvent[]> {
  const { teamMemberId } = await getCurrentActor();
  if (!teamMemberId) return [];

  const [statusRows, hotelFillPackages, hotelRejectPackages] = await Promise.all([
    db.custom_packages.findMany({
      where: {
        builtBy: teamMemberId,
        execNotifiedAt: null,
        OR: [{ verified: true }, { rejectedAt: { not: null } }],
      },
      select: {
        id: true, title: true, verified: true, rejectedAt: true,
        rejectionNote: true, rejectionReason: { select: { label: true } },
      },
      take: 20,
    }),
    db.custom_packages.findMany({
      where: {
        builtBy: teamMemberId,
        itineraries: {
          none: { hotelPending: true },
          some: { hotelFilledAt: { not: null }, hotelFillNotifiedAt: null },
        },
      },
      select: {
        id: true, title: true,
        itineraries: {
          where: { hotelFilledAt: { not: null }, hotelFillNotifiedAt: null },
          orderBy: { day: "asc" },
          select: { id: true, day: true, accommodation: true, hotelFilledByName: true },
        },
      },
      take: 20,
    }),
    db.custom_packages.findMany({
      where: {
        builtBy: teamMemberId,
        itineraries: { some: { hotelRejectedAt: { not: null }, hotelRejectedNotifiedAt: null } },
      },
      select: {
        id: true, title: true,
        query: { select: { name: true } },
        itineraries: {
          where: { hotelRejectedAt: { not: null }, hotelRejectedNotifiedAt: null },
          orderBy: { day: "asc" },
          select: { id: true, day: true, hotelRejectionNote: true, hotelRejectedByName: true },
        },
      },
      take: 20,
    }),
  ]);
  if (statusRows.length === 0 && hotelFillPackages.length === 0 && hotelRejectPackages.length === 0) return [];

  const hotelFillItineraryIds = hotelFillPackages.flatMap((p) => p.itineraries.map((it) => it.id));
  const hotelRejectItineraryIds = hotelRejectPackages.flatMap((p) => p.itineraries.map((it) => it.id));

  await Promise.all([
    statusRows.length > 0
      ? db.custom_packages.updateMany({
          where: { id: { in: statusRows.map((r) => r.id) } },
          data: { execNotifiedAt: new Date() },
        })
      : Promise.resolve(),
    hotelFillItineraryIds.length > 0
      ? db.custom_itineraries.updateMany({
          where: { id: { in: hotelFillItineraryIds } },
          data: { hotelFillNotifiedAt: new Date() },
        })
      : Promise.resolve(),
    hotelRejectItineraryIds.length > 0
      ? db.custom_itineraries.updateMany({
          where: { id: { in: hotelRejectItineraryIds } },
          data: { hotelRejectedNotifiedAt: new Date() },
        })
      : Promise.resolve(),
  ]);

  return [
    ...statusRows.map((r) => ({
      id: r.id,
      title: r.title,
      kind: r.verified ? "verified" as const : "rejected" as const,
      reasonLabel: r.rejectionReason?.label ?? null,
      note: r.rejectionNote,
    })),
    ...hotelFillPackages.map((p) => ({
      id: p.id,
      title: p.title,
      kind: "hotel_filled" as const,
      days: p.itineraries.map((it) => ({ day: it.day, hotelName: it.accommodation })),
      filledByName: p.itineraries[0]?.hotelFilledByName ?? null,
    })),
    ...hotelRejectPackages.map((p) => ({
      id: p.id,
      title: p.title,
      kind: "hotel_rejected" as const,
      clientName: p.query?.name ?? null,
      days: p.itineraries.map((it) => ({ day: it.day, note: it.hotelRejectionNote })),
      rejectedByName: p.itineraries[0]?.hotelRejectedByName ?? null,
    })),
  ];
}

// emailPackageToClient lives in ./email-package.ts (a plain, non-"use server"
// module) rather than here — imported above, called from
// shareCustomPackageWithClient, the only place that ever calls it now.
