// Pure logic for the Seasonal Rate Calendar — no React, no DOM, so every rule
// here (overlap trimming, rate grouping, color assignment, rate resolution)
// can be unit tested against plain arrays independent of the UI.

export interface RateSeasonBase {
  id: string;
  /** Which room type / vehicle type / other priceable item this override
   * belongs to — seasons are never shared across a whole property's
   * inventory, only ever scoped to one item. */
  itemId: string;
  /** Optional display name, e.g. "Peak — Christmas". Falls back to the date
   * range itself wherever it's shown. */
  label?: string;
  /** "YYYY-MM-DD" — inclusive. */
  startDate: string;
  /** "YYYY-MM-DD" — inclusive. */
  endDate: string;
  /** Hex or hsl() string — 1:1 with `rate` within one item's seasons. */
  color: string;
  rate: number;
}

// ── Date helpers ─────────────────────────────────────────────────────────────
// Plain "YYYY-MM-DD" strings sort/compare correctly with normal string
// operators, so most of this file never needs to touch a Date object at all —
// only day-before/day-after arithmetic does.

export function dayAfter(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

export function dayBefore(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

export function rangesOverlap(
  a: { startDate: string; endDate: string },
  b: { startDate: string; endDate: string },
): boolean {
  return a.startDate <= b.endDate && b.startDate <= a.endDate;
}

// ── Overlap trimming ─────────────────────────────────────────────────────────

/**
 * Adjusts every OTHER season for the same item that overlaps `newRange` so
 * dates never overlap after a save — never blocks, always auto-resolves:
 *   - fully inside the new range      → dropped entirely
 *   - new range fully inside it       → split into a before-piece and an
 *                                        after-piece (new ids, same
 *                                        label/color/rate)
 *   - overlaps only one side          → that side is trimmed back
 * `excludeId` is the id of the season currently being edited (if any) — it's
 * skipped here since the caller replaces it outright with the new values.
 * `makeId` generates a fresh id for the pieces a split produces.
 */
export function trimOverlaps<T extends RateSeasonBase>(
  existingSeasonsForItem: T[],
  newRange: { startDate: string; endDate: string },
  excludeId: string | undefined,
  makeId: () => string,
): T[] {
  const result: T[] = [];
  for (const s of existingSeasonsForItem) {
    if (excludeId && s.id === excludeId) continue;
    if (!rangesOverlap(s, newRange)) {
      result.push(s);
      continue;
    }
    const startsBeforeNew = s.startDate < newRange.startDate;
    const endsAfterNew = s.endDate > newRange.endDate;
    if (startsBeforeNew && endsAfterNew) {
      // New range sits entirely inside this season — split around it.
      result.push({ ...s, id: makeId(), endDate: dayBefore(newRange.startDate) });
      result.push({ ...s, id: makeId(), startDate: dayAfter(newRange.endDate) });
    } else if (startsBeforeNew) {
      // Overlaps only the tail end of this season — trim it back.
      result.push({ ...s, endDate: dayBefore(newRange.startDate) });
    } else if (endsAfterNew) {
      // Overlaps only the front of this season — trim it forward.
      result.push({ ...s, startDate: dayAfter(newRange.endDate) });
    }
    // else: fully contained within the new range — dropped.
  }
  return result;
}

// ── Grouping by rate ─────────────────────────────────────────────────────────

export interface RateGroup<T extends RateSeasonBase> {
  rate: number;
  color: string;
  label?: string;
  entries: T[];
}

/** One card per distinct rate, every date range for that rate listed under
 * it — color and label come from whichever entry has them (they're 1:1 with
 * rate within one item by construction). Sorted highest rate first. */
export function groupSeasonsByRate<T extends RateSeasonBase>(seasonsForItem: T[]): RateGroup<T>[] {
  const groups = new Map<number, RateGroup<T>>();
  for (const s of seasonsForItem) {
    let group = groups.get(s.rate);
    if (!group) {
      group = { rate: s.rate, color: s.color, label: s.label, entries: [] };
      groups.set(s.rate, group);
    } else if (!group.label && s.label) {
      group.label = s.label;
    }
    group.entries.push(s);
  }
  return Array.from(groups.values())
    .map((g) => ({ ...g, entries: [...g.entries].sort((a, b) => (a.startDate < b.startDate ? -1 : 1)) }))
    .sort((a, b) => b.rate - a.rate);
}

// ── Rate resolution ──────────────────────────────────────────────────────────

/** The effective price for one item on one date — the season covering that
 * date if one exists, else the item's own base rate. */
export function resolveRate<T extends RateSeasonBase>(
  seasonsForItem: T[],
  onDate: string,
  baseRate: number,
): number {
  const match = seasonsForItem.find((s) => s.startDate <= onDate && onDate <= s.endDate);
  return match ? match.rate : baseRate;
}

// ── Color ↔ rate locking ─────────────────────────────────────────────────────

/** Hand-picked, visually distinct first — only overflows into generated hues
 * once every curated color is already claimed by a different rate. */
export const CURATED_PALETTE = [
  "#f97316", // orange
  "#14b8a6", // teal
  "#eab308", // gold
  "#3b82f6", // blue
  "#ef4444", // red
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#22c55e", // green
];

/** Deterministic overflow palette — rotates hue by a fixed step so it never
 * runs out, no matter how many distinct prices a single item ends up with. */
export function generatedColor(index: number): string {
  const hue = (index * 47) % 360;
  return `hsl(${hue}, 70%, 45%)`;
}

export interface ColorAssignment {
  /** True when `rate` already belongs to a different season of this item —
   * the color is fixed to whatever that rate already uses. */
  locked: boolean;
  lockedColor?: string;
  /** Colors safe to offer for a new rate — already-claimed colors are
   * excluded outright, not just greyed out. */
  availableColors: string[];
  /** How many curated colors were hidden because another rate already owns them. */
  hiddenCount: number;
}

/**
 * Given the rate currently typed into the add/edit form and every OTHER
 * season belonging to the same item (i.e. excluding the one being edited),
 * works out whether the color should be locked to an existing rate's color,
 * or which colors are still free to assign to a new rate.
 */
export function resolveColorOptions(
  rate: number | null,
  otherSeasonsForItem: RateSeasonBase[],
): ColorAssignment {
  const rateToColor = new Map<number, string>();
  const usedColors = new Set<string>();
  for (const s of otherSeasonsForItem) {
    if (!rateToColor.has(s.rate)) rateToColor.set(s.rate, s.color);
    usedColors.add(s.color);
  }

  if (rate != null && rateToColor.has(rate)) {
    const color = rateToColor.get(rate)!;
    return { locked: true, lockedColor: color, availableColors: [color], hiddenCount: 0 };
  }

  // Grow the palette with generated colors until at least one is unclaimed.
  const palette = [...CURATED_PALETTE];
  let i = 0;
  while (palette.every((c) => usedColors.has(c)) && i < 64) {
    palette.push(generatedColor(CURATED_PALETTE.length + i));
    i++;
  }
  const availableColors = palette.filter((c) => !usedColors.has(c));
  const hiddenCount = palette.length - availableColors.length;
  return { locked: false, availableColors, hiddenCount };
}

// ── Misc ─────────────────────────────────────────────────────────────────────

export function formatDateLabel(iso: string): string {
  if (!iso) return "";
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
}

/** "1 Jan 2026 – 22 Feb 2026" — the fallback shown wherever a season has no label. */
export function defaultRangeLabel(startDate: string, endDate: string): string {
  return `${formatDateLabel(startDate)} – ${formatDateLabel(endDate)}`;
}
