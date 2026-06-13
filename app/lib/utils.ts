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
