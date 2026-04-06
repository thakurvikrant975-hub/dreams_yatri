// app/types/hotel.ts

export type HotelCardData = {
  id:             number;
  name:           string;
  slug:           string;
  thumbnail:      string | null;
  category:       string | null;
  star_rating:    number | null;
  address:        string | null;
  check_in_time:  string | null;
  check_out_time: string | null;
  destination: {
    id:   number;
    name: string;
    region: { id: number; name: string };
  };
  room_pricing: {
    price_per_night: number;
    original_price:  number | null;
    room_type:       string;
    season:          string;
  }[];
  _count: { room_pricing: number };
};

export type HotelListMeta = {
  total:       number;
  page:        number;
  limit:       number;
  totalPages:  number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
};

export type HotelListResponse = {
  data: HotelCardData[];
  meta: HotelListMeta;
};

export type HotelFilters = {
  page?:           number;
  limit?:          number;
  destination_id?: number;
  region_id?:      number;
  category?:       string;
  stars?:          number;
  min_price?:      number;
  max_price?:      number;
  sort?:           "newest" | "price_asc" | "price_desc";
  search?:         string;
};

// ── Build query string from filters ──────────────────────────────────────

export function buildHotelParams(filters: HotelFilters): string {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      params.set(key, String(value));
    }
  });
  return params.toString();
}

// ── Server-side fetch (SSR) ───────────────────────────────────────────────
// Call this in a Server Component — no auth header needed (same origin)

export async function fetchHotelsSSR(
  filters: HotelFilters = {},
  baseUrl: string,
): Promise<HotelListResponse> {
  const qs  = buildHotelParams(filters);
  const res = await fetch(`${baseUrl}/api/hotels?${qs}`, {
    next: { revalidate: 60 },  // ISR — revalidate every 60s
  });

  if (!res.ok) throw new Error("Failed to fetch hotels");
  return res.json();
}

// ── Client-side fetch ─────────────────────────────────────────────────────

export async function fetchHotels(
  filters: HotelFilters = {},
): Promise<HotelListResponse> {
  const qs  = buildHotelParams(filters);
  const res = await fetch(`/api/hotels?${qs}`);
  if (!res.ok) throw new Error("Failed to fetch hotels");
  return res.json();
}