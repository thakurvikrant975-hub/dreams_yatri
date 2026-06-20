export type AmenityCategory = {
  label: string;
  items: string[];
};

export const AMENITY_CATEGORIES: AmenityCategory[] = [
  {
    label: "Mandatory",
    items: [
      "Air Conditioning", "Parking", "Room service", "Swimming Pool", "Wifi",
      "Reception", "Bar", "Restaurant", "Luggage assistance", "Wheelchair",
      "Gym / Fitness centre", "CCTV", "Airport Transfers", "Elevator / Lift",
      "Housekeeping", "Kitchen / Kitchenette", "Power backup", "Caretaker",
      "Spa", "Kids' Play Area",
    ],
  },
  {
    label: "General Services",
    items: [
      "Laundry", "Newspaper", "Smoking rooms", "Lounge", "First-aid services",
      "Concierge", "Multilingual Staff", "Cloak Room", "Specially abled assistance",
      "Butler Services", "Doctor on call", "Medical centre (Within Premise)",
      "Pool / Beach towels",
    ],
  },
  {
    label: "Security",
    items: [
      "Smoke detector", "Fire extinguishers", "Security alarms", "Security Guard",
      "Carbon Monoxide Detector", "Door-Eye", "Door Chain",
    ],
  },
  {
    label: "Basic Facilities",
    items: [
      "LAN", "Refrigerator", "Umbrellas", "Washing Machine", "Laundromat",
      "EV Charging Station (Within Premise)", "Driver's Accommodation",
      "Grocery Purchase", "Utensil Cleaning",
    ],
  },
  {
    label: "Outdoor Sports & Activities",
    items: [
      "Beach", "Golf Course / Mini Golf", "Outdoor sports", "Skiing", "Cycling",
      "Rock Climbing", "Ziplining", "Archery", "Tennis", "Basketball court",
      "Cricket", "Badminton", "Volley Ball", "High rope course", "Paintball",
      "Paragliding", "Camping", "Hot Air Balloon Ride", "Air Rifle Shooting",
      "Football / Soccer", "Pickle Ball", "ATV or Buggy Ride", "Zorbing",
      "Wall Climbing", "Bungee Jumping", "Beach Volley / Football",
      "Golf Simulator", "Rappelling",
    ],
  },
  {
    label: "Common Area",
    items: [
      "Balcony / Terrace", "Garden", "Sun Deck", "Prayer Room", "Living Room",
      "Outdoor Furniture",
    ],
  },
  {
    label: "Food and Drink",
    items: [
      "Barbeque", "Dining Area", "Kid's Menu", "Breakfast",
      "Food Options Available", "Indian Chef", "Cook Service",
    ],
  },
  {
    label: "Business Center and Conferences",
    items: [
      "Banquet", "Business Center", "Conference room", "Photocopying",
      "Fax service", "Printer",
    ],
  },
  {
    label: "Transfers",
    items: [
      "Pickup / Drop", "Shuttle Service", "Railway Station Transfers",
      "Bus Station transfers",
    ],
  },
  {
    label: "Entertainment",
    items: [
      "Events", "Professional Photography", "Night Club", "Beach club",
      "Movie Room", "Music System",
    ],
  },
  {
    label: "Shopping",
    items: [
      "Grocery / Supermarket (Within Premise)", "Souvenir shop", "Jewellery Shop",
    ],
  },
  {
    label: "Media and Technology",
    items: ["TV"],
  },
  {
    label: "Payment Services",
    items: ["ATM", "Currency Exchange"],
  },
  {
    label: "Family and Kids",
    items: ["Kids' Club", "Babysitting", "Crib"],
  },
  {
    label: "Pet Essentials",
    items: ["Pet bowls", "Pet baskets"],
  },
  {
    label: "Spa & Wellness",
    items: [
      "Massage", "Salon", "Steam and Sauna", "Jacuzzi", "Activity Centre",
      "Yoga", "Meditation Room", "Solarium", "Hot Spring bath (Within Premise)",
      "Hammam", "Ayurvedic Treatment (Within Premise)",
    ],
  },
  {
    label: "Accessibility",
    items: [
      "Auditory Guidance", "Visual aids (Braille)", "Visual aids (tactile signs)",
      "Ramp", "Step free entrance", "Designated Accessible Parking",
      "Wide Pathways", "Toilet with grabrails", "Raised toilet", "Lowered sink",
      "Bathroom emergency cord",
    ],
  },
  {
    label: "Water Sports & Activities",
    items: [
      "Kayaking", "Snorkelling", "Water sports", "Canoeing",
      "Water Park (Within Premise)", "Scuba Diving", "Jet skiing",
      "Paddle Boarding", "Pedal Boats", "Banana Boat Ride", "Fishing",
      "Windsurfing", "Beach Volleyball", "Laser Boat", "Glass Bottom Boat",
      "Parasailing", "Beach football", "Surfing", "River Rafting",
      "Dolphin Boat Ride", "Water Skiing", "Diving", "Motor Boat ride",
      "Boat Ride", "Beach Sports",
    ],
  },
  {
    label: "Indoor Sports & Activities",
    items: [
      "Library", "Indoor games", "Indoor games room", "Table Tennis",
      "Billiards / pool table", "Board Games", "Foosball table", "Air hockey table",
      "Game Zone / Arcade", "Virtual Gaming / VR Zone", "Dart Board", "Bowling",
      "Squash",
    ],
  },
  {
    label: "Live Shows & Music",
    items: [
      "Casino", "Bonfire", "Live Music", "Cultural Programme", "Movie Screenings",
      "Karaoke", "Magic Shows", "Puppet Shows", "Live Art Performance",
      "Stand-up Comedy", "Light & Sound Show", "Rain Dance", "DJ Party",
      "Firework Show", "Dance Performance", "Disco Club", "Aarti Ceremony",
      "Drone Show",
    ],
  },
  {
    label: "Wildlife & Nature",
    items: [
      "Jungle Safari", "Wildlife Photography", "Night Safari", "Forest Camping",
      "Dolphin Watching", "Tiger Safari", "Elephant Safari", "Forest Hiking",
      "Riverside Trek", "Nature Walk / Hike", "Bird Watching", "Star Gazing",
      "Trekking",
    ],
  },
  {
    label: "Rides, Safari, Excursions & Tour",
    items: [
      "Bicycle Ride", "Jeep Safari", "Camel Ride", "Horse Ride", "Tractor Ride",
      "Carriage or Cart Ride", "Cable Car Ride", "Shikara Ride", "Gondola Ride",
      "Desert Safari", "Walking Tours", "Boat Ride or Tour", "Pub Crawls",
      "Plantation Tour", "Horticulture Tour", "Cycling Trail", "Vintage Car ride",
      "Hill Trek",
    ],
  },
  {
    label: "Hands-on Workshops",
    items: [
      "Cooking class", "Pottery Making", "Drawing & Painting", "Craft Activities",
      "Bangle Making", "Block Painting", "Photography Class", "Heena Art",
      "Cocktail Making Workshop", "Environment Activities", "Astrologer Session",
      "Caricature Drawings",
    ],
  },
];

// Flat set of all valid amenity strings for server-side validation
export const ALL_AMENITY_KEYS = new Set(
  AMENITY_CATEGORIES.flatMap((c) => c.items)
);

// ── Rich amenity value types ──────────────────────────────────────────────────

export type PoolConfig = {
  id: string;
  name: string;
  type: "Indoor" | "Outdoor" | "";
  suitableFor: "All ages" | "Kid's only" | "Adult only" | "";
  features: string[];
  winterAccess: boolean;
  facilities: string[];
  openTime: string;
  closeTime: string;
  nonOpDays: string[];
  depth: string;
  hasShallowEnd: boolean;
};

export type DetailAmenityValue      = { yes: true; detail: string };
export type PoolAmenityValue        = { yes: true; pools: PoolConfig[] };
export type MultiSelectAmenityValue = { yes: true; selections: string[] };
export type AmenityValue = boolean | DetailAmenityValue | PoolAmenityValue | MultiSelectAmenityValue;

// ── Mandatory category config ─────────────────────────────────────────────────

export type MandatoryItemConfig = {
  name: string;
  subOptions?: string[];
  isPool?: true;
};

export const MANDATORY_CONFIG: MandatoryItemConfig[] = [
  { name: "Air Conditioning",    subOptions: ["Room controlled", "Centralized"] },
  { name: "Parking",             subOptions: ["Free", "Paid"] },
  { name: "Room service",        subOptions: ["24-hour Room Service", "Limited hour Room Service"] },
  { name: "Swimming Pool",       isPool: true },
  { name: "Wifi",                subOptions: ["Free", "Paid"] },
  { name: "Reception",           subOptions: ["24-hour Reception", "Limited hour Reception"] },
  { name: "Bar",                 subOptions: ["In-house", "Outsourced"] },
  { name: "Restaurant",          subOptions: ["In-house", "Outsourced"] },
  { name: "Luggage assistance" },
  { name: "Wheelchair",          subOptions: ["Available for use", "Property is wheelchair accessible"] },
  { name: "Gym / Fitness centre", subOptions: ["In-house", "Outsourced"] },
  { name: "CCTV" },
  { name: "Airport Transfers",   subOptions: ["Free", "Paid"] },
  { name: "Elevator / Lift" },
  { name: "Housekeeping" },
  { name: "Kitchen / Kitchenette", subOptions: ["In-room Kitchen", "Shared Kitchen"] },
  { name: "Power backup" },
  { name: "Caretaker" },
  { name: "Spa" },
  { name: "Kids' Play Area",     subOptions: ["Indoor", "Outdoor"] },
];

// ── Pool constants ────────────────────────────────────────────────────────────

export const POOL_FEATURES = [
  "Roof top", "Infinity edge", "Temperature-controlled",
  "Glass edge", "Lap pool", "Freeform", "Wave Pool",
];

export const POOL_FACILITIES = [
  "Showers / changing rooms", "Sun umbrellas", "Pool Towels",
  "Lifeguard on Duty", "Pool Bar", "Jacuzzi", "Water slide",
  "Sunbeds / Loungers", "Kids' pool area", "Poolside lighting",
];

export const POOL_DEPTHS = [
  "< 1 m", "1 m", "1.2 m", "1.5 m", "1.8 m", "2 m", "2.5 m", "3 m", "> 3 m",
];

export const WEEK_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function makeTimeOptions(): string[] {
  return Array.from({ length: 24 }, (_, i) => {
    const h = i % 12 || 12;
    const ampm = i < 12 ? "AM" : "PM";
    return `${h}:00 ${ampm}`;
  });
}

// ── Amenity value helpers ─────────────────────────────────────────────────────

export function isYesValue(v: AmenityValue | undefined): boolean {
  if (v === true) return true;
  if (v !== null && typeof v === "object" && "yes" in v) return true;
  return false;
}

export function isNoValue(v: AmenityValue | undefined): boolean {
  return v === false;
}

export function getDetail(v: AmenityValue | undefined): string {
  if (typeof v === "object" && v !== null && "detail" in v) return (v as DetailAmenityValue).detail;
  return "";
}

export function getPools(v: AmenityValue | undefined): PoolConfig[] {
  if (typeof v === "object" && v !== null && "pools" in v) return (v as PoolAmenityValue).pools;
  return [];
}

export function getSelections(v: AmenityValue | undefined): string[] {
  if (typeof v === "object" && v !== null && "selections" in v) return (v as MultiSelectAmenityValue).selections;
  return [];
}

// ── General Services category config ─────────────────────────────────────────

export type GeneralServicesSubField = {
  label: string;
  type: "select" | "multiselect";
  options: string[];
};

export type GeneralServicesItemConfig = {
  name: string;
  subField?: GeneralServicesSubField;
};

export const GENERAL_SERVICES_CONFIG: GeneralServicesItemConfig[] = [
  { name: "Laundry",                       subField: { label: "Service Type",        type: "select",      options: ["Free", "Paid"] } },
  { name: "Newspaper",                     subField: { label: "Preferred Language",   type: "multiselect", options: ["English", "Local Language"] } },
  { name: "Smoking rooms" },
  { name: "Lounge",                        subField: { label: "Lounge Access",        type: "select",      options: ["Paid", "Complimentary"] } },
  { name: "First-aid services" },
  { name: "Concierge" },
  { name: "Multilingual Staff",            subField: { label: "Languages Spoken",     type: "multiselect", options: ["English", "Hindi", "Regional Language"] } },
  { name: "Cloak Room" },
  { name: "Specially abled assistance",    subField: { label: "Assistance Type",      type: "multiselect", options: ["Wheelchair", "Braille", "Sign Language", "Task Assistance"] } },
  { name: "Butler Services",               subField: { label: "Service Availability", type: "select",      options: ["24 Hours", "On Request", "Limited Hours"] } },
  { name: "Doctor on call" },
  { name: "Medical centre (Within Premise)" },
  { name: "Pool / Beach towels" },
];
