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
export type MultiFieldAmenityValue  = { yes: true; f1?: string | string[]; f2?: string | string[] };
export type AmenityValue = boolean | DetailAmenityValue | PoolAmenityValue | MultiSelectAmenityValue | MultiFieldAmenityValue;

// ── Mandatory category config ─────────────────────────────────────────────────

export type MandatorySubField = {
  label?: string;
  type: "select" | "multiselect";
  options: string[];
};

export type MandatoryItemConfig = {
  name: string;
  field1?: MandatorySubField;
  field2?: MandatorySubField;
  isPool?: true;
};

export const GUEST_HOUSE_MANDATORY_CONFIG: MandatoryItemConfig[] = [
  { name: "Air Conditioning",
    field1: { label: "Type",     type: "select",      options: ["Centralized", "Room controlled", "All-Weather (Hot & Cold)"] } },
  { name: "Parking",
    field1: { label: "Cost",     type: "select",      options: ["Free", "Paid"] },
    field2: { label: "Location", type: "select",      options: ["Onsite", "Offsite"] } },
  { name: "Wifi",
    field1: { label: "Cost",     type: "select",      options: ["Free", "Paid"] },
    field2: { label: "Speed",    type: "select",      options: ["Speed Suitable for working", "Basic Speed"] } },
  { name: "Kitchen / Kitchenette",
    field1: { label: "Facilities", type: "multiselect", options: ["Cooking appliances", "Microwave", "Utensils", "Toaster", "Induction", "Refrigerator"] } },
  { name: "Housekeeping" },
  { name: "Power backup" },
  { name: "Caretaker" },
  { name: "CCTV" },
  { name: "Reception",
    field1: { label: "Availability", type: "select",  options: ["24 hours", "Limited hours"] },
    field2: { label: "Language",     type: "select",  options: ["English Spoken at front desk"] } },
  { name: "Wheelchair",
    field1: { label: "Cost",         type: "select",  options: ["Free", "Paid"] } },
];

export const MANDATORY_CONFIG: MandatoryItemConfig[] = [
  { name: "Air Conditioning",
    field1: { label: "Type",           type: "select",      options: ["Centralized", "Room controlled", "All-Weather (Hot & Cold)"] } },
  { name: "Parking",
    field1: { label: "Cost",           type: "select",      options: ["Free", "Paid"] },
    field2: { label: "Location",       type: "select",      options: ["Onsite", "Offsite"] } },
  { name: "Room service",
    field1: { label: "Availability",   type: "select",      options: ["24 hours", "Limited hours"] } },
  { name: "Swimming Pool", isPool: true },
  { name: "Wifi",
    field1: { label: "Cost",           type: "select",      options: ["Free", "Paid"] },
    field2: { label: "Speed",          type: "select",      options: ["Speed Suitable for working", "Basic Speed"] } },
  { name: "Reception",
    field1: { label: "Availability",   type: "select",      options: ["24 hours", "Limited hours"] },
    field2: { label: "Language",       type: "select",      options: ["English Spoken at front desk"] } },
  { name: "Bar",
    field1: { label: "Type",           type: "multiselect", options: ["Rooftop", "Poolside", "Sports Bar"] } },
  { name: "Restaurant",
    field1: { label: "Dietary options", type: "multiselect", options: ["Kosher", "Jain food available", "Halal", "Vegetarian only"] } },
  { name: "Luggage assistance" },
  { name: "Wheelchair",
    field1: { label: "Cost",           type: "select",      options: ["Free", "Paid"] } },
  { name: "Gym / Fitness centre",
    field1: { label: "Features",       type: "multiselect", options: ["24-hour", "Personal Trainer", "Yoga classes"] } },
  { name: "CCTV" },
  { name: "Airport Transfers",
    field1: { label: "Cost",           type: "select",      options: ["Free", "Paid"] },
    field2: { label: "Transport type", type: "multiselect", options: ["Private taxi", "Luxury Car", "Shared shuttle"] } },
  { name: "Elevator / Lift" },
  { name: "Housekeeping" },
  { name: "Kitchen / Kitchenette",
    field1: { label: "Facilities",     type: "multiselect", options: ["Cooking appliances", "Microwave", "Utensils", "Toaster", "Induction", "Refrigerator"] } },
  { name: "Power backup" },
  { name: "Caretaker" },
  { name: "Spa" },
  { name: "Kids' Play Area",
    field1: { label: "Type",           type: "select",      options: ["Indoor", "Outdoor"] } },
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

export function getF1(v: AmenityValue | undefined): string {
  if (typeof v === "object" && v !== null && "f1" in v) {
    const f1 = (v as MultiFieldAmenityValue).f1;
    return typeof f1 === "string" ? f1 : "";
  }
  return "";
}

export function getF1s(v: AmenityValue | undefined): string[] {
  if (typeof v === "object" && v !== null && "f1" in v) {
    const f1 = (v as MultiFieldAmenityValue).f1;
    return Array.isArray(f1) ? f1 : [];
  }
  return [];
}

export function getF2(v: AmenityValue | undefined): string {
  if (typeof v === "object" && v !== null && "f2" in v) {
    const f2 = (v as MultiFieldAmenityValue).f2;
    return typeof f2 === "string" ? f2 : "";
  }
  return "";
}

export function getF2s(v: AmenityValue | undefined): string[] {
  if (typeof v === "object" && v !== null && "f2" in v) {
    const f2 = (v as MultiFieldAmenityValue).f2;
    return Array.isArray(f2) ? f2 : [];
  }
  return [];
}

// ── General Services category config ─────────────────────────────────────────

export type GeneralServicesItemConfig = {
  name: string;
  field1?: MandatorySubField;
  field2?: MandatorySubField;
};

// ── Outdoor Sports & Activities category config ───────────────────────────────

const FREE_PAID: MandatorySubField = { label: "Cost", type: "select", options: ["Free", "Paid"] };

export const OUTDOOR_SPORTS_CONFIG: GeneralServicesItemConfig[] = [
  { name: "Beach",
    field1: { label: "Type",   type: "multiselect", options: ["Private", "Public"] } },
  { name: "Golf Course / Mini Golf",  field1: FREE_PAID },
  { name: "Outdoor sports",
    field1: { label: "Sports", type: "multiselect", options: [
      "Volleyball", "Basketball", "Cricket", "Badminton", "Tennis",
      "Football / Soccer", "Pickle Ball", "Paintball", "Archery",
      "Cycling", "Rock Climbing", "Ziplining", "High rope course",
      "Rappelling", "Zorbing", "Wall Climbing", "Bungee Jumping",
    ] } },
  { name: "Skiing",                   field1: FREE_PAID },
  { name: "Cycling",                  field1: FREE_PAID },
  { name: "Rock Climbing",            field1: FREE_PAID },
  { name: "Ziplining",                field1: FREE_PAID },
  { name: "Archery",                  field1: FREE_PAID },
  { name: "Tennis",                   field1: FREE_PAID },
  { name: "Basketball court",         field1: FREE_PAID },
  { name: "Cricket",                  field1: FREE_PAID },
  { name: "Badminton",                field1: FREE_PAID },
  { name: "Volley Ball",              field1: FREE_PAID },
  { name: "High rope course",         field1: FREE_PAID },
  { name: "Paintball",                field1: FREE_PAID },
  { name: "Paragliding",              field1: FREE_PAID },
  { name: "Camping",                  field1: FREE_PAID },
  { name: "Hot Air Balloon Ride",     field1: FREE_PAID },
  { name: "Air Rifle Shooting",       field1: FREE_PAID },
  { name: "Football / Soccer",        field1: FREE_PAID },
  { name: "Pickle Ball",              field1: FREE_PAID },
  { name: "ATV or Buggy Ride",        field1: FREE_PAID },
  { name: "Zorbing",                  field1: FREE_PAID },
  { name: "Wall Climbing",            field1: FREE_PAID },
  { name: "Bungee Jumping",           field1: FREE_PAID },
  { name: "Beach Volley / Football",  field1: FREE_PAID },
  { name: "Golf Simulator",           field1: FREE_PAID },
  { name: "Rappelling",               field1: FREE_PAID },
];

// ── Hands-on Workshops category config ───────────────────────────────────────

export const WORKSHOPS_CONFIG: GeneralServicesItemConfig[] = [
  { name: "Cooking class",              field1: FREE_PAID },
  { name: "Pottery Making",             field1: FREE_PAID },
  { name: "Drawing & Painting",         field1: FREE_PAID },
  { name: "Craft Activities",           field1: FREE_PAID },
  { name: "Bangle Making",              field1: FREE_PAID },
  { name: "Block Painting",             field1: FREE_PAID },
  { name: "Photography Class",          field1: FREE_PAID },
  { name: "Heena Art",                  field1: FREE_PAID },
  { name: "Cocktail Making Workshop",   field1: FREE_PAID },
  { name: "Environment Activities",     field1: FREE_PAID },
  { name: "Astrologer Session",         field1: FREE_PAID },
  { name: "Caricature Drawings",        field1: FREE_PAID },
];

// ── Rides, Safari, Excursions & Tour category config ─────────────────────────

export const RIDES_SAFARI_CONFIG: GeneralServicesItemConfig[] = [
  { name: "Bicycle Ride",         field1: FREE_PAID },
  { name: "Jeep Safari",          field1: FREE_PAID },
  { name: "Camel Ride",           field1: FREE_PAID },
  { name: "Horse Ride",           field1: FREE_PAID },
  { name: "Tractor Ride",         field1: FREE_PAID },
  { name: "Carriage or Cart Ride", field1: FREE_PAID },
  { name: "Cable Car Ride",       field1: FREE_PAID },
  { name: "Shikara Ride",         field1: FREE_PAID },
  { name: "Gondola Ride",         field1: FREE_PAID },
  { name: "Desert Safari",        field1: FREE_PAID },
  { name: "Walking Tours",        field1: FREE_PAID },
  { name: "Boat Ride or Tour",    field1: FREE_PAID },
  { name: "Pub Crawls",           field1: FREE_PAID },
  { name: "Plantation Tour",      field1: FREE_PAID },
  { name: "Horticulture Tour",    field1: FREE_PAID },
  { name: "Cycling Trail",        field1: FREE_PAID },
  { name: "Vintage Car ride",     field1: FREE_PAID },
  { name: "Hill Trek",            field1: FREE_PAID },
];

// ── Wildlife & Nature category config ────────────────────────────────────────

export const WILDLIFE_NATURE_CONFIG: GeneralServicesItemConfig[] = [
  { name: "Jungle Safari",         field1: FREE_PAID },
  { name: "Wildlife Photography",  field1: FREE_PAID },
  { name: "Night Safari",          field1: FREE_PAID },
  { name: "Forest Camping",        field1: FREE_PAID },
  { name: "Dolphin Watching",      field1: FREE_PAID },
  { name: "Tiger Safari",          field1: FREE_PAID },
  { name: "Elephant Safari",       field1: FREE_PAID },
  { name: "Forest Hiking",         field1: FREE_PAID },
  { name: "Riverside Trek",        field1: FREE_PAID },
  { name: "Nature Walk / Hike",    field1: FREE_PAID },
  { name: "Bird Watching",         field1: FREE_PAID },
  { name: "Star Gazing",           field1: FREE_PAID },
  { name: "Trekking",              field1: FREE_PAID },
];

// ── Live Shows & Music category config ───────────────────────────────────────

export const LIVE_SHOWS_CONFIG: GeneralServicesItemConfig[] = [
  { name: "Casino",
    field1: { label: "Entry", type: "multiselect", options: ["Free entry", "Paid entry"] } },
  { name: "Bonfire",
    field1: { label: "Availability", type: "select", options: ["On Request"] } },
  { name: "Live Music",           field1: FREE_PAID },
  { name: "Cultural Programme",   field1: FREE_PAID },
  { name: "Movie Screenings",     field1: FREE_PAID },
  { name: "Karaoke",              field1: FREE_PAID },
  { name: "Magic Shows",          field1: FREE_PAID },
  { name: "Puppet Shows",         field1: FREE_PAID },
  { name: "Live Art Performance", field1: FREE_PAID },
  { name: "Stand-up Comedy",      field1: FREE_PAID },
  { name: "Light & Sound Show",   field1: FREE_PAID },
  { name: "Rain Dance",           field1: FREE_PAID },
  { name: "DJ Party",             field1: FREE_PAID },
  { name: "Firework Show",        field1: FREE_PAID },
  { name: "Dance Performance",    field1: FREE_PAID },
  { name: "Disco Club",           field1: FREE_PAID },
  { name: "Aarti Ceremony",       field1: FREE_PAID },
  { name: "Drone Show",           field1: FREE_PAID },
];

// ── Indoor Sports & Activities category config ────────────────────────────────

export const INDOOR_SPORTS_CONFIG: GeneralServicesItemConfig[] = [
  { name: "Library",               field1: FREE_PAID },
  { name: "Indoor games",
    field1: { label: "Games", type: "multiselect", options: [
      "Chess", "Carrom", "Cards", "Ludo", "Scrabble", "Monopoly",
      "UNO", "Jenga", "Checkers", "Chinese Checkers", "Dominoes",
    ] } },
  { name: "Indoor games room",     field1: FREE_PAID },
  { name: "Table Tennis",          field1: FREE_PAID },
  { name: "Billiards / pool table", field1: FREE_PAID },
  { name: "Board Games",           field1: FREE_PAID },
  { name: "Foosball table",        field1: FREE_PAID },
  { name: "Air hockey table",      field1: FREE_PAID },
  { name: "Game Zone / Arcade",    field1: FREE_PAID },
  { name: "Virtual Gaming / VR Zone", field1: FREE_PAID },
  { name: "Dart Board",            field1: FREE_PAID },
  { name: "Bowling",               field1: FREE_PAID },
  { name: "Squash",                field1: FREE_PAID },
];

// ── Water Sports & Activities category config ─────────────────────────────────

export const WATER_SPORTS_CONFIG: GeneralServicesItemConfig[] = [
  { name: "Kayaking",                   field1: FREE_PAID },
  { name: "Snorkelling",                field1: FREE_PAID },
  { name: "Water sports",
    field1: { label: "Activities", type: "multiselect", options: [
      "Jet Ski", "Banana Boat", "Scuba Diving", "Snorkelling", "Kayaking",
      "Canoeing", "Paddle Boarding", "Pedal Boats", "Windsurfing",
      "Water Skiing", "Parasailing", "Surfing", "River Rafting",
      "Laser Boat", "Glass Bottom Boat", "Dolphin Boat Ride", "Motor Boat ride",
      "Boat Ride", "Fishing", "Beach Sports",
    ] } },
  { name: "Canoeing",                   field1: FREE_PAID },
  { name: "Water Park (Within Premise)", field1: FREE_PAID },
  { name: "Scuba Diving",               field1: FREE_PAID },
  { name: "Jet skiing",                 field1: FREE_PAID },
  { name: "Paddle Boarding",            field1: FREE_PAID },
  { name: "Pedal Boats",                field1: FREE_PAID },
  { name: "Banana Boat Ride",           field1: FREE_PAID },
  { name: "Fishing",                    field1: FREE_PAID },
  { name: "Windsurfing",                field1: FREE_PAID },
  { name: "Beach Volleyball",           field1: FREE_PAID },
  { name: "Laser Boat",                 field1: FREE_PAID },
  { name: "Glass Bottom Boat",          field1: FREE_PAID },
  { name: "Parasailing",                field1: FREE_PAID },
  { name: "Beach football",             field1: FREE_PAID },
  { name: "Surfing",                    field1: FREE_PAID },
  { name: "River Rafting",              field1: FREE_PAID },
  { name: "Dolphin Boat Ride",          field1: FREE_PAID },
  { name: "Water Skiing",               field1: FREE_PAID },
  { name: "Diving",                     field1: FREE_PAID },
  { name: "Motor Boat ride",            field1: FREE_PAID },
  { name: "Boat Ride",                  field1: FREE_PAID },
  { name: "Beach Sports",               field1: FREE_PAID },
];

// ── Spa & Wellness category config ───────────────────────────────────────────

export const SPA_WELLNESS_CONFIG: GeneralServicesItemConfig[] = [
  { name: "Massage",                            field1: FREE_PAID },
  { name: "Salon",                              field1: FREE_PAID },
  { name: "Steam and Sauna",                    field1: FREE_PAID },
  { name: "Jacuzzi",                            field1: FREE_PAID },
  { name: "Activity Centre" },
  { name: "Yoga",                               field1: FREE_PAID },
  { name: "Meditation Room",                    field1: FREE_PAID },
  { name: "Solarium",                           field1: FREE_PAID },
  { name: "Hot Spring bath (Within Premise)",   field1: FREE_PAID },
  { name: "Hammam",                             field1: FREE_PAID },
  { name: "Ayurvedic Treatment (Within Premise)", field1: FREE_PAID },
];

// ── Family and Kids category config ──────────────────────────────────────────

export const FAMILY_KIDS_CONFIG: GeneralServicesItemConfig[] = [
  { name: "Kids' Club" },
  { name: "Babysitting", field1: FREE_PAID },
  { name: "Crib",        field1: FREE_PAID },
];

// ── Media and Technology category config ──────────────────────────────────────

export const MEDIA_TECHNOLOGY_CONFIG: GeneralServicesItemConfig[] = [
  { name: "TV",
    field1: { label: "Type", type: "multiselect", options: [
      "LED", "LCD", "Flat screen", "International Channels", "HD Channels",
      "Satellite TV", "Remote controlled", "Cable", "Smart TV",
      "Non-Smart LED TV", "Non-Smart LCD TV",
    ] } },
];

// ── Entertainment category config ────────────────────────────────────────────

export const ENTERTAINMENT_CONFIG: GeneralServicesItemConfig[] = [
  { name: "Events",
    field1: { label: "Type", type: "multiselect", options: [
      "Live Band", "Live Singer", "Live Ghazal", "Live Music",
      "Puppet Show", "Magic", "Fire Show", "Karaoke",
      "Movies", "DJ", "Stand-up Comedy", "Folk Dance",
    ] } },
  { name: "Professional Photography" },
  { name: "Night Club" },
  { name: "Beach club" },
  { name: "Movie Room" },
  { name: "Music System" },
];

// ── Transfers category config ─────────────────────────────────────────────────

export const TRANSFERS_CONFIG: GeneralServicesItemConfig[] = [
  { name: "Pickup / Drop",             field1: FREE_PAID },
  { name: "Shuttle Service",           field1: FREE_PAID },
  { name: "Railway Station Transfers", field1: FREE_PAID },
  { name: "Bus Station transfers",     field1: FREE_PAID },
];

// ── Food and Drink category config ───────────────────────────────────────────

export const FOOD_AND_DRINK_CONFIG: GeneralServicesItemConfig[] = [
  { name: "Barbeque",
    field1: { label: "Cost", type: "select", options: ["Free", "Paid"] } },
  { name: "Dining Area" },
  { name: "Kid's Menu" },
  { name: "Breakfast",
    field1: { label: "Type", type: "multiselect", options: ["Indian veg food", "Jain food", "Continental", "Buffet", "South Indian", "North Indian", "American", "English"] } },
  { name: "Food Options Available",
    field1: { label: "Diet types", type: "multiselect", options: ["Veg", "Satvik", "Non-Veg", "Vegan", "Gluten-free"] } },
  { name: "Indian Chef" },
  { name: "Cook Service" },
];

// ── Basic Facilities category config ─────────────────────────────────────────

export const BASIC_FACILITIES_CONFIG: GeneralServicesItemConfig[] = [
  { name: "LAN" },
  { name: "Refrigerator" },
  { name: "Umbrellas" },
  { name: "Washing Machine" },
  { name: "Laundromat" },
  { name: "EV Charging Station (Within Premise)",
    field1: { label: "Charging type", type: "select", options: ["Slow charging", "Fast charging", "Rapid charging"] } },
  { name: "Driver's Accommodation",
    field1: { label: "Cost", type: "select", options: ["Free", "Paid"] } },
  { name: "Grocery Purchase" },
  { name: "Utensil Cleaning" },
];

// ── Security category config ──────────────────────────────────────────────────

export const SECURITY_CONFIG: GeneralServicesItemConfig[] = [
  { name: "Smoke detector",
    field1: { label: "Location", type: "multiselect", options: ["In room", "Lobby"] } },
  { name: "Fire extinguishers" },
  { name: "Security alarms" },
  { name: "Security Guard" },
  { name: "Carbon Monoxide Detector" },
  { name: "Door-Eye" },
  { name: "Door Chain" },
];

// ── General Services category config ─────────────────────────────────────────

export const GENERAL_SERVICES_CONFIG: GeneralServicesItemConfig[] = [
  { name: "Laundry",
    field1: { label: "Cost",             type: "select",      options: ["Free", "Paid"] },
    field2: { label: "Services",         type: "multiselect", options: ["Limited Pieces of Laundry Free", "Ironing Service", "Dry Cleaning"] } },
  { name: "Newspaper",
    field1: { label: "Type",             type: "multiselect", options: ["Local Language", "National", "International"] } },
  { name: "Smoking rooms" },
  { name: "Lounge",
    field1: { label: "Type",             type: "multiselect", options: ["Cigar lounge", "Shared lounge", "Private lounge"] } },
  { name: "First-aid services" },
  { name: "Concierge" },
  { name: "Multilingual Staff",
    field1: { label: "Languages Spoken", type: "multiselect", options: ["English", "Hindi", "French", "German", "Spanish", "Arabic", "Japanese", "Chinese", "Russian", "Italian", "Portuguese"] } },
  { name: "Cloak Room" },
  { name: "Specially abled assistance",
    field1: { label: "Assistance Type",  type: "multiselect", options: ["Auditory Guidance", "Tactile paving", "Braille"] } },
  { name: "Butler Services",
    field1: { label: "Type",             type: "multiselect", options: ["Personal", "For each floor"] } },
  { name: "Doctor on call" },
  { name: "Medical centre (Within Premise)" },
  { name: "Pool / Beach towels" },
];
