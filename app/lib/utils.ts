import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function toTitleCase(str: string): string {
  return str
    .trim()
    .split(/\s+/)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

// Capitalizes the first letter of each word without trimming or collapsing
// whitespace, so it's safe to apply on every keystroke.
export function capitalizeWords(str: string): string {
  return str.replace(/(^|\s)(\S)/g, (_, sep, ch) => sep + ch.toUpperCase());
}

// Capitalizes only the first character, leaving the rest untouched.
// Safe to apply on every keystroke.
export function capitalizeFirst(str: string): string {
  return str.replace(/^\s*\S/, (ch) => ch.toUpperCase());
}

// Capitalizes the first letter of each sentence and ensures the text ends
// with a full stop (without duplicating one), e.g. for inclusion/exclusion
// list items: "breakfast included" -> "Breakfast included."
export function formatListItem(str: string): string {
  const trimmed = str.trim().replace(/\s+/g, " ");
  if (!trimmed) return trimmed;

  const capitalized = trimmed.replace(
    /(^|[.!?]\s+)([a-z])/g,
    (_, sep, ch) => sep + ch.toUpperCase()
  );

  return /[.!?]$/.test(capitalized) ? capitalized : `${capitalized}.`;
}
