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

export type PermitRow = {
  id:                 number;
  name:               string;
  category:           PermitCategory;
  location_id:        string | null;
  location_name:      string | null;
  issuing_authority:  string | null;
  price_per_vehicle:  number;
  price_per_person:   number | null;
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
  location_id?:       string | null;
  issuing_authority?: string | null;
  price_per_vehicle:  number;
  price_per_person?:  number | null;
  validity_type:      PermitValidityType;
  validity_days?:     number | null;
  notes?:             string | null;
};
