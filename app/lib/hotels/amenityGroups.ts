import { AMENITY_CATEGORIES } from "@/app/(hotel-connect)/hotel-connect/(main)/properties/[id]/edit/tabs/amenities-data";
import { ROOM_AMENITY_GROUPS } from "@/app/(hotel-connect)/hotel-connect/(main)/properties/[id]/edit/tabs/room-data";

/**
 * Categorise a property's amenities for the guest-facing detail page.
 *
 * The problem this solves: three vocabularies are in play. The owner wizard
 * writes `AMENITY_CATEGORIES` names ("Wifi", "Power backup", "Room service"),
 * the room wizard writes `ROOM_AMENITY_GROUPS` names ("Geyser/Water Heater"),
 * and the dashboard-imported stock in `hotel_rooms.amenities` uses a third
 * spelling again ("Wi-Fi", "Power Backup", "Geyser / Water Heater"). An exact
 * `map[name]` lookup — what the page did before — matched almost none of the
 * imported values, so the Amenities section rendered empty on properties that
 * actually list 20+ facilities each.
 *
 * Matching on a normalised key (case- and punctuation-insensitive) lifts the
 * hit rate from near-zero to 80 of the 111 distinct values in the catalogue;
 * `EXTRA_GROUPS` below places the remaining 31 by hand. Anything still
 * unrecognised lands in a catch-all group rather than being dropped, so a new
 * amenity added upstream degrades to "shown, roughly grouped" instead of
 * "silently invisible".
 */

/** Case/punctuation-insensitive key: "Wi-Fi", "Wifi" and "WI FI" all collapse. */
export function normaliseAmenity(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * Values present in the imported catalogue that neither wizard vocabulary
 * knows. Grouped into the labels those vocabularies already use, so the tabs a
 * guest sees stay the same set.
 */
const EXTRA_GROUPS: Record<string, string> = {
  "24-Hour Reception": "General Services",
  "Luggage Storage": "General Services",
  "Baby Cot / Crib": "Family and Kids",
  "Cable TV": "Media and Technology",
  "Smart TV": "Media and Technology",
  "Streaming Services": "Media and Technology",
  "Cafe / Coffee Shop": "Food and Drink",
  "Poolside Bar": "Food and Drink",
  "Ceiling Fan": "Room Features",
  "Coffee / Tea Maker": "Room Features",
  "Connecting Rooms Available": "Room Features",
  "Electric Kettle": "Room Features",
  "Electronic Safe": "Room Features",
  "Intercom": "Room Features",
  "Reading Chair": "Room Features",
  "Sitting Area": "Room Features",
  "Wardrobe / Closet": "Room Features",
  "Extra Pillows / Blankets": "Beds & Blanket",
  "Fire Extinguisher": "Security",
  "First Aid Kit": "Security",
  "Hot Water": "Basic Facilities",
  "Rain Shower": "Basic Facilities",
  "Shower": "Basic Facilities",
  "Water Purifier": "Basic Facilities",
  "Garden Access": "Common Area",
  "Golf Course": "Outdoor Sports & Activities",
  "Photocopier": "Business Center and Conferences",
  "Projector": "Business Center and Conferences",
  "Sauna": "Spa & Wellness",
  "Wheelchair Accessible": "Accessibility",
  "DJ": "Live Shows & Music",
};

/** "Mandatory" is the wizard's own internal label and reads oddly to a guest. */
const DISPLAY_LABEL: Record<string, string> = { Mandatory: "Most Popular" };

const CATCH_ALL = "More Facilities";

/** Guest-facing tab order — recognisable groups first, niche ones last. */
const GROUP_ORDER = [
  "Most Popular",
  "Basic Facilities",
  "Popular with Guests",
  "Room Features",
  "Beds & Blanket",
  "General Services",
  "Food and Drink",
  "Food & Drinks",
  "Kitchen & Appliances",
  "Media and Technology",
  "Media & Entertainment",
  "Entertainment",
  "Common Area",
  "Spa & Wellness",
  "Outdoor Sports & Activities",
  "Indoor Sports & Activities",
  "Water Sports & Activities",
  "Wildlife & Nature",
  "Rides, Safari, Excursions & Tour",
  "Hands-on Workshops",
  "Live Shows & Music",
  "Business Center and Conferences",
  "Transfers",
  "Family and Kids",
  "Childcare",
  "Pet Essentials",
  "Accessibility",
  "Security",
  "Safety & Security",
  "Shopping",
  "Payment Services",
  "Other Facilities",
  CATCH_ALL,
];

/** normalised amenity key → group label. Built once at module load. */
const GROUP_BY_AMENITY: Map<string, string> = (() => {
  const map = new Map<string, string>();
  // Property vocabulary wins over the room one where both know a name, since
  // its grouping is the one the guest-facing tabs were designed around.
  for (const cat of AMENITY_CATEGORIES) {
    for (const item of cat.items) map.set(normaliseAmenity(item), DISPLAY_LABEL[cat.label] ?? cat.label);
  }
  for (const cat of ROOM_AMENITY_GROUPS) {
    for (const item of cat.items) {
      const key = normaliseAmenity(item);
      if (!map.has(key)) map.set(key, DISPLAY_LABEL[cat.label] ?? cat.label);
    }
  }
  for (const [name, group] of Object.entries(EXTRA_GROUPS)) {
    map.set(normaliseAmenity(name), group);
  }
  return map;
})();

export function groupForAmenity(name: string): string {
  return GROUP_BY_AMENITY.get(normaliseAmenity(name)) ?? CATCH_ALL;
}

export type AmenityGroup = { group: string; items: { label: string; icon: string }[] };

/**
 * Group a flat list of amenity names into guest-facing sections, preserving the
 * property's own spelling for display and de-duplicating across rooms.
 */
export function groupAmenityNames(
  names: string[],
  iconFor: (name: string) => string,
): AmenityGroup[] {
  const seen = new Set<string>();
  const byGroup = new Map<string, string[]>();

  for (const raw of names) {
    const name = raw.trim();
    if (!name) continue;
    const key = normaliseAmenity(name);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const group = groupForAmenity(name);
    if (!byGroup.has(group)) byGroup.set(group, []);
    byGroup.get(group)!.push(name);
  }

  return [...byGroup.entries()]
    .sort(([a], [b]) => {
      const ia = GROUP_ORDER.indexOf(a);
      const ib = GROUP_ORDER.indexOf(b);
      return (ia === -1 ? GROUP_ORDER.length : ia) - (ib === -1 ? GROUP_ORDER.length : ib);
    })
    .map(([group, items]) => ({
      group,
      items: items.sort((a, b) => a.localeCompare(b)).map((label) => ({ label, icon: iconFor(label) })),
    }));
}

/**
 * The handful shown in the summary strip above the "View all" link. Ordered by
 * how many guests actually look for them, not alphabetically or by whatever
 * order the property happened to save.
 */
const HEADLINE_PRIORITY = [
  "Wi-Fi", "Swimming Pool", "Restaurant", "Parking", "Air Conditioning",
  "Room Service", "Power Backup", "Gym / Fitness Centre", "Spa", "Bar",
  "Reception", "Housekeeping", "Laundry Service", "TV", "Elevator / Lift",
  "Hot Water", "Airport Transfers", "Doctor on Call",
];

export function headlineAmenities(names: string[], limit = 8): string[] {
  const byKey = new Map<string, string>();
  for (const n of names) {
    const key = normaliseAmenity(n);
    if (key && !byKey.has(key)) byKey.set(key, n.trim());
  }
  const out: string[] = [];
  for (const preferred of HEADLINE_PRIORITY) {
    const hit = byKey.get(normaliseAmenity(preferred));
    if (hit) { out.push(hit); byKey.delete(normaliseAmenity(preferred)); }
    if (out.length >= limit) return out;
  }
  for (const rest of byKey.values()) {
    out.push(rest);
    if (out.length >= limit) break;
  }
  return out;
}
