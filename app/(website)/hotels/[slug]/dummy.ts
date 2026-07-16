// Dummy data for the hotel detail page (UI development only).
// Replace with real data fetching once the hotel engine backend is wired.

export type RatePlan = {
  id: string;
  mealPlan: string;
  inclusions: string[];
  cancellation: string;
  refundable: boolean;
  price: number;
  originalPrice: number;
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
  ratePlans: RatePlan[];
};

export type ReviewItem = {
  id: string;
  name: string;
  initials: string;
  date: string;
  rating: number;
  text: string;
};

export type SimilarHotel = {
  id: string;
  name: string;
  image: string;
  location: string;
  rating: number;
  price: number;
};

export type Hotel = {
  id: number;
  slug: string;
  name: string;
  starRating: number;
  address: string;
  area: string;
  city: string;
  reviewScore: number;
  reviewLabel: string;
  reviewCount: number;
  tags: string[];
  images: string[];
  about: string;
  amenities: { icon: string; label: string }[];
  allAmenities: { group: string; items: { label: string; icon: string }[] }[];
  landmarks: { category: string; items: { name: string; distance: string }[] }[];
  rules: {
    checkIn: string;
    checkOut: string;
    guestProfile: string[];
    mustRead: string[];
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
  address: "S-20/51, The Mall Road, Cantonment, Varanasi",
  area: "Cantonment",
  city: "Varanasi",
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
  rules: {
    checkIn: "12:00 PM",
    checkOut: "11:00 AM",
    guestProfile: [
      "Couples are welcome.",
      "Guests below 18 years of age are not allowed without a guardian.",
      "Local ids are allowed.",
    ],
    mustRead: [
      "Passport, Aadhaar, Driving License and Govt. ID are accepted as ID proof(s).",
      "Pets are not allowed.",
      "Outside food is not allowed.",
      "Smoking within the premises is not allowed.",
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
    { id: "s1", name: "The Ganges Grand", image: IMG("photo-1571003123894-1f0594d2b5d9", 500, 350), location: "Sigra, Varanasi", rating: 4.4, price: 3299 },
    { id: "s2", name: "Riverside Retreat", image: IMG("photo-1520250497591-112f2f40a3f4", 500, 350), location: "Assi Ghat, Varanasi", rating: 4.1, price: 2799 },
    { id: "s3", name: "Kashi Comfort Inn", image: IMG("photo-1445019980597-93fa8acb246c", 500, 350), location: "Lanka, Varanasi", rating: 3.9, price: 1899 },
    { id: "s4", name: "Sarnath Serenity", image: IMG("photo-1512918728675-ed5a9ecdebfd", 500, 350), location: "Sarnath, Varanasi", rating: 4.3, price: 3599 },
  ],
};
