// ─────────────────────────────────────────────────────────────────────────────
// Who counts as an infant, a child and an adult — and what that costs.
//
// custom_packages carries `childrenAges`/`infantAges` alongside the counts,
// and both builders have had inputs for them for a while. What was missing is
// that nothing ever required them: a new age slot was padded with 0, which is
// indistinguishable from "nobody typed anything", so packages reached costing
// reading "2 Children (age 0, 0)" and the reviewer had to go and ask.
//
// So: -1 is "not entered yet" (the same sentinel the website's TravellersField
// already uses), 0 stays a real age for an infant under one, and submitting to
// costing is blocked until every traveller has one.
//
// The second half is the age BANDS those numbers are read against. They used
// to be constants here — infant 0–2, child 3–17, and a separate hard-coded
// "under 5 doesn't count as a paying head". Hotels do not agree on any of it:
// plenty of properties treat under-5s as infants who need no bed and carry no
// charge, and start the child rate above that; a few cut the child band at 10
// or 11 rather than 12. One line for every property meant costing reconciled
// the difference by hand, on a package whose per-person figure had already
// been divided by the wrong number of heads.
//
// Now the two boundaries live on the package (custom_packages.infantMaxAge /
// childMaxAge, defaulting to the industry 2 and 12) and the exec sets them to
// whatever the stays on THIS trip actually use. Everything downstream — how
// many beds the party needs, how many mattresses, how many heads the total is
// divided by — is derived from the band a traveller's AGE falls in, not from
// the box the exec happened to type them into.
//
// Plain module, no "use server": the server action, both builders, the costing
// panel and the pricing service all import from here, so the rule can't drift
// between where it's enforced and where it's shown.
// ─────────────────────────────────────────────────────────────────────────────

/** No age entered yet. Not 0 — an infant of 0 is a real, common answer. */
export const AGE_UNSET = -1;

/** The oldest age anyone can be typed as. Not a band boundary — just the top
 * of the number inputs, so a fat-fingered "144" doesn't reach pricing. */
export const AGE_MAX = 17;
export const AGE_MIN = 0;

// ─────────────────────────────────────────────────────────────────────────────
// Age bands
// ─────────────────────────────────────────────────────────────────────────────

/** Both bounds INCLUSIVE: infant ≤ infantMaxAge < child ≤ childMaxAge < adult. */
export type AgeBands = {
  infantMaxAge: number;
  childMaxAge: number;
};

/** What a new package starts with — the airline/hotel industry default, and
 * the line the sales team quotes to when nobody says otherwise. */
export const DEFAULT_AGE_BANDS: AgeBands = { infantMaxAge: 2, childMaxAge: 12 };

/** How far the two boundaries may be dragged. Wide enough for every real
 * policy we've seen (infants to 5, child bands ending anywhere from 10 to 17)
 * and narrow enough that a typo can't quietly reclassify the whole party. */
export const BAND_LIMITS = {
  infantMaxAge: { min: 0, max: 5 },
  childMaxAge: { min: 5, max: 17 },
} as const;

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

/** Coerce whatever came off a form or an old DB row into a usable pair.
 *
 * Guarantees infantMaxAge < childMaxAge, because a package where the two
 * crossed would have an empty child band and would silently price children as
 * adults — the exact failure this module exists to make impossible. */
export function normalizeAgeBands(
  raw?: { infantMaxAge?: number | null; childMaxAge?: number | null } | null,
): AgeBands {
  const infantMaxAge = clamp(
    Math.floor(Number(raw?.infantMaxAge ?? DEFAULT_AGE_BANDS.infantMaxAge)) || 0,
    BAND_LIMITS.infantMaxAge.min, BAND_LIMITS.infantMaxAge.max,
  );
  const childRaw = Math.floor(Number(raw?.childMaxAge ?? DEFAULT_AGE_BANDS.childMaxAge)) || 0;
  const childMaxAge = clamp(
    Math.max(childRaw, infantMaxAge + 1),
    BAND_LIMITS.childMaxAge.min, BAND_LIMITS.childMaxAge.max,
  );
  return { infantMaxAge, childMaxAge };
}

export type Band = "infant" | "child" | "adult";

/** The band an age falls in. An unset age (-1) has no band — callers decide
 * what to do about that, and every one of them treats it as "still to answer"
 * rather than guessing a bucket. */
export function bandOf(age: number | null | undefined, bands: AgeBands): Band | null {
  if (age == null || age < 0) return null;
  if (age <= bands.infantMaxAge) return "infant";
  if (age <= bands.childMaxAge) return "child";
  return "adult";
}

export const BAND_LABELS: Record<Band, string> = {
  infant: "Infant", child: "Child", adult: "Adult",
};

/** "Infants 0–2 · Children 3–12 · Adults 13+" — the bands as a sentence, for
 * anywhere they need to be shown rather than edited. */
export function ageBandsLine(bands: AgeBands): string {
  return [
    `Infants 0–${bands.infantMaxAge}`,
    `Children ${bands.infantMaxAge + 1}–${bands.childMaxAge}`,
    `Adults ${bands.childMaxAge + 1}+`,
  ].join(" · ");
}

// ─────────────────────────────────────────────────────────────────────────────
// Age lists
// ─────────────────────────────────────────────────────────────────────────────

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
export function parseAgeInput(raw: string, min: number = AGE_MIN, max: number = AGE_MAX): number {
  if (raw.trim() === "") return AGE_UNSET;
  const n = parseInt(raw, 10);
  if (Number.isNaN(n)) return AGE_UNSET;
  return Math.min(max, Math.max(min, n));
}

export type TravellerAges = {
  children: number;
  /** Optional throughout: PreviewData and the client-facing page carry the
   * counts and children's ages but were never given infants' — an absent list
   * simply means nobody's age is known, which classifyTravellers already
   * handles by leaving those travellers in the box they were entered in. */
  infants?: number;
  childrenAges?: number[];
  infantAges?: number[];
  /** Absent on an old row or a half-built form — normalizeAgeBands fills in
   * the industry defaults, so every function here can be called with a raw
   * package or form object. */
  infantMaxAge?: number | null;
  childMaxAge?: number | null;
};

export function bandsOf(t: Pick<TravellerAges, "infantMaxAge" | "childMaxAge">): AgeBands {
  return normalizeAgeBands({ infantMaxAge: t.infantMaxAge, childMaxAge: t.childMaxAge });
}

/** The labels of every traveller still missing a usable age, in the order they
 * appear on the form ("Child 2", "Infant 1"). Empty when the package is
 * complete — which is every package travelling adults-only.
 *
 * Only genuinely absent ages count as missing. An age that is present but sits
 * in a different band than its box (a 14-year-old typed under Children on a
 * package whose child band ends at 12) is NOT missing — it is answered, it is
 * priced correctly by the band it falls in, and it is reported separately by
 * bandMismatches below. Blocking on it would stop an exec submitting a package
 * whose numbers are already right. */
export function travellersMissingAges(t: TravellerAges): string[] {
  const missing: string[] = [];
  for (let i = 0; i < (t.children || 0); i++) {
    const age = t.childrenAges?.[i];
    if (age == null || age < AGE_MIN || age > AGE_MAX) missing.push(`Child ${i + 1}`);
  }
  for (let i = 0; i < (t.infants || 0); i++) {
    const age = t.infantAges?.[i];
    if (age == null || age < AGE_MIN || age > AGE_MAX) missing.push(`Infant ${i + 1}`);
  }
  return missing;
}

/** The blocking message for the submit path, or null when nothing is missing.
 * Names every traveller at once: fixing them one toast at a time, with a save
 * and a re-click between each, is the same work spread over five rounds. */
export function missingTravellerAgesError(t: TravellerAges): string | null {
  const missing = travellersMissingAges(t);
  if (missing.length === 0) return null;
  const bands = bandsOf(t);
  const who = missing.length === 1
    ? missing[0]
    : `${missing.slice(0, -1).join(", ")} and ${missing[missing.length - 1]}`;
  return (
    `${who} still ${missing.length === 1 ? "needs an age" : "need ages"} before this goes to costing — ` +
    `rooms, mattresses and the per-person price are all worked out from the age band ` +
    `(${ageBandsLine(bands)}), not the head count.`
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Classification
// ─────────────────────────────────────────────────────────────────────────────

/** One traveller whose age puts them in a different band than the box they
 * were entered in. Not an error — the price already follows the age — but the
 * exec and costing both need to be able to see it, because the itinerary still
 * says "2 Children" while the rooms were built for one child and one adult. */
export type BandMismatch = {
  /** "Child 2" / "Infant 1" — how the traveller is labelled on the form. */
  label: string;
  age: number;
  /** The box they were typed into. */
  enteredAs: Band;
  /** The band their age actually falls in, and what they're priced as. */
  pricedAs: Band;
};

/** The party as PRICING sees it: everyone sorted by the band their age falls
 * in, regardless of which box they were typed into.
 *
 * This is the number that must reach room capacity, mattress counts and the
 * per-person divisor. Passing the raw `adults`/`children` columns instead is
 * how a 14-year-old on a package with a child band ending at 12 ended up
 * costed into a child's share of a room they need an adult bed for.
 *
 * Adults carry no ages (they are adults by definition), so they pass straight
 * through and are only ever added to.
 *
 * An unset age keeps the traveller in the box they were entered in. It cannot
 * be shown to belong anywhere else, and quietly promoting or demoting an
 * unanswered traveller would change the price of a draft nobody has finished
 * filling in — ages are required before costing, so this only affects drafts.
 */
export type PricedParty = {
  /** Heads needing an adult bed — the `adults` every capacity calculation wants. */
  adults: number;
  /** Heads in the child band — may share an adult's bed, see room-capacity.ts. */
  children: number;
  /** Heads in the infant band — no bed, no share of the price. */
  infants: number;
  mismatches: BandMismatch[];
};

export function classifyTravellers(
  t: TravellerAges & { adults: number },
): PricedParty {
  const bands = bandsOf(t);
  let adults = Math.max(0, t.adults || 0);
  let children = 0;
  let infants = 0;
  const mismatches: BandMismatch[] = [];

  const sort = (age: number | undefined, enteredAs: Band, label: string) => {
    const band = bandOf(age, bands) ?? enteredAs;
    if (band === "adult") adults += 1;
    else if (band === "child") children += 1;
    else infants += 1;
    if (age != null && age >= 0 && band !== enteredAs) {
      mismatches.push({ label, age, enteredAs, pricedAs: band });
    }
  };

  for (let i = 0; i < (t.children || 0); i++) {
    sort(t.childrenAges?.[i], "child", `Child ${i + 1}`);
  }
  for (let i = 0; i < (t.infants || 0); i++) {
    sort(t.infantAges?.[i], "infant", `Infant ${i + 1}`);
  }

  return { adults, children, infants, mismatches };
}

/** Just the two numbers every room/mattress/occupancy calculation takes.
 * Sugar over classifyTravellers so call sites read as what they're asking for. */
export function pricingPartyOf(
  t: TravellerAges & { adults: number },
): { adults: number; children: number } {
  const { adults, children } = classifyTravellers(t);
  return { adults, children };
}

/** How many heads the package price is divided by.
 *
 * Everyone in the adult and child bands; nobody in the infant band. An infant
 * gets no bed and is charged for by nobody, so they are not a share of the
 * trip — dividing by them makes the per-person number smaller than anyone will
 * actually pay. The total is right either way; this only decides what the
 * total is divided BY.
 *
 * Which ages count as infants is the package's own infantMaxAge, so an exec
 * quoting a property that treats under-5s as infants sets the band to 5 and
 * the headline figure follows. That is what the old hard-coded "under 5 is
 * free" line was approximating for every package at once.
 */
export function payingPaxOf(input: {
  adults: number;
  children: number;
  childrenAges?: number[] | null;
  infants?: number | null;
  infantAges?: number[] | null;
  infantMaxAge?: number | null;
  childMaxAge?: number | null;
}): number {
  const party = classifyTravellers({
    adults: input.adults,
    children: input.children,
    infants: input.infants ?? 0,
    childrenAges: input.childrenAges ?? [],
    infantAges: input.infantAges ?? [],
    infantMaxAge: input.infantMaxAge,
    childMaxAge: input.childMaxAge,
  });
  return Math.max(0, party.adults + party.children);
}

/** "2 Adults, 1 Child (age 7), 1 Infant (age 1)" — the traveller line as
 * costing needs to read it. Ages appear per traveller, and an unset one says
 * so out loud rather than printing a misleading number.
 *
 * Deliberately reports the party AS ENTERED, not as classified: this is the
 * client's own description of who is travelling, and it appears on documents
 * the client reads. Where the two differ, bandMismatchLines below says so in
 * its own words rather than rewriting this one. */
export function travellersLine(t: TravellerAges & { adults: number }): string {
  const ages = (list: number[], count: number) => {
    const shown = Array.from({ length: count }, (_, i) =>
      list?.[i] == null || list[i] < 0 ? "?" : String(list[i]),
    );
    return shown.length > 0 ? ` (age ${shown.join(", ")})` : "";
  };

  const infants = t.infants ?? 0;
  return [
    `${t.adults} Adult${t.adults !== 1 ? "s" : ""}`,
    t.children > 0
      ? `${t.children} Child${t.children !== 1 ? "ren" : ""}${ages(t.childrenAges ?? [], t.children)}`
      : null,
    infants > 0
      ? `${infants} Infant${infants !== 1 ? "s" : ""}${ages(t.infantAges ?? [], infants)}`
      : null,
  ].filter(Boolean).join(", ");
}

/** "Child 2 is 14 — priced as an adult (this package's child band ends at 12)".
 * One line per traveller whose box and band disagree, ready to render. */
export function bandMismatchLines(t: TravellerAges & { adults: number }): string[] {
  const bands = bandsOf(t);
  return classifyTravellers(t).mismatches.map((m) => {
    const edge = m.pricedAs === "adult"
      ? `this package's child band ends at ${bands.childMaxAge}`
      : m.pricedAs === "child"
        ? `this package's infant band ends at ${bands.infantMaxAge}`
        : `this package treats up to ${bands.infantMaxAge} as an infant`;
    return `${m.label} is ${m.age} — priced as ${m.pricedAs === "infant" ? "an infant" : m.pricedAs === "adult" ? "an adult" : "a child"} (${edge}).`;
  });
}

/** "3 Adults, 1 Child" — the classified party, for the readouts that need to
 * show what the price was actually built for. */
export function pricedPartyLine(t: TravellerAges & { adults: number }): string {
  const p = classifyTravellers(t);
  return [
    `${p.adults} Adult${p.adults !== 1 ? "s" : ""}`,
    p.children > 0 ? `${p.children} Child${p.children !== 1 ? "ren" : ""}` : null,
    p.infants > 0 ? `${p.infants} Infant${p.infants !== 1 ? "s" : ""}` : null,
  ].filter(Boolean).join(", ");
}
