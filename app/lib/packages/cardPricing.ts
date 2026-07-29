import { db } from "@/app/lib/db";
import { computePackagePrice } from "@/app/services/package-pricing.service";

/**
 * Shared "starting from" pricing for package cards.
 *
 * Every card surface (search listing, region/destination pages, home page,
 * related-packages widget) used to price cards its own way — some with a flat
 * `Σ(price_per_night × nights)` that ignored occupancy, meals, cab, activities,
 * margin and GST entirely, and all of them pinned to the admin-flagged DEFAULT
 * duration rather than the cheapest one. That made the "/Adult" figure on a
 * card differ from the real price the moment you clicked through.
 *
 * This resolves both: one real `computePackagePrice` run per duration, and the
 * cheapest duration wins — so the card's price, its "Starting from" framing,
 * AND the URL it links to all describe the same configuration.
 */

/** Card prices are quoted for a couple unless a caller passes real search pax. */
export const CARD_PRICING_ADULTS = 2;

export type CardPricingOccupancy = {
  adults: number;
  children: number;
  childAges: number[];
  travelDate: string | null;
};

export const DEFAULT_CARD_OCCUPANCY: CardPricingOccupancy = {
  adults: CARD_PRICING_ADULTS,
  children: 0,
  childAges: [],
  travelDate: null,
};

/** The cheapest bookable configuration of a package, priced for real. */
export type CardPricing = {
  durationId: number;
  durationSlug: string;
  days: number;
  nights: number;
  routeId: number;
  routeSlug: string;
  stops: { place_name: string; stay_days: number }[];
  stayCategoryId: number;
  staySlug: string;
  /** Per-adult price at the quoted occupancy (what the card highlights). */
  perAdult: number;
  /** Full trip total at the quoted occupancy (shown beneath the per-adult figure). */
  total: number;
  /** True when the package has no usable pricing config — card should hide price. */
  missingPricing: boolean;
};

type DurationRow = {
  id: number;
  slug: string;
  days: number;
  nights: number;
  routes: { id: number; slug: string; stops: { place_name: string; stay_days: number }[] }[];
};

/** All active durations (each with its first active route) + the default stay
 *  category, for a batch of packages — one query pair for the whole batch
 *  rather than per-card. */
async function loadCombos(packageIds: number[]): Promise<{
  durationsByPackage: Map<number, DurationRow[]>;
  stayByPackage: Map<number, { id: number; slug: string }>;
}> {
  if (packageIds.length === 0) {
    return { durationsByPackage: new Map(), stayByPackage: new Map() };
  }

  const [durations, stays] = await Promise.all([
    db.package_durations.findMany({
      where: { package_id: { in: packageIds }, is_active: true },
      orderBy: [{ is_default: "desc" }, { sort_order: "asc" }],
      select: {
        id: true, slug: true, days: true, nights: true, package_id: true,
        routes: {
          where: { is_active: true },
          orderBy: { sort_order: "asc" },
          take: 1,
          select: {
            id: true, slug: true,
            stops: { orderBy: { sort_order: "asc" }, select: { place_name: true, stay_days: true } },
          },
        },
      },
    }),
    db.package_stay_categories.findMany({
      where: { package_id: { in: packageIds }, is_active: true },
      orderBy: [{ is_default: "desc" }, { sort_order: "asc" }],
      select: { id: true, slug: true, package_id: true },
    }),
  ]);

  const durationsByPackage = new Map<number, DurationRow[]>();
  for (const d of durations) {
    const list = durationsByPackage.get(d.package_id) ?? [];
    list.push(d);
    durationsByPackage.set(d.package_id, list);
  }
  // orderBy above puts the default/lowest-sort_order stay category first.
  const stayByPackage = new Map<number, { id: number; slug: string }>();
  for (const s of stays) {
    if (!stayByPackage.has(s.package_id)) stayByPackage.set(s.package_id, { id: s.id, slug: s.slug });
  }

  return { durationsByPackage, stayByPackage };
}

/**
 * Resolve "starting from" pricing for a batch of packages at once.
 * Returns a map keyed by package id; packages with no bookable combo are absent.
 */
export async function computeCardPricingBatch(
  packageIds: number[],
  occupancy: CardPricingOccupancy = DEFAULT_CARD_OCCUPANCY,
): Promise<Map<number, CardPricing>> {
  const { durationsByPackage, stayByPackage } = await loadCombos(packageIds);

  const results = await Promise.all(
    packageIds.map(async (packageId): Promise<readonly [number, CardPricing] | null> => {
      const durations = durationsByPackage.get(packageId) ?? [];
      const stay = stayByPackage.get(packageId);
      if (durations.length === 0 || !stay) return null;

      const priced = await Promise.all(
        durations.map(async (duration): Promise<CardPricing | null> => {
          const route = duration.routes[0];
          if (!route) return null;

          const base = {
            durationId: duration.id,
            durationSlug: duration.slug,
            days: duration.days,
            nights: duration.nights,
            routeId: route.id,
            routeSlug: route.slug,
            stops: route.stops,
            stayCategoryId: stay.id,
            staySlug: stay.slug,
          };

          try {
            const b = await computePackagePrice({
              package_id: packageId,
              duration_id: duration.id,
              route_id: route.id,
              stay_category_id: stay.id,
              adults: Math.max(1, occupancy.adults),
              children: occupancy.children,
              infants: 0,
              child_ages: occupancy.childAges,
              travel_date: occupancy.travelDate,
            });
            if (b.missing_pricing_config) {
              return { ...base, perAdult: 0, total: 0, missingPricing: true };
            }
            return {
              ...base,
              perAdult: Math.ceil(b.price_per_adult),
              total: Math.ceil(b.final_price),
              missingPricing: false,
            };
          } catch {
            return { ...base, perAdult: 0, total: 0, missingPricing: true };
          }
        }),
      );

      const usable = priced.filter((p): p is CardPricing => p !== null);
      if (usable.length === 0) return null;

      // "Starting from" = the cheapest real total. Un-priceable durations sort
      // last so a package that can be priced at all never reports ₹0.
      const priceable = usable.filter((p) => !p.missingPricing && p.total > 0);
      const best = priceable.length > 0
        ? priceable.reduce((a, b) => (b.total < a.total ? b : a))
        : usable[0];

      return [packageId, best] as const;
    }),
  );

  return new Map(results.filter((r): r is readonly [number, CardPricing] => r !== null));
}
