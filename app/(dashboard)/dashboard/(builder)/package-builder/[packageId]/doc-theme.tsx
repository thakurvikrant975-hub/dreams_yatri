"use client";

// Context/Provider only — the theme data and pure functions (DocTheme,
// TEMPLATES, isTemplateId, resolveDocTheme, ...) live in doc-theme-core.tsx so
// server code can import them without a "use client" boundary. Re-exported
// here so existing client importers don't need to change their import path.
export * from "./doc-theme-core";

import { createContext, useContext } from "react";
import { CLASSIC, type DocTheme } from "./doc-theme-core";

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
