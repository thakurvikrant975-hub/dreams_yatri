// Shared types and pure helpers — no "use server" directive

export type BathroomDetail = {
  name: string;
  type: string;
  has_bathtub: boolean;
  has_shower: boolean;
  has_hot_water: boolean;
  amenities: string[];
  size_value: number | null;
  size_unit: "sqm" | "sqft";
  floor_level: string;
  step_reached: number;
};

export type KitchenDetail = {
  type: string;
  is_accessible: boolean;
  meal_types: string;
  staff_help: string[];
  appliances: string[];
  appliance_details: Record<string, string | string[]>;
  description: string;
  step_reached: number;
};

export type SpaceItem = {
  id: string;
  space_type: string;
  label: string;
  instance: number;
  name: string;
  access_type: string;
  is_accessible: boolean;
  beds: Record<string, number>;
  base_adults: number;
  max_adults: number;
  floor_level: string;
  room_view: string;
  room_size: number | null;
  room_size_unit: "sqm" | "sqft";
  has_attached_bathroom: boolean | null;
  has_attached_balcony: boolean | null;
  amenities: string[];
  amenity_details: Record<string, string | string[]>;
  description: string;
  details_added: boolean;
  step_reached: number;
};

export const BED_TYPES: { key: string; label: string; size: string }[] = [
  { key: "single_bed",    label: "Single Bed",    size: "3 by 4 feet" },
  { key: "twin_bed",      label: "Twin Bed",       size: "3 by 4 feet" },
  { key: "queen_bed",     label: "Queen Bed",      size: "5 by 6 feet" },
  { key: "king_bed",      label: "King Bed",       size: "6 by 6.30 feet" },
  { key: "double_bed",    label: "Double Bed",     size: "6 by 6 feet" },
  { key: "bunk_bed",      label: "Bunk Bed",       size: "Variable Size" },
  { key: "mattress",      label: "Mattress",       size: "Variable Size" },
  { key: "sofa_cum_bed",  label: "Sofa Cum Bed",   size: "Variable Size" },
  { key: "sofa_2_seater", label: "2 Seater Sofa",  size: "Variable Size" },
  { key: "sofa_3_seater", label: "3 Seater Sofa",  size: "Variable Size" },
  { key: "sofa_5_seater", label: "5 Seater Sofa",  size: "Variable Size" },
  { key: "futon",         label: "Futon",          size: "Variable Size" },
  { key: "murphy",        label: "Murphy",         size: "Variable Size" },
  { key: "tatami_mats",   label: "Tatami Mats",    size: "Variable Size" },
];

export const SPACE_TYPES: { key: string; label: string }[] = [
  { key: "living_room",   label: "Living Room" },
  { key: "lobby_lounge",  label: "Lobby Lounge" },
  { key: "helpers_room",  label: "Helpers Room" },
  { key: "swimming_pool", label: "Swimming Pool" },
  { key: "parking",       label: "Parking" },
  { key: "drivers_room",  label: "Drivers Room" },
  { key: "terrace",       label: "Terrace" },
  { key: "courtyard",     label: "Courtyard" },
  { key: "dining_area",   label: "Dining Area" },
  { key: "gym",           label: "Gym" },
  { key: "game_room",     label: "Game Room" },
  { key: "library",       label: "Library" },
  { key: "prayer_room",   label: "Prayer Room" },
  { key: "store_room",    label: "Store Room" },
  { key: "garden",        label: "Garden" },
];

export function defaultBathroom(n: number): BathroomDetail {
  return {
    name: `Bathroom ${n}`,
    type: "",
    has_bathtub: false,
    has_shower: true,
    has_hot_water: true,
    amenities: [],
    size_value: null,
    size_unit: "sqm",
    floor_level: "",
    step_reached: 0,
  };
}

export function defaultKitchen(): KitchenDetail {
  return { type: "", is_accessible: true, meal_types: "", staff_help: [], appliances: [], appliance_details: {}, description: "", step_reached: 0 };
}

export function defaultSpace(type: string, label: string, instance: number): SpaceItem {
  return {
    id: `${type}_${instance}_${Date.now()}`,
    space_type: type, label, instance,
    name: `${label} ${instance}`,
    access_type: "",
    is_accessible: true,
    beds: {},
    base_adults: 1,
    max_adults: 2,
    floor_level: "",
    room_view: "",
    room_size: null,
    room_size_unit: "sqm",
    has_attached_bathroom: null,
    has_attached_balcony: null,
    amenities: [],
    amenity_details: {},
    description: "",
    details_added: false,
    step_reached: 0,
  };
}
