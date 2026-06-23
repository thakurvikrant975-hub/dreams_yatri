export const GUEST_HOUSE_ROOM_TYPES = [
  "Standard", "Deluxe", "Family", "AC Room", "Non-AC Room", "Dormitory", "Other",
];

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
  { value: "accommodation_only",    label: "Accommodation only (No meals included)" },
  { value: "free_breakfast",        label: "FREE Breakfast" },
  { value: "half_board",            label: "FREE Breakfast and Lunch/Dinner (Half Board)" },
  { value: "full_board",            label: "FREE Breakfast, Lunch and Dinner (Full Board)" },
  { value: "cooked_breakfast",      label: "FREE Cooked Breakfast" },
  { value: "full_board_custom",     label: "FREE Breakfast, Lunch, Dinner and Custom Inclusions" },
  { value: "breakfast_lunch",       label: "FREE Breakfast and Lunch" },
  { value: "breakfast_dinner",      label: "FREE Breakfast and Dinner" },
  { value: "free_lunch",            label: "FREE Lunch" },
  { value: "free_dinner",           label: "FREE Dinner" },
  { value: "lunch_dinner",          label: "FREE Lunch and Dinner" },
];

// ── Room amenity sub-field config ─────────────────────────────────────────────

export type RoomAmenitySubField = {
  label?: string;
  type: "select" | "multiselect";
  options: string[];
};

export type RoomAmenityConfig = {
  name: string;
  field?: RoomAmenitySubField;
};

export const ROOM_MANDATORY_CONFIG: RoomAmenityConfig[] = [
  { name: "Bathtub" },
  { name: "Hairdryer" },
  { name: "Hot & Cold Water" },
  { name: "Toiletries",
    field: { type: "multiselect", options: ["Premium", "Moisturiser", "Shampoo", "Conditioner", "Shower Gel", "Soap", "Comb"] } },
  { name: "Towels",
    field: { type: "multiselect", options: ["Bath Towel", "Pool Towel"] } },
  { name: "TV",
    field: { type: "multiselect", options: ["LED TV", "LCD TV", "Plasma TV", "CRT TV", "Smart TV"] } },
  { name: "Balcony",
    field: { label: "Type", type: "select", options: ["Private", "Shared"] } },
  { name: "Private Pool" },
  { name: "Air Conditioning",
    field: { label: "Type", type: "select", options: ["Centralized", "Room controlled", "Temperature will be fixed as per Govt. Norms", "Window AC", "Split AC"] } },
  { name: "Iron/Ironing Board" },
  { name: "Mineral Water" },
  { name: "Kettle" },
  { name: "Wifi" },
  { name: "Safe",
    field: { label: "Type", type: "select", options: ["Electronic", "Manual"] } },
  { name: "Bathroom",
    field: { label: "Type", type: "select", options: ["Private", "Shared"] } },
  { name: "Peep Hole" },
];

export const ROOM_AMENITY_GROUPS: { label: string; items: string[] }[] = [
  {
    label: "Mandatory",
    items: [
      "Bathtub", "Hairdryer", "Hot & Cold Water", "Toiletries", "Towels",
      "TV", "Balcony", "Private Pool", "Air Conditioning", "Iron/Ironing Board",
      "Mineral Water", "Kettle", "Wifi", "Safe", "Bathroom", "Peep Hole",
    ],
  },
  {
    label: "Popular with Guests",
    items: [
      "Interconnected Room", "Heater", "Housekeeping", "In Room Dining",
      "Laundry Service", "Room Service", "Smoking Room", "Study Room",
      "Air Purifier", "Bathroom Phone", "Bubble Bath", "Dental Kit",
      "Geyser/Water Heater", "Slippers", "Shower Cap", "Hammam", "Bathrobes",
      "Western Toilet Seat", "Shower Cubicle", "Weighing Scale", "Shaving Mirror",
      "Sewing Kit", "Bidet", "Toilet with Grab Rails", "Ensuite Bathroom/Common Bay",
      "Jetspray", "Open Air Shower",
    ],
  },
  {
    label: "Room Features",
    items: [
      "Closet", "Blackout Curtains", "Center Table", "Charging Points", "Couch",
      "Dining Table", "Fireplace", "Mini Fridge", "Sofa", "Telephone", "Work Desk",
      "Pillow Menu", "Hypoallergenic Bedding", "Living Area", "Dining Area",
      "Seating Area", "Chair", "Fireplace Guards", "Open Air Bath", "Jacuzzi",
      "Hot Water Bag", "Full-length Mirror", "Private Garden", "Private Beach",
    ],
  },
  {
    label: "Media & Entertainment",
    items: ["Smart Controls", "Sound Speakers", "Smartphone"],
  },
  {
    label: "Food & Drinks",
    items: ["Cake", "Fruit Basket", "Mini Bar", "BBQ Grill", "Cook Service", "Champagne", "Sparkling Wine"],
  },
  {
    label: "Kitchen & Appliances",
    items: [
      "Dishwasher", "Induction", "Kitchenette", "Refrigerator", "Washing Machine",
      "Cook/Chef", "Cooking Basics", "Coffee Machine", "Stove/Induction",
      "Dishes and Silverware", "Toaster", "Microwave", "Rice Cooker",
      "Espresso Pod Machine", "French Press",
    ],
  },
  {
    label: "Beds & Blanket",
    items: ["Blanket"],
  },
  {
    label: "Safety & Security",
    items: ["Cupboards with Locks"],
  },
  {
    label: "Childcare",
    items: ["Child Safety Socket Covers"],
  },
  {
    label: "Other Facilities",
    items: ["Mosquito Net", "Newspaper", "Terrace", "Fan", "Butler Service"],
  },
];
