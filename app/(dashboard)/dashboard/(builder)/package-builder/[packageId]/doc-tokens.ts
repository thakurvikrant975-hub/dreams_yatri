// ─────────────────────────────────────────────────────────────────────────────
// Document design tokens
//
// Their own module so both the document and the builder chrome that sits
// inside it (DaySectionsBar) can use them. They used to live in
// ItineraryDocument, which imports DayActionsMenu — importing them back the
// other way would have closed a cycle.
//
// The palette itself moved on to doc-theme-data.ts once the document became
// templatable: a colour is no longer a constant, it's whatever the package's
// template and overrides resolve to. Components inside the document should
// therefore read `useDocTheme()`, NOT the `DOC` re-exported below.
// ─────────────────────────────────────────────────────────────────────────────

// The data module rather than doc-theme.tsx — this file carries no "use client"
// of its own, and importing from the client module would drag every consumer of
// these tokens across that boundary too.
import { CLASSIC } from "./doc-theme-data";

/** The house palette as a plain object, for the handful of call sites that
 * genuinely can't use the hook — module-level constants and anything rendered
 * outside a DocThemeProvider. Inside the document, prefer `useDocTheme()`, or
 * a package on a non-default template will paint one stray classic-red edge. */
export const DOC = CLASSIC;

/** The document's full-width "add something here" control. One shape for every
 * one of them, so the package-level menu and each day's read as the same
 * offer at two altitudes. */
export const ADD_CONTROL_CLASS =
  "builder-only no-print w-full flex items-center justify-center gap-1.5 rounded-lg " +
  "border border-dashed px-3 py-2.5 text-[11px] font-medium transition-colors " +
  "hover:bg-dashboard-primary/6";
