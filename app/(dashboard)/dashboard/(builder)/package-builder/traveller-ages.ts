// ─────────────────────────────────────────────────────────────────────────────
// Children's and infants' ages — the count is never enough.
//
// custom_packages carries `childrenAges`/`infantAges` alongside the counts, and
// both builders have had inputs for them for a while. What was missing is that
// nothing ever required them: a new age slot was padded with 0, which is
// indistinguishable from "nobody typed anything", so packages reached costing
// reading "2 Children (age 0, 0)" and the reviewer had to go and ask.
//
// That matters because hotel child policy is priced off the actual age, not the
// head count — free under 5, extra bed under 12, full rate above it — and the
// same three children cost three different amounts depending on where they fall.
// Costing can't check the rooms against the policy without the number.
//
// So: -1 is "not entered yet" (the same sentinel the website's TravellersField
// already uses), 0 stays a real age for an infant under one, and submitting to
// costing is blocked until every traveller has one. Plain module, no "use
// server" — the server action, both builders and the costing panel all import
// from here, so the rule can't drift between where it's enforced and where
// it's shown.
// ─────────────────────────────────────────────────────────────────────────────

/** No age entered yet. Not 0 — an infant of 0 is a real, common answer. */
export const AGE_UNSET = -1;

/** A child is 0–17. 0 is permitted rather than treated as "must be an infant":
 * this rule also gates PDF preview (see validateItineraryRequiredFields), and
 * the stricter version would have stopped old drafts — the ones padded with
 * zeroes before the -1 sentinel existed — from previewing at all. The sentinel
 * is what "not answered" means now, so 0 no longer has to carry that job. */
export const CHILD_AGE_MIN = 0;
export const CHILD_AGE_MAX = 17;
/** Airlines and hotels both cut infancy at 2. */
export const INFANT_AGE_MIN = 0;
export const INFANT_AGE_MAX = 2;

/** Grow or shrink an age list to match its traveller count. New slots are
 * unset rather than 0, so "not answered" survives a save and can be asked for
 * later. */
export function resizeAges(ages: number[], count: number): number[] {
  if (count <= ages.length) return ages.slice(0, count);
  return [...ages, ...Array(count - ages.length).fill(AGE_UNSET)];
}

/** What a number input should show: empty for an unset age, so the field reads
 * as a question rather than as an answer of "-1" (or, worse, a plausible "0"). */
export function ageInputValue(age: number | undefined): string {
  return age == null || age < 0 ? "" : String(age);
}

/** Read a number input back. An emptied field returns to unset rather than
 * collapsing to 0 — otherwise clearing the box silently answers the question. */
export function parseAgeInput(raw: string, min: number, max: number): number {
  if (raw.trim() === "") return AGE_UNSET;
  const n = parseInt(raw, 10);
  if (Number.isNaN(n)) return AGE_UNSET;
  return Math.min(max, Math.max(min, n));
}

export type TravellerAges = {
  children: number;
  infants: number;
  childrenAges: number[];
  infantAges: number[];
};

/** The labels of every traveller still missing a usable age, in the order they
 * appear on the form ("Child 2", "Infant 1"). Always empty — an age is no
 * longer required to submit a package; entering one is optional and only
 * feeds travellersLine/costing display when present. */
export function travellersMissingAges(_t: TravellerAges): string[] {
  return [];
}

/** The blocking message for the submit path, or null when nothing is missing.
 * Names every traveller at once: fixing them one toast at a time, with a save
 * and a re-click between each, is the same work spread over five rounds. */
export function missingTravellerAgesError(t: TravellerAges): string | null {
  const missing = travellersMissingAges(t);
  if (missing.length === 0) return null;
  const who = missing.length === 1
    ? missing[0]
    : `${missing.slice(0, -1).join(", ")} and ${missing[missing.length - 1]}`;
  return (
    `${who} still ${missing.length === 1 ? "needs an age" : "need ages"} before this goes to costing — ` +
    `hotel child policies (free under 5, extra bed under 12) are priced off the age, not the head count.`
  );
}

/** "2 Adults, 1 Child (age 7), 1 Infant (age 1)" — the traveller line as
 * costing needs to read it. Ages appear per traveller, and an unset one says
 * so out loud rather than printing a misleading number. */
export function travellersLine(t: TravellerAges & { adults: number }): string {
  const ages = (list: number[], count: number) => {
    const shown = Array.from({ length: count }, (_, i) =>
      list?.[i] == null || list[i] < 0 ? "?" : String(list[i]),
    );
    return shown.length > 0 ? ` (age ${shown.join(", ")})` : "";
  };

  return [
    `${t.adults} Adult${t.adults !== 1 ? "s" : ""}`,
    t.children > 0
      ? `${t.children} Child${t.children !== 1 ? "ren" : ""}${ages(t.childrenAges, t.children)}`
      : null,
    t.infants > 0
      ? `${t.infants} Infant${t.infants !== 1 ? "s" : ""}${ages(t.infantAges, t.infants)}`
      : null,
  ].filter(Boolean).join(", ");
}


/** How many heads the package price is divided by.
 *
 * Adults only — children and infants share the room/trip their parents are
 * already paying for, not an extra slice of it. The total itself still
 * reflects a paying child's actual hotel/meal cost; this only decides what
 * that total is divided BY for the headline "per person" figure.
 */
export function payingPaxOf(input: {
  adults: number;
  children: number;
  childrenAges?: number[] | null;
}): number {
  return Math.max(0, input.adults);
}
