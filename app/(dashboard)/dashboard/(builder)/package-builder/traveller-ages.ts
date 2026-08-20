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
/** The oldest a child can be and still not count as a head when the package
 * price is divided into a per-person figure.
 *
 * A four-year-old sharing their parents' bed is not a fifth person paying a
 * fifth of the trip, and dividing by them makes the per-person number smaller
 * than anyone will actually pay. The total is right either way — this only
 * decides what the total is divided BY.
 *
 * Five is the line the sales team quotes to, and it is the age most hotel
 * child policies start charging at. It is deliberately not read from those
 * policies: a hotel's rule decides what a bed costs, this decides how a quote
 * reads, and one hotel on one night should not change the headline figure of
 * the whole trip. */
export const PER_PERSON_FREE_CHILD_AGE_MAX = 4;

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
 * appear on the form ("Child 2", "Infant 1"). Empty when the package is
 * complete — which is every package travelling adults-only. */
export function travellersMissingAges(t: TravellerAges): string[] {
  const missing: string[] = [];
  for (let i = 0; i < (t.children || 0); i++) {
    const age = t.childrenAges?.[i];
    if (age == null || age < CHILD_AGE_MIN || age > CHILD_AGE_MAX) {
      missing.push(`Child ${i + 1}`);
    }
  }
  for (let i = 0; i < (t.infants || 0); i++) {
    const age = t.infantAges?.[i];
    if (age == null || age < INFANT_AGE_MIN || age > INFANT_AGE_MAX) {
      missing.push(`Infant ${i + 1}`);
    }
  }
  return missing;
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
 * Adults, plus the children old enough to count — see
 * PER_PERSON_FREE_CHILD_AGE_MAX. Infants were never counted; this brings the
 * youngest children in line with them.
 *
 * A child whose age nobody has entered yet counts as paying. It cannot be
 * shown to be under five, and the alternative — assuming it is — would quietly
 * raise the headline price of every package still being built. Ages are
 * required before a package can go to costing, so this only affects drafts.
 */
export function payingPaxOf(input: {
  adults: number;
  children: number;
  childrenAges?: number[] | null;
}): number {
  const ages = input.childrenAges ?? [];
  const freeChildren = ages
    .slice(0, input.children)
    .filter((age) => age != null && age >= 0 && age <= PER_PERSON_FREE_CHILD_AGE_MAX)
    .length;
  return Math.max(0, input.adults + input.children - freeChildren);
}
