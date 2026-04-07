// app/lib/hotelImageCategories.ts

export type SystemCategory = {
  name:        string;
  is_required: boolean;
  is_system:   boolean;
  sort_order:  number;
};

// Required — minimum 1 image enforced in UI
export const REQUIRED_HOTEL_CATEGORIES: SystemCategory[] = [
  { name: "Facade / Exterior", is_required: true,  is_system: true, sort_order: 0 },
  { name: "Lobby / Reception", is_required: true,  is_system: true, sort_order: 1 },
];

// Optional predefined — user can skip
export const OPTIONAL_HOTEL_CATEGORIES: SystemCategory[] = [
  { name: "Restaurant / Dining", is_required: false, is_system: true, sort_order: 2 },
  { name: "Swimming Pool",       is_required: false, is_system: true, sort_order: 3 },
  { name: "Gym / Fitness",       is_required: false, is_system: true, sort_order: 4 },
  { name: "Spa / Wellness",      is_required: false, is_system: true, sort_order: 5 },
  { name: "Parking Area",        is_required: false, is_system: true, sort_order: 6 },
  { name: "Garden / Outdoor",    is_required: false, is_system: true, sort_order: 7 },
  { name: "View / Scenery",      is_required: false, is_system: true, sort_order: 8 },
];

export const ALL_SYSTEM_HOTEL_CATEGORIES: SystemCategory[] = [
  ...REQUIRED_HOTEL_CATEGORIES,
  ...OPTIONAL_HOTEL_CATEGORIES,
];

// Room category name helper
export function getRoomCategoryName(room_type: string): string {
  return room_type; // e.g. "Deluxe Room", "Standard Room"
}