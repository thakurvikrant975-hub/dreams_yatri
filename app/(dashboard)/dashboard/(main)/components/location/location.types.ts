// Mirrors the Prisma LocationType enum — kept as a string union so this file
// can be imported safely from client components (no Prisma server-only symbols).
export type LocationType =
  | "REGION" | "SUBREGION" | "COUNTRY" | "STATE" | "CITY"
  | "DISTRICT" | "AREA" | "NEIGHBORHOOD" | "VILLAGE" | "LANDMARK"
  | "AIRPORT" | "BEACH" | "MOUNTAIN" | "ISLAND" | "TOURISM_ZONE"
  | "BUS_STATION" | "TRAIN_STATION" | "PORT"
  | "HOTEL" | "ACTIVITY" | "ROUTE_STOP";

export const LOCATION_LABELS: Record<LocationType, string> = {
  REGION: "Region", SUBREGION: "Subregion", COUNTRY: "Country",
  STATE: "State", CITY: "City", DISTRICT: "District",
  AREA: "Area", NEIGHBORHOOD: "Neighborhood", VILLAGE: "Village",
  LANDMARK: "Landmark", AIRPORT: "Airport", BEACH: "Beach",
  MOUNTAIN: "Mountain", ISLAND: "Island", TOURISM_ZONE: "Tourism Zone",
  BUS_STATION: "Bus Station", TRAIN_STATION: "Train Station", PORT: "Port",
  HOTEL: "Hotel", ACTIVITY: "Activity", ROUTE_STOP: "Route Stop",
};

export const LOCATION_COLORS: Record<LocationType, string> = {
  REGION: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  SUBREGION: "bg-purple-50 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400",
  COUNTRY: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  STATE: "bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400",
  CITY: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  DISTRICT: "bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400",
  AREA: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300",
  NEIGHBORHOOD: "bg-yellow-50 text-yellow-600 dark:bg-yellow-900/20 dark:text-yellow-400",
  VILLAGE: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
  LANDMARK: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  AIRPORT: "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300",
  BEACH: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300",
  MOUNTAIN: "bg-stone-100 text-stone-700 dark:bg-stone-900/30 dark:text-stone-300",
  ISLAND: "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300",
  TOURISM_ZONE: "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300",
  BUS_STATION: "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-300",
  TRAIN_STATION: "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-300",
  PORT: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300",
  HOTEL: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  ACTIVITY: "bg-lime-100 text-lime-700 dark:bg-lime-900/30 dark:text-lime-300",
  ROUTE_STOP: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300",
};

// Maps Mapbox place_type strings to our LocationType
export const MAPBOX_TYPE_MAP: Record<string, LocationType> = {
  country: "COUNTRY", region: "STATE", district: "DISTRICT",
  place: "CITY", locality: "AREA", neighborhood: "NEIGHBORHOOD",
  address: "AREA", poi: "LANDMARK",
};

// ── Shared value type (what the component exposes to its consumers) ────────────
export interface LocationValue {
  id: string;            // BigInt serialised as string
  name: string;
  type: LocationType;
  breadcrumb: string;    // "Name, State, Country"
  slug: string;
  latitude?: number | null;
  longitude?: number | null;
  city_name?: string | null;
  state_name?: string | null;
  country_name?: string | null;
}

// ── API response shapes ────────────────────────────────────────────────────────
export interface LocalResult extends LocationValue {
  source: "local";
}

export interface ExternalResult {
  source: "external";
  mapbox_id: string;
  name: string;
  full_name: string;
  place_type: LocationType;
  coordinates: [number, number]; // [lng, lat]
  country?: string;
  region?: string;
  place?: string;
}

export type SearchResult = LocalResult | ExternalResult;

// ── Manual creation form ───────────────────────────────────────────────────────
export interface ManualLocationFormValues {
  name: string;
  type: LocationType;
  country: string;
  state: string;
  city: string;
  latitude: string;
  longitude: string;
  description: string;
  slug: string;
  is_featured: boolean;
}

// ── Type restriction constants ─────────────────────────────────────────────────
// Used across multiple callsites — defined once here to avoid duplication.

/** Locations valid as route stops (city-level geographic areas, no transport hubs) */
export const ROUTE_STOP_TYPES: LocationType[] = [
  "CITY", "STATE", "DISTRICT", "AREA", "NEIGHBORHOOD",
  "VILLAGE", "SUBREGION", "REGION", "ISLAND", "TOURISM_ZONE",
];

/** Locations valid as transfer pickup/drop points (specific, sub-city granularity) */
export const TRANSFER_TYPES: LocationType[] = [
  "CITY", "DISTRICT", "AREA", "NEIGHBORHOOD", "VILLAGE",
  "LANDMARK", "AIRPORT", "BUS_STATION", "TRAIN_STATION", "PORT",
  "BEACH", "ISLAND", "TOURISM_ZONE",
];

/** Locations valid for destinations (state/region-level areas) */
export const DESTINATION_TYPES: LocationType[] = [
  "CITY", "STATE", "DISTRICT", "AREA", "SUBREGION",
  "REGION", "ISLAND", "TOURISM_ZONE",
];

/** Locations valid for activities (any physical venue except meta/admin types) */
export const ACTIVITY_TYPES: LocationType[] = [
  "CITY", "STATE", "DISTRICT", "AREA", "NEIGHBORHOOD", "VILLAGE",
  "LANDMARK", "AIRPORT", "BEACH", "MOUNTAIN", "ISLAND", "TOURISM_ZONE",
  "BUS_STATION", "TRAIN_STATION", "PORT", "SUBREGION", "REGION",
];

// ── Component props ────────────────────────────────────────────────────────────
export interface LocationSearchSelectProps {
  value: LocationValue | null;
  onChange: (location: LocationValue | null) => void;
  placeholder?: string;
  /** Restrict results to specific location types */
  types?: LocationType[];
  /** Lock manual-creation type to this value (e.g. "HOTEL") */
  lockedType?: LocationType;
  /** Initial map center for manual creation (defaults to center of India) */
  mapCenter?: { lat: number; lng: number };
  className?: string;
  disabled?: boolean;
  label?: string;
  required?: boolean;
  id?: string;
  error?: string;
  /** Extra query params forwarded to /api/locations/search (e.g. destinationsOnly, excludePricedCabs) */
  extraParams?: Record<string, string>;
  /** Hide the worldwide (Mapbox) search and "Add manually" options */
  disableExternalSearch?: boolean;
  /** Suppress the "Recent" section entirely (use when showing a filtered set like unpriced cities) */
  hideRecent?: boolean;
}
