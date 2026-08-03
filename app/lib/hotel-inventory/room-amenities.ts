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

/**
 * Maps a human amenity label to the icon-slug keys in amenity-icons.tsx.
 *
 * Ordered most-specific-first: "Poolside Bar" must reach the bar rule before
 * the pool one, and "Air Conditioning" must not be caught by a bare "ac"
 * substring (which also sits inside "Terrace", "Access" and "Jacuzzi").
 */
export function iconFor(label: string): string {
  const l = label.toLowerCase();

  // Connectivity & tech
  if (l.includes("wifi") || l.includes("wi-fi") || l.includes("internet")) return "wifi";
  if (l.includes("tv") || l.includes("television") || l.includes("streaming") || l.includes("projector")) return "tv";
  if (l.includes("telephone") || l.includes("intercom") || l.includes("phone")) return "phone";
  if (l.includes("charging") || l.includes("power backup") || l.includes("generator")) return "power";
  if (l.includes("smartphone") || l.includes("smart control") || l.includes("music") || l.includes("speaker") || l.includes("dj")) return "music";

  // Safety & security
  if (l.includes("cctv") || l.includes("camera") || l.includes("peep") || l.includes("door-eye")) return "cctv";
  if (l.includes("alarm") || l.includes("smoke detector") || l.includes("carbon monoxide")) return "alarm";
  if (l.includes("first aid") || l.includes("first-aid") || l.includes("doctor") || l.includes("medical")) return "medical";
  if (l.includes("fire exting") || l.includes("security") || l.includes("guard") || l.includes("safety")) return "security";
  if (l.includes("safe") || l.includes("locker")) return "safe";

  // Bathroom & grooming
  if (l.includes("toiletries") || l.includes("towel") || l.includes("dental") || l.includes("slipper") || l.includes("bathrobe")) return "toiletries";
  if (l.includes("hairdryer") || l.includes("shaving") || l.includes("mirror") || l.includes("sewing")) return "grooming";
  if (l.includes("shower") || l.includes("bathtub") || l.includes("jacuzzi") || l.includes("bath") || l.includes("water purifier") || l.includes("mineral water")) return "water";
  if (l.includes("hot water") || l.includes("geyser") || l.includes("heater") || l.includes("fireplace")) return "heating";

  // Food & drink
  if (l.includes("bar") || l.includes("cafe") || l.includes("coffee") || l.includes("kettle") || l.includes("minibar") || l.includes("mini bar")) return "kitchen";
  if (l.includes("restaurant") || l.includes("dining") || l.includes("food") || l.includes("breakfast") || l.includes("bbq")) return "restaurant";
  if (l.includes("kitchen") || l.includes("microwave") || l.includes("refrigerator") || l.includes("fridge") || l.includes("stove") || l.includes("induction") || l.includes("toaster")) return "kitchen";

  // Leisure
  if (l.includes("pool") || l.includes("swim")) return "pool";
  if (l.includes("gym") || l.includes("fitness")) return "gym";
  if (l.includes("spa") || l.includes("wellness") || l.includes("sauna") || l.includes("massage")) return "spa";
  if (
    l.includes("game") || l.includes("kids") || l.includes("play") || l.includes("sport") ||
    l.includes("safari") || l.includes("cycling") || l.includes("kayak") || l.includes("golf") ||
    l.includes("ski") || l.includes("canoe") || l.includes("snorkel") || l.includes("jungle")
  ) return "games";
  if (l.includes("library") || l.includes("newspaper") || l.includes("book")) return "library";

  // Services
  if (l.includes("park")) return "parking";
  if (l.includes("laundry") || l.includes("washing") || l.includes("iron") || l.includes("housekeep")) return "laundry";
  if (l.includes("reception") || l.includes("concierge") || l.includes("caretaker") || l.includes("staff") || l.includes("butler")) return "reception";
  if (l.includes("luggage") || l.includes("cloak") || l.includes("wardrobe") || l.includes("closet")) return "storage";
  if (l.includes("transfer") || l.includes("pickup") || l.includes("airport") || l.includes("station") || l.includes("shuttle")) return "transfer";
  if (l.includes("room service") || l.includes("in-room dining") || l.includes("in room dining")) return "service";
  if (l.includes("atm") || l.includes("payment") || l.includes("card")) return "payment";
  if (l.includes("printer") || l.includes("photocopier") || l.includes("scanner")) return "printer";
  if (l.includes("business") || l.includes("conference") || l.includes("meeting")) return "business";
  if (l.includes("desk") || l.includes("work")) return "workspace";

  // Rooms & structure
  if (l.includes("elevator") || l.includes("lift")) return "elevator";
  if (l.includes("balcony") || l.includes("terrace") || l.includes("garden") || l.includes("beach") || l.includes("view")) return "balcony";
  if (l.includes("pillow") || l.includes("blanket") || l.includes("bedding") || l.includes("cot") || l.includes("crib") || l.includes("curtain")) return "bedding";
  if (l.includes("air condition") || l.includes("ceiling fan") || l.includes("fan") || l.includes("air purifier")) return "ac";
  if (
    l.includes("sofa") || l.includes("chair") || l.includes("table") || l.includes("seating") ||
    l.includes("sitting") || l.includes("couch") || l.includes("furniture") || l.includes("lounge")
  ) return "furniture";
  if (l.includes("wheelchair") || l.includes("accessib") || l.includes("abled")) return "device";
  if (l.includes("room") || l.includes("smoking")) return "balcony";

  return "desk";
}
