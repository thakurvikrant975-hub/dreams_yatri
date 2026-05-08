import type {
  packages,
  package_durations,
  package_routes,
  route_stops,
  package_itineraries,
  itinerary_stays,
  itinerary_activities,
  itinerary_transfers,
  itinerary_notes,
  package_stay_categories,
  package_pricing,
  package_cab_options,
  package_gallery,
  package_images,
  destinations,
  hotel_room_pricing,
  hotel_rooms,
  hotels,
  activities,
  CabType,
  GallerySourceType,
} from "@/app/generated/prisma";

// ── Prisma model aliases ───────────────────────────────────────────────────────

export type Package = packages;
export type PackageDuration = package_durations;
export type PackageRoute = package_routes;
export type RouteStop = route_stops;
export type PackageItinerary = package_itineraries;
export type ItineraryStay = itinerary_stays;
export type ItineraryActivity = itinerary_activities;
export type ItineraryTransfer = itinerary_transfers;
export type ItineraryNote = itinerary_notes;
export type PackageStayCategory = package_stay_categories;
export type PackagePricing = package_pricing;
export type PackageCabOption = package_cab_options;
export type PackageGallery = package_gallery;
export type PackageImage = package_images;

export type { CabType, GallerySourceType };

// ── Destination slim pick (shared across views) ────────────────────────────────

export type DestinationRef = Pick<destinations, "id" | "name" | "slug">;

// ── Route view types ───────────────────────────────────────────────────────────

export type RouteStopWithDestination = RouteStop & {
  destination: DestinationRef;
};

export type RouteWithStops = PackageRoute & {
  stops: RouteStopWithDestination[];
};

// ── Hotel / Room pricing view types ───────────────────────────────────────────

export type HotelRef = Pick<
  hotels,
  "id" | "name" | "slug" | "star_rating" | "category"
>;

export type RoomRef = Pick<hotel_rooms, "id" | "name" | "slug"> | null;

export type RoomPricingWithHotel = hotel_room_pricing & {
  hotel: HotelRef;
  room: RoomRef;
};

// ── Itinerary view types ───────────────────────────────────────────────────────

export type ItineraryStayView = ItineraryStay & {
  room_pricing: RoomPricingWithHotel;
  stay_category: Pick<PackageStayCategory, "id" | "label" | "slug">;
};

export type ItineraryActivityView = ItineraryActivity & {
  activity: Pick<
    activities,
    "id" | "name" | "slug" | "price" | "duration_hours" | "category"
  >;
};

export type ItineraryDayView = PackageItinerary & {
  itineraryStays: ItineraryStayView[];
  itinerary_activities: ItineraryActivityView[];
  itinerary_transfers: ItineraryTransfer[];
  itinerary_notes: ItineraryNote[];
};

// ── Package list view (dashboard table row) ───────────────────────────────────

export type PackageListItem = Pick<
  Package,
  "id" | "title" | "slug" | "thumbnail" | "is_active" | "created_at"
> & {
  destination: DestinationRef;
  durations: Pick<
    PackageDuration,
    "id" | "label" | "days" | "nights" | "is_default"
  >[];
  _count: { bookings: number };
};

// ── Package detail view (dashboard edit page) ─────────────────────────────────

export type PackageWithRelations = Package & {
  destination: DestinationRef;
  durations: PackageDuration[];
  packageRoutes: RouteWithStops[];
  stay_categories: PackageStayCategory[];
  packagePricings: PackagePricing[];
  cabOptions: PackageCabOption[];
};

// ── Itinerary grid view (all days for a duration + route) ─────────────────────

export type ItineraryGrid = {
  total_days: number;
  days: ItineraryDayView[];
  /** day numbers that have no itinerary record yet */
  missing_days: number[];
};

// ── Pricing computation types ──────────────────────────────────────────────────

export type PackagePriceQueryInput = {
  package_id: number;
  duration_id: number;
  stay_category_id: number;
  pax: number;
};

export type StayCostLine = {
  day: number;
  stay_category_id: number;
  stay_category_label: string;
  room_pricing_id: number;
  hotel_name: string;
  room_name: string | null;
  price_per_night: number;
  nights: number;
  subtotal: number;
};

export type ActivityCostLine = {
  day: number;
  activity_id: number;
  activity_name: string;
  price_per_person: number;
  pax: number;
  is_optional: boolean;
  subtotal: number;
};

export type TransferCostLine = {
  day: number;
  transfer_id: number;
  pickup_name: string | null;
  drop_name: string | null;
  vehicle_name: string | null;
  num_vehicles: number;
  distance_km: number | null;
  cost_price: number | null;
  sell_price: number | null;
};

export type PackagePriceBreakdown = {
  stay_lines: StayCostLine[];
  activity_lines: ActivityCostLine[];
  transfer_lines: TransferCostLine[];
  base_cost: number;
  margin_percentage: number;
  margin_amount: number;
  gst_percentage: number;
  gst_amount: number;
  final_price: number;
};

// ── Server action result wrapper ───────────────────────────────────────────────

export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string; fieldErrors?: Record<string, string[]> };
