/**
 * Which leads a partner agency may be given, and where in the day's traffic
 * theirs land.
 *
 * The decisions only — no database, so they can be exercised directly
 * (scripts/test-partner-share.ts). Deciding what a lead manager's settings
 * actually mean is the part worth being able to check.
 */
import type { QuerySource } from "@/app/generated/prisma";

export type PartnerRule = {
  maxGroupSize: number | null;
  /** The only destinations this agency may be given; empty means any. */
  allowedDestinations: string[];
  blockedSources: QuerySource[];
};

export type QualifyingLead = {
  groupSize: number | null;
  destination: string | null;
  source: QuerySource;
};

/**
 * Whether a lead is one this agency may be given at all.
 *
 * Every filter the manager has set must pass; one they have left alone is not
 * an opinion. A lead whose group size we do not know passes a size limit —
 * most leads arrive without one, and treating unknown as too big would starve
 * the agency over a fact the customer simply never gave us.
 */
export function leadQualifies(lead: QualifyingLead, rule: PartnerRule): boolean {
  if (rule.maxGroupSize != null && lead.groupSize != null && lead.groupSize > rule.maxGroupSize) return false;
  if (rule.blockedSources.includes(lead.source)) return false;

  /*
   * The destination allowlist reads the opposite way to the size limit above,
   * on purpose.
   *
   * A size limit is a ceiling: a lead we cannot measure has not been shown to
   * exceed it, so it passes. An allowlist is a statement of what we are
   * willing to sell: a lead with no destination, or one that is not on the
   * list, has not been shown to belong to it, so it does not go. Selling a
   * lead the manager never named is the mistake worth avoiding here.
   */
  if (rule.allowedDestinations.length > 0) {
    const wanted = lead.destination?.trim().toLowerCase();
    if (!wanted) return false;
    if (!rule.allowedDestinations.some((d) => d.trim().toLowerCase() === wanted)) return false;
  }

  return true;
}

/**
 * Whether this lead is the one that lands on the agency, given how many have
 * gone by since their last.
 *
 * The next lead should fall at a random point between gapMin and gapMax after
 * the previous one. Rather than remembering a number drawn in advance, each
 * lead is taken with probability 1/(gapMax - position + 1): a one-in-eight
 * chance at position 7 of a 7..14 window, rising as the window closes, and
 * certain at 14. That is a uniform choice across the window, decided fresh
 * each time, with no counter to keep in step with the database.
 */
export function fallsOnThisLead(position: number, gapMin: number, gapMax: number, roll = Math.random()): boolean {
  if (position < gapMin) return false;
  if (position >= gapMax) return true;
  return roll < 1 / (gapMax - position + 1);
}
