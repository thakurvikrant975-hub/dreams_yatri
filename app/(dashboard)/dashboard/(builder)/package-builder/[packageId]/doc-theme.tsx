"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Document templates & theming
//
// The printed itinerary's look, as data rather than as classes scattered
// through a 3,000-line component. One `DocTheme` object drives every colour
// and both type faces; a *template* is nothing more than a named DocTheme, so
// adding "Corporate" or "Religious" later means adding an object here — no
// second copy of the document, no conditional layout branches.
//
// Two hard constraints shape this file, both inherited from the PDF path:
//
//  1. **Colours are literal hex, never Tailwind theme classes or oklch().**
//     html2canvas-pro (pdfExport.ts) can't resolve this app's oklch() tokens
//     — an inline SVG's stroke comes out blank. See the note on SectionHeader.
//     Anything the document paints has to be a plain #rrggbb string.
//
//  2. **Fonts go through CSS custom properties, not classes.** getComputedStyle
//     resolves var() before html2canvas ever sees it, so a family swap survives
//     the capture. The two vars below are set on the page root by
//     ItineraryDocument and read by the .font-heading rule in PRINT_STYLES.
// ─────────────────────────────────────────────────────────────────────────────

import { createContext, useContext } from "react";

/** The tone strip on a day note. Lives here rather than in ItineraryDocument
 * because the palette owns these colours now — ItineraryDocument re-exports
 * the type and map so existing importers (ExtrasDrawers) don't have to care. */
export type NoteTone = "neutral" | "info" | "success" | "warning" | "error";

export type NoteToneStyle = {
  label: string; bg: string; border: string; ink: string; icon: string;
};

export type DocTheme = {
  /** Page ground. Reads as the stock the document is printed on. */
  paper: string;
  /** Cards that should lift off `paper` — always the lighter of the two. */
  card: string;
  ink: string;
  inkSoft: string;
  inkMuted: string;
  /** Hairline rules and card borders. */
  rule: string;
  /** The document's one loud colour: prices, the inverted stat cell, contact
   * glyphs. Spend it sparingly — that's what makes it read as emphasis. */
  accent: string;
  /** A darker step of `accent`, for text sitting on `accentSoft`. */
  accentInk: string;
  /** Tinted ground for accent-toned chips and badges. */
  accentSoft: string;
  /** Icons that LABEL a section rather than signal anything about it. Kept
   * deliberately quiet — these were once all accent, which spent the loud
   * colour on decoration and left nothing to mark a price or a warning. */
  iconMuted: string;
  /** Ground for a section header's icon badge. */
  iconBadge: string;
  /** Secondary accent for the "included / confirmed" tone. */
  positive: string;
  /** CSS font-family stacks, not class names — see the header note. */
  fontHeading: string;
  fontBody: string;
  notes: Record<NoteTone, NoteToneStyle>;
};

// ── Font stacks ──────────────────────────────────────────────────────────────
//
// Only families the app actually loads (Poppins + Inter, via next/font in the
// root layout) or that ship with every OS. A stack naming an unloaded webfont
// would silently fall back — worse in the PDF than on screen, since there's no
// second chance to re-render once the capture is taken.

export const FONT_STACKS = {
  poppins: 'var(--font-poppins), "Poppins", sans-serif',
  inter:   'var(--font-inter), "Inter", sans-serif',
  georgia: 'Georgia, "Times New Roman", serif',
  system:  '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
} as const;

export type FontKey = keyof typeof FONT_STACKS;

/** Offered in the settings UI. Labelled for a non-technical admin — "Poppins"
 * means nothing to a sales lead, "Poppins — brand display" does. */
export const FONT_CHOICES: { key: FontKey; label: string }[] = [
  { key: "poppins", label: "Poppins — brand display" },
  { key: "inter",   label: "Inter — clean sans" },
  { key: "georgia", label: "Georgia — classic serif" },
  { key: "system",  label: "System default" },
];

// ── Templates ────────────────────────────────────────────────────────────────

/** Tailwind's `gray` ramp and `red` ramp, verbatim. Named so the theme objects
 * below read as design decisions ("rule is gray-200") rather than as hex
 * soup, and so a second template can borrow the same ramp knowingly. */
const GRAY = {
  50: "#F9FAFB", 100: "#F3F4F6", 200: "#E5E7EB", 300: "#D1D5DB", 400: "#9CA3AF",
  500: "#6B7280", 600: "#4B5563", 700: "#374151", 800: "#1F2937", 900: "#111827",
} as const;

const RED = {
  50: "#FEF2F2", 100: "#FEE2E2", 200: "#FECACA", 500: "#EF4444", 600: "#DC2626", 700: "#B91C1C",
} as const;

/** The house template. Neutral gray page, red-500 as the single accent.
 *
 * Replaces an earlier warm-paper palette (#FDFBF7 ground, #c0392b brick
 * accent) that tried to simulate cream stock — it read as a slightly dirty
 * white on screen and printed muddy on anything but premium paper. A true
 * neutral ramp keeps the photography honest, which matters more on a document
 * that is mostly hotel and destination imagery. */
export const CLASSIC: DocTheme = {
  paper: GRAY[50],
  card: "#FFFFFF",
  ink: GRAY[900],
  inkSoft: GRAY[600],
  inkMuted: GRAY[400],
  rule: GRAY[200],
  accent: RED[500],
  accentInk: RED[700],
  accentSoft: RED[50],
  iconMuted: GRAY[400],
  iconBadge: GRAY[100],
  positive: "#059669",
  fontHeading: FONT_STACKS.poppins,
  fontBody: FONT_STACKS.inter,
  notes: {
    neutral:  { label: "Note",      bg: GRAY[50],  border: GRAY[200],  ink: GRAY[600],   icon: GRAY[400] },
    info:     { label: "Info",      bg: "#EFF6FF", border: "#BFDBFE", ink: "#1E40AF", icon: "#3B82F6" },
    success:  { label: "Good",      bg: "#ECFDF5", border: "#A7F3D0", ink: "#065F46", icon: "#059669" },
    warning:  { label: "Heads up",  bg: "#FFFBEB", border: "#FDE68A", ink: "#92400E", icon: "#F59E0B" },
    error:    { label: "Important", bg: RED[50],   border: RED[200],   ink: "#991B1B", icon: RED[500] },
  },
};

/** Every selectable template, keyed by the id stored on the package.
 *
 * Adding a tour-type variant is an entry here plus a DocTheme above — the
 * document component itself never learns the template's name. */
export const TEMPLATES = {
  classic: { label: "Classic", description: "Neutral gray with a red accent. The house default.", theme: CLASSIC },
} as const;

export type TemplateId = keyof typeof TEMPLATES;

export const DEFAULT_TEMPLATE: TemplateId = "classic";

export function isTemplateId(v: unknown): v is TemplateId {
  return typeof v === "string" && v in TEMPLATES;
}

// ── Overrides ────────────────────────────────────────────────────────────────

/** The subset of a theme an admin or exec may retune on top of a template.
 * Deliberately not the whole DocTheme: `ink`/`rule`/`iconBadge` and the note
 * tones are internal consistency, not brand, and letting them drift produces
 * documents that look broken rather than customised. */
export type ThemeOverrides = {
  accent?: string;
  paper?: string;
  ink?: string;
  fontHeading?: FontKey;
  fontBody?: FontKey;
};

const HEX_RE = /^#[0-9A-Fa-f]{6}$/;

/** Builds the theme a document actually renders with: template first, then the
 * company's house overrides, then anything set on the package itself.
 *
 * Every value is validated on the way in. These land in inline `style` props
 * and in a `<style>` block, so an unvalidated string from the database is both
 * a rendering risk and an injection one — a bad hex is dropped, not painted. */
export function resolveDocTheme(
  templateId?: string | null,
  ...overrideLayers: (ThemeOverrides | null | undefined)[]
): DocTheme {
  const base = isTemplateId(templateId) ? TEMPLATES[templateId].theme : CLASSIC;
  const merged: ThemeOverrides = Object.assign({}, ...overrideLayers.map((o) => o ?? {}));

  const theme: DocTheme = { ...base };

  if (merged.accent && HEX_RE.test(merged.accent)) {
    theme.accent = merged.accent;
    // accentInk/accentSoft are derived rather than separately configurable:
    // asking an admin to pick three related reds is how you get a document
    // with a red price and a pink-brown badge that clearly don't match.
    theme.accentInk = shade(merged.accent, -0.35);
    theme.accentSoft = shade(merged.accent, 0.92);
  }
  if (merged.paper && HEX_RE.test(merged.paper)) theme.paper = merged.paper;
  if (merged.ink && HEX_RE.test(merged.ink)) theme.ink = merged.ink;
  if (merged.fontHeading && merged.fontHeading in FONT_STACKS) theme.fontHeading = FONT_STACKS[merged.fontHeading];
  if (merged.fontBody && merged.fontBody in FONT_STACKS) theme.fontBody = FONT_STACKS[merged.fontBody];

  return theme;
}

/** Mixes a hex toward black (amount < 0) or white (amount > 0). Plain sRGB
 * interpolation — not perceptually even, but predictable, dependency-free and
 * good enough for deriving a badge tint and a text shade from one accent. */
function shade(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const target = amount > 0 ? 255 : 0;
  const t = Math.abs(amount);
  const ch = (shift: number) => {
    const c = (n >> shift) & 0xff;
    return Math.round(c + (target - c) * t).toString(16).padStart(2, "0");
  };
  return `#${ch(16)}${ch(8)}${ch(0)}`;
}

// ── Context ──────────────────────────────────────────────────────────────────

/** Defaults to the house template so any consumer rendered outside a provider
 * — a drawer previewing a fragment, a test — still paints correctly instead of
 * throwing or rendering colourless. */
const DocThemeContext = createContext<DocTheme>(CLASSIC);

export function DocThemeProvider({ theme, children }: { theme: DocTheme; children: React.ReactNode }) {
  return <DocThemeContext.Provider value={theme}>{children}</DocThemeContext.Provider>;
}

export function useDocTheme(): DocTheme {
  return useContext(DocThemeContext);
}
