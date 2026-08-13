"use client";

<<<<<<< HEAD
// Context/Provider only — the theme data and pure functions (DocTheme,
// TEMPLATES, isTemplateId, resolveDocTheme, ...) live in doc-theme-core.tsx so
// server code can import them without a "use client" boundary. Re-exported
// here so existing client importers don't need to change their import path.
export * from "./doc-theme-core";

import { createContext, useContext } from "react";
import { CLASSIC, type DocTheme } from "./doc-theme-core";
=======
// ─────────────────────────────────────────────────────────────────────────────
// The DocTheme context — the React half of the theming setup.
//
// The palette itself, the templates, the override resolver and `isTemplateId`
// all live in ./doc-theme-data, which carries no "use client" directive. That
// split is load-bearing: this file's context makes everything exported from it
// a client reference, and a Server Action calling one of those gets a proxy
// rather than a function. Server code imports ./doc-theme-data directly.
//
// Everything from that module is re-exported here so existing client importers
// (ItineraryDocument, DocumentThemeCard, DayActionsMenu) need no change — a
// Client Component may import from either side.
// ─────────────────────────────────────────────────────────────────────────────

import { createContext, useContext } from "react";
import { CLASSIC, type DocTheme } from "./doc-theme-data";

export * from "./doc-theme-data";
>>>>>>> 9dbe7e84f2c144511dbdfaa0bfdf3cfc7631426d

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
