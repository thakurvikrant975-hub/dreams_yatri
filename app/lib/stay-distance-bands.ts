// Pure distance-band definitions for the stay picker's road-distance filter.
// Deliberately NOT a "use server" module: the picker's <select> needs these
// values on the client, and a server-action file may only export async
// functions — exporting the array from the service itself is what broke the
// builder page at runtime.

/**
 * Road-distance bands for the picker's distance filter.
 *
 * Half-open [minKm, maxKm) on purpose: a hotel exactly 10.0 km out belongs to
 * "10 – 25 km" and nowhere else, so the bands partition the results instead of
 * double-counting the boundary. The last band is open-ended above.
 *
 * These are DRIVING kilometres, like the badge on each result — the whole point
 * of the filter is that a crow-flies band would lie in the hills, where the same
 * pairs run a median 2.5x longer by road (see roadDistances).
 */
export type DistanceBand = { slug: string; label: string; minKm: number; maxKm: number };

export const DISTANCE_BANDS: DistanceBand[] = [
  { slug: "0-5",   label: "0 – 5 km",   minKm: 0,  maxKm: 5 },
  { slug: "5-10",  label: "5 – 10 km",  minKm: 5,  maxKm: 10 },
  { slug: "10-25", label: "10 – 25 km", minKm: 10, maxKm: 25 },
  { slug: "25-50", label: "25 – 50 km", minKm: 25, maxKm: 50 },
  { slug: "50+",   label: "50+ km",     minKm: 50, maxKm: Number.POSITIVE_INFINITY },
];

/** What actually happened to a requested distance band. Without this the
 *  picker cannot tell three very different situations apart: the band is
 *  genuinely empty, the routing service didn't answer, or the filter never
 *  ran because there was no stop to measure from. All three used to render
 *  as the same "no hotels found". */
export type DistanceFilterStatus = {
  band: string;
  /** False when the band could not be applied at all — the day's stop has no
   *  coordinates — in which case THE LIST IS UNFILTERED. */
  applied: boolean;
  /** Routing failed for some or all of the candidate set. When this is set an
   *  empty list means "we could not measure", never "nothing is in range". */
  routingFailed: boolean;
  /** Stays dropped because no road distance could be obtained for them —
   *  unroutable pins, or a set past the routing ceiling. */
  excludedUnmeasured: number;
};

export function findDistanceBand(slug?: string | null): DistanceBand | null {
  if (!slug) return null;
  return DISTANCE_BANDS.find((b) => b.slug === slug) ?? null;
}
