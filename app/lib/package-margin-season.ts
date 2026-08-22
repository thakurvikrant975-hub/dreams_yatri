// Pure seasonal-margin resolution — no "use server" here on purpose, so the
// billing engine (package-pricing.service.ts) and anything else that needs to
// show a package's margin resolve it through the exact same rule. A preview
// quoting one margin and checkout charging another would be a far worse bug
// than the one import this avoids.

/** Percentage margin applied when a package has no pricing config row at all
 *  — the same default computePackagePrice has always used. */
export const DEFAULT_MARGIN_PERCENTAGE = 10;

export type MarginSeasonRow = {
  season_name?: string | null;
  valid_from: Date;
  valid_to: Date;
  margin_percentage: unknown;
  is_active?: boolean;
};

export type MarginPricingConfig = {
  margin_percentage: unknown;
  seasons?: MarginSeasonRow[];
} | null;

export type ResolvedMargin = {
  margin_percentage: number;
  /** The season the date landed in, for display ("Peak — Christmas"), or null
   *  when the base margin applied. */
  margin_season_label: string | null;
};

/** "1 Jan – 22 Feb" — what an unnamed season is shown as, since a margin
 *  season's name is optional. Year-free, because the match is year-free. */
function rangeLabel(from: Date, to: Date): string {
  const fmt = (d: Date) =>
    d.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
  return `${fmt(from)} – ${fmt(to)}`;
}

/**
 * The margin percentage in force on `travelDate`.
 *
 * Seasons are stored year-agnostically (year-2000 placeholder comparison,
 * identical to resolveHotelSeasonPricing), so a range entered once recurs every
 * year rather than lapsing each January — and a range that wraps the new year
 * (e.g. 20 Dec → 5 Jan) matches on both sides of it.
 *
 * A margin is one percentage over the whole trip's base cost, so unlike a room
 * rate there is no per-night resolution to do: the caller passes the trip's
 * FIRST travel date and that decides the whole quote. With no date (a catalog
 * page listing a price before anyone has picked one), the base margin applies.
 */
/** The day-of-year intervals a year-agnostic range covers — two when it wraps
 *  the new year, one otherwise. Encoded as month*100+day so plain integer
 *  comparison orders them and no Date (or timezone) is involved. */
function intervalsFor(fromISO: string, toISO: string): [number, number][] {
  const md = (iso: string) => Number(iso.slice(5, 7)) * 100 + Number(iso.slice(8, 10));
  const from = md(fromISO);
  const to = md(toISO);
  return from <= to ? [[from, to]] : [[from, 1231], [101, to]];
}

/**
 * The first pair of seasons whose dates collide, or null when none do.
 *
 * Overlapping ranges aren't a crash — resolution just takes the first match by
 * sort order — but they make a package's margin depend on row order, which is
 * not something anyone chose. The calendar already trims overlaps client-side;
 * this is the server's own invariant, so a direct call can't install a set the
 * UI would never have produced.
 *
 * Compared year-agnostically, exactly as resolvePackageMargin matches: a range
 * wrapping the new year collides with anything touching either end of it.
 */
export function findMarginSeasonOverlap(
  seasons: { valid_from: string; valid_to: string }[],
): { a: number; b: number } | null {
  for (let i = 0; i < seasons.length; i++) {
    for (let j = i + 1; j < seasons.length; j++) {
      for (const [aStart, aEnd] of intervalsFor(seasons[i].valid_from, seasons[i].valid_to)) {
        for (const [bStart, bEnd] of intervalsFor(seasons[j].valid_from, seasons[j].valid_to)) {
          if (aStart <= bEnd && bStart <= aEnd) return { a: i, b: j };
        }
      }
    }
  }
  return null;
}

export function resolvePackageMargin(
  config: MarginPricingConfig,
  travelDate: Date | null,
): ResolvedMargin {
  const base = config
    ? Number(config.margin_percentage)
    : DEFAULT_MARGIN_PERCENTAGE;
  const seasons = (config?.seasons ?? []).filter((s) => s.is_active !== false);

  if (!travelDate || Number.isNaN(travelDate.getTime()) || seasons.length === 0) {
    return { margin_percentage: base, margin_season_label: null };
  }

  const normalised = new Date(2000, travelDate.getMonth(), travelDate.getDate());
  const matched = seasons.find((s) => {
    const from = new Date(s.valid_from);
    const to = new Date(s.valid_to);
    const normFrom = new Date(2000, from.getMonth(), from.getDate());
    const normTo = new Date(2000, to.getMonth(), to.getDate());
    if (normFrom <= normTo) {
      return normalised >= normFrom && normalised <= normTo;
    }
    // Wraps the year end — matches the tail of the year OR its head.
    return normalised >= normFrom || normalised <= normTo;
  });

  if (!matched) return { margin_percentage: base, margin_season_label: null };

  const margin = Number(matched.margin_percentage);
  if (!Number.isFinite(margin)) {
    return { margin_percentage: base, margin_season_label: null };
  }
  return {
    margin_percentage: margin,
    margin_season_label:
      matched.season_name?.trim() ||
      rangeLabel(new Date(matched.valid_from), new Date(matched.valid_to)),
  };
}
