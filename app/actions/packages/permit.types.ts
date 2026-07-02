export const PERMIT_PRICE_TYPES = ["FLAT", "PER_PERSON", "PER_VEHICLE"] as const;
export type PermitPriceType = (typeof PERMIT_PRICE_TYPES)[number];

export type PermitOption = {
  id:               number;
  name:             string;
  price_per_vehicle: number;
  price_per_person:  number;
  location_name:    string | null;
  category:         string;
  custom_category:  string | null;
};

export type PackagePermit = {
  id: number;
  duration_id: number;
  name: string;
  price: number;
  price_type: PermitPriceType;
  is_included: boolean;
  sort_order: number;
};
