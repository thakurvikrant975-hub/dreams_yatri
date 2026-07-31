"use server";

import { revalidatePath } from "next/cache";
import { getCurrentActor, logTimeline } from "@/app/(dashboard)/dashboard/(main)/(marketing)/queries/actions";
import { fetchPackagePageData } from "@/app/actions/packages/fetch-page-data";
import { getHeroImage, getThumbnailImage } from "@/app/lib/imageUrl";
import { db } from "@/app/lib/db";
import { deriveTransportFields } from "@/app/lib/deriveTicketTransport";
import { computeBuilderHotelPricing, computeBuilderCabPricing } from "@/app/services/package-pricing.service";
import { splitManualHotelName } from "@/app/services/hotel-name-utils";
import { parseRoomSelections, parseCabSelections } from "./room-cab-selections";
import type { RoomSelection, CabSelection } from "./room-cab-selections";
import type { Prisma } from "@/app/generated/prisma";
import { getItinerarySettings } from "@/app/(dashboard)/dashboard/(main)/itinerary-settings/actions";
import { broadcastVerificationCounts } from "@/app/services/verification-counts.service";
import { emailPackageToClient } from "./email-package";

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
  pricePerNight: number;
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

  return {
    id:            item.id,
    hotelName:     item.hotel.name,
    roomName:      item.room?.name ?? "Room",
    mealPlanName:  item.meal_type?.name ?? null,
    coveredMeals:  item.meal_type?.covered_meals ?? [],
    pricePerNight: Number(item.price_per_night),
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
 * "name_asc" is the original default order. */
export type HotelSortOption = "price_asc" | "price_desc" | "rating_desc" | "name_asc";

const HOTEL_SORT_ORDER_BY: Record<HotelSortOption, Prisma.hotel_room_pricingOrderByWithRelationInput[]> = {
  price_asc:    [{ price_per_night: "asc" }, { hotel: { name: "asc" } }],
  price_desc:   [{ price_per_night: "desc" }, { hotel: { name: "asc" } }],
  // hotels.stay_type is a free-text string like "4 Star" — descending string
  // sort still puts 5/4/3/2 Star in the right order since only the leading
  // digit differs between them.
  rating_desc:  [{ hotel: { stay_type: "desc" } }, { hotel: { name: "asc" } }],
  name_asc:     [{ hotel: { name: "asc" } }, { sort_order: "asc" }],
};

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
): Promise<HotelRoomResult[]> {
  const city = cityOrDestinationName.split(",")[0]?.trim();
  const q = query.trim();
  if (!city && !q) return [];

  const list = await db.hotel_room_pricing.findMany({
    where: {
      is_active: true,
      hotel: {
        is_active: true,
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
              OR: [
                { city: { contains: city, mode: "insensitive" } },
                { destination: { name: { contains: city, mode: "insensitive" } } },
              ],
            }),
        ...(starFilter ? { stay_type: starFilter } : {}),
        ...(categoryFilter ? { category: categoryFilter } : {}),
      },
      ...(noMealsOnly
        ? { OR: [{ meal_type_id: null }, { meal_type: { covered_meals: { isEmpty: true } } }] }
        : mealFilter && mealFilter.length > 0
          ? { meal_type: { covered_meals: { hasEvery: mealFilter } } }
          : {}),
    },
    select: HOTEL_ROOM_SELECT,
    take: HOTEL_SEARCH_PAGE_SIZE,
    skip: (Math.max(page, 1) - 1) * HOTEL_SEARCH_PAGE_SIZE,
    orderBy: HOTEL_SORT_ORDER_BY[sortBy ?? "name_asc"],
  });

  return list.map((item) => mapHotelRoomRow(item, refCoords));
}

/** Looks up a single room by its `hotel_room_pricing` id — used by the hotel
 * picker to price the currently-selected room so other results can show a
 * "+4000 / -200" delta against it, even after a draft reload (the delta
 * baseline isn't persisted, just recomputed from the stored roomPricingId). */
export async function getHotelRoomByIdForBuilder(
  id: number,
  refCoords?: { lat: number; lng: number } | null,
): Promise<HotelRoomResult | null> {
  const item = await db.hotel_room_pricing.findUnique({
    where: { id },
    select: HOTEL_ROOM_SELECT,
  });
  if (!item) return null;
  return mapHotelRoomRow(item, refCoords);
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
): Promise<CabPricingResult[]> {
  const city = cityOrDestinationName.split(",")[0]?.trim();

  if (city) {
    const list = await db.cab_pricing.findMany({
      where: {
        is_active: true,
        OR: [
          { destination: { name: { contains: city, mode: "insensitive" } } },
          { location: { name: { contains: city, mode: "insensitive" } } },
        ],
        ...(query ? { vehicle: { name: { contains: query, mode: "insensitive" } } } : {}),
      },
      select: CAB_PRICING_SELECT,
      orderBy: [{ price: "asc" }],
    });
    if (list.length > 0) return list.map((item) => toCabPricingResult(item, refCoords));
  }

  // No pricing configured for this exact city — find the nearest one that
  // does have it, using refCoords (geocoded from the searched city name).
  if (!refCoords) return [];

  const all = await db.cab_pricing.findMany({
    where: {
      is_active: true,
      location: { latitude: { not: null }, longitude: { not: null } },
      ...(query ? { vehicle: { name: { contains: query, mode: "insensitive" } } } : {}),
    },
    select: CAB_PRICING_SELECT,
  });
  if (all.length === 0) return [];

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
  if (!nearestCityName) return [];

  return all
    .filter((item) => (item.destination?.name ?? item.location?.name) === nearestCityName)
    .map((item) => toCabPricingResult(item, refCoords))
    .sort((a, b) => a.price - b.price);
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
    pricePerPerson:  number | null;
    totalPrice:      number | null;
    marginPercentage: number;
    gstPercentage:    number;
    inclusions:      string[];
    exclusions:      string[];
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
  accommodationRoomCapacity: number | null;
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
  /** B2B price/night the hotel team entered when fulfilling a pending
   * request — feeds computeBuilderHotelPricing's manual-price branch since
   * roomPricingId stays null for these days. */
  manualHotelPricePerNight: number | null;
  /** Read-only — who/when the hotel team filled this day in, for display
   * only (not written back by saveCustomPackage). */
  hotelFilledAt?:     Date | null;
  hotelFilledByName?: string | null;
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
  pricePerPerson:  number | null;
  totalPrice:      number | null;
  marginPercentage: number;
  gstPercentage:    number;
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
  type:           "FLIGHT" | "TRAIN";
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
  title:         string;
  description:   string;
  coverImage:    string;
  destination:   string;
  startingPoint: string;
  totalDays:     number;
  totalNights:   number;
  inclusions:    string[];
  exclusions:    string[];
  termsNotes:    string;
  stops:         StopInput[];
  itineraries:   DayItinerary[];
}

export async function copyPackageIntoDraft(
  packageSlug:  string,
  durationSlug: string,
  routeSlug:    string,
  staySlug:     string,
): Promise<PackageCopyPayload | null> {
  const data = await fetchPackagePageData(packageSlug, durationSlug, routeSlug, staySlug);
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
  accommodationLocation: string | null; accommodationRoomSpecs: string | null; accommodationRoomCapacity: number | null;
  roomPricingId: number | null;
  roomsCount: number | null;
  extraRooms: Prisma.JsonValue;
  hotelCheckIn: string | null; hotelCheckOut: string | null; hotelMealPlan: string | null;
  hotelPending: boolean; hotelPendingNote: string | null;
  manualHotelPricePerNight: number | null;
  hotelFilledAt: Date | null; hotelFilledByName: string | null;
  transport: string | null; transportPhoto: string | null; transportVehicleType: string | null;
  transportSeats: number | null; transportPickup: string | null;
  transportPickupLat: number | null; transportPickupLng: number | null;
  transportDrop: string | null;
  transportDistanceKm: number | null; transportTravelTime: string | null; notes: string | null;
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
    accommodationRoomCapacity: it.accommodationRoomCapacity ?? null,
    roomPricingId:             it.roomPricingId ?? null,
    roomsCount:                it.roomsCount ?? null,
    extraRooms:                parseRoomSelections(it.extraRooms),
    hotelCheckIn:              it.hotelCheckIn ?? "",
    hotelCheckOut:             it.hotelCheckOut ?? "",
    hotelMealPlan:             it.hotelMealPlan ?? "",
    hotelPending:              it.hotelPending,
    hotelPendingNote:          it.hotelPendingNote ?? "",
    manualHotelPricePerNight:  it.manualHotelPricePerNight ?? null,
    hotelFilledAt:             it.hotelFilledAt,
    hotelFilledByName:         it.hotelFilledByName,
    transport:                 it.transport ?? "",
    transportPhoto:            it.transportPhoto ?? "",
    transportVehicleType:      it.transportVehicleType ?? "",
    transportSeats:            it.transportSeats ?? null,
    transportPickup:           it.transportPickup ?? "",
    transportPickupLat:        it.transportPickupLat ?? null,
    transportPickupLng:        it.transportPickupLng ?? null,
    transportDrop:             it.transportDrop ?? "",
    transportDistanceKm:       it.transportDistanceKm ?? null,
    transportTravelTime:       it.transportTravelTime ?? "",
    cabPricingId:              it.cabPricingId ?? null,
    cabQuantity:               it.cabQuantity ?? null,
    extraCabs:                 parseCabSelections(it.extraCabs),
    notes:                     it.notes ?? "",
  };
}

function normalizeTicket(t: {
  id: string; type: "FLIGHT" | "TRAIN"; provider: string | null; ticketNumber: string | null;
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
      pricePerPerson:  true,
      totalPrice:      true,
      marginPercentage: true,
      gstPercentage:    true,
      inclusions:      true,
      exclusions:      true,
      termsNotes:      true,
      termsConditions: true,
      paymentPolicy:   true,
      amendmentPolicy: true,
      travelBenefits:  true,
      extraPolicyItems: true,
      pricingSnapshot: true,
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
          accommodationRoomCapacity: true,
          roomPricingId:      true,
          roomsCount:         true,
          extraRooms:         true,
          hotelCheckIn:       true,
          hotelCheckOut:      true,
          hotelMealPlan:      true,
          hotelPending:       true,
          hotelPendingNote:   true,
          manualHotelPricePerNight: true,
          hotelFilledAt:      true,
          hotelFilledByName:  true,
          transport:          true,
          transportPhoto:     true,
          transportVehicleType: true,
          transportSeats:     true,
          transportPickup:    true,
          transportPickupLat: true,
          transportPickupLng: true,
          transportDrop:      true,
          transportDistanceKm: true,
          transportTravelTime: true,
          cabPricingId:       true,
          cabQuantity:        true,
          extraCabs:          true,
          notes:              true,
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

// ─────────────────────────────────────────────────────────────────────────────
// 4. Save (create or update) a custom package with itineraries
// ─────────────────────────────────────────────────────────────────────────────
export async function saveCustomPackage(input: PackageInput): Promise<{ id: string; success: boolean; error?: string }> {
  try {
    const {
      id, queryId, title, description, coverImage, coverImagePosition, destination, startingPoint,
      totalDays, totalNights, travelDate, adults, children, infants,
      pricePerPerson, totalPrice, marginPercentage, gstPercentage, currency,
      termsNotes, extraPolicyItems,
      status, stops, itineraries, tickets, addOns,
    } = input;

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
        status: true, title: true, totalDays: true, totalNights: true, travelDate: true,
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
    // Once a package is out for costing review, only a reject (which flips
    // it back to DRAFT — see verify-packages' rejectCustomPackage) reopens
    // it for editing. The builder UI already hides/disables everything
    // while READY, but that's client-side only — this is the actual gate
    // against a stale tab (or anything else calling this action directly)
    // still being able to write over a package costing is reviewing.
    if (existing?.status === "READY") {
      return { id, success: false, error: "This package is awaiting costing review and can't be edited until it's verified or rejected back to you." };
    }

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
        pricePerPerson:  pricePerPerson ?? null,
        totalPrice:      totalPrice ?? null,
        marginPercentage,
        gstPercentage,
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
        status,
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
        pricePerPerson:  pricePerPerson ?? null,
        totalPrice:      totalPrice ?? null,
        marginPercentage,
        gstPercentage,
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
        status,
        builtByName:     builtByName || null,
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
      select: { day: true, hotelPending: true, hotelRequestedAt: true, hotelFilledAt: true, hotelFilledById: true, hotelFilledByName: true },
    });
    const existingByDay = new Map(existingHotelState.map((r) => [r.day, r]));

    await db.custom_itineraries.deleteMany({
      where: { customPackageId: pkg.id },
    });

    if (itineraries.length > 0) {
      await db.$transaction(
        itineraries.map((it) => {
          const existing = existingByDay.get(it.day);
          const alreadyFilled = !!existing?.hotelFilledAt;
          // Can't resurrect "pending" on a day the hotel team already filled.
          const hotelPending = it.hotelPending && !alreadyFilled;
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
              accommodationRoomCapacity: it.accommodationRoomCapacity ?? null,
              roomPricingId:      it.roomPricingId ?? null,
              roomsCount:         it.roomsCount ?? null,
              hotelPending,
              hotelPendingNote:   hotelPending ? (it.hotelPendingNote || null) : null,
              hotelRequestedAt,
              hotelFilledAt:      existing?.hotelFilledAt ?? null,
              hotelFilledById:    existing?.hotelFilledById ?? null,
              hotelFilledByName:  existing?.hotelFilledByName ?? null,
              manualHotelPricePerNight: it.manualHotelPricePerNight ?? null,
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
              transportPickupLng: it.transportPickupLng ?? null,
              transportDrop:      it.transportDrop || null,
              transportDistanceKm: it.transportDistanceKm ?? null,
              transportTravelTime: it.transportTravelTime || null,
              cabPricingId:       it.cabPricingId ?? null,
              cabQuantity:        it.cabQuantity ?? null,
              // Same "drop unfinished rows" filter as extraRooms above.
              extraCabs:          (it.extraCabs ?? []).filter((c) => c.label.trim()) as unknown as Prisma.InputJsonValue,
              notes:              it.notes || null,
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
      );
    }

    // Replace tickets — flat rows, no nested children, so createMany is fine
    // (same pattern as stops above).
    await db.custom_package_tickets.deleteMany({
      where: { customPackageId: pkg.id },
    });
    if (tickets.length > 0) {
      await db.custom_package_tickets.createMany({
        data: tickets.map((t, idx) => ({
          customPackageId: pkg.id,
          type:            t.type,
          provider:        t.provider || null,
          ticketNumber:    t.ticketNumber || null,
          fromPlace:       t.fromPlace || null,
          toPlace:         t.toPlace || null,
          travelDate:      t.travelDate ? new Date(t.travelDate) : null,
          departureTime:   t.departureTime || null,
          arrivalTime:     t.arrivalTime || null,
          durationText:    t.durationText || null,
          adults:          t.adults,
          children:        t.children,
          infants:         t.infants,
          ticketCount:     t.ticketCount,
          fare:            t.fare ?? null,
          notes:           t.notes || null,
          sortOrder:       idx,
        })),
      });
    }

    // Replace add-ons — flat rows, no nested children, same pattern as
    // tickets/stops above.
    await db.custom_package_addons.deleteMany({
      where: { customPackageId: pkg.id },
    });
    const namedAddons = addOns.filter((a) => a.name.trim());
    if (namedAddons.length > 0) {
      await db.custom_package_addons.createMany({
        data: namedAddons.map((a, idx) => ({
          customPackageId: pkg.id,
          name:            a.name,
          price:           a.price ?? 0,
          quantity:        a.quantity || 1,
          notes:           a.notes || null,
          day:             a.day ?? null,
          sortOrder:       idx,
        })),
      });
    }

    revalidatePath("/dashboard/package-builder");

    return { id: pkg.id, success: true };
  } catch (err) {
    console.error("[saveCustomPackage]", err);
    return { id: "", success: false, error: "Failed to save package" };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. Mark package as SENT → update query status → return WhatsApp URL
// ─────────────────────────────────────────────────────────────────────────────
export async function sendPackageToClient(packageId: string): Promise<{
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
          extraRooms:    parseRoomSelections(it.extraRooms),
          manualHotelPricePerNight: it.manualHotelPricePerNight,
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
    const finalPrice = taxable + gstAmount;
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
export async function markPackageReady(packageId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { actor } = await getCurrentActor();

    const pkg = await db.custom_packages.findUnique({
      where: { id: packageId },
      select: { id: true, status: true, queryId: true },
    });
    if (!pkg) return { success: false, error: "Package not found" };
    if (!pkg.queryId) return { success: false, error: "This package isn't linked to a client query yet — attach one before submitting for review." };
    if (pkg.status === "SENT") return { success: false, error: "This package has already been sent to the client." };

    await db.custom_packages.update({
      where: { id: packageId },
      data: {
        status: "READY",
        readyAt: new Date(),
        readyBy: actor?.id ?? null,
        readyByName: actor?.name ?? null,
        verified: false, verifiedAt: null, verifiedBy: null, verifiedByName: null,
        rejectedAt: null, rejectedBy: null, rejectedByName: null, rejectionReasonId: null, rejectionNote: null,
        execNotifiedAt: null,
        // A prior review cycle's correction may no longer apply to whatever
        // the exec just changed — start the new cycle with a clean slate.
        hotelSubtotalOverride: null, cabSubtotalOverride: null,
      },
    });

    await logTimeline(pkg.queryId, `Package marked ready for costing review by ${actor?.name ?? "team member"}`, actor?.id, actor?.name ?? undefined);
    await broadcastVerificationCounts();

    revalidatePath("/dashboard/package-builder");
    revalidatePath(`/dashboard/package-builder/${packageId}`);
    revalidatePath("/dashboard/verify-packages");
    revalidatePath("/dashboard/sales-query");
    return { success: true };
  } catch (err) {
    console.error("[markPackageReady]", err);
    return { success: false, error: "Failed to mark package ready" };
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
      select: { id: true, status: true, verified: true, queryId: true },
    });
    if (!pkg) return { success: false, error: "Package not found" };
    if (!pkg.verified) return { success: false, error: "This package hasn't been approved by costing yet." };

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

    return { success: true, whatsappUrl: sendResult.whatsappUrl, shareUrl: sendResult.shareUrl };
  } catch (err) {
    console.error("[shareCustomPackageWithClient]", err);
    return { success: false, error: "Failed to send package" };
  }
}

export type PackageStatusEvent = {
  id: string;
  title: string;
  kind: "verified" | "rejected";
  reasonLabel: string | null;
  note: string | null;
};

/**
 * Polled every ~20s by PackageStatusNotifier (mounted for sales execs in the
 * dashboard layout) so an exec sees "your package was approved" or "…was
 * rejected — <reason>" as a toast without refreshing. No generic
 * notification bus exists in this dashboard yet — this is deliberately
 * narrow (just these two package events) rather than building one.
 *
 * Marks every returned row execNotifiedAt=now in the same call, so a event
 * surfaces exactly once — re-marking ready (which clears execNotifiedAt)
 * or a fresh verify/reject decision is what makes an event eligible again.
 */
export async function getMyUnseenPackageEvents(): Promise<PackageStatusEvent[]> {
  const { teamMemberId } = await getCurrentActor();
  if (!teamMemberId) return [];

  const rows = await db.custom_packages.findMany({
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
  });
  if (rows.length === 0) return [];

  await db.custom_packages.updateMany({
    where: { id: { in: rows.map((r) => r.id) } },
    data: { execNotifiedAt: new Date() },
  });

  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    kind: r.verified ? "verified" as const : "rejected" as const,
    reasonLabel: r.rejectionReason?.label ?? null,
    note: r.rejectionNote,
  }));
}

// emailPackageToClient lives in ./email-package.ts (a plain, non-"use server"
// module) rather than here — imported above, called from
// shareCustomPackageWithClient, the only place that ever calls it now.
