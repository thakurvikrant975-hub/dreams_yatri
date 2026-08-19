// ─────────────────────────────────────────────────────────────────────────────
// Stay options — the one, two or three standards a package is quoted at.
//
// One stay is the normal case and always has been: a package has a single
// option until someone deliberately adds another. Nothing here requires more
// than one, and the document renders a one-option package exactly the way it
// rendered before options existed.
//
// When there ARE several, all of them live in ONE document: every stay block
// lists each option's hotel side by side and the pricing block lists each
// option's price, with the recommended one highlighted in both. The client gets
// a single PDF showing every option and picks from it — there is no per-option
// document and no per-option export.
//
// Names are the exec's own words. "Standard", "Deluxe" and "Premium" are
// offered as suggestions because they are what most quotes use, but a trip
// whose real distinction is "Beachfront" against "Hill View" can say so.
//
// Plain module (no "use server") so the document, the drawer, the costing panel
// and the server actions can all import it.
// ─────────────────────────────────────────────────────────────────────────────

/** Offered as one-click suggestions when naming an option. Not a constraint —
 * the field is free text. */
export const SUGGESTED_STAY_LABELS = ["Standard", "Deluxe", "Premium"] as const;

/** Three is the cap, and it is a layout constraint rather than a preference: a
 * fourth column on a 210mm page leaves each hotel about 45mm, narrower than the
 * photo needs to be to show anything. */
export const MAX_STAY_OPTIONS = 3;

export type StayOptionLike = {
  id: string;
  label: string;
  sortOrder: number;
  isRecommended: boolean;
};

/** Trimmed, and never empty — an unnamed column tells the client nothing. */
export function normaliseStayLabel(raw: string): string {
  return raw.trim().replace(/\s+/g, " ").slice(0, 40);
}

/** The order the client compares in. sortOrder is assigned on creation and is
 * the only ordering there is now that names carry no implied rank. */
export function sortStayOptions<T extends { sortOrder: number; label: string }>(options: T[]): T[] {
  return [...options].sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label));
}

/** The one the client is steered toward — badged in the document and leading
 * the pricing block. Falls back to the first rather than returning nothing, so
 * a package whose flag was somehow lost still renders a complete document. */
export function recommendedOption<T extends StayOptionLike>(options: T[]): T | null {
  if (options.length === 0) return null;
  return options.find((o) => o.isRecommended) ?? sortStayOptions(options)[0];
}

/** Why a label can't be used, or null when it can. Duplicates are refused
 * because two columns with one name is not a choice the client can make. */
export function stayLabelProblem(raw: string, existing: { id: string; label: string }[], selfId?: string): string | null {
  const label = normaliseStayLabel(raw);
  if (!label) return "Give this option a name — the client sees it as the column heading.";
  const clash = existing.find((o) => o.id !== selfId && o.label.toLowerCase() === label.toLowerCase());
  if (clash) return `There's already an option called "${clash.label}".`;
  return null;
}

// ── Stay blocks ──────────────────────────────────────────────────────────────

export type StayCell = {
  /** Null where this option has no hotel for this night. */
  hotel: string | null;
  photo?: string | null;
  location?: string | null;
  starRating?: string | null;
  mealPlan?: string | null;
  rooms?: number | null;
  checkIn?: string | null;
  checkOut?: string | null;
  pending?: boolean;
};

export type StayDay = {
  day: number;
  checkIn?: string | null;
  checkOut?: string | null;
  /** Where this day is spent — the route stop it falls under, from
   * deriveDayLocations. This is what decides where one stay ends and the next
   * begins; see buildStayRuns. */
  location?: string | null;
  /** Keyed by stay option id. */
  byOption: Record<string, StayCell>;
};

export type StayRun = {
  fromDay: number;
  toDay: number;
  /** One night per day in the block. */
  nights: number;
  checkIn: string | null;
  checkOut: string | null;
  byOption: Record<string, StayCell>;
};

/** What decides whether a night joins the block before it: every option's
 * hotel, in a stable order. */
/** What makes two adjacent days the same stay.
 *
 * The destination, not the hotels. Three nights in Shimla is one stay whether
 * the exec has picked its hotels yet or not — which is the whole point: they
 * pick once, on the first night, and the rest of the block follows.
 *
 * Keyed on hotel identity before, this fragmented exactly when it was least
 * helpful. An empty package had no hotels anywhere, so every day was its own
 * block and the exec was asked to choose a hotel five times for a five-night
 * trip. Filling one option and not another broke the block too, so the
 * columns disagreed about where the stay even ended.
 *
 * Falls back to hotel identity only when there are no locations to group by —
 * a package with no route stops yet, where the old behaviour is still the
 * best guess available.
 */
function runKey(day: StayDay, optionIds: string[]): string {
  const place = day.location?.trim();
  if (place) return `@${place.toLowerCase()}`;
  return optionIds.map((id) => day.byOption[id]?.hotel?.trim() ?? "").join(" | ");
}

/** Collapse consecutive nights into stay blocks — "2N", one check-in, one
 * check-out — rather than reprinting the same hotels under every day.
 *
 * A block breaks the moment ANY option's hotel changes, not just the
 * recommended one. That is what guarantees every column inside a block names
 * exactly one hotel: an option that moved mid-stay would otherwise need two
 * hotels under one check-in.
 *
 * Nights with no hotel in any option are skipped — that is a departure day, not
 * an unfinished quote — and skipping one also closes the open block, since the
 * guest checked out.
 */
export function buildStayRuns(days: StayDay[], optionIds: string[]): StayRun[] {
  const ordered = [...days].sort((a, b) => a.day - b.day);
  const runs: StayRun[] = [];
  let openKey: string | null = null;
  let openDay: number | null = null;

  for (const day of ordered) {
    // A day with no hotel in any option used to end the run and produce no
    // block at all — so an unfilled trip had nothing to pick INTO, and the
    // only way to get a block was to already have what the block was for.
    // A day that belongs to a destination is part of that destination's stay
    // whether or not anyone has chosen where to sleep yet.
    const hasHotel = optionIds.some((id) => day.byOption[id]?.hotel?.trim());
    if (!hasHotel && !day.location?.trim()) {
      openKey = null;
      openDay = null;
      continue;
    }

    const key = runKey(day, optionIds);
    const current = runs[runs.length - 1];
    if (current != null && key === openKey && openDay === day.day - 1) {
      current.toDay = day.day;
      current.nights += 1;
      current.checkOut = day.checkOut ?? current.checkOut;
    } else {
      runs.push({
        fromDay: day.day,
        toDay: day.day,
        nights: 1,
        checkIn: day.checkIn ?? null,
        checkOut: day.checkOut ?? null,
        byOption: day.byOption,
      });
    }

    openKey = key;
    openDay = day.day;
  }

  return runs;
}

// ── Completeness ─────────────────────────────────────────────────────────────

// stayOptionGaps/stayOptionGapError lived here and refused a submission when
// any night had no hotel. Removed rather than left unused: a package quoted
// without stays — or without transport — is a real thing clients ask for, so
// an unbooked night is a fact about the quote, not an error in it. Costing
// still sees which nights are unpriced, via gapDays on the option comparison
// and the hotels table.
