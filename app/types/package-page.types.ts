// app/types/package-page.types.ts

// ── Shared primitives ─────────────────────────────────────────────────────────

export type ImageAsset = {
  url: string;
  thumbnail: string | null;
  blur_base64: string | null;
  alt: string | null;
};

export type ImageAssetWithPrimary = ImageAsset & {
  is_primary: boolean;
};

// ── Route ─────────────────────────────────────────────────────────────────────
type RouteStop = {
  d: number;  // day number
  p: string;  // place name
};

export type RouteOption = {
  id: number;
  slug: string;
  label: string;
  stops: RouteStop[];
  is_default: boolean;
};

// ── Stay category ─────────────────────────────────────────────────────────────

export type StayCategory = {
  id: number;
  slug: string;
  label: string;
  description: string | null;
  is_default: boolean;
  min_duration_days: number | null;
  sort_order: number;
};

// ── Pricing ───────────────────────────────────────────────────────────────────

export type DurationPricing = {
  route_index: number | null;
  stay_category_id: number;
  price: number;
  original_price: number | null;
};

// ── Hotel ─────────────────────────────────────────────────────────────────────

// app/types/package-page.types.ts
export type RoomPricing = {
  room_type: string;
  description: string | null;
  occupancy: number | null;  // was string | null
  amenities: unknown;
  price_per_night: number;
  original_price: number | null;
  margin_percentage: number | null;
};

export type Hotel = {
  id: number;
  name: string;
  slug: string;
  stay_type: string | null;
  category: string | null;
  check_in_time: string | null;
  check_out_time: string | null;
  images: ImageAsset[];
  room_pricing: RoomPricing[];
};

// ── Activity ──────────────────────────────────────────────────────────────────

// types/package-page.types.ts

export type Activity = {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  duration_hours: number | null;
  difficulty: string | null;
  category: string | null;
  price: number | null;
  original_price: number | null;
  margin_percentage: number;
  pricing_type: string | null;
  min_persons: number | null;
  max_persons: number | null;
  images: {
    url: string;
    thumbnail: string | null;
    blur_base64: string | null;
    alt: string | null;
    is_primary: boolean | null;
  }[];
};

// ── Itinerary ─────────────────────────────────────────────────────────────────

export type ItineraryDay = {
  id: number;
  day: number;
  title: string;
  description: string | null;
  meals: string[] | null;
  route_index: number | null;
  hotel_days: number[] | null;
  activity_details: Activity[];
  hotel: Hotel | null;
};

// ── Duration ──────────────────────────────────────────────────────────────────

// Used in the duration selector — lightweight, no full pricing array
export type DurationCard = {
  id: number;
  slug: string;
  label: string;
  days: number;
  nights: number;
  is_default: boolean;
  routes: RouteOption[];
  meta_title: string | null;
  meta_desc: string | null;
  startingPrice: number | null;
  originalPrice: number | null;
};

// Full duration data for the selected/active duration
export type CurrentDuration = {
  id: number;
  slug: string;
  label: string;
  days: number;
  nights: number;
  is_default: boolean;
  routes: RouteOption[];
  meta_title: string | null;
  meta_desc: string | null;
  filteredItinerary: ItineraryDay[];
  currentPricing: DurationPricing[];
  selectedRouteIndex: number;
  selectedStayCategory: StayCategory;
};

// ── Package page ──────────────────────────────────────────────────────────────

export type PackagePageData = {
  id: number;
  title: string;
  slug: string;
  thumbnail: string | null;
  cover_image: string | null;
  description: string | null;
  meta_title: string | null;
  meta_desc: string | null;
  destination: {
    name: string;
    slug: string;
    region: { name: string; slug: string };
  };
  images: ImageAssetWithPrimary[];
  durations: DurationCard[];
  stay_categories: StayCategory[];
  tags: { name: string; slug: string }[];
  categories: { name: string; slug: string }[];
  currentDuration: CurrentDuration;
};

// ── Package hotel (for hotel listing on package — separate from itinerary) ────

export type PackageHotel = {
  is_recommended: boolean;
  night_number: number | null;
  stay_category: { id: number; label: string; sort_order: number };
  hotel: {
    id: number;
    name: string;
    slug: string;
    description: string | null;
    stay_type: string | null;
    category: string | null;
    address: string | null;
    amenities: unknown;
    check_in_time: string | null;
    check_out_time: string | null;
    images: ImageAssetWithPrimary[];
    rooms: {
      name: string;
      capacity: number;
      amenities: unknown;
    }[];
  };
};

// ── Package activity (for activity listing on package — separate from itinerary) ─

export type PackageActivity = {
  day_number: number;
  is_optional: boolean;
  extra_price: number | null;   // was string — Decimal must be converted
  activity: {
    id: number;
    name: string;
    slug: string;
    description: string | null;
    duration_hours: number | null;  // was string
    difficulty: string | null;
    category: string | null;
    price: number | null;  // was string
    images: ImageAsset[];
  };
};