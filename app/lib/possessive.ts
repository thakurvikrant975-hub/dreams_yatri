/**
 * "Suraj Kumar" → "Suraj's".
 *
 * First name only: the phrases this appears in read as spoken ones — "Suraj's
 * / Bikaner Desert Safari" across a cover — and a full legal name there sounds
 * like a form field rather than a trip someone is about to take.
 *
 * A name already ending in s takes the bare apostrophe ("Chris'"), which is the
 * convention the client is most likely to see their own name written in.
 *
 * Its own module rather than a helper inside ItineraryDocument, which is where
 * it started: the booking review shows the same lockup, and importing it from
 * there would pull a 4,500-line client component into that page's bundle for
 * four lines of string handling.
 */
export function possessive(name: string): string {
  const first = name.trim().split(/\s+/)[0] ?? "";
  if (!first) return "";
  return /s$/i.test(first) ? `${first}'` : `${first}'s`;
}
