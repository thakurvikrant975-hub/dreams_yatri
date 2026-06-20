export const ROOM_TYPES = [
  "Apartment", "Bungalow", "Chalet", "Common", "Cottage", "Deluxe",
  "Dorm room", "Family", "For Honeymooners", "Luxury", "Master",
  "Studio", "Suite", "Tent", "Villa", "Other",
];

// Room types that have multiple rooms internally (bedroom/living room fields apply)
export const MULTI_ROOM_TYPES = new Set([
  "Apartment", "Bungalow", "Chalet", "Cottage",
  "Family", "For Honeymooners", "Master", "Suite", "Villa",
]);

export const ROOM_VIEWS = [
  "No View", "Airport View", "Backwater View", "Bay View", "Beach View",
  "City View", "Countryside View", "Courtyard View", "Desert View",
  "Forest View", "Garden View", "Golf Course View", "Harbor View",
  "Hill View", "Jungle View", "Lake View", "Landmark View",
  "Mountain View", "Ocean View", "Pool View", "River View",
  "Sea View", "Valley View",
];

export const BED_TYPES = [
  "King", "Queen", "Double", "Twin", "Single",
  "Bunk Bed", "Sofa Bed", "Murphy Bed", "Futon", "Water Bed",
];

export const BATHROOM_FEATURES = [
  "Bathtub", "Shower", "Rain Shower", "Outdoor Shower", "Handheld Shower",
  "Hair Dryer", "Bathrobe", "Slippers", "Toiletries", "Jacuzzi",
  "Hot Tub", "Sauna", "Steam Room", "Bidet", "Double Sink",
];

export const MEAL_PLANS = [
  { value: "EP",  label: "EP — Room Only (European Plan)" },
  { value: "CP",  label: "CP — Breakfast Included (Continental Plan)" },
  { value: "MAP", label: "MAP — Breakfast + Dinner (Modified American Plan)" },
  { value: "AP",  label: "AP — All Meals Included (American Plan)" },
  { value: "AI",  label: "AI — All Inclusive" },
];

export const ROOM_AMENITY_GROUPS: { label: string; items: string[] }[] = [
  {
    label: "Climate Control",
    items: ["Air Conditioning", "Heater", "Fan", "Fireplace", "Air Purifier"],
  },
  {
    label: "Entertainment",
    items: ["TV", "Smart TV", "Cable TV", "Satellite TV", "Streaming Service", "Music System"],
  },
  {
    label: "Connectivity",
    items: ["Wi-Fi", "LAN / Ethernet", "Telephone", "USB Charging Ports"],
  },
  {
    label: "Kitchen & Dining",
    items: ["Minibar", "Refrigerator", "Coffee / Tea Maker", "Kettle", "Microwave", "Oven", "Dining Table"],
  },
  {
    label: "Bedroom & Comfort",
    items: ["Bathrobe", "Slippers", "Iron / Ironing Board", "Blackout Curtains", "Wardrobe / Closet", "Study Table", "Sofa", "Reading Lamp"],
  },
  {
    label: "Outdoor",
    items: ["Balcony", "Patio", "Private Terrace", "Private Garden", "Private Pool"],
  },
  {
    label: "Security & Safety",
    items: ["Safe / Locker", "Electronic Key Card", "First-aid Kit", "Smoke Detector"],
  },
  {
    label: "Other",
    items: ["Hairdryer", "In-room Dining", "Baby Cot", "Printer"],
  },
];
