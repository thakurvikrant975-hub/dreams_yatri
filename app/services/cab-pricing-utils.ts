/**
 * Pure cab-pricing helpers — deliberately NOT in package-pricing.service.ts,
 * which has a top-level "use server" directive (every export there must be
 * an async Server Action). This stays a plain sync module so both the
 * package pricing engine and ad-hoc lookups (e.g. verify-cabs' "Change Cab"
 * vehicle picker) can import it directly.
 */

/** Resolve the effective cab price for a segment given a specific calendar date.
 *  Seasons are stored year-agnostically (year-2000 placeholder), so we normalise
 *  the query date to year 2000 before comparing — same pattern as hotel/activity seasons.
 */
export function resolveCabPrice(
  basePricing: {
    pricing_type: string;
    price: unknown;
    seasons: Array<{
      pricing_type: string;
      valid_from: Date;
      valid_to: Date;
      weekday_price: unknown;
      weekend_price: unknown;
      is_active: boolean;
    }>;
  },
  date: Date | null,
): { weekdayPrice: number; weekendPrice: number; is_seasonal: boolean; pricing_type: "PER_DAY" | "PER_KM" } {
  const basePrice = Number(basePricing.price);
  const basePricingType = basePricing.pricing_type as "PER_DAY" | "PER_KM";

  if (!date) {
    return { weekdayPrice: basePrice, weekendPrice: basePrice, is_seasonal: false, pricing_type: basePricingType };
  }

  // Normalise to year 2000 for year-agnostic season matching
  const normalised = new Date(2000, date.getMonth(), date.getDate());
  const activeSeason = basePricing.seasons.find((s) => {
    if (!s.is_active) return false;
    const from = new Date(s.valid_from);
    const to = new Date(s.valid_to);
    const normFrom = new Date(2000, from.getMonth(), from.getDate());
    const normTo = new Date(2000, to.getMonth(), to.getDate());
    if (normFrom <= normTo) {
      return normalised >= normFrom && normalised <= normTo;
    }
    // Cross-year range (e.g., Nov → Feb)
    return normalised >= normFrom || normalised <= normTo;
  });

  if (!activeSeason) {
    return { weekdayPrice: basePrice, weekendPrice: basePrice, is_seasonal: false, pricing_type: basePricingType };
  }

  const weekdayPrice = Number(activeSeason.weekday_price);
  const weekendPrice = activeSeason.weekend_price != null && Number(activeSeason.weekend_price) > 0
    ? Number(activeSeason.weekend_price)
    : weekdayPrice;
  const pricingType = activeSeason.pricing_type as "PER_DAY" | "PER_KM";

  return { weekdayPrice, weekendPrice, is_seasonal: true, pricing_type: pricingType };
}
