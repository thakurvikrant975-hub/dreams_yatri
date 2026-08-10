// ─────────────────────────────────────────────────────────────────────────────
// Document design tokens
//
// Their own module so both the document and the builder chrome that sits
// inside it (DaySectionsBar) can use them. They used to live in
// ItineraryDocument, which imports DayActionsMenu — importing them back the
// other way would have closed a cycle.
// ─────────────────────────────────────────────────────────────────────────────

/** The printed document's palette, as literal hex rather than Tailwind theme
 * classes. Two reasons this can't just use `bg-primary-600` and friends:
 *
 *  1. html2canvas-pro (the PDF export path) can't reliably resolve this app's
 *     oklch() theme tokens — the same limitation documented on SectionHeader's
 *     icon colour, which this centralises.
 *  2. The document is a *printed* artefact, not a screen surface. It wants a
 *     warm paper ground rather than the UI's pure #fff, so it deliberately
 *     doesn't inherit the dashboard's neutral ramp.
 *
 * `accent` is this app's established rgb fallback for --color-primary-600
 * (see the .prose-editor/.prose-article rules in globals.css). */
export const DOC = {
  /** Warm off-white page ground — reads as paper stock, not screen. */
  paper: "#FDFBF7",
  /** Pure white, reserved for cards that should lift off the paper. */
  card: "#FFFFFF",
  ink: "#191817",
  inkSoft: "#57534E",
  inkMuted: "#8C857D",
  /** Warm hairline, tuned to sit on `paper` without going grey-blue. */
  rule: "#E9E3DA",
  accent: "#c0392b",
  accentSoft: "#FBF1EF",
  /** Secondary accent for the "included / confirmed" tone. */
  positive: "#059669",
} as const;

/** The document's full-width "add something here" control. One shape for every
 * one of them, so the package-level menu and each day's read as the same
 * offer at two altitudes. */
export const ADD_CONTROL_CLASS =
  "builder-only no-print w-full flex items-center justify-center gap-1.5 rounded-lg " +
  "border border-dashed px-3 py-2.5 text-[11px] font-medium transition-colors " +
  "hover:bg-dashboard-primary/6";
