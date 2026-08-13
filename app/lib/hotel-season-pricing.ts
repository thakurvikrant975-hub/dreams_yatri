// Pure hotel seasonal/weekend price resolution — no "use server" here on
// purpose, so both package-pricing.service.ts (the billing engine) and
// package-builder/action.ts (the builder's hotel search) can call the exact
// same resolution logic. Search showing one price and billing computing a
// different one for the same room/date would be a much worse bug than any
// duplication this avoids.

/**
 * Resolve the effective hotel price_per_night, extra-bed (mattress) rate, and
 * occupancy_prices for a given travel date. Seasons are stored year-agnostically
 * (year-2000 placeholder). Returns the matched season's rates, or the base room
 * pricing rates if no season applies.
 *
 * Extra-bed rate resolution mirrors the room rate: a season's own weekday/weekend
 * extra-bed rate is used when set; if a season doesn't specify one, it falls back
 * to the base room's extra-bed rate — a season overriding just the room rate
 * shouldn't silently zero out the mattress charge. Weekend variants (room and
 * extra-bed) fall back to their own weekday value when not set, at both the base
 * and season level, matching the "not provided = same as weekday" convention
 * used throughout the Seasonal Rate Calendar.
 */
export type OccupancyPriceRow = { occupancy: number; price_per_night: unknown; weekend_price_per_night?: unknown };

// Occupancy-tier prices (e.g. single occupancy) get the same weekday/weekend
// split as the room rate and extra-bed rate — a tier with no weekend price of
// its own just uses its own weekday price on weekends too.
function resolveOccupancyWeekend(entry: OccupancyPriceRow, isWeekend: boolean): { occupancy: number; price_per_night: unknown } {
  return {
    occupancy: entry.occupancy,
    price_per_night: (isWeekend && entry.weekend_price_per_night != null) ? entry.weekend_price_per_night : entry.price_per_night,
  };
}

export function resolveHotelSeasonPricing(
  roomPricing: {
    price_per_night: unknown;
    extra_bed_rate: unknown;
    weekend_extra_bed_rate?: unknown;
    occupancy_prices: OccupancyPriceRow[];
    seasons: {
      valid_from: Date;
      valid_to: Date;
      price_per_night: unknown;
      weekend_price_per_night?: unknown;
      extra_bed_rate?: unknown;
      weekend_extra_bed_rate?: unknown;
      occupancy_prices?: OccupancyPriceRow[];
    }[];
  },
  travelDate: Date | null,
): { basePrice: number; extraBedRate: number; occPrices: { occupancy: number; price_per_night: unknown }[]; isSeasonal: boolean } {
  const defaultBase = Number(roomPricing.price_per_night);
  const defaultExtraBedWeekday = roomPricing.extra_bed_rate != null ? Number(roomPricing.extra_bed_rate) : 0;
  const defaultExtraBedWeekend = roomPricing.weekend_extra_bed_rate != null
    ? Number(roomPricing.weekend_extra_bed_rate)
    : defaultExtraBedWeekday;

  const isWeekend = travelDate ? (travelDate.getDay() === 0 || travelDate.getDay() === 6) : false;
  const defaultExtraBedRate = isWeekend ? defaultExtraBedWeekend : defaultExtraBedWeekday;
  const defaultOcc = roomPricing.occupancy_prices.map((op) => resolveOccupancyWeekend(op, isWeekend));

  if (!travelDate || roomPricing.seasons.length === 0) {
    return { basePrice: defaultBase, extraBedRate: defaultExtraBedRate, occPrices: defaultOcc, isSeasonal: false };
  }

  const normalised = new Date(2000, travelDate.getMonth(), travelDate.getDate());
  const matchedSeason = roomPricing.seasons.find((s) => {
    const from = new Date(s.valid_from);
    const to = new Date(s.valid_to);
    const normFrom = new Date(2000, from.getMonth(), from.getDate());
    const normTo = new Date(2000, to.getMonth(), to.getDate());
    if (normFrom <= normTo) {
      return normalised >= normFrom && normalised <= normTo;
    }
    return normalised >= normFrom || normalised <= normTo;
  });

  if (!matchedSeason) return { basePrice: defaultBase, extraBedRate: defaultExtraBedRate, occPrices: defaultOcc, isSeasonal: false };

  // Use weekend price on Sat (6) or Sun (0) when configured
  const seasonBase = (isWeekend && matchedSeason.weekend_price_per_night != null)
    ? Number(matchedSeason.weekend_price_per_night)
    : Number(matchedSeason.price_per_night);

  const seasonExtraBedWeekday = matchedSeason.extra_bed_rate != null
    ? Number(matchedSeason.extra_bed_rate)
    : defaultExtraBedWeekday;
  const seasonExtraBedWeekend = matchedSeason.weekend_extra_bed_rate != null
    ? Number(matchedSeason.weekend_extra_bed_rate)
    : seasonExtraBedWeekday;
  const seasonExtraBedRate = isWeekend ? seasonExtraBedWeekend : seasonExtraBedWeekday;

  const seasonOcc = (matchedSeason.occupancy_prices ?? []).map((op) => resolveOccupancyWeekend(op, isWeekend));
  return {
    basePrice: seasonBase,
    extraBedRate: seasonExtraBedRate,
    occPrices: seasonOcc.length > 0 ? seasonOcc : defaultOcc,
    isSeasonal: true,
  };
}
