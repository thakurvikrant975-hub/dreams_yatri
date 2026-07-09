import "server-only";
import { db } from "@/app/lib/db";
import { getRoomAvailability, type NightAvailability } from "./availability";

/**
 * Channel-management — ARI resolver (read path).
 *
 * Combines the Phase 2 availability ledger with the existing season/weekend/occupancy
 * pricing engine into one per-night record: `(room, date) → { available, price, restrictions }`.
 *
 * Season resolution mirrors `app/services/package-pricing.service.ts`
 * (`resolveHotelSeasonPricing`) so ARI prices stay consistent with package pricing:
 *   - seasons are year-agnostic (matched on month/day, wrap-around supported),
 *   - weekend = Sat/Sun uses `weekend_price_per_night` when set,
 *   - occupancy overrides come from the season, else the base rate plan.
 *
 * Resolves either a specific rate plan (pass `pricingId`) or, when omitted, the room's
 * **lead** rate plan (lowest sort_order) — the "room rate" a calendar / channel needs by
 * default when no particular plan is in play. A per-date `price_override` on the ledger
 * wins over everything, regardless of which plan was resolved.
 */

export type PriceSource = "override" | "weekend" | "season" | "base" | "none";

export type DailyRate = NightAvailability & {
  price: number | null;
  priceSource: PriceSource;
  planName: string | null;
};

type OccPrice = { occupancy: number; price_per_night: unknown };
type Season = {
  valid_from: Date;
  valid_to: Date;
  price_per_night: unknown;
  weekend_price_per_night: unknown;
  occupancy_prices: OccPrice[];
};
type ResolvedPlan = {
  plan_name: string | null;
  price_per_night: unknown;
  occupancy_prices: OccPrice[];
  seasons: Season[];
};

function normMonthDay(d: Date): Date {
  return new Date(2000, d.getMonth(), d.getDate());
}

function pickOcc(occPrices: OccPrice[], occupancy: number | null): number | null {
  if (occupancy == null) return null;
  const hit = occPrices.find((o) => o.occupancy === occupancy);
  return hit ? Number(hit.price_per_night) : null;
}

/**
 * Resolve one night's base price for a rate plan (before ledger override),
 * following the same rules as the package-pricing service.
 */
function resolvePlanNight(
  plan: ResolvedPlan,
  night: Date,
  occupancy: number | null,
): { price: number; source: PriceSource } {
  const defaultBase = Number(plan.price_per_night);
  const norm = normMonthDay(night);

  const season = plan.seasons.find((s) => {
    const from = normMonthDay(new Date(s.valid_from));
    const to = normMonthDay(new Date(s.valid_to));
    return from <= to ? norm >= from && norm <= to : norm >= from || norm <= to;
  });

  if (!season) {
    const occ = pickOcc(plan.occupancy_prices, occupancy);
    return { price: occ ?? defaultBase, source: "base" };
  }

  const isWeekend = night.getDay() === 0 || night.getDay() === 6;
  const weekend = isWeekend && season.weekend_price_per_night != null;
  const seasonBase = weekend ? Number(season.weekend_price_per_night) : Number(season.price_per_night);

  const occList = season.occupancy_prices.length > 0 ? season.occupancy_prices : plan.occupancy_prices;
  const occ = pickOcc(occList, occupancy);

  return { price: occ ?? seasonBase, source: weekend ? "weekend" : "season" };
}

/**
 * Per-night ARI for a room over `[checkIn, checkOut)`.
 * `occupancy` defaults to the room's `base_adults`. Ledger `price_override` wins.
 * `pricingId`, when given, resolves that specific rate plan instead of the lead plan —
 * every existing caller omits it and keeps today's lead-plan behavior unchanged.
 */
export async function getRoomARI(
  roomId: number,
  checkIn: string,
  checkOut: string,
  occupancy?: number,
  pricingId?: number,
): Promise<DailyRate[]> {
  const nights = await getRoomAvailability(roomId, checkIn, checkOut);
  if (nights.length === 0) return [];

  const pricingSelect = {
    plan_name: true,
    price_per_night: true,
    occupancy_prices: { select: { occupancy: true, price_per_night: true } },
    seasons: {
      where: { is_active: true },
      select: {
        valid_from: true,
        valid_to: true,
        price_per_night: true,
        weekend_price_per_night: true,
        occupancy_prices: { select: { occupancy: true, price_per_night: true } },
      },
    },
  } as const;

  const room = await db.hotel_rooms.findUnique({
    where: { id: roomId },
    select: {
      base_adults: true,
      pricing: pricingId != null
        ? { where: { id: pricingId }, take: 1, select: pricingSelect }
        : { where: { is_active: true }, orderBy: { sort_order: "asc" }, take: 1, select: pricingSelect },
    },
  });

  const resolved = room?.pricing[0] as ResolvedPlan | undefined;
  const occ = occupancy ?? room?.base_adults ?? null;

  return nights.map((n) => {
    // Defense in depth: a positive override is required going forward
    // (saveAvailabilityRange validates this), but never trust legacy/raw
    // data enough to quote a guest a zero or negative price.
    if (n.priceOverride != null && Number(n.priceOverride) > 0) {
      return { ...n, price: n.priceOverride, priceSource: "override", planName: resolved?.plan_name ?? null };
    }
    if (!resolved) return { ...n, price: null, priceSource: "none", planName: null };
    const { price, source } = resolvePlanNight(resolved, new Date(`${n.date}T00:00:00.000Z`), occ);
    return { ...n, price, priceSource: source, planName: resolved.plan_name ?? null };
  });
}

/** Nightly price + total for a stay (sum of bookable nights). Null if any night unpriced. */
export async function getStayQuote(
  roomId: number,
  checkIn: string,
  checkOut: string,
  occupancy?: number,
  pricingId?: number,
): Promise<{ nights: DailyRate[]; total: number | null; allAvailable: boolean }> {
  const nights = await getRoomARI(roomId, checkIn, checkOut, occupancy, pricingId);
  const allAvailable = nights.length > 0 && nights.every((n) => n.available > 0);
  const anyUnpriced = nights.some((n) => n.price == null);
  const total = anyUnpriced ? null : nights.reduce((s, n) => s + (n.price ?? 0), 0);
  return { nights, total, allAvailable };
}
