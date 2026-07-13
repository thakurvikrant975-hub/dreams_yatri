// Types and constants for permits — kept separate from actions.ts so they
// can be imported by client components without the "use server" restriction.

export const PERMIT_CATEGORIES = [
  "ENTRY_FEE",
  "MOUNTAIN_PASS",
  "WILDLIFE",
  "BORDER_AREA",
  "NATIONAL_PARK",
  "FOREST",
  "OTHER",
] as const;
export type PermitCategory = (typeof PERMIT_CATEGORIES)[number];

// Sentinel used only in the form UI — maps to category=OTHER + custom_category=<text>
export const CUSTOM_CATEGORY_VALUE = "__CUSTOM__";

export const PERMIT_VALIDITY_TYPES = ["SINGLE_TRIP", "PER_DAY", "MULTI_DAY"] as const;
export type PermitValidityType = (typeof PERMIT_VALIDITY_TYPES)[number];

export const CATEGORY_LABELS: Record<PermitCategory, string> = {
  ENTRY_FEE:     "Entry Fee",
  MOUNTAIN_PASS: "Mountain Pass",
  WILDLIFE:      "Wildlife",
  BORDER_AREA:   "Border Area",
  NATIONAL_PARK: "National Park",
  FOREST:        "Forest",
  OTHER:         "Other",
};

export const VALIDITY_LABELS: Record<PermitValidityType, string> = {
  SINGLE_TRIP: "Single Trip",
  PER_DAY:     "Per Day",
  MULTI_DAY:   "Multi Day",
};

// A permit's price for one specific vehicle — e.g. Rohtang Pass costs a
// different amount for an SUV than a Sedan or a Bus, priced per km driven.
export type PermitVehicleRate = {
  vehicle_id:         number;
  vehicle_name:       string;
  vehicle_type:       string;
  passenger_capacity: number;
  has_ac:             boolean;
  thumbnail:          string | null;
  price_per_km:       number;
};

export type PermitRow = {
  id:                 number;
  name:               string;
  category:           PermitCategory;
  custom_category:    string | null;
  location_id:        string | null;
  location_name:      string | null;
  issuing_authority:  string | null;
  vehicle_rates:      PermitVehicleRate[];
  validity_type:      PermitValidityType;
  validity_days:      number | null;
  notes:              string | null;
  is_active:          boolean;
  created_by:         string | null;
  updated_by:         string | null;
  created_at:         Date;
  updated_at:         Date;
};

export type PermitInput = {
  name:               string;
  category:           PermitCategory;
  custom_category?:   string | null;
  location_id?:       string | null;
  issuing_authority?: string | null;
  vehicle_rates:      { vehicle_id: number; price_per_km: number }[];
  validity_type:      PermitValidityType;
  validity_days?:     number | null;
  notes?:             string | null;
};

// ── Vehicle-picker (city search, sorted by distance from the permit's own
// location, backed by real cab_pricing rows so only vehicles that are
// actually priced somewhere can be attached to a permit) ────────────────────

export type CabPricingCityOption = {
  /** Stable identifier for one destination/location grouping — "dest:<id>"
   * or "loc:<id>" — not a DB id on its own since either source can apply. */
  cityKey:      string;
  cityName:     string;
  stateName:    string | null;
  vehicleCount: number;
  /** Straight-line km from the permit's own location; null when the permit
   * has no location set yet, or this city has no stored coordinates. */
  distanceKm:   number | null;
};

export type VehicleCandidate = {
  vehicle_id:         number;
  vehicle_name:       string;
  vehicle_type:       string;
  passenger_capacity: number;
  has_ac:             boolean;
  thumbnail:          string | null;
};

// Returns the label to display in the table for a permit's category
export function displayCategory(row: Pick<PermitRow, "category" | "custom_category">): string {
  if (row.category === "OTHER" && row.custom_category) return row.custom_category;
  return CATEGORY_LABELS[row.category];
}
