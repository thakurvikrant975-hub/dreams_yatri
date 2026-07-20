/**
 * hotel_rooms.amenities is saved by the room wizard as either a raw
 * string[] (legacy rows) or { selected: string[], details }
 * (room-actions.ts's save shape).
 */
export function parseRoomAmenities(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map(String);
  if (raw && typeof raw === "object" && Array.isArray((raw as { selected?: unknown }).selected)) {
    return (raw as { selected: unknown[] }).selected.map(String);
  }
  return [];
}

/** Maps a human amenity label to the icon-slug keys in amenity-icons.tsx. */
export function iconFor(label: string): string {
  const l = label.toLowerCase();
  if (l.includes("wifi") || l.includes("wi-fi") || l.includes("internet")) return "wifi";
  if (l.includes("park")) return "parking";
  if (l.includes("restaurant") || l.includes("dining") || l.includes("food")) return "restaurant";
  if (l.includes("ac") || l.includes("air condition")) return "ac";
  if (l.includes("pool") || l.includes("swim")) return "pool";
  if (l.includes("gym") || l.includes("fitness")) return "gym";
  if (l.includes("spa") || l.includes("wellness")) return "spa";
  return "desk";
}
