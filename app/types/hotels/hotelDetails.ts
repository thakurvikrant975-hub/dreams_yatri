// app/types/hotelDetail.ts

export type HotelImage = {
  id:         number;
  url:        string;
  thumbnail:  string | null;
  alt:        string | null;
  is_primary: boolean;
  sort_order: number;
};

export type HotelImageCategory = {
  id:              number;
  name:            string;
  is_required:     boolean;
  room_pricing_id: number | null;
  images:          HotelImage[];
};

export type HotelRoom = {
  id:                number;
  room_type:         string;
  description:       string | null;
  occupancy:         number;
  price_per_night:   number;
  original_price:    number | null;
  season:            string;
  amenities:         unknown;
  margin_percentage: number;
};

export type HotelDetail = {
  id:             number;
  name:           string;
  slug:           string;
  thumbnail:      string | null;
  description:    string | null;
  meta_title:     string | null;
  meta_desc:      string | null;
  address:        string | null;
  latitude:       number | null;
  longitude:      number | null;
  category:       string | null;
  stay_type:      string | null;
  amenities:      unknown;
  check_in_time:  string | null;
  check_out_time: string | null;
  destination: {
    id:   number;
    name: string;
    slug: string;
    region: { id: number; name: string; slug: string };
  };
  room_pricing:     HotelRoom[];
  image_categories: HotelImageCategory[];
};

// All images flattened in order
export function getAllImages(hotel: HotelDetail): HotelImage[] {
  return hotel.image_categories
    .flatMap(cat => cat.images)
    .sort((a, b) => {
      if (a.is_primary && !b.is_primary) return -1;
      if (!a.is_primary && b.is_primary) return 1;
      return a.sort_order - b.sort_order;
    });
}

export function getPrimaryImage(hotel: HotelDetail): HotelImage | null {
  for (const cat of hotel.image_categories) {
    const primary = cat.images.find(img => img.is_primary);
    if (primary) return primary;
  }
  return hotel.image_categories[0]?.images[0] ?? null;
}