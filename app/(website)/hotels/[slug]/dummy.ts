// Dummy data for the hotel detail page (UI development only).
// Replace with real data fetching once the hotel engine backend is wired.
import type { HotelCard } from "@/app/lib/hotels/hotelCard";

export type RatePlan = {
  id: string;
  mealPlan: string;
  inclusions: string[];
  cancellation: string;
  refundable: boolean;
  price: number;
  /**
   * The pre-discount rate, or null when the property never set one. Nullable
   * on purpose: a non-null default invited a synthesised "was" price, which is
   * a discount claim we can't substantiate.
   */
  originalPrice: number | null;
  taxes: number;
  badge?: string;
};

export type BedroomLayout = {
  name: string;
  bed: string;
  view: string;
  attachedBathroom: boolean;
  size: string;
  amenities: string[];
};

export type Room = {
  id: string;
  name: string;
  images: string[];
  size: string;
  bed: string;
  view: string;
  occupancy: string;
  amenities: string[];
  allAmenities?: { group: string; items: { label: string; icon: string }[] }[];
  ratePlans: RatePlan[];
  roomsLeft: number | null;
};

export type ReviewItem = {
  id: string;
  name: string;
  initials: string;
  date: string;
  rating: number;
  text: string;
  images?: string[];
  hostResponse?: string | null;
  hostResponseAt?: string | null;
  roomType?: string | null;
  travelMonth?: string | null;
  tags?: string[];
};

/**
 * Same shape as a search-result tile. The rail used to carry a thinner,
 * bespoke type, so the four properties a guest lines up for comparison showed
 * strictly less than the listing they arrived from.
 */
export type SimilarHotel = HotelCard;

export type Hotel = {
  id: number;
  slug: string;
  name: string;
  /** null when the property has no classification — never guess a tier. */
  starRating: number | null;
  /** "Resort", "Homestay" — so the tier badge doesn't call everything a Hotel. */
  propertyType: string | null;
  address: string;
  area: string;
  city: string;
  latitude: number | null;
  longitude: number | null;
  /** Coordinates came from the linked locality, not the property itself — the
   *  map pin is the area centre and must be labelled as such. */
  approximateLocation?: boolean;
  reviewScore: number;
  reviewLabel: string;
  reviewCount: number;
  tags: string[];
  images: string[];
  galleryCategories: { label: string; images: { src: string; fullSrc: string; label: string }[] }[];
  about: string;
  amenities: { icon: string; label: string }[];
  allAmenities: { group: string; items: { label: string; icon: string }[] }[];
  landmarks: { category: string; items: { name: string; distance: string; lat?: number | null; lon?: number | null }[] }[];
  policies: {
    checkIn: string;
    checkOut: string;
    couplesRule: string | null;
    minAgeRule: string | null;
    badges?: { icon: string; label: string; active: boolean }[];
    sections: { title: string; items: string[] }[];
    importantInfo: { title: string; items: string[] }[];
  };
  rooms: Room[];
  // Present only for HOMESTAY_VILLA properties — MMT/Goibibo-style "Property
  // Layout" showing the physical bedrooms rather than sellable hotel rooms.
  homestay?: {
    bedroomCount: number;
    bathroomCount: number;
    managedBy: string;
    managedByNote: string;
    layout: BedroomLayout[];
  };
  reviews: {
    overall: number;
    label: string;
    count: number;
    distribution: { stars: number; pct: number }[];
    items: ReviewItem[];
  };
  similar: SimilarHotel[];
};

const IMG = (id: string, w = 800, h = 600) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&h=${h}&q=80`;

export const hotel: Hotel = {
  id: 1,
  slug: "hotel-jyoti-plaza-varanasi",
  name: "Hotel Jyoti Plaza",
  starRating: 3,
  propertyType: "Hotel",
  address: "S-20/51, The Mall Road, Cantonment, Varanasi",
  area: "Cantonment",
  city: "Varanasi",
  latitude: 25.3535,
  longitude: 82.9986,
  reviewScore: 4.2,
  reviewLabel: "Very Good",
  reviewCount: 1284,
  tags: ["Couple Friendly", "Free Wi-Fi", "Free Parking", "Breakfast Included"],
  images: [
    IMG("photo-1566073771259-6a8506099945", 1200, 800),
    IMG("photo-1611892440504-42a792e24d32"),
    IMG("photo-1590490360182-c33d57733427"),
    IMG("photo-1582719478250-c89cae4dc85b"),
    IMG("photo-1631049307264-da0ec9d70304"),
    IMG("photo-1618773928121-c32242e63f39"),
    IMG("photo-1595576508898-0ad5c879a061"),
    IMG("photo-1560448204-e02f11c3d0e2"),
  ],
  galleryCategories: [
    {
      label: "Exterior",
      images: [
        { src: IMG("photo-1566073771259-6a8506099945", 1200, 800), fullSrc: IMG("photo-1566073771259-6a8506099945", 1920, 1280), label: "Exterior" },
      ],
    },
  ],
  about:
    "Nestled in the heart of Varanasi Cantonment, Hotel Jyoti Plaza blends contemporary comfort with warm Indian hospitality. Just minutes from the ghats and the railway station, the property offers well-appointed rooms, a multi-cuisine restaurant, a rooftop lounge and round-the-clock service — an ideal base for pilgrims and leisure travellers alike.",
  amenities: [
    { icon: "wifi", label: "Free Wi-Fi" },
    { icon: "parking", label: "Free Parking" },
    { icon: "restaurant", label: "Restaurant" },
    { icon: "ac", label: "Air Conditioning" },
    { icon: "pool", label: "Swimming Pool" },
    { icon: "gym", label: "Fitness Centre" },
    { icon: "spa", label: "Spa" },
    { icon: "desk", label: "24-hr Front Desk" },
  ],
  allAmenities: [
    { group: "Popular", items: [
      { label: "Free Wi-Fi", icon: "wifi" }, { label: "Free Parking", icon: "parking" },
      { label: "Swimming Pool", icon: "pool" }, { label: "Restaurant", icon: "restaurant" },
      { label: "Room Service", icon: "desk" }, { label: "Power Backup", icon: "desk" },
    ] },
    { group: "Basic Facilities", items: [
      { label: "Air Conditioning", icon: "ac" }, { label: "Elevator", icon: "desk" },
      { label: "Laundry", icon: "desk" }, { label: "Housekeeping", icon: "desk" },
      { label: "Wake-up Call", icon: "desk" }, { label: "Luggage Storage", icon: "desk" },
    ] },
    { group: "Wellness", items: [
      { label: "Spa", icon: "spa" }, { label: "Fitness Centre", icon: "gym" },
      { label: "Steam & Sauna", icon: "spa" }, { label: "Yoga", icon: "spa" },
    ] },
    { group: "Food & Drink", items: [
      { label: "Multi-cuisine Restaurant", icon: "restaurant" }, { label: "Rooftop Lounge", icon: "restaurant" },
      { label: "In-room Dining", icon: "restaurant" }, { label: "Bar", icon: "restaurant" },
      { label: "Complimentary Breakfast", icon: "restaurant" },
    ] },
  ],
  landmarks: [
    {
      category: "Tourist Attractions",
      items: [
        { name: "Dashashwamedh Ghat", distance: "3.2 km" },
        { name: "Kashi Vishwanath Temple", distance: "3.8 km" },
        { name: "Sarnath", distance: "9.5 km" },
        { name: "Assi Ghat", distance: "5.1 km" },
      ],
    },
    {
      category: "Transport",
      items: [
        { name: "Varanasi Junction Railway Station", distance: "1.4 km" },
        { name: "Lal Bahadur Shastri Airport", distance: "24 km" },
        { name: "Cantt Bus Stand", distance: "0.9 km" },
      ],
    },
    {
      category: "Food & Shopping",
      items: [
        { name: "Godowlia Market", distance: "3.5 km" },
        { name: "JHV Mall", distance: "0.6 km" },
        { name: "Kachori Gali", distance: "3.9 km" },
      ],
    },
  ],
  policies: {
    checkIn: "12:00 PM",
    checkOut: "11:00 AM",
    couplesRule: "Unmarried couples allowed. Local ids allowed.",
    minAgeRule: "Primary guest should be at least 18 years of age.",
    sections: [
      {
        title: "Guest Profile",
        items: [
          "Couples are welcome.",
          "Guests below 18 years of age are not allowed without a guardian.",
          "Local guests with a same-city ID are accepted.",
        ],
      },
      { title: "Pets", items: ["Pets are not allowed."] },
    ],
    importantInfo: [
      {
        title: "We Should Mention",
        items: [
          "Free cancellation until 24 hours before check-in.",
          "Accepted ID proofs: Passport, Aadhaar, Driving License, Govt. ID.",
        ],
      },
      {
        title: "You Need to Know",
        items: ["Smoking is not allowed on the property."],
      },
    ],
  },
  rooms: [
    {
      id: "deluxe",
      name: "Deluxe Room with City View",
      images: [IMG("photo-1631049307264-da0ec9d70304"), IMG("photo-1618773928121-c32242e63f39"), IMG("photo-1595576508898-0ad5c879a061")],
      size: "220 sq.ft",
      bed: "1 King Bed",
      view: "City View",
      occupancy: "2 Adults",
      amenities: ["Air Conditioning", "Free Wi-Fi", "LED TV", "Mini Fridge", "Tea/Coffee Maker"],
      roomsLeft: null,
      ratePlans: [
        {
          id: "deluxe-ro",
          mealPlan: "Room Only",
          inclusions: ["No meals included"],
          cancellation: "Free cancellation before 24 Feb",
          refundable: true,
          price: 1932,
          originalPrice: 2760,
          taxes: 232,
        },
        {
          id: "deluxe-bf",
          mealPlan: "Room with Breakfast",
          inclusions: ["Free breakfast", "Free cancellation"],
          cancellation: "Free cancellation before 24 Feb",
          refundable: true,
          price: 2675,
          originalPrice: 3540,
          taxes: 321,
          badge: "Best Value",
        },
      ],
    },
    {
      id: "suite",
      name: "Luxury Suite with 2 Complimentary Beers",
      images: [IMG("photo-1582719478250-c89cae4dc85b"), IMG("photo-1560448204-e02f11c3d0e2"), IMG("photo-1590490360182-c33d57733427")],
      size: "420 sq.ft",
      bed: "1 King Bed + Sofa",
      view: "Garden View",
      occupancy: "2 Adults + 1 Child",
      amenities: ["Air Conditioning", "Free Wi-Fi", "Bathtub", "Living Area", "Mini Bar", "Bathrobes"],
      roomsLeft: 3,
      ratePlans: [
        {
          id: "suite-ro",
          mealPlan: "Room Only",
          inclusions: ["2 complimentary beers", "No meals included"],
          cancellation: "Non-Refundable",
          refundable: false,
          price: 2438,
          originalPrice: 3480,
          taxes: 293,
        },
        {
          id: "suite-bf",
          mealPlan: "Room with Breakfast",
          inclusions: ["2 complimentary beers", "Free breakfast", "Free cancellation"],
          cancellation: "Free cancellation before 23 Feb",
          refundable: true,
          price: 4280,
          originalPrice: 5350,
          taxes: 514,
          badge: "Popular",
        },
      ],
    },
    {
      id: "standard",
      name: "Standard Room",
      images: [IMG("photo-1611892440504-42a792e24d32"), IMG("photo-1631049307264-da0ec9d70304"), IMG("photo-1618773928121-c32242e63f39")],
      size: "180 sq.ft",
      bed: "1 Queen Bed",
      view: "No View",
      occupancy: "2 Adults",
      amenities: ["Air Conditioning", "Free Wi-Fi", "LED TV", "Work Desk"],
      roomsLeft: null,
      ratePlans: [
        {
          id: "standard-ro",
          mealPlan: "Room Only",
          inclusions: ["No meals included"],
          cancellation: "Free cancellation before 24 Feb",
          refundable: true,
          price: 1665,
          originalPrice: 2380,
          taxes: 200,
          badge: "Lowest Price",
        },
      ],
    },
  ],
  reviews: {
    overall: 4.2,
    label: "Very Good",
    count: 1284,
    distribution: [
      { stars: 5, pct: 58 },
      { stars: 4, pct: 26 },
      { stars: 3, pct: 9 },
      { stars: 2, pct: 4 },
      { stars: 1, pct: 3 },
    ],
    items: [
      {
        id: "r1",
        name: "Ananya Sharma",
        initials: "AS",
        date: "12 Jan 2026",
        rating: 5,
        text: "Loved every bit of the stay. Rooms were spotless, the breakfast spread was generous, and the staff went out of their way to arrange an early check-in for us. The location is very convenient — walkable to the mall and a short ride to the ghats.",
        images: [
          IMG("photo-1618773928121-c32242e63f39", 600, 450),
          IMG("photo-1595576508898-0ad5c879a061", 600, 450),
        ],
        hostResponse:
          "Thank you so much for the kind words, Ananya! We're delighted the early check-in and breakfast spread made your stay special. Looking forward to hosting you again.",
        hostResponseAt: "14 Jan 2026",
      },
      {
        id: "r2",
        name: "Rahul Verma",
        initials: "RV",
        date: "04 Jan 2026",
        rating: 4,
        text: "Comfortable and clean, exactly what I needed for a two-night work trip. Wi-Fi was fast and reliable. Only minor gripe was that the room faced the road and could get a little noisy in the mornings.",
      },
      {
        id: "r3",
        name: "Meera Iyer",
        initials: "MI",
        date: "28 Dec 2025",
        rating: 5,
        text: "Upgraded to the suite and it was fantastic — spacious living area, a bathtub, and the complimentary beers were a nice touch. Very couple-friendly, no hassles at check-in. Will definitely return.",
        images: [
          IMG("photo-1590490360182-c33d57733427", 600, 450),
          IMG("photo-1560448204-e02f11c3d0e2", 600, 450),
          IMG("photo-1582719478250-c89cae4dc85b", 600, 450),
        ],
        hostResponse:
          "So glad you enjoyed the suite, Meera! We'll pass your compliments on to the housekeeping team. Can't wait to welcome you back on your next visit to Varanasi.",
        hostResponseAt: "29 Dec 2025",
      },
      {
        id: "r4",
        name: "Karan Singh",
        initials: "KS",
        date: "15 Dec 2025",
        rating: 4,
        text: "Stayed here during a solo pilgrimage. The front desk helped me plan the Ganga Aarti timing and arranged a cab. Rooms are a touch dated but very well maintained and value for money.",
      },
    ],
  },
  similar: [
    { id: 1, slug: "the-ganges-grand", name: "The Ganges Grand", city: "Sigra", state: "Varanasi", starRating: 4, propertyType: "Hotel", image: IMG("photo-1571003123894-1f0594d2b5d9", 500, 350), photoCount: 18, priceFrom: 3299, taxesFrom: 594, mealPlan: "Breakfast Included", roomName: "Deluxe Room", maxOccupancy: 2, bedType: "1 King Bed", roomTypeCount: 3, amenities: ["Wi-Fi", "Parking", "Restaurant"] },
    { id: 2, slug: "riverside-retreat", name: "Riverside Retreat", city: "Assi Ghat", state: "Varanasi", starRating: 4, propertyType: "Resort", image: IMG("photo-1520250497591-112f2f40a3f4", 500, 350), photoCount: 12, priceFrom: 2799, taxesFrom: 504, mealPlan: null, roomName: "Premium Room", maxOccupancy: 3, bedType: "1 Double Bed", roomTypeCount: 2, amenities: ["Wi-Fi", "Swimming Pool"] },
    { id: 3, slug: "kashi-comfort-inn", name: "Kashi Comfort Inn", city: "Lanka", state: "Varanasi", starRating: 3, propertyType: "Hotel", image: IMG("photo-1445019980597-93fa8acb246c", 500, 350), photoCount: 9, priceFrom: 1899, taxesFrom: 228, mealPlan: "Breakfast Included", roomName: "Standard Room", maxOccupancy: 2, bedType: "2 Single Beds", roomTypeCount: 1, amenities: ["Wi-Fi", "Parking"] },
    { id: 4, slug: "sarnath-serenity", name: "Sarnath Serenity", city: "Sarnath", state: "Varanasi", starRating: 4, propertyType: "Resort", image: IMG("photo-1512918728675-ed5a9ecdebfd", 500, 350), photoCount: 21, priceFrom: 3599, taxesFrom: 648, mealPlan: "All Meals Included", roomName: "Suite", maxOccupancy: 4, bedType: "1 King Bed", roomTypeCount: 4, amenities: ["Wi-Fi", "Spa", "Restaurant"] },
  ],
};
