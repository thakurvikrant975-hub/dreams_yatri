export const PERMIT_PRICE_TYPES = ["FLAT", "PER_PERSON", "PER_VEHICLE"] as const;
export type PermitPriceType = (typeof PERMIT_PRICE_TYPES)[number];

// One catalog permit's per-vehicle rate — lets the package builder resolve
// the right price the moment it knows which vehicle a cab type points to.
export type PermitVehicleRateOption = {
  vehicle_id:        number;
  price_per_vehicle: number;
};

export type PermitOption = {
  id:               number;
  name:             string;
  price_per_vehicle: number;
  price_per_person:  number;
  location_name:    string | null;
  category:         string;
  custom_category:  string | null;
  /** Real per-vehicle rates from the Permits admin page — when non-empty,
   * the package builder can track a cab type instead of a flat price. */
  vehicle_rates:    PermitVehicleRateOption[];
};

export type PackagePermit = {
  id: number;
  duration_id: number;
  name: string;
  /** Fallback/manual price — ignored in favor of resolved_price whenever
   * permit_id + cab_type_id are both set and a matching vehicle rate exists. */
  price: number;
  price_type: PermitPriceType;
  is_included: boolean;
  sort_order: number;
  /** Catalog permit this row is linked to, if any. */
  permit_id: number | null;
  /** Which of the package's cab types this permit's price should track. */
  cab_type_id: number | null;
  /** Live per-vehicle price for the cab type's CURRENT vehicle — null when
   * not linked, or no rate exists yet for that vehicle. */
  resolved_price: number | null;
  /** Vehicle name the resolved_price is for — for display next to the price. */
  resolved_vehicle_name: string | null;
};
