// One spelling of a meal, everywhere.
//
// Two vocabularies met in custom_itineraries.meals and neither won. The
// builder's own toggle chips write labels — "Breakfast", "Dinner". Catalog
// templates (package_itineraries.meals), meal_types.covered_meals and
// itinerary_stays.active_meals all store lowercase keys — "breakfast",
// "dinner". copyPackageIntoDraft copied a template's day straight across
// whenever that day had no hotel to take meals from, so a package built from a
// template arrived with lowercase meals on exactly those days — most often the
// departure day, which has no stay.
//
// What that looked like to an exec: the itinerary document printed the meal
// (it renders whatever is in the array), the edit chips did not (they match on
// the label), and ticking the chip then unticking it removed only the label —
// leaving ["breakfast", "Breakfast"] behind. The meal could not be turned off
// at all. 222 days across 181 packages in production carry a lowercase meal,
// eight of them both spellings of the same one.
//
// A plain module rather than a helper inside action.ts: that file is
// "use server", where every export must be an async function.

/** The labels the builder's meal chips use — the spelling that wins. */
export const MEAL_LABELS = ["Breakfast", "Lunch", "Dinner", "Tea & Snacks"] as const;

/** Lowercase keys the catalog and hotel tables use, mapped to those labels. */
const KEY_TO_LABEL: Record<string, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  "tea & snacks": "Tea & Snacks",
  tea: "Tea & Snacks",
  snacks: "Tea & Snacks",
  morning_snacks: "Tea & Snacks",
  evening_snacks: "Tea & Snacks",
};

/**
 * Canonicalises a day's meals to the builder's labels and drops duplicates.
 *
 * Case-insensitive on the way in, so it repairs a row as well as preventing
 * one: run over ["breakfast", "Breakfast", "dinner"] it yields
 * ["Breakfast", "Dinner"]. Anything it does not recognise is passed through
 * trimmed rather than dropped — an unknown meal is still someone's data, and
 * silently eating it would be a worse bug than the one this fixes.
 */
export function normalizeMealLabels(meals: readonly string[] | null | undefined): string[] {
  if (!meals?.length) return [];
  const out: string[] = [];
  for (const raw of meals) {
    const trimmed = typeof raw === "string" ? raw.trim() : "";
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    const label = KEY_TO_LABEL[key]
      ?? MEAL_LABELS.find((m) => m.toLowerCase() === key)
      ?? trimmed;
    if (!out.some((m) => m.toLowerCase() === label.toLowerCase())) out.push(label);
  }
  return out;
}
