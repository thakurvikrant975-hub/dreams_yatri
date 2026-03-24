

// ── Pricing row ───────────────────────────────────────────────────────────────
export type PricingRow = {
  duration_id:      number;
  route_index:      number;
  stay_category_id: number;
  price:            string;
  original_price:   string | null;
};

// ── Route option ──────────────────────────────────────────────────────────────
export type RouteOption = {
  id:         number;
  label:      string;
  stops:      string[];
  is_default: boolean;
};

// ── Itinerary day ─────────────────────────────────────────────────────────────
export type ItineraryDay = {
  id:           number;
  day:          number;
  title:        string;
  description:  string | null;
  activities:   unknown;
  activity_ids: unknown;
  meals:        unknown;
  route_index:  number | null;
  hotel: {
    id:             number;
    name:           string;
    slug:           string;
    star_rating:    number | null;
    category:       string | null;
    check_in_time:  string | null;
    check_out_time: string | null;
    images: {
      url:         string;
      thumbnail:   string | null;
      blur_base64: string | null;
      alt:         string | null;
    }[];
  } | null;
};

// ── Stay category ─────────────────────────────────────────────────────────────
export type StayCategory = {
  id:                number;
  label:             string;
  description:       string | null;
  is_default:        boolean;
  min_duration_days: number | null;
  sort_order:        number;
};

// ── Duration with pricing ─────────────────────────────────────────────────────
export type DurationCard = {
  id:           number;
  slug:         string;
  label:        string;
  days:         number;
  nights:       number;
  is_default:   boolean;
  routes:       unknown;
  meta_title:   string | null;
  meta_desc:    string | null;
  pricing:      PricingRow[];
};

// ── Current duration — full data for selected duration ────────────────────────
export type CurrentDuration = DurationCard & {
  itineraries: ItineraryDay[];
};

// ── Package page data — full SSR response ─────────────────────────────────────
export type PackagePageData = {
  id:          number;
  title:       string;
  slug:        string;
  thumbnail:   string | null;
  cover_image: string | null;
  description: string | null;
  destination: {
    name:   string;
    slug:   string;
    region: { name: string; slug: string };
  };
  images: {
    url:         string;
    thumbnail:   string | null;
    blur_base64: string | null;
    alt:         string | null;
    is_primary:  boolean;
  }[];
  durations:       DurationCard[];
  stay_categories: StayCategory[];
  tags:       { tag:      { name: string; slug: string } }[];
  categories: { category: { name: string; slug: string } }[];
  currentDuration: CurrentDuration;
};

// ── Hotel ─────────────────────────────────────────────────────────────────────
export type PackageHotel = {
  is_recommended: boolean;
  night_number:   number | null;
  stay_category:  { id: number; label: string; sort_order: number };
  hotel: {
    id:             number;
    name:           string;
    slug:           string;
    description:    string | null;
    star_rating:    number | null;
    category:       string | null;
    address:        string | null;
    amenities:      unknown;
    check_in_time:  string | null;
    check_out_time: string | null;
    images: {
      url:         string;
      thumbnail:   string | null;
      blur_base64: string | null;
      alt:         string | null;
      is_primary:  boolean;
    }[];
    rooms: {
      name:      string;
      capacity:  number;
      amenities: unknown;
    }[];
  };
};

// ── Activity ──────────────────────────────────────────────────────────────────
export type PackageActivity = {
  day_number:  number;
  is_optional: boolean;
  extra_price: string | null;
  activity: {
    id:             number;
    name:           string;
    slug:           string;
    description:    string | null;
    duration_hours: string | null;
    difficulty:     string | null;
    category:       string | null;
    price:          string | null;
    images: {
      url:         string;
      thumbnail:   string | null;
      blur_base64: string | null;
      alt:         string | null;
    }[];
  };
};