/**
 * Package card marketing bits: the headline "was" price and the category
 * badge. Pure module (no imports, no DB) so both server shapers and client
 * cards can use it.
 */

// ── Standing offer ───────────────────────────────────────────────────────────
//
// A flat 5% "offer" shown on every package card. IMPORTANT: this is a
// DISPLAY-ONLY reference price — it does NOT change what anyone is charged.
// `computePackagePrice` remains the single source of truth for money, and the
// figure the card highlights is still exactly what the package page and
// checkout will charge. We derive the struck-through number by grossing the
// real price UP (price / 0.95) rather than discounting it down, precisely so
// the payable figure never drifts from the engine.
export const PACKAGE_OFFER_PERCENT = 5;

/**
 * Reference ("was") price for a real payable price, or 0 when there isn't a
 * sensible one. Returning 0 makes the card hide the savings row entirely,
 * which is what we want for un-priceable packages.
 */
export function referencePriceFor(payable: number): number {
  if (!Number.isFinite(payable) || payable <= 0) return 0;
  const gross = payable / (1 - PACKAGE_OFFER_PERCENT / 100);
  // Round up to a whole rupee so the strikethrough never renders as a
  // fractional amount next to a clean payable figure.
  return Math.ceil(gross);
}

// ── Category badge ───────────────────────────────────────────────────────────
//
// Category names in the DB are messy — near-duplicates ("Weekend Getaway" vs
// "Weekend Getaways"), CMS artefacts ("# Family Tour Packages"), and long
// variants ("Family & Weekend Getaways"). Rather than surface that noise on
// cards, match against a small curated set: first keyword hit wins, and a
// package matching nothing simply gets no badge.

export type BadgeColor = 'teal' | 'blue' | 'orange' | 'green' | 'purple' | 'red';

type BadgeRule = { label: string; color: BadgeColor; keywords: string[] };

// Order matters — the most specific/sellable themes are checked first so a
// package tagged both "Honeymoon Tours" and "Weekend Getaway" reads as the
// former, which is the one that actually influences a booking decision.
const BADGE_RULES: BadgeRule[] = [
  { label: 'Honeymoon',       color: 'red',    keywords: ['honeymoon', 'romantic', 'couple'] },
  { label: 'Adventure',       color: 'orange', keywords: ['adventure', 'trek', 'rafting', 'safari'] },
  { label: 'Spiritual',       color: 'purple', keywords: ['spiritual', 'temple', 'pilgrim', 'char dham', 'yatra'] },
  { label: 'Family',          color: 'blue',   keywords: ['family', 'kids', 'children'] },
  { label: 'Weekend Getaway', color: 'teal',   keywords: ['weekend', 'getaway', 'short trip'] },
  { label: 'Hill Station',    color: 'green',  keywords: ['hill station', 'mountain', 'snow'] },
  { label: 'Beach',           color: 'teal',   keywords: ['beach', 'island', 'coastal'] },
  { label: 'Wildlife',        color: 'green',  keywords: ['wildlife', 'jungle', 'national park'] },
  { label: 'Nature',          color: 'green',  keywords: ['nature', 'scenic', 'lake'] },
];

/** Pick one display badge from a package's raw category/tag names. */
export function resolveBadge(
  names: (string | null | undefined)[],
): { label: string; color: BadgeColor } | null {
  const haystack = names
    .filter((n): n is string => !!n)
    // Strip CMS artefacts like a leading "# " before matching.
    .map((n) => n.toLowerCase().replace(/[#_]/g, ' ').trim())
    .join(' | ');
  if (!haystack) return null;

  for (const rule of BADGE_RULES) {
    if (rule.keywords.some((kw) => haystack.includes(kw))) {
      return { label: rule.label, color: rule.color };
    }
  }
  return null;
}
