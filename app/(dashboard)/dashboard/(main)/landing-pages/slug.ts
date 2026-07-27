// Plain utility, deliberately NOT in actions.ts — that file has "use server",
// which requires every export to be an async Server Action. slugify is pure
// sync string manipulation with no DB access, so it lives here instead and
// is imported directly by both the client editor (on every keystroke) and
// the server action (for validation), rather than round-tripping to the
// server for something that never needed one.

/** Lowercase, hyphenated, alnum-only — matches the /offers/[slug] path segment. */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}
