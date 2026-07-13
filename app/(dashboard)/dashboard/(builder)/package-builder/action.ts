"use server";

import { revalidatePath } from "next/cache";
import { getCurrentActor } from "@/app/(dashboard)/dashboard/(main)/(marketing)/queries/actions";
import { fetchPackagePageData } from "@/app/actions/packages/fetch-page-data";
import { getHeroImage, getThumbnailImage } from "@/app/lib/imageUrl";
import { db } from "@/app/lib/db";
import { sendEmail } from "@/app/lib/functions/sendEmail";
import type { Prisma } from "@/app/generated/prisma";

// meal_types.covered_meals / itinerary_stays.active_meals store lowercase
// keys ("breakfast", "lunch", "dinner") — mapped to the same labels the
// builder's own meal toggle chips use (see MEAL_OPTIONS in page.tsx).
const MEAL_KEY_LABELS: Record<string, string> = {
  breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner",
};

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
      name: true, category: true, thumbnail: true, city: true, state: true,
      images: { select: { url: true, thumbnail: true }, orderBy: HOTEL_IMAGE_ORDER, take: 1 },
      location: { select: { latitude: true, longitude: true } },
    },
  },
  room: {
    select: {
      name: true, bed_type: true, view_type: true, area_sqft: true, max_occupancy: true,
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
  /** "City, State" — shown under the hotel name in the preview. */
  location:      string | null;
  /** e.g. "1 Double Bed | Mountain View | 250 sq.ft" */
  roomSpecs:     string | null;
  roomCapacity:  number | null;
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

export async function searchHotelRoomsForBuilder(
  cityOrDestinationName: string,
  query: string,
  refCoords?: { lat: number; lng: number } | null,
  page: number = 1,
): Promise<HotelRoomResult[]> {
  const city = cityOrDestinationName.split(",")[0]?.trim();
  if (!city) return [];

  const list = await db.hotel_room_pricing.findMany({
    where: {
      is_active: true,
      hotel: {
        is_active: true,
        OR: [
          { city: { contains: city, mode: "insensitive" } },
          { destination: { name: { contains: city, mode: "insensitive" } } },
        ],
        ...(query ? { name: { contains: query, mode: "insensitive" } } : {}),
      },
    },
    select: HOTEL_ROOM_SELECT,
    take: HOTEL_SEARCH_PAGE_SIZE,
    skip: (Math.max(page, 1) - 1) * HOTEL_SEARCH_PAGE_SIZE,
    orderBy: [{ hotel: { name: "asc" } }, { sort_order: "asc" }],
  });

  return list.map((item) => {
    const rawHotelPhoto = item.hotel.images[0]?.thumbnail ?? item.hotel.images[0]?.url ?? item.hotel.thumbnail ?? null;
    const rawRoomPhotos = (item.room?.images ?? []).map((img) => img.thumbnail ?? img.url).filter((u): u is string => !!u);
    const rawThumbnail = rawRoomPhotos[0] ?? rawHotelPhoto ?? null;
    const roomSpecs = [item.room?.bed_type, item.room?.view_type, item.room?.area_sqft ? `${item.room.area_sqft} sq.ft` : null]
      .filter(Boolean).join(" | ") || null;

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
      location:      [item.hotel.city, item.hotel.state].filter(Boolean).join(", ") || null,
      roomSpecs,
      roomCapacity:  item.room?.max_occupancy ?? null,
      distanceKm,
    };
  });
}

export interface ActivityResult {
  id:            number;
  name:          string;
  category:      string | null;
  durationHours: number | null;
  thumbnail:     string | null;
  /** Up to 3 gallery photos — "Glimpses of the experience" style. */
  photos:        string[];
  photoLabels:   string[];
}

export async function searchActivitiesForBuilder(cityOrDestinationName: string, query: string): Promise<ActivityResult[]> {
  const city = cityOrDestinationName.split(",")[0]?.trim();
  if (!city) return [];

  const list = await db.activities.findMany({
    where: {
      is_active: true,
      OR: [
        { city: { contains: city, mode: "insensitive" } },
        { destination: { name: { contains: city, mode: "insensitive" } } },
        // `city`/`destination_id` are unpopulated on virtually every real
        // activity row — the city instead lives as a suffix in the name
        // itself (e.g. "Tea Garden Walk munnar"), so match against that too.
        { name: { contains: city, mode: "insensitive" } },
      ],
      ...(query ? { name: { contains: query, mode: "insensitive" } } : {}),
    },
    select: {
      id: true, name: true, duration_hours: true,
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
}

export interface QueryDetail extends QueryRow {
  message: string | null;
  /** Joined from TeamMember — package_queries.assignedTo has no FK relation. */
  execEmail:       string | null;
  execDesignation: string | null;
  customPackage: {
    id:              string;
    status:          string;
    sentAt:          Date | null;
    viewedAt:        Date | null;
    viewCount:       number;
    /** Snapshot of the last-SENT version, captured right before an edit
     * overwrites it — see PreviousSnapshot in page.tsx for the shape. */
    previousSnapshot: unknown;
    title:           string;
    description:     string | null;
    coverImage:      string | null;
    pricePerPerson:  number | null;
    totalPrice:      number | null;
    flightsIncluded: boolean;
    flightNotes:     string | null;
    flightFrom:      string | null;
    flightTo:        string | null;
    trainIncluded:   boolean;
    trainNotes:      string | null;
    trainFrom:       string | null;
    trainTo:         string | null;
    stops:           StopInput[];
    itineraries:     DayItinerary[];
  } | null;
}

export interface StopInput {
  id?:     string;
  name:    string;
  nights:  number;
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
  hotelCheckIn:       string;
  hotelCheckOut:      string;
  hotelMealPlan:      string;
  transport:          string;
  transportPhoto:     string;
  transportVehicleType: string;
  transportSeats:     number | null;
  transportPickup:    string;
  transportDrop:      string;
  transportDistanceKm: number | null;
  notes:              string;
}

export interface PackageInput {
  queryId:         string;
  title:           string;
  description:     string;
  coverImage:      string;
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
  currency:        string;
  inclusions:      string[];
  exclusions:      string[];
  termsNotes:      string;
  flightsIncluded: boolean;
  flightNotes:     string;
  flightFrom:      string;
  flightTo:        string;
  trainIncluded:   boolean;
  trainNotes:      string;
  trainFrom:       string;
  trainTo:         string;
  status:          "DRAFT" | "READY";
  stops:           StopInput[];
  itineraries:     DayItinerary[];
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
      // The catalog's public page-data fetcher doesn't expose the raw
      // hotel_room_pricing id, so a copied template needs the exec to
      // re-pick the room via search before it counts toward auto pricing.
      roomPricingId:      null,
      hotelCheckIn:       day.hotel?.check_in_time ?? "",
      hotelCheckOut:      day.hotel?.check_out_time ?? "",
      hotelMealPlan:      day.hotel?.plan_name ?? day.hotel?.meal_type ?? "",
      transport:          transfer?.vehicle_name ?? "",
      transportPhoto:     transfer?.vehicle_image_key ? getThumbnailImage(transfer.vehicle_image_key) : "",
      transportVehicleType: transfer?.vehicle_type ?? "",
      transportSeats:     transfer?.vehicle_capacity ?? null,
      transportPickup:    transfer?.pickup_name ?? "",
      transportDrop:      transfer?.drop_name ?? "",
      transportDistanceKm: transfer?.distance_km ?? null,
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
      },
    }),
  ]);

  return {
    queries: queries as QueryRow[],
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
  hotelCheckIn: string | null; hotelCheckOut: string | null; hotelMealPlan: string | null;
  transport: string | null; transportPhoto: string | null; transportVehicleType: string | null;
  transportSeats: number | null; transportPickup: string | null; transportDrop: string | null;
  transportDistanceKm: number | null; notes: string | null;
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
    hotelCheckIn:              it.hotelCheckIn ?? "",
    hotelCheckOut:             it.hotelCheckOut ?? "",
    hotelMealPlan:             it.hotelMealPlan ?? "",
    transport:                 it.transport ?? "",
    transportPhoto:            it.transportPhoto ?? "",
    transportVehicleType:      it.transportVehicleType ?? "",
    transportSeats:            it.transportSeats ?? null,
    transportPickup:           it.transportPickup ?? "",
    transportDrop:             it.transportDrop ?? "",
    transportDistanceKm:       it.transportDistanceKm ?? null,
    notes:                     it.notes ?? "",
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Get single query detail (with existing custom package if any)
// ─────────────────────────────────────────────────────────────────────────────
export async function getQueryDetail(queryId: string): Promise<QueryDetail | null> {
  const query = await db.package_queries.findUnique({
    where: { id: queryId },
    select: {
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
      // custom_packages is a singular 1:1 relation (queryId is @unique on
      // custom_packages), so no take/orderBy here — those only apply to
      // to-many relations.
      custom_packages: {
        select: {
          id:              true,
          status:          true,
          sentAt:          true,
          viewedAt:        true,
          viewCount:       true,
          previousSnapshot: true,
          title:           true,
          description:     true,
          coverImage:      true,
          pricePerPerson:  true,
          totalPrice:      true,
          flightsIncluded: true,
          flightNotes:     true,
          flightFrom:      true,
          flightTo:        true,
          trainIncluded:   true,
          trainNotes:      true,
          trainFrom:       true,
          trainTo:         true,
          stops: {
            orderBy: { sortOrder: "asc" },
            select: { id: true, name: true, nights: true },
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
              hotelCheckIn:       true,
              hotelCheckOut:      true,
              hotelMealPlan:      true,
              transport:          true,
              transportPhoto:     true,
              transportVehicleType: true,
              transportSeats:     true,
              transportPickup:    true,
              transportDrop:      true,
              transportDistanceKm: true,
              notes:              true,
              activities: {
                orderBy: { sortOrder: "asc" },
                select: { id: true, title: true, description: true, photo: true, photos: true, photoLabels: true },
              },
            },
          },
        },
      },
    },
  });

  if (!query) return null;

  // package_queries.assignedTo is a plain string (no FK relation defined),
  // so the exec's contact details need a separate lookup.
  const exec = query.assignedTo
    ? await db.teamMember.findUnique({
        where:  { id: query.assignedTo },
        select: { email: true, designation: true },
      })
    : null;

  return {
    ...(query as any),
    execEmail:       exec?.email ?? null,
    execDesignation: exec?.designation ?? null,
    customPackage: query.custom_packages ? {
      ...query.custom_packages,
      itineraries: query.custom_packages.itineraries.map(normalizeItinerary),
    } : null,
  } as QueryDetail;
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Save (create or update) a custom package with itineraries
// ─────────────────────────────────────────────────────────────────────────────
export async function saveCustomPackage(input: PackageInput): Promise<{ id: string; success: boolean; error?: string }> {
  try {
    const {
      queryId, title, description, coverImage, destination, startingPoint,
      totalDays, totalNights, travelDate, adults, children, infants,
      pricePerPerson, totalPrice, currency, inclusions, exclusions,
      termsNotes, flightsIncluded, flightNotes, flightFrom, flightTo,
      trainIncluded, trainNotes, trainFrom, trainTo,
      status, stops, itineraries,
    } = input;

    const { teamMemberId, teamMemberName } = await getCurrentActor();
    const builtBy = teamMemberId ?? "unknown";
    const builtByName = teamMemberName ?? "Sales Executive";

    // If a package was already SENT to the client, snapshot what they were
    // actually shown before this save overwrites it — otherwise an exec
    // editing after send has no way to see what changed from the version
    // the customer has in hand.
    let previousSnapshot: Prisma.InputJsonValue | undefined;
    const existing = await db.custom_packages.findUnique({
      where:  { queryId },
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

    // Upsert the custom package (unique on queryId)
    const pkg = await db.custom_packages.upsert({
      where:  { queryId },
      create: {
        queryId,
        title,
        description:     description || null,
        coverImage:      coverImage || null,
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
        currency,
        inclusions,
        exclusions,
        termsNotes:      termsNotes || null,
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
        currency,
        inclusions,
        exclusions,
        termsNotes:      termsNotes || null,
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
          sortOrder:       idx,
        })),
      });
    }

    // Replace itineraries (and their nested activities, via cascade) — delete
    // all then recreate. Nested `activities.create` needs one create per day
    // rather than createMany, since createMany can't take nested writes.
    await db.custom_itineraries.deleteMany({
      where: { customPackageId: pkg.id },
    });

    if (itineraries.length > 0) {
      await db.$transaction(
        itineraries.map((it) =>
          db.custom_itineraries.create({
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
              hotelCheckIn:       it.hotelCheckIn || null,
              hotelCheckOut:      it.hotelCheckOut || null,
              hotelMealPlan:      it.hotelMealPlan || null,
              transport:          it.transport || null,
              transportPhoto:     it.transportPhoto || null,
              transportVehicleType: it.transportVehicleType || null,
              transportSeats:     it.transportSeats ?? null,
              transportPickup:    it.transportPickup || null,
              transportDrop:      it.transportDrop || null,
              transportDistanceKm: it.transportDistanceKm ?? null,
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
          }),
        ),
      );
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
      },
    });

    if (!pkg) return { success: false, error: "Package not found" };

    const baseUrl  = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
    const shareUrl = `${baseUrl}/itinerary/${packageId}`;

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

    const priceStr = pkg.totalPrice
      ? `${pkg.currency} ${Number(pkg.totalPrice).toLocaleString("en-IN")}`
      : "To be confirmed";

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
    await db.$transaction([
      db.custom_packages.update({
        where: { id: packageId },
        data:  { status: "SENT", sentAt: new Date() },
      }),
      db.package_queries.update({
        where: { id: pkg.queryId },
        data:  { status: "PACKAGE_SENT" },
      }),
    ]);

    // ── Email the client a link to the live itinerary ─────────────────────────
    // Best-effort — a failed/missing email should never block the WhatsApp
    // send, since that's already been handed back to the exec by this point.
    if (pkg.query.email) {
      const emailHtml = [
        `<div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:24px;">`,
        `<h2 style="color:#1a1a1a;">Hi ${pkg.query.name} 👋</h2>`,
        `<p style="color:#444;font-size:15px;">Your customised <strong>${pkg.title}</strong> package is ready!</p>`,
        `<p style="color:#444;font-size:15px;">`,
        `📍 <strong>Destination:</strong> ${pkg.destination}<br/>`,
        `📅 <strong>Travel Date:</strong> ${travelDateStr}<br/>`,
        `🌙 <strong>Duration:</strong> ${pkg.totalDays} Days / ${pkg.totalNights} Nights<br/>`,
        `👥 <strong>Travellers:</strong> ${paxLine}<br/>`,
        `💰 <strong>Total Price:</strong> ${priceStr}`,
        `</p>`,
        `<a href="${shareUrl}" style="display:inline-block;margin-top:12px;padding:12px 24px;background:#e11d48;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;">View Your Itinerary</a>`,
        `<p style="color:#888;font-size:12px;margin-top:24px;">Let us know if you'd like any changes!</p>`,
        `</div>`,
      ].join("");

      await sendEmail({
        to:      pkg.query.email,
        subject: `Your ${pkg.title} itinerary is ready!`,
        html:    emailHtml,
      }).catch((err) => console.error("[sendPackageToClient] email failed:", err));
    }

    revalidatePath("/dashboard/package-builder");

    return { success: true, whatsappUrl, shareUrl };
  } catch (err) {
    console.error("[sendPackageToClient]", err);
    return { success: false, error: "Failed to send package" };
  }
}
